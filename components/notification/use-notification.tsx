import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { API } from '../../constants/backend'; // adjust path to match your project

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

const POLL_INTERVAL_MS = 2000; // "real time" via polling — bump up/down as needed
const NOTIFICATION_SOUND = require('../../assets/sound/notification.mp3'); // add your own sound file here

// Reads the logged-in student's id out of AsyncStorage.
// Adjust this if your `user` object is shaped differently.
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

/*
|--------------------------------------------------------------------------
| PROVIDER — mount this ONCE near the root of the app (e.g. app/_layout.tsx)
|--------------------------------------------------------------------------
| Everything that needs notifications (the header badge, the modal list,
| etc.) reads from this single instance via useNotifications() below.
| This is what keeps the poll loop, the "seen ids" tracker, and the sound
| playback to exactly one copy — so a notification only ever plays once.
*/
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<QueueNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const isPollingRef = useRef(false); // guards against overlapping polls

  // Load the notification sound once
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

  const playSound = useCallback(async () => {
    try {
      const sound = soundRef.current;
      if (!sound) return;
      // A single replayAsync() call (stop + seek-to-0 + play in one native
      // bridge round-trip) fires much closer to the badge/number update
      // than doing stopAsync -> setPositionAsync -> playAsync separately.
      await sound.replayAsync();
    } catch {
      // ignore playback errors (e.g. silent mode)
    }
  }, []);

  const poll = useCallback(async () => {
    if (isPollingRef.current) return; // skip if a poll is already in flight
    isPollingRef.current = true;

    try {
      const student_id = await getStudentId();
      if (!student_id) return;

      const res = await fetch(API.checkNotifications, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id }),
      });
      const data = await res.json();

      if (!data.success) return;

      const incoming: QueueNotification[] = data.notifications;

      // Detect genuinely new notification ids since the last poll
      const newOnes = incoming.filter((n) => !seenIdsRef.current.has(n.id));
      incoming.forEach((n) => seenIdsRef.current.add(n.id));

      if (newOnes.length > 0 && !isFirstLoadRef.current) {
        playSound(); // fires exactly once per poll, regardless of how many new items
      }
      isFirstLoadRef.current = false;

      setNotifications(incoming);
      setUnreadCount(data.unread_count);
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

  // Poll on mount, then on an interval — this is the ONLY interval in the app
  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/*
|--------------------------------------------------------------------------
| HOOK — same name/shape as before, so NotificationModal.tsx and
| app-header.tsx don't need to change. Just reads from the Provider above.
|--------------------------------------------------------------------------
*/
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