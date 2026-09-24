/*
|--------------------------------------------------------------------------
| Push / alarm plumbing (works when the app is backgrounded OR killed)
|--------------------------------------------------------------------------
| Everything that must survive the app being closed lives here:
|   - Android notification channels (MAX importance, DND bypass)
|   - permission request + Expo push token retrieval
|   - token registration for BOTH students and parents
|
| Delivery while closed is ONLY possible through the server push
| (Expo -> FCM / APNs). JS timers are killed with the app, so polling can
| never be the delivery mechanism - it is just a UI sync.
*/
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { API } from '../../constants/backend';

export const CHANNEL_ALARM = 'proceed_alert';
export const CHANNEL_DEFAULT = 'default';

const TOKEN_CACHE_KEY = 'push_token_registered_for';

export type PushOwner = { role: 'student' | 'parent'; id: number };

export function isExpoGo(): boolean {
  const ownership = (Constants as any).appOwnership;
  const env = (Constants as any).executionEnvironment;
  return ownership === 'expo' || env === 'storeClient';
}

/** MAX-importance channels. Must exist BEFORE the first push arrives. */
export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ALARM, {
    name: 'Your Turn — Proceed Now',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 1200],
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    lightColor: '#660810',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
    name: 'Queue Updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'default',
    enableVibrate: true,
  });

  // Legacy channel kept so older server builds still ring loudly.
  await Notifications.setNotificationChannelAsync('proceed', {
    name: 'Proceed Alerts (legacy)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    bypassDnd: true,
  });
}

/** Ask for permission (Android 13+ needs the runtime POST_NOTIFICATIONS prompt). */
export async function ensurePermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  if (isExpoGo()) return null; // Expo Go has no Android push since SDK 53
  if (!Device.isDevice) return null; // emulators never receive real pushes

  if (!(await ensurePermission())) return null;
  await ensureAndroidChannels();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data ?? null;
  } catch (err) {
    console.warn('getExpoPushTokenAsync failed:', err);
    return null;
  }
}

/**
 * Register (or refresh) this device's push token for the signed-in user.
 * Safe to call on every launch, after every login, and on token rotation.
 */
export async function registerPushToken(owner: PushOwner): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  const cacheKey = `${owner.role}:${owner.id}:${token}`;
  const cached = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
  if (cached === cacheKey) return token; // already registered on this server

  try {
    const res = await fetch(API.registerPushToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // new generic fields
        owner_type: owner.role,
        owner_id: owner.id,
        role: owner.role,
        // legacy field kept so an older API build keeps working
        student_id: owner.role === 'student' ? owner.id : 0,
        parent_id: owner.role === 'parent' ? owner.id : 0,
        push_token: token,
        platform: Platform.OS,
      }),
    });
    const ok = res.ok;
    if (ok) await AsyncStorage.setItem(TOKEN_CACHE_KEY, cacheKey);
    return token;
  } catch (err) {
    console.warn('registerPushToken failed:', err);
    return null;
  }
}

/** Call on logout so the device stops receiving the previous user's alarms. */
export async function unregisterPushToken(owner: PushOwner): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
  await AsyncStorage.removeItem(TOKEN_CACHE_KEY);
  if (!token) return;
  try {
    await fetch(API.registerPushToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unregister',
        owner_type: owner.role,
        owner_id: owner.id,
        push_token: token.split(':').slice(2).join(':'),
      }),
    });
  } catch {
    // best effort
  }
}
