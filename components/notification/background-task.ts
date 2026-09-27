/*
|--------------------------------------------------------------------------
| Background notification task (Android) + background sync fallback
|--------------------------------------------------------------------------
| 1. BACKGROUND_NOTIFICATION_TASK runs when a push arrives while the app is
|    backgrounded or KILLED. It lets us re-post a loud, alarm-channel
|    notification even if the server sent a silent/data-only payload.
| 2. BACKGROUND_SYNC_TASK is an OS-scheduled safety net (~15 min minimum,
|    never exact). It catches the case where a push was dropped. It is a
|    backup only - the push is the real delivery path.
|
| IMPORTANT: this file must be imported at the TOP of app/_layout.tsx so the
| task is defined before the JS bundle finishes loading in a headless start.
*/
import { Platform } from 'react-native';

import { CHANNEL_ALARM, CHANNEL_DEFAULT, getNotifications, isExpoGo } from './push';

// expo-task-manager is safe in Expo Go; expo-notifications is loaded lazily
// through getNotifications() so Expo Go never prints the SDK 53 push warning.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TaskManager = require('expo-task-manager');

export const BACKGROUND_NOTIFICATION_TASK = 'UNIQUEUE_BG_NOTIFICATION';

const ALARM_TYPES = ['next_in_line', 'called', 'in_progress'];

function isAlarm(type?: string | null) {
  return ALARM_TYPES.includes(String(type ?? '').toLowerCase());
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.warn('BG notification task error:', error);
    return;
  }
  try {
    const payload =
      data?.notification?.data?.body ?? // Android FCM shape
      data?.body ??                     // iOS shape
      {};
    const content = data?.notification?.request?.content ?? {};
    const extra = payload?.data ?? content?.data ?? payload ?? {};

    // Only re-post when the push carried no visible notification
    // (data-only). Visible pushes are already shown by the OS.
    const hasVisible = Boolean(content?.title || payload?.title);
    if (hasVisible) return;

    const N = getNotifications();
    if (!N) return;

    await N.scheduleNotificationAsync({
      content: {
        title: extra?.title ?? "It's your turn",
        body: extra?.message ?? 'Please proceed to the window.',
        sound: isAlarm(extra?.type) ? 'alarm.wav' : 'notify.wav',
        priority: N.AndroidNotificationPriority.MAX,
        data: extra,
      },
      trigger:
        Platform.OS === 'android'
          ? ({ channelId: isAlarm(extra?.type) ? CHANNEL_ALARM : CHANNEL_DEFAULT } as any)
          : null,
    });
  } catch (err) {
    console.warn('BG notification task failed:', err);
  }
});

/** Registers the headless push handler. Call once at startup. */
export async function registerBackgroundNotificationTask(): Promise<void> {
  const N = getNotifications();
  if (!N || isExpoGo()) return; // no background push in Expo Go
  try {
    await N.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    console.warn('registerTaskAsync failed:', err);
  }
}
