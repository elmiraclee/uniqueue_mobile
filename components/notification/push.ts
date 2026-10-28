import { clientFetch } from '@/utils/client-fetch';
/*
|--------------------------------------------------------------------------
| Push / alarm plumbing (works when the app is backgrounded OR killed)
|--------------------------------------------------------------------------
| Everything that must survive the app being closed lives here:
|   - Android notification channels (MAX importance, DND bypass)
|   - permission request + Expo push token retrieval
|   - token registration for BOTH students and parents
|
| NOTE ON EXPO GO:
| expo-notifications is loaded LAZILY (require() inside functions, never a
| top-level import). Importing it inside Expo Go prints the scary
| "Android Push notifications ... removed from Expo Go with SDK 53"
| message even if you never call it. Lazy loading + the isExpoGo() guards
| below keep the console clean. Remote push simply does not exist in
| Expo Go - you MUST use a development build or an EAS build to test it.
*/
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { isRunningInExpoGo, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { API } from "../../constants/backend";

/*
| IMPORTANT: an Android channel's sound is LOCKED the moment the channel is
| first created. Changing the sound therefore needs a NEW channel id -
| that is why these end in _v5. Bump the id again whenever channel behavior
| or the audio file changes, and add the old id to LEGACY_CHANNELS below.
*/
export const CHANNEL_ALARM = "proceed_alert_v5";
export const CHANNEL_DEFAULT = "queue_updates_v5";

/** Old channels to delete so the user doesn't see duplicates in Settings. */
const LEGACY_CHANNELS = [
  "proceed_alert_v4",
  "queue_updates_v4",
  "proceed_alert_v3",
  "queue_updates_v3",
  "proceed_alert_v2",
  "queue_updates_v2",
  "proceed_alert",
  "proceed",
  "default",
];

/*
| Sound files live in assets/sounds/ and are compiled into the app by the
| expo-notifications plugin (see app.json -> plugins -> sounds).
*/
const ALARM_SOUND = "alarm.wav";
const NOTIFY_SOUND = "notify.wav";

const TOKEN_CACHE_KEY = "push_token_registered_for";

export type PushOwner = { role: "student" | "parent"; id: number };

export function isExpoGo(): boolean {
  // SDK 58's official detector does not depend on deprecated ownership fields.
  return isRunningInExpoGo()
    || Constants.appOwnership === "expo"
    || Constants.executionEnvironment === "storeClient";
}

let notificationsModule: typeof import("expo-notifications") | null | undefined;

/**
 * Do not evaluate expo-notifications in Expo Go or a stale native build.
 * SDK 58 eagerly requires these native modules when its JS index loads.
 * Returning null disables system notifications, NOT the API/in-app feed.
 */
export function getNotifications(): typeof import("expo-notifications") | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (isExpoGo() || Platform.OS === "web") {
    notificationsModule = null;
    return null;
  }
  const requiredModules = [
    "NotificationsServerRegistrationModule",
    "ExpoPushTokenManager",
    "ExpoNotificationsHandlerModule",
    "ExpoNotificationsEmitter",
    "ExpoNotificationScheduler",
    "ExpoNotificationPresenter",
    "ExpoNotificationPermissionsModule",
    "ExpoNotificationChannelManager",
    "ExpoNotificationChannelGroupManager",
    "ExpoNotificationCategoriesModule",
    "ExpoBadgeModule",
    "ExpoBackgroundNotificationTasksModule",
    ...(Platform.OS === "android" ? ["ExpoTopicSubscriptionModule"] : []),
  ];
  try {
    const missing = requiredModules.filter(name => !requireOptionalNativeModule(name));
    if (missing.length) {
      console.warn(
        "[UniQueue] System notifications are disabled in this native build. "
        + "Rebuild/install the SDK 58 development app. Missing modules: "
        + missing.join(", "),
      );
      notificationsModule = null;
      return null;
    }
    // Only evaluate the package after confirming native support.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications");
    return notificationsModule ?? null;
  } catch (error) {
    console.warn("[UniQueue] System notifications could not load; rebuild the native app.", error);
    notificationsModule = null;
    return null;
  }
}

function getDevice(): typeof import("expo-device") | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-device");
  } catch {
    return null;
  }
}

/** MAX-importance channels. Must exist BEFORE the first push arrives. */
export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  const N = getNotifications();
  if (!N) return;

  // Remove the old channels first so Settings stays clean.
  for (const id of LEGACY_CHANNELS) {
    try {
      await N.deleteNotificationChannelAsync(id);
    } catch {
      // channel may not exist - fine
    }
  }

  await N.setNotificationChannelAsync(CHANNEL_ALARM, {
    name: "Your Turn — Proceed Now",
    importance: N.AndroidImportance.MAX,
    // Long vibration loop while the alarm sound plays.
    vibrationPattern: [
      0, 800, 400, 800, 400, 800, 400, 1200, 400, 800, 400, 800, 400, 1200,
    ],
    sound: ALARM_SOUND,
    enableVibrate: true,
    enableLights: true,
    lightColor: "#660810",
    bypassDnd: true,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });

  await N.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: "Queue Updates",
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    sound: NOTIFY_SOUND,
    enableVibrate: true,
  });
}

/** Ask for permission (Android 13+ needs the runtime POST_NOTIFICATIONS prompt). */
export async function ensurePermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;

  const { status: existing } = await N.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await N.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null; // Expo Go - no remote push since SDK 53

  const Device = getDevice();
  if (Device && !Device.isDevice) return null; // emulators never get pushes

  if (!(await ensurePermission())) return null;
  await ensureAndroidChannels();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  try {
    const { data } = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data ?? null;
  } catch (err) {
    console.warn("getExpoPushTokenAsync failed:", err);
    return null;
  }
}

/**
 * Register (or refresh) this device's push token for the signed-in user.
 * Safe to call on every launch, after every login, and on token rotation.
 */
export async function registerPushToken(
  owner: PushOwner,
): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  const cacheKey = `${owner.role}:${owner.id}:${token}`;

  try {
    const res = await clientFetch(API.registerPushToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_type: owner.role,
        owner_id: owner.id,
        role: owner.role,
        // legacy fields kept so an older API build keeps working
        student_id: owner.role === "student" ? owner.id : 0,
        parent_id: owner.role === "parent" ? owner.id : 0,
        push_token: token,
        platform: Platform.OS,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success !== true) {
      console.warn(
        "Push token registration rejected:",
        res.status,
        body?.message ?? "Invalid server response",
      );
      return null;
    }
    // Always POST once per app launch. The local cache is only used for
    // logout; treating any HTTP 200 as registered previously hid DB errors.
    await AsyncStorage.setItem(TOKEN_CACHE_KEY, cacheKey);
    return token;
  } catch (err) {
    console.warn("registerPushToken failed:", err);
    return null;
  }
}

/** Call on logout so the device stops receiving the previous user's alarms. */
export async function unregisterPushToken(owner: PushOwner): Promise<void> {
  const cached = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
  await AsyncStorage.removeItem(TOKEN_CACHE_KEY);
  if (!cached) return;

  const token = cached.split(":").slice(2).join(":");
  try {
    await clientFetch(API.registerPushToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unregister",
        owner_type: owner.role,
        owner_id: owner.id,
        push_token: token,
      }),
    });
  } catch {
    // best effort
  }
}
