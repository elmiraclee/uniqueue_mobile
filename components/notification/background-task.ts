/** Data-only remote queue pushes are authenticated and freshness-checked before display.
 * Requires a native build and OS background execution permission. Force-stop,
 * battery restrictions and iOS termination can delay/prevent delivery.
 * Defined at module load; registration happens after sign-in. */
import { Platform } from "react-native";
import { getSessionToken } from "../../utils/session-storage";
import { API, API_URL } from "../../constants/backend";
import { AppState } from "react-native";
import { claimQueueEvent } from "../../utils/queue-alerts";

import {
  CHANNEL_ALARM,
  CHANNEL_DEFAULT,
  getNotifications,
  isExpoGo,
} from "./push";
import {
  updateLiveTicketWidget,
} from "../../utils/live-ticket-widget";

// expo-task-manager is safe in Expo Go; expo-notifications is loaded lazily
// through getNotifications() so Expo Go never prints the SDK 53 push warning.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TaskManager = require("expo-task-manager");

export const BACKGROUND_NOTIFICATION_TASK = "UNIQUEUE_BG_NOTIFICATION";

const ALARM_TYPES = ["called", "in_progress"];

function isAlarm(type?: string | null) {
  return ALARM_TYPES.includes(String(type ?? "").toLowerCase());
}

TaskManager.defineTask(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }: any) => {
    if (error) {
      console.warn("BG notification task error:", error);
      return;
    }
    try {
      const content = data?.notification?.request?.content ?? {};
      const raw = data?.data?.dataString ?? data?.dataString ?? data?.notification?.data?.body ?? data?.body ?? data?.data ?? content?.data ?? {};
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const extra = parsed?.data ?? parsed;
      if(AppState.currentState==='active')return;
      const token=await getSessionToken();
      if(!token || Number(extra?.ticket_id)<=0)return;
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
      try {
        const response=await fetch(API_URL+'/verify_queue_alert.php',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({event_id:extra.event_id}),signal:controller.signal});
        const verified=await response.json();
        if(!response.ok || !verified?.success || await getSessionToken()!==token)return;
      } finally {clearTimeout(timer);}


      if(!await claimQueueEvent(extra))return;

      // Keep the home-screen ticket current even when the app UI is asleep.
      // The native widget performs its own API refresh after this cache update.
      if (Number(extra?.ticket_id) > 0) {
        await updateLiveTicketWidget({
          ticketId: Number(extra.ticket_id),
          ticket: extra?.queue_number,
          office: extra?.office_name,
          window: extra?.window_name,
          status: extra?.type,
        });
      }

      const N = getNotifications();
      if (!N) return;

      if(await getSessionToken()!==token)return;
      await N.scheduleNotificationAsync({
        content: {
          title: extra?.title ?? "It's your turn",
          body: extra?.message ?? "Please proceed to the window.",
          sound: isAlarm(extra?.type) ? "alarm.wav" : "notify.wav",
          priority: N.AndroidNotificationPriority.MAX,
          data: extra,
        },
        trigger:
          Platform.OS === "android"
            ? ({
                channelId: isAlarm(extra?.type)
                  ? CHANNEL_ALARM
                  : CHANNEL_DEFAULT,
              } as any)
            : null,
      });
    } catch (err) {
      console.warn("BG notification task failed:", err);
    }
  },
);

/** Registers the headless push handler. Call once at startup. */
export async function registerBackgroundNotificationTask(): Promise<void> {
  const N = getNotifications();
  if (!N || isExpoGo()) return; // no background push in Expo Go
  try {
    await N.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    console.warn("registerTaskAsync failed:", err);
  }
}
