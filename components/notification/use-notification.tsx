import { clientAlert } from '@/components/client/client-ui';
import { clientFetch, getSessionToken } from '@/utils/client-fetch';
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

// Native currentState may be absent during startup; do not assume foreground.
function currentAppState(): AppStateStatus {
  const state = AppState.currentState;
  switch (state) {
    case 'active': case 'background': case 'inactive': case 'extension':
      return state;
    default:
      return 'unknown';
  }
}

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
import { claimQueueEvent, isFresh, playQueueCue, stopQueueAlarm } from '@/utils/queue-alerts';
import { flushPendingLogout } from '@/utils/session-storage';
import { API_URL } from '@/constants/backend';

export interface QueueNotification {
  id: number;
  event_id?: string;
  expires_at?: number;
  ahead?: number;
  reason?: string;
  ticket_id: number;
  type:
    | 'position_update'
    | 'next_in_line'
    | 'called'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'relationship_unlinked' | 'moved' | 'priority_bump' | 'appointment_bump' | 'conflict_deferred' | 'conflict_resolved' | 'activated' | 'expired' | 'requeued' | 'rejoined' | 'ticket_created' | 'reserved' | 'queue_policy_changed' | 'status_update';
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
    const [raw, role, token] = await Promise.all([
      AsyncStorage.getItem('user'),
      AsyncStorage.getItem('role'),
      getSessionToken(),
    ]);
    // Cached profile data alone is not an authenticated session.
    if (!raw || !token || !['student', 'parent'].includes(role ?? '')) return null;
    const user = JSON.parse(raw);
    const id = Number(user?.id ?? (role === 'parent' ? user?.parent_id : user?.student_id) ?? 0);
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
| Polls in-app events and deduplicates remote push with the same event ID.
| Foreground cues use queue-alerts; background work uses OS notifications.
| Remote data-push needs a native build and remains subject to OS delivery
| restrictions; fully-closed delivery is not guaranteed.
*/
export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<QueueNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const notificationRowsRef = useRef<QueueNotification[]>(notifications);
  notificationRowsRef.current = notifications;
  const readRevision = useRef(0);
  const readBusy = useRef(false);
  const accountKeyRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  // Event IDs already handled in this provider,
  // so a locally-posted alert and the server's push never double-ring.
  const presentedKeysRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const isPollingRef = useRef(false);
  const lastPollWarningRef = useRef<string | null>(null);
  const pushRegisteredRef = useRef(false);
  const foregroundEventRef = useRef<(n: QueueNotification) => Promise<void>>(async () => {});
  const appStateRef = useRef<AppStateStatus>(currentAppState());

  // Foreground cues have one shared owner; suppress duplicate OS presentation.
  useEffect(() => {
    const mods = loadPushModules();
    if (!mods) return;
    const { Notifications } = mods;

    Notifications.setNotificationHandler({
      handleNotification: async (event: any) => {
        const d=event?.request?.content?.data||{};
        const show=currentAppState()!=='active' && isFresh(d) && !!await getSessionToken();
        return { shouldShowAlert: show, shouldPlaySound: show, shouldSetBadge: true, shouldShowBanner: show, shouldShowList: show };
      },
    });

    ensureChannels().catch(() => {});

    // A server push already rang for this event — don't post a local copy.
    const sub = Notifications.addNotificationReceivedListener((event: any) => {
      const raw = event?.request?.content?.data ?? {};
      const data=typeof raw.dataString==='string'?JSON.parse(raw.dataString):raw;
      if(currentAppState()==='active' && data.event_id)void foregroundEventRef.current({ ...data, message:data.message||data.body||'',id:0 });
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
   * Verify a fresh event and claim it once before foreground audio/vibration.
   * If the app backgrounds during verification, use a local OS notification.
   */
  const presentLocalNotification = useCallback(
    async (n: QueueNotification) => {
      if(currentAppState()!=='active' || !isFresh(n))return;
      // Recheck server audience/freshness before presenting remote or polled events.
      if(n.ticket_id){
        try{const check=await clientFetch(API_URL+'/verify_queue_alert.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:n.event_id})});if(!check.ok)return;}catch{return;}
      }
      if(!await claimQueueEvent(n))return;
      if(currentAppState()==='active'){await playQueueCue(n);return;}
      const mods=loadPushModules();if(!mods)return;

      try {
        await mods.Notifications.scheduleNotificationAsync({
          content: {
            title: n.child_name ? `${n.child_name}: ${n.title}` : n.title,
            body: n.message,
            // Android ignores this (the CHANNEL owns the sound); iOS uses it.
            sound: ['called','in_progress'].includes(n.type) ? 'alarm.wav' : 'notify.wav',
            priority: mods.Notifications.AndroidNotificationPriority?.MAX,
            data: {
              event_id: n.event_id, expires_at: n.expires_at, ahead: n.ahead,
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
                  channelId: ['called','in_progress'].includes(n.type) ? CHANNEL_ALARM : CHANNEL_DEFAULT,
                }
              : null,
        } as any);
      } catch (err) {
        console.warn('Local notification failed:', err);
      }
    },
    []
  );

  foregroundEventRef.current = presentLocalNotification;

  const poll = useCallback(async () => {
    const revision = readRevision.current;
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      await flushPendingLogout();
      const session = await getSession();
      if (!session) {stopQueueAlarm();pushRegisteredRef.current=false;setNotifications([]);setUnreadCount(0);accountKeyRef.current=null;seenIdsRef.current.clear();presentedKeysRef.current.clear();isFirstLoadRef.current=true;return;}
      const accountKey=session.role+':'+session.id;
      if(accountKeyRef.current!==accountKey){pushRegisteredRef.current=false;accountKeyRef.current=accountKey;seenIdsRef.current.clear();presentedKeysRef.current.clear();isFirstLoadRef.current=true;setNotifications([]);setUnreadCount(0)}

      // Parents watch their linked children's queues through their own
      // endpoint; students generate + read their own notifications.
      const endpoint = session.role === 'parent' ? API.getParentNotifications : API.checkNotifications;
      const res =
        session.role === 'parent'
          ? await clientFetch(API.getParentNotifications, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parent_id: session.id }),
            })
          : await clientFetch(API.checkNotifications, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ student_id: session.id }),
            });
      const contentType = res.headers.get('content-type') ?? '';
      const responseText = await res.text();

      if (!res.ok || !contentType.toLowerCase().includes('application/json')) {
        // Only display known authentication codes, never raw bodies/tokens.
        let authCode = '';
        if (res.status === 401) {
          try {
            const code = JSON.parse(responseText).code;
            if (['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID', 'AUTH_SESSION_EXPIRED', 'AUTH_ACCOUNT_UNAVAILABLE'].includes(code)) {
              authCode = ` [${code}]`;
            }
          } catch { /* A proxy may return non-JSON errors. */ }
        }
        const warning = `Notification API returned ${res.status}${authCode} (${contentType || 'unknown content type'})`;
        if (lastPollWarningRef.current !== warning) {
          console.warn(`${warning}: ${endpoint}`);
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
      lastPollWarningRef.current = null;
      const currentSession = await getSession();
      if (!currentSession || currentSession.role + ':' + currentSession.id !== accountKey) return;

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
      const candidates = isFirstLoadRef.current
        ? newOnes.filter(n=>!n.is_read && isFresh(n))
            .sort((a,b)=>(['called','in_progress'].includes(b.type)?2:b.type==='next_in_line'?1:0)-(['called','in_progress'].includes(a.type)?2:a.type==='next_in_line'?1:0))
            .filter((n,i,all)=>all.findIndex(other=>other.ticket_id===n.ticket_id)===i)
        : newOnes;
      for (const n of [...candidates].reverse()) await presentLocalNotification(n);
      isFirstLoadRef.current = false;

      if (revision !== readRevision.current) return;
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

  const commitRead = useCallback(async (notificationId?: number) => {
    if (readBusy.current) return;
    readBusy.current = true;
    try {
      const session = await getSession(); if (!session) return;
      const owner = session.role === 'parent' ? { parent_id: session.id } : { student_id: session.id };
      const response = await clientFetch(API.markNotificationsRead, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...owner, ...(notificationId == null ? {} : { notification_id: notificationId }) }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Could not mark notifications read. Please retry.');
      const current = await getSession();
      if (!current || current.role !== session.role || current.id !== session.id) return;
      readRevision.current++;
      const rows = notificationRowsRef.current.map(n => notificationId == null || n.id === notificationId ? { ...n, is_read: true } : n);
      notificationRowsRef.current = rows;
      setNotifications(rows); setUnreadCount(rows.filter(n => !n.is_read).length);
    } catch (error) {
      clientAlert('Notification not updated', error instanceof Error ? error.message : 'Check your connection and retry.');
    } finally { readBusy.current = false; }
  }, []);
  const markAsRead = useCallback((id: number) => commitRead(id), [commitRead]);
  const markAllAsRead = useCallback(() => commitRead(), [commitRead]);

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
    start(currentAppState());

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      if(next!=='active')stopQueueAlarm();
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
