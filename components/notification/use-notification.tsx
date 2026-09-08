import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { API } from '../../constants/backend';

export interface QueueNotification {
  id: number;
  ticket_id: number;
  type:
    | 'position_update'
    | 'next_in_line'
    | 'called'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  title: string;
  message: string;
  queue_number: string;
  office_name: string | null;
  window_name: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL_MS = 2000;
const NOTIFICATION_SOUND = require('../../assets/sound/notification.mp3');

async function getStudentId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id ?? user?.student_id ?? null;
  } catch {
    return null;
  }
}

interface NotificationContextValue {
  notifications: QueueNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

/**
 * Expo Go (SDK 53+) removed Android remote push support.
 * Detect Expo Go so we never import / call expo-notifications push APIs there.
 * In-app proceed modal + alarm + vibration still work via expo-av.
 */
function isExpoGo(): boolean {
  const ownership = (Constants as any).appOwnership;
  const env = (Constants as any).executionEnvironment;
  return ownership === 'expo' || env === 'storeClient';
}

/**
 * Only load expo-notifications outside Expo Go.
 * Importing it in Expo Go triggers a console ERROR about removed remote push.
 */
function loadPushModules(): {
  Notifications: typeof import('expo-notifications');
  Device: typeof import('expo-device');
} | null {
  if (isExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device');
    return { Notifications, Device };
  } catch (err) {
    console.warn('Push modules unavailable:', err);
    return null;
  }
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  const mods = loadPushModules();
  if (!mods) return null;

  const { Notifications, Device } = mods;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (!Device.isDevice && Platform.OS === 'ios') {
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('proceed', {
        name: 'Proceed Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Queue Updates',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data ?? null;
  } catch (err) {
    console.warn('Failed to register for push notifications:', err);
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| PROVIDER — mount this ONCE near the root of the app (e.g. app/_layout.tsx)
|--------------------------------------------------------------------------
| Polls the API for in-app notifications. Remote push only registers when
| running a development / production build (not Expo Go).
*/
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<QueueNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const isPollingRef = useRef(false);
  const lastPollWarningRef = useRef<string | null>(null);
  const pushRegisteredRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(NOTIFICATION_SOUND);
        if (isMounted) {
          soundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (err) {
        console.warn('Notification sound not loaded:', err);
      }
    })();

    return () => {
      isMounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Register Expo push token only on real builds (skipped in Expo Go)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (pushRegisteredRef.current) return;
      if (isExpoGo()) return;

      const student_id = await getStudentId();
      if (!student_id || cancelled) return;

      const token = await registerForPushNotificationsAsync();
      if (!token || cancelled) return;

      try {
        await fetch(API.registerPushToken, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id,
            push_token: token,
            platform: Platform.OS,
          }),
        });
        pushRegisteredRef.current = true;
      } catch (err) {
        console.warn('Failed to save push token:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const playSound = useCallback(async () => {
    try {
      const sound = soundRef.current;
      if (!sound) return;
      await sound.replayAsync();
    } catch {
      // ignore playback errors (e.g. silent mode)
    }
  }, []);

  const poll = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const student_id = await getStudentId();
      if (!student_id) return;

      const res = await fetch(API.checkNotifications, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id }),
      });
      const contentType = res.headers.get('content-type') ?? '';
      const responseText = await res.text();

      if (!res.ok || !contentType.toLowerCase().includes('application/json')) {
        const warning = `Notification API returned ${res.status} (${contentType || 'unknown content type'})`;
        if (lastPollWarningRef.current !== warning) {
          console.warn(`${warning}: ${API.checkNotifications}`);
          lastPollWarningRef.current = warning;
        }
        return;
      }

      let data: {
        success?: boolean;
        notifications?: QueueNotification[];
        unread_count?: number;
      };
      try {
        data = JSON.parse(responseText);
      } catch {
        return;
      }

      if (!data.success) return;

      const incoming = data.notifications ?? [];

      const newOnes = incoming.filter((n) => !seenIdsRef.current.has(n.id));
      incoming.forEach((n) => seenIdsRef.current.add(n.id));

      if (newOnes.length > 0 && !isFirstLoadRef.current) {
        // Soft chime for non-proceed updates. Proceed uses its own
        // looping alarm on the home ProceedModal.
        const hasProceed = newOnes.some(
          (n) => n.type === 'called' || n.type === 'in_progress'
        );
        if (!hasProceed) {
          playSound();
        }
      }
      isFirstLoadRef.current = false;

      setNotifications(incoming);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      console.warn('Notification poll failed:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [playSound]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await poll();
    setLoading(false);
  }, [poll]);

  const markAsRead = useCallback(async (notification_id: number) => {
    const student_id = await getStudentId();
    if (!student_id) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification_id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(API.markNotificationsRead, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, notification_id }),
      });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const student_id = await getStudentId();
    if (!student_id) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await fetch(API.markNotificationsRead, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id }),
      });
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotifications() must be used inside a <NotificationProvider>. ' +
        'Wrap your root layout (e.g. app/_layout.tsx) with it.'
    );
  }
  return ctx;
}
