import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { API } from '../../constants/backend';
import {
  CHANNEL_ALARM,
  CHANNEL_DEFAULT,
  ensureAndroidChannels as ensureChannels,
  getNotifications,
  isExpoGo as detectExpoGo,
  registerPushToken,
} from './push';
import { registerBackgroundNotificationTask } from './background-task';

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
  /** Present only for parent sessions — which child this is about. */
  child_name?: string;
}

/*
|--------------------------------------------------------------------------
| Sound policy
|--------------------------------------------------------------------------
| Alerts use the DEVICE'S NOTIFICATION SOUND, not media playback. Every
| alert is delivered as a real system notification (remote push from the
| server, or a local notification posted by this provider), so Android /
| iOS play the user's own notification tone on the notification stream,
| respect Do Not Disturb settings, and keep showing in the tray while the
| app is in the background or closed. No expo-av / mp3 assets involved.
*/

// Foreground polls stay snappy; backgrounded polls back off so we don't
// hammer the API (and the OS throttles timers there anyway). Real
// closed-app delivery comes from the server's Expo push.
const POLL_INTERVAL_ACTIVE_MS = 2000;
const POLL_INTERVAL_BACKGROUND_MS = 15000;

/** Notification types that should trigger the blocking alarm UI. */
export const ALARM_TYPES = ['next_in_line', 'called', 'in_progress'] as const;

export function isAlarmType(type?: string | null): boolean {
  return (ALARM_TYPES as readonly string[]).includes((type ?? '').toLowerCase());
}

type Session = { role: 'student' | 'parent'; id: number } | null;

/**
 * Who is signed in. Parents must never be polled as students — their
 * parent id would be read as a student id and surface someone else's
 * queue notifications.
 */
async function getSession(): Promise<Session> {
  try {
    const [raw, role] = await Promise.all([
      AsyncStorage.getItem('user'),
      AsyncStorage.getItem('role'),
    ]);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const id = Number(user?.id ?? user?.student_id ?? 0);
    if (!id) return null;
    return { role: role === 'parent' ? 'parent' : 'student', id };
  } catch {
    return null;
  }
}

async function getStudentId(): Promise<number | null> {
  const session = await getSession();
  return session && session.role === 'student' ? session.id : null;
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
 * Only load expo-notifications outside Expo Go (Expo Go has no Android
 * remote push since SDK 53; importing it there logs an error).
 */
function loadPushModules(): {
  Notifications: typeof import('expo-notifications');
} | null {
  const Notifications = getNotifications();
  return Notifications ? { Notifications } : null;
}

/*
|--------------------------------------------------------------------------
| PROVIDER — mount this ONCE near the root of the app (e.g. app/_layout.tsx)
|--------------------------------------------------------------------------
| Polls the API for in-app notifications and posts a real system
| notification for anything new, so the device's own notification sound
| plays whether the app is open, backgrounded, or on the home screen.
| Remote push (server-sent) covers the fully-closed case and only works in
| a development / production build, never in Expo Go.
*/
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<QueueNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const seenIdsRef = useRef<Set<number>>(new Set());
  // `${ticket_id}:${type}` keys already shown as a system notification,
  // so a locally-posted alert and the server's push never double-ring.
  const presentedKeysRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const isPollingRef = useRef(false);
  const lastPollWarningRef = useRef<string | null>(null);
  const pushRegisteredRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Foreground presentation: still show the banner and play the device's
  // notification sound instead of silently swallowing it.
  useEffect(() => {
    const mods = loadPushModules();
    if (!mods) return;
    const { Notifications } = mods;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    ensureChannels().catch(() => {});

    // A server push already rang for this event — don't post a local copy.
    const sub = Notifications.addNotificationReceivedListener((event: any) => {
      const data = event?.request?.content?.data ?? {};
      if (data?.ticket_id && data?.type) {
        presentedKeysRef.current.add(`${data.ticket_id}:${data.type}`);
      }
    });

    return () => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    };
  }, []);

  // Register the Expo push token for BOTH students and parents, retry until
  // a session exists (the user may log in after this provider mounted), and
  // register the headless background task that handles pushes while closed.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let tokenSub: { remove: () => void } | null = null;

    const tryRegister = async () => {
      if (cancelled || pushRegisteredRef.current) return;
      if (detectExpoGo()) return; // no remote push in Expo Go

      const session = await getSession();
      if (!session || cancelled) return; // not logged in yet - retry later

      await ensureChannels();
      await registerBackgroundNotificationTask();

      const token = await registerPushToken(session);
      if (token) {
        pushRegisteredRef.current = true;
        if (timer) clearInterval(timer);
      }
    };

    tryRegister();
    // Login registers immediately; this remains a conservative retry for
    // restored sessions, temporary network failures, or denied permissions.
    timer = setInterval(tryRegister, 10000);

    // Android can rotate the underlying FCM token. Re-register the Expo
    // token immediately instead of waiting for the next app reinstall.
    const N = getNotifications();
    if (N) {
      tokenSub = N.addPushTokenListener(() => {
        pushRegisteredRef.current = false;
        tryRegister();
      });
    }

    // Also re-check whenever the app returns to the foreground (covers
    // permission granted from Settings and rotated tokens).
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') tryRegister();
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      tokenSub?.remove();
      sub.remove();
    };
  }, []);

  /**
   * Post a system notification for a freshly-created queue update.
   * Uses the device notification sound via the channel (Android) or
   * `sound: 'default'` (iOS) — never media playback.
   */
  const presentLocalNotification = useCallback(
    async (n: QueueNotification) => {
      const mods = loadPushModules();
      if (!mods) return;

      const key = `${n.ticket_id}:${n.type}`;
      if (presentedKeysRef.current.has(key)) return;
      presentedKeysRef.current.add(key);

      try {
        await mods.Notifications.scheduleNotificationAsync({
          content: {
            title: n.child_name ? `${n.child_name}: ${n.title}` : n.title,
            body: n.message,
            // Android ignores this (the CHANNEL owns the sound); iOS uses it.
            sound: isAlarmType(n.type) ? 'alarm.wav' : 'notify.wav',
            priority: mods.Notifications.AndroidNotificationPriority?.MAX,
            data: {
              type: n.type,
              ticket_id: n.ticket_id,
              queue_number: n.queue_number,
              office_name: n.office_name,
              window_name: n.window_name,
            },
          },
          trigger:
            Platform.OS === 'android'
              ? {
                  channelId: isAlarmType(n.type) ? CHANNEL_ALARM : CHANNEL_DEFAULT,
                }
              : null,
        } as any);
      } catch (err) {
        console.warn('Local notification failed:', err);
      }
    },
    []
  );

  const poll = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const session = await getSession();
      if (!session) return;

      // Parents watch their linked children's queues through their own
      // endpoint; students generate + read their own notifications.
      const res =
        session.role === 'parent'
          ? await fetch(API.getParentNotifications, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parent_id: session.id }),
            })
          : await fetch(API.checkNotifications, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_id: session.id }),
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

      // The parent endpoint returns read_at instead of is_read and adds
      // the child's name — normalise both shapes here.
      const incoming = (data.notifications ?? []).map((n: any) => ({
        ...n,
        is_read: n.is_read ?? !!n.read_at,
        child_name:
          n.first_name || n.last_name
            ? `${n.first_name ?? ''} ${n.last_name ?? ''}`.trim()
            : undefined,
      })) as QueueNotification[];

      const newOnes = incoming.filter((n) => !seenIdsRef.current.has(n.id));
      incoming.forEach((n) => seenIdsRef.current.add(n.id));

      // Everything new rings through the system notification tray using
      // the device's notification sound. Alarm-worthy updates
      // (next_in_line / called / in_progress) go to the MAX-importance
      // channel; ordinary position updates use the normal one.
      if (newOnes.length > 0 && !isFirstLoadRef.current) {
        for (const n of newOnes) {
          presentLocalNotification(n);
        }
      }
      isFirstLoadRef.current = false;

      setNotifications(incoming);
      setUnreadCount(
        data.unread_count ?? incoming.filter((n) => !n.is_read).length
      );
    } catch (err) {
      console.warn('Notification poll failed:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [presentLocalNotification]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await poll();
    setLoading(false);
  }, [poll]);

  const markAsRead = useCallback(async (notification_id: number) => {
    const session = await getSession();
    if (!session) return;
    const owner = session.role === 'parent' ? { parent_id: session.id } : { student_id: session.id };

    setNotifications((prev) =>
      prev.map((n) => (n.id === notification_id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(API.markNotificationsRead, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...owner, notification_id }),
      });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const session = await getSession();
    if (!session) return;
    const owner = session.role === 'parent' ? { parent_id: session.id } : { student_id: session.id };

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await fetch(API.markNotificationsRead, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(owner),
      });
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    }
  }, []);

  // Poll on a cadence that follows the app state: fast while the student
  // is looking at the app, slow while it's backgrounded, and an immediate
  // catch-up poll the moment it comes back to the foreground.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = (state: AppStateStatus) => {
      if (interval) clearInterval(interval);
      const ms =
        state === 'active' ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_BACKGROUND_MS;
      interval = setInterval(poll, ms);
    };

    poll();
    start(AppState.currentState);

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (next === 'active' && prev !== 'active') {
        poll();
      }
      start(next);
    });

    return () => {
      if (interval) clearInterval(interval);
      sub.remove();
    };
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
