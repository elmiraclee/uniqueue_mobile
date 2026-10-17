import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import FeedbackModal, {
  PendingFeedbackTransaction,
} from "@/components/feedback/feedback-modal";
import CurrentQueueModal from "@/components/queue/current-queue-modal";
import ProceedModal, { ProceedKind } from "@/components/queue/proceed-modal";
import { useNotifications } from "@/components/notification/use-notification";
import UnavailableServicesModal from "@/components/queue/unavailable-services-modal";
import RequeueModal from "@/components/queue/requeue-modal";
import { API, API_URL, ASSET_BASE_URL } from "@/constants/backend";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import AppHeader from "../../components/layout/app-header";
import AnimatedPressable from "../../components/ui/animated-pressable";
import Skeleton from "../../components/ui/skeleton";
import StatusBadge from "../../components/ui/status-badge";
import {
  COLORS,
  ICON_SIZES,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from "../../constants/theme";
import { formatDuration } from "@/utils/format-duration";
import { fetchJsonOrNull } from "@/utils/api";
import {
  clearLiveTicketWidget,
  updateLiveTicketWidget,
} from "@/utils/live-ticket-widget";

interface Office {
  id: number;
  name: string;
  slug: string;
  description: string;
  // Config + capacity — same fields the web dashboard uses so Join can
  // be disabled and a FULL badge shown when the office is at capacity.
  walkin_enabled?: boolean | null;
  appointment_enabled?: boolean | null;
  priority_enabled?: boolean | null;
  daily_capacity?: number | null;
  today_ticket_count?: number;
  is_full?: boolean;
  transaction_type?: string;
  // Today's availability (web get_office_queue_availability()).
  is_open?: boolean;
  can_join?: boolean;
  availability_reason?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  cutoff_time?: string | null;
  is_holiday?: boolean;
}

// OFFICE EVENT — e.g. "Enrollment", shown nested under its office so a
// student can jump straight into the event's step flow instead of the
// regular walk-in/appointment form. Mirrors office_events on the web
// dashboard.
interface OfficeEvent {
  id: number;
  office_id: number;
  name: string;
  description: string | null;
  office_slug: string;
}

const OFFICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  registrar: "document-text-outline",
  scholarship: "ribbon-outline",
  finance: "cash-outline",
  cashier: "cash-outline",
  library: "library-outline",
  clinic: "medkit-outline",
  guidance: "heart-outline",
  it: "desktop-outline",
  admission: "person-add-outline",
  security: "shield-checkmark-outline",
  osa: "people-outline",
  "student-affairs": "people-outline",
};

const POLL_INTERVAL_MS = 3000;

function OfficeCardSkeleton() {
  return (
    <View style={styles.officeCard}>
      <View style={styles.cardTop}>
        <View style={styles.officeIconAndName}>
          <Skeleton width={44} height={44} radius={RADIUS.md} />
          <Skeleton
            width={130}
            height={16}
            style={{ marginLeft: SPACING.md }}
          />
        </View>
        <Skeleton width={54} height={20} radius={RADIUS.full} />
      </View>
      <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.md }}>
        <Skeleton width="90%" height={12} />
        <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.cardFooter}>
        <Skeleton width="100%" height={46} radius={RADIUS.md} />
      </View>
    </View>
  );
}

export default function StudentHome() {
  const [studentName, setStudentName] = useState("");
  const [picture, setPicture] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [dashStats, setDashStats] = useState<{
    open_offices: number;
    total_waiting: number;
    done_today: number;
    est_wait_mins: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentQueue, setCurrentQueue] = useState<any>(null);
  // Live stats for the current ticket (web dashboard: People Ahead,
  // Estimated Wait, Assigned Window, Estimated Call Time).
  const [queueLive, setQueueLive] = useState<any>(null);
  // Every active ticket incl. reserved ones (smart multi-queue, web parity).
  const [allQueues, setAllQueues] = useState<any[]>([]);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [studentId, setStudentId] = useState<number>(0);

  // Requeue prompt — shown when polling reports is_requeued = true for
  // the student's active ticket (see fetchCurrentQueue).
  const [requeueTicket, setRequeueTicket] = useState<any>(null);
  const [showRequeueModal, setShowRequeueModal] = useState(false);
  // Tracks the ticket id already responded to / dismissed this session,
  // so a stale still-requeued poll response right after responding
  // doesn't immediately reopen the modal.
  const respondedRequeueTicketId = useRef<number | null>(null);

  // Alarm modal — vibrates until OK (the sound is the device's own
  // notification tone, played by the system notification).
  // It fires for BOTH stages, matching the web flow:
  //   'next'    -> the student is next in line (people ahead hit 0)
  //   'proceed' -> the ticket is called / in progress
  // Auto-opens once per ticket+stage so pressing OK keeps it closed even
  // while polling still reports the same state.
  const [showProceedModal, setShowProceedModal] = useState(false);
  const [proceedKind, setProceedKind] = useState<ProceedKind>("proceed");
  const acknowledgedProceedKey = useRef<string | null>(null);

  // Queue notifications (shared provider) — used to detect next_in_line.
  const { notifications } = useNotifications();

  // Tracks whether the student currently has an active ticket for each
  // event, keyed by event id — e.g. { [eventId]: true }. This is separate
  // from `currentQueue` (which only covers the regular walk-in/appointment
  // queue) because event tickets live under their own
  // office-queue.php?action=event endpoint with its own active_ticket.
  const [activeEventTickets, setActiveEventTickets] = useState<
    Record<number, boolean>
  >({});

  // The student's most recent completed transaction that hasn't been
  // rated yet, if any. While this is set, joining any queue (regular
  // or event) is blocked and the FeedbackModal is shown instead.
  const [pendingFeedback, setPendingFeedback] =
    useState<PendingFeedbackTransaction | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Parent / Guardian link requests waiting for student approval
  const [parentLinkRequests, setParentLinkRequests] = useState<any[]>([]);
  // Unavailable services (demand-only) + service-need modal
  const [unavailableServices, setUnavailableServices] = useState<any[]>([]);
  const [serviceNeedTarget, setServiceNeedTarget] = useState<any | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    loadUser();
    fetchOffices();
    fetchEvents();

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();

    const interval = setInterval(async () => {
      const user = await AsyncStorage.getItem("user");
      if (!user) return;

      const parsed = JSON.parse(user);
      fetchCurrentQueue(parsed.id);
      fetchActiveEventTickets(parsed.id);
      fetchPendingFeedback(parsed.id);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Refetch the moment this screen regains focus — e.g. coming back from
  // the event step flow after joining/cancelling a queue, or after the
  // event's queue status changed elsewhere. Without this, the student
  // only sees the update once the 3s poll below happens to fire, which
  // can feel like it "needs a reload".
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const user = await AsyncStorage.getItem("user");
        if (!user || cancelled) return;

        const parsed = JSON.parse(user);
        fetchCurrentQueue(parsed.id);
        fetchEvents();
        fetchActiveEventTickets(parsed.id);
        fetchPendingFeedback(parsed.id);
      })();

      return () => {
        cancelled = true;
      };
    }, [events]),
  );

  // Checks, per event, whether the student has an active ticket for it —
  // using the same office-queue.php?action=event endpoint the event flow
  // itself relies on for active_ticket, since that's the real source of
  // truth (currentQueue only tracks the regular walk-in/appointment queue).
  const fetchActiveEventTickets = async (sid: number) => {
    if (!sid || events.length === 0) return;

    try {
      const results = await Promise.all(
        events.map(async (ev) => {
          try {
            const data = await fetchJsonOrNull(
              `${API_URL}/office-queue.php?action=event&event_id=${ev.id}&office_id=${ev.office_id}&student_id=${sid}`,
            );
            return [ev.id, !!(data?.success && data.active_ticket)] as const;
          } catch {
            return [ev.id, false] as const;
          }
        }),
      );

      setActiveEventTickets(Object.fromEntries(results));
    } catch (e) {
      console.log("Fetch Active Event Tickets Error:", e);
    }
  };

  useEffect(() => {
    if (!studentId || events.length === 0) return;
    fetchActiveEventTickets(studentId);
  }, [studentId, events]);

  const loadUser = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (!user) return;

      const parsed = JSON.parse(user);
      setStudentId(parsed.id);
      // Fire-and-forget secondary data
      fetchParentLinkRequests(parsed.id);
      fetchUnavailableServices(parsed.id);
      setStudentName(
        parsed.name ||
          parsed.full_name ||
          `${parsed.first_name ?? ""} ${parsed.last_name ?? ""}`.trim(),
      );
      setPicture(parsed.picture ?? null);
      try {
        const data = await fetchJsonOrNull(
          `${API.getStudentProfile}?student_id=${parsed.id}`,
          undefined,
          "Fetch Student Profile Error",
        );

        if (data?.success) {
          // Prefer uploaded picture; fall back to Google account photo
          // (same resolve order as web resolve_student_avatar).
          const pic =
            data.student.picture || data.student.google_picture || null;
          setPicture(pic);

          await AsyncStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              picture: data.student.picture ?? null,
              google_picture: data.student.google_picture ?? null,
            }),
          );
        }
      } catch (e) {
        console.log(e);
      }

      fetchCurrentQueue(parsed.id);
      fetchPendingFeedback(parsed.id);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchCurrentQueue = async (studentId: number) => {
    try {
      const data = await fetchJsonOrNull(
        API.getCurrentQueue,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId }),
        },
        "Fetch Current Queue Error",
      );
      const queue = data?.success ? data.queue : null;
      setCurrentQueue(queue);
      setAllQueues(data?.success ? data.queues || (queue ? [queue] : []) : []);
      if (queue?.id) {
        fetchJsonOrNull(API.getQueueDetails, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, ticket_id: queue.id }),
        })
          .then((d) => setQueueLive(d?.success ? d.queue : null))
          .catch(() => {});
      } else {
        setQueueLive(null);
      }
      if (queue?.id) {
        updateLiveTicketWidget({
          ticketId: Number(queue.id),
          ticket: queue.queue_number,
          office: queue.office_name,
          window: queue.window_name,
          status: queue.status,
        });
      } else {
        clearLiveTicketWidget();
      }

      // Staff skipped this ticket and it's waiting on the student to
      // respond — show the requeue prompt (mirrors student-dashboard.js
      // on web). Don't re-show it if the student already dismissed it
      // for this exact ticket in this session.
      if (queue?.is_requeued && respondedRequeueTicketId.current !== queue.id) {
        setRequeueTicket(queue);
        setShowRequeueModal(true);
      } else if (!queue?.is_requeued) {
        setShowRequeueModal(false);
      }

      // Alarm modal: "proceed now" when called / in_progress, and
      // "you're next" as soon as the ticket reaches the front of the line
      // (status 'next'). Stays closed after OK for that same stage.
      const status = (queue?.status || "").toLowerCase();
      if (queue && (status === "called" || status === "in_progress")) {
        const key = `${queue.id}:${status}`;
        if (acknowledgedProceedKey.current !== key) {
          setProceedKind("proceed");
          setShowProceedModal(true);
        }
      } else if (queue && status === "next") {
        const key = `${queue.id}:next`;
        if (acknowledgedProceedKey.current !== key) {
          setProceedKind("next");
          setShowProceedModal(true);
        }
      } else {
        setShowProceedModal(false);
        if (!queue) {
          acknowledgedProceedKey.current = null;
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  // The server also flags "you're next" through the notification stream
  // (type = next_in_line) the moment nobody is ahead anymore, which can
  // arrive while the ticket is still 'waiting'. Treat it as the same
  // get-ready alarm so the student is warned one step earlier.
  useEffect(() => {
    if (!currentQueue?.id) return;

    const status = (currentQueue.status || "").toLowerCase();
    if (status !== "waiting" && status !== "next") return;

    const hasNextAlert = notifications.some(
      (n) =>
        Number(n.ticket_id) === Number(currentQueue.id) &&
        n.type === "next_in_line",
    );
    if (!hasNextAlert) return;

    const key = `${currentQueue.id}:next`;
    if (acknowledgedProceedKey.current === key) return;

    setProceedKind("next");
    setShowProceedModal(true);
  }, [notifications, currentQueue]);

  const fetchPendingFeedback = async (sid: number) => {
    try {
      const data = await fetchJsonOrNull(
        `${API.getPendingFeedback}?student_id=${sid}`,
        undefined,
        "Fetch Pending Feedback Error",
      );
      setPendingFeedback(
        data?.success && data.pending ? data.transaction : null,
      );
    } catch (e) {
      console.log("Fetch Pending Feedback Error:", e);
    }
  };

  const fetchOffices = async () => {
    try {
      const data = await fetchJsonOrNull(
        API.getOffice,
        undefined,
        "Fetch Offices Error",
      );
      if (data?.success) {
        setOffices(data.offices);
        if (data.stats) {
          setDashStats(data.stats);
        }
      }
    } catch (error) {
      console.log("Fetch Offices Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await fetchJsonOrNull(
        `${API_URL}/office-queue.php?action=events`,
        undefined,
        "Fetch Events Error",
      );
      if (data?.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.log("Fetch Events Error:", error);
    }
  };

  const fetchParentLinkRequests = async (sid: number) => {
    try {
      const data = await fetchJsonOrNull(API.getParentLinkRequests, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: sid }),
      });
      if (data?.success) setParentLinkRequests(data.requests || []);
    } catch (e) {
      console.log("Parent link requests error", e);
    }
  };

  const respondParentLink = async (
    requestId: number,
    action: "approve" | "decline",
  ) => {
    try {
      const data = await fetchJsonOrNull(API.studentRespondLinkRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          request_id: requestId,
          action,
        }),
      });
      if (data?.success) {
        setParentLinkRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        Alert.alert("Error", data?.message || "Could not process request");
      }
    } catch {
      Alert.alert("Error", "Network error");
    }
  };

  const fetchUnavailableServices = async (sid: number) => {
    try {
      const data = await fetchJsonOrNull(API.getUnavailableServices, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: sid }),
      });
      if (data?.success) setUnavailableServices(data.services || []);
    } catch (e) {
      console.log("Unavailable services error", e);
    }
  };

  const submitServiceNeed = async (service: any) => {
    try {
      const data = await fetchJsonOrNull(API.serviceNeedRequest, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          service_item_id: service.id,
          office_id: service.office_id,
        }),
      });
      if (data?.success) {
        setUnavailableServices((prev) =>
          prev.map((s) =>
            s.id === service.id ? { ...s, requested_today: 1 } : s,
          ),
        );
        setServiceNeedTarget(null);
        Alert.alert("Request sent", data.message || "Staff will be notified.");
      } else {
        Alert.alert("Error", data?.message || "Could not submit request");
      }
    } catch {
      Alert.alert("Error", "Network error");
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Sequential (not Promise.all) to avoid Hostinger connection limits
      // that show up as empty HTTP 500 responses under burst traffic.
      await loadUser();
      await fetchOffices();
      await fetchEvents();

      const user = await AsyncStorage.getItem("user");
      if (user) {
        try {
          const parsed = JSON.parse(user);
          if (parsed?.id) {
            await fetchCurrentQueue(parsed.id);
            await fetchPendingFeedback(parsed.id);
            await fetchActiveEventTickets(parsed.id);
            await fetchParentLinkRequests(parsed.id);
            await fetchUnavailableServices(parsed.id);
          }
        } catch {
          // ignore storage parse errors
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [events]);

  const joinQueue = async (office: Office) => {
    // Same blocking rules as the web dashboard:
    // active ticket OR pending feedback OR office full → cannot join.
    if (pendingFeedback) {
      setShowFeedbackModal(true);
      return;
    }
    if (office.can_join === false) {
      Alert.alert(office.name, office.availability_reason || "This office is not accepting queues right now.");
      return;
    }
    if (office.is_full) {
      return;
    }
    // Web parity (smart multi-queue): a student may queue at another office
    // while a ticket is active, as long as the timing gate allows it.
    const sameOffice = allQueues.find((q) => Number(q.office_id) === Number(office.id));
    if (sameOffice) {
      router.push({
        pathname: "/student/ticket",
        params: { ticketId: String(sameOffice.id), queueId: String(sameOffice.id) },
      } as any);
      return;
    }
    if (allQueues.length > 0 || Object.values(activeEventTickets).some(Boolean)) {
      const ok = await prequeueAllowed(office);
      if (!ok) return;
    }
    router.push(`/student/queues/office-queue?office=${office.slug}`);
  };

  /** Dashboard-level smart multi-queue check (web prequeue-check.php). */
  const prequeueAllowed = async (office: Office): Promise<boolean> => {
    try {
      const pre = await fetchJsonOrNull(
        `${API.prequeueCheck}?student_id=${studentId}&office_id=${office.id}&type=walkin`,
      );
      if (pre?.success && pre.allowed === false) {
        Alert.alert(
          "Cannot join yet",
          (pre.reason || "You cannot join this office right now.") +
            (pre.retry_at ? `\n\nTry again around ${pre.retry_at}.` : ""),
        );
        return false;
      }
    } catch {}
    return true;
  };

  const joinEventQueue = async (office: Office, event: OfficeEvent) => {
    if (pendingFeedback) {
      setShowFeedbackModal(true);
      return;
    }
    // Already on this event → treat as view, not new join
    if (activeEventTickets[event.id]) {
      return;
    }
    if (office.can_join === false) {
      Alert.alert(office.name, office.availability_reason || "This office is not accepting queues right now.");
      return;
    }
    if (office.is_full) {
      return;
    }
    if (allQueues.length > 0 || Object.values(activeEventTickets).some(Boolean)) {
      if (allQueues.some((q) => Number(q.office_id) === Number(office.id))) {
        Alert.alert("Already queued", "You already have a queue at this office.");
        return;
      }
      const ok = await prequeueAllowed(office);
      if (!ok) return;
    }
    router.push(
      `/student/queues/office-queue?office=${office.slug}&event_id=${event.id}`,
    );
  };

  /** True when the student is blocked from joining any new queue
   *  (active regular ticket, any active event ticket, or pending feedback). */
  const hasActiveEventTicket = Object.values(activeEventTickets).some(Boolean);
  // Only pending feedback blocks every office (web parity); active tickets
  // are handled per office by the smart multi-queue pre-check.
  const joinBlocked = !!pendingFeedback;
  const officeClosed = (o: Office) => o.can_join === false;
  const officeHours = (o: Office) =>
    o.open_time && o.close_time
      ? `${String(o.open_time).slice(0, 5)} – ${String(o.close_time).slice(0, 5)}`
      : null;

  const openTicketDetail = () => {
    if (!currentQueue?.id) {
      setShowQueueModal(true);
      return;
    }
    router.push({
      pathname: "/student/ticket",
      params: {
        ticketId: String(currentQueue.id),
        queueId: String(currentQueue.id),
      },
    } as any);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const getQueueStatusText = () => {
    if (!currentQueue) return "Ready to Queue";
    const s = (currentQueue.status || "").toLowerCase();
    if (s === "called" || s === "in_progress") return "Proceed Now";
    if (s === "next") return "Next in Queue";
    return "On Queue";
  };

  const getQueueStatusColor = () => {
    if (!currentQueue) return "#22C55E";
    const s = (currentQueue.status || "").toLowerCase();
    if (s === "called" || s === "in_progress") return "#2563EB";
    if (s === "next") return "#0EA5E9";
    return "#F59E0B";
  };

  const getQueueStatusBackground = () => {
    if (!currentQueue) return "rgba(34,197,94,0.18)";
    const s = (currentQueue.status || "").toLowerCase();
    if (s === "called" || s === "in_progress") return "rgba(37,99,235,0.18)";
    if (s === "next") return "rgba(14,165,233,0.18)";
    return "rgba(245,158,11,0.18)";
  };

  const getOfficeIcon = (slug: string): keyof typeof Ionicons.glyphMap => {
    const key = Object.keys(OFFICE_ICONS).find((k) =>
      slug.toLowerCase().includes(k),
    );
    return key ? OFFICE_ICONS[key] : "business-outline";
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <Animated.View
          style={{
            opacity: fade,
            transform: [{ translateY: slide }],
            gap: SPACING.lg,
          }}
        >
          {/* Greeting */}
          <View style={styles.greetingCard}>
            {/* Top */}
            <View style={styles.profileRow}>
              <View style={styles.profileIcon}>
                {picture ? (
                  <Image
                    source={{
                      // google_picture is already an absolute URL; local uploads
                      // are stored relative to the site root.
                      uri: picture.startsWith("http")
                        ? picture
                        : `${ASSET_BASE_URL}/${picture}`,
                    }}
                    style={styles.profileImage}
                  />
                ) : (
                  <Ionicons name="person" size={24} color={COLORS.primary} />
                )}
              </View>

              <View style={styles.profileText}>
                <Text style={styles.greetingLabel}>{getGreeting()}</Text>

                <Text numberOfLines={1} style={styles.studentName}>
                  {studentName || "Student"}
                </Text>
              </View>

              <View style={styles.todayChip}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={COLORS.white}
                />

                <Text style={styles.todayChipText}>
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.greetingDivider} />

            {/* Bottom */}
            <View style={styles.bottomRow}>
              <View style={styles.portalRow}>
                <Ionicons
                  name="school-outline"
                  size={15}
                  color="rgba(255,255,255,0.85)"
                />

                <Text style={styles.subtitle}>UniQueue Student Portal</Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: getQueueStatusBackground(),
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: getQueueStatusColor(),
                    },
                  ]}
                />

                <Text style={styles.statusText}>{getQueueStatusText()}</Text>
              </View>
            </View>
          </View>
          {/* Pending feedback banner — shown until the student rates
              their last completed transaction. Tapping it opens the
              same modal that blocks "Join Queue" below. */}
          {pendingFeedback && (
            <AnimatedPressable
              style={styles.feedbackBanner}
              onPress={() => setShowFeedbackModal(true)}
            >
              <View style={styles.feedbackBannerIcon}>
                <Ionicons name="star" size={18} color={COLORS.warning} />
              </View>
              <View style={styles.feedbackBannerTextCol}>
                <Text style={styles.feedbackBannerTitle}>
                  Rate your last visit
                </Text>
                <Text style={styles.feedbackBannerSubtitle} numberOfLines={1}>
                  {pendingFeedback.office_name} · {pendingFeedback.queue_number}{" "}
                  — join a new queue after rating
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </AnimatedPressable>
          )}

          {/* Parent / Guardian link requests */}
          {parentLinkRequests.map((req) => (
            <View key={req.id} style={styles.parentLinkCard}>
              <Text style={styles.parentLinkTitle}>
                Parent / Guardian link request
              </Text>
              <Text style={styles.parentLinkBody}>
                {req.full_name} ({req.email}) wants to link as{" "}
                {req.relationship}.
              </Text>
              <View style={styles.parentLinkActions}>
                <AnimatedPressable
                  style={styles.parentApprove}
                  onPress={() => respondParentLink(req.id, "approve")}
                >
                  <Text style={styles.parentApproveText}>Confirm</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.parentDecline}
                  onPress={() => respondParentLink(req.id, "decline")}
                >
                  <Text style={styles.parentDeclineText}>Decline</Text>
                </AnimatedPressable>
              </View>
            </View>
          ))}

          {/* Unavailable services — demand requests */}
          {unavailableServices.length > 0 && (
            <View style={styles.unavailableSection}>
              <Text style={styles.unavailableTitle}>
                Currently unavailable services
              </Text>
              {unavailableServices.map((svc) => (
                <View key={svc.id} style={styles.unavailableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unavailableName}>{svc.name}</Text>
                    <Text style={styles.unavailableOffice}>
                      {svc.office_name}
                    </Text>
                  </View>
                  {svc.requested_today ? (
                    <Text style={styles.requestedLabel}>Requested today</Text>
                  ) : (
                    <AnimatedPressable
                      style={styles.needBtn}
                      onPress={() => setShowUnavailableModal(true)}
                    >
                      <Text style={styles.needBtnText}>I need this</Text>
                    </AnimatedPressable>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Other active / reserved tickets (smart multi-queue) */}
          {allQueues
            .filter((q) => Number(q.id) !== Number(currentQueue?.id))
            .map((q) => (
              <AnimatedPressable
                key={q.id}
                style={styles.unavailableSection}
                onPress={() =>
                  router.push({
                    pathname: "/student/ticket",
                    params: { ticketId: String(q.id), queueId: String(q.id) },
                  } as any)
                }
              >
                <Text style={styles.unavailableTitle}>
                  {q.status === "reserved" ? "Reserved queue" : "Also on queue"} · #{q.queue_number}
                </Text>
                <Text style={styles.unavailableOffice}>
                  {q.office_name}
                  {q.status === "reserved"
                    ? ` — joins the line after #${q.depends_on_queue_number || currentQueue?.queue_number || ""}${q.depends_on_office_name ? ` at ${q.depends_on_office_name}` : ""} is done`
                    : q.window_name ? ` · ${q.window_name}` : ""}
                </Text>
              </AnimatedPressable>
            ))}

          {/* Proceed now banner — mirrors web's called-info panel */}
          {currentQueue &&
            ["called", "in_progress"].includes(
              (currentQueue.status || "").toLowerCase(),
            ) && (
              <AnimatedPressable
                style={styles.proceedBanner}
                onPress={() => setShowQueueModal(true)}
              >
                <View style={styles.proceedBannerIcon}>
                  <Ionicons
                    name="walk-outline"
                    size={22}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.feedbackBannerTextCol}>
                  <Text style={styles.proceedBannerTitle}>
                    Please Proceed Now
                  </Text>
                  <Text style={styles.proceedBannerSubtitle} numberOfLines={1}>
                    {currentQueue.queue_number}
                    {currentQueue.window_name
                      ? ` · ${currentQueue.window_name}`
                      : ""}
                    {" — your turn"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="rgba(255,255,255,0.85)"
                />
              </AnimatedPressable>
            )}

          {/* Next-in-queue highlight */}
          {currentQueue &&
            (currentQueue.status || "").toLowerCase() === "next" && (
              <AnimatedPressable
                style={styles.nextBanner}
                onPress={() => setShowQueueModal(true)}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={COLORS.info}
                />
                <Text style={styles.nextBannerText}>
                  You're next — stay nearby
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.gray}
                />
              </AnimatedPressable>
            )}

          {/* Current Queue */}
          <AnimatedPressable
            style={styles.currentQueueCard}
            disabled={!currentQueue}
            onPress={openTicketDetail}
          >
            <View style={styles.currentTitleRow}>
              <View style={styles.currentTitleLeft}>
                <Ionicons
                  name="ticket-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.currentTitle}>Current Queue</Text>
              </View>
              {currentQueue && <StatusBadge status={currentQueue.status} />}
            </View>

            {currentQueue ? (
              <View style={styles.queueBody}>
                <Text style={styles.queueNumberLarge} numberOfLines={1}>
                  {currentQueue.queue_number}
                </Text>

                <View style={styles.queueDivider} />

                <View style={styles.queueInfoCol}>
                  <View style={styles.queueMetaRow}>
                    <Ionicons
                      name="business-outline"
                      size={ICON_SIZES.sm}
                      color={COLORS.gray}
                    />
                    <Text style={styles.queueOffice} numberOfLines={1}>
                      {currentQueue.office_name}
                    </Text>
                  </View>
                  <View style={styles.queueMetaRow}>
                    <Ionicons
                      name="albums-outline"
                      size={ICON_SIZES.sm}
                      color={COLORS.gray}
                    />
                    <Text style={styles.queueWindow} numberOfLines={1}>
                      {currentQueue.window_name ?? "Not yet assigned"}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.gray}
                />
              </View>
            ) : null}

            {/* Web dashboard live rows */}
            {currentQueue && (
              <View style={styles.liveGrid}>
                {[
                  ["People Ahead", queueLive?.people_ahead ?? "—"],
                  ["Estimated Wait", formatDuration(queueLive?.estimated_wait_minutes)],
                  ["Assigned Window", queueLive?.window_name || currentQueue.window_name || "Not yet assigned"],
                  ["Estimated Call Time", queueLive?.estimated_label || queueLive?.estimated_call_time || "—"],
                ].map(([label, value]) => (
                  <View key={String(label)} style={styles.liveRow}>
                    <Text style={styles.liveLabel}>{label}</Text>
                    <Text style={styles.liveValue} numberOfLines={1}>
                      {String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!currentQueue ? (
              <View style={styles.noQueueState}>
                <View style={styles.noQueueIcon}>
                  <Ionicons
                    name="time-outline"
                    size={ICON_SIZES.md}
                    color={COLORS.primaryLight}
                  />
                </View>
                <View style={styles.noQueueTextCol}>
                  <Text style={styles.noQueue}>No active queue right now</Text>
                  <Text style={styles.noQueueHint}>
                    Join one of the offices below to get started
                  </Text>
                </View>
              </View>
            ) : null}
          </AnimatedPressable>

          {/* Entry to office live monitor — web "Live Queue" page */}
          <AnimatedPressable
            style={styles.liveMonitorBtn}
            onPress={() =>
              router.push({
                pathname: "/student/live-monitor",
                params: currentQueue?.office_id
                  ? { officeId: String(currentQueue.office_id) }
                  : {},
              } as any)
            }
          >
            <Ionicons name="tv-outline" size={16} color={COLORS.primary} />
            <Text style={styles.liveMonitorText}>View Live Queue Monitor</Text>
          </AnimatedPressable>

          {/* Dashboard stats — mirrors web dash-hero__stats */}
          {dashStats && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{dashStats.open_offices}</Text>
                <Text style={styles.statLabel}>Offices Open</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{dashStats.total_waiting}</Text>
                <Text style={styles.statLabel}>Waiting Today</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {dashStats.est_wait_mins != null
                    ? `~${dashStats.est_wait_mins}m`
                    : "—"}
                </Text>
                <Text style={styles.statLabel}>Est. Wait</Text>
              </View>
            </View>
          )}

          {/* Offices */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Available Offices</Text>
              <Text style={styles.sectionSubtitle}>
                Choose where you'd like to line up
              </Text>
            </View>

            {!loading && offices.length > 0 && (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {offices.length} open
                </Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={{ gap: SPACING.lg }}>
              <OfficeCardSkeleton />
              <OfficeCardSkeleton />
              <OfficeCardSkeleton />
            </View>
          ) : offices.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Ionicons
                  name="business-outline"
                  size={ICON_SIZES.xl}
                  color={COLORS.primaryLight}
                />
              </View>
              <Text style={styles.emptyTitle}>No offices available</Text>
              <Text style={styles.emptyText}>
                Check back later — offices open throughout the day.
              </Text>
            </View>
          ) : (
            <View style={{ gap: SPACING.lg }}>
              {offices.map((office) => (
                <View key={office.id} style={styles.officeCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.officeIconAndName}>
                      <View style={styles.officeIconBox}>
                        <Ionicons
                          name={getOfficeIcon(office.slug)}
                          size={ICON_SIZES.md}
                          color={COLORS.primary}
                        />
                      </View>
                      <Text style={styles.officeName} numberOfLines={2}>
                        {office.name}
                      </Text>
                    </View>

                    {office.is_full || officeClosed(office) ? (
                      <View style={styles.fullBadge}>
                        <Text style={styles.fullBadgeText}>
                          {office.is_full ? "FULL" : office.is_holiday ? "HOLIDAY" : "CLOSED"}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeText}>OPEN</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.officeDescription} numberOfLines={2}>
                    {office.description}
                  </Text>
                  {(officeHours(office) || officeClosed(office)) && (
                    <Text style={[styles.officeDescription, { marginTop: 4, color: officeClosed(office) ? "#dc2626" : COLORS.gray }]}>
                      {officeClosed(office) && office.availability_reason
                        ? office.availability_reason
                        : `Hours today: ${officeHours(office)}${office.cutoff_time ? ` · cutoff ${String(office.cutoff_time).slice(0, 5)}` : ""}`}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <AnimatedPressable
                      style={[
                        styles.joinButton,
                        (office.is_full || joinBlocked || officeClosed(office)) &&
                          styles.joinButtonDisabled,
                      ]}
                      onPress={() => joinQueue(office)}
                      disabled={!!office.is_full || joinBlocked}
                    >
                      <Text style={styles.joinButtonText}>
                        {office.is_full
                          ? "Full for today"
                          : joinBlocked
                            ? "Feedback required"
                            : officeClosed(office)
                              ? "Not accepting queues"
                              : allQueues.some((q) => Number(q.office_id) === Number(office.id))
                                ? "View my ticket"
                                : "Join Queue"}
                      </Text>
                      {!office.is_full && !joinBlocked && !officeClosed(office) && (
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={COLORS.white}
                        />
                      )}
                    </AnimatedPressable>
                  </View>

                  {/* Office Events — e.g. "Enrollment". Same idea as the
                      web dashboard's nested event rows: jump straight
                      into the event's step flow instead of the regular
                      walk-in/appointment form. */}
                  {events
                    .filter((ev) => ev.office_id === office.id)
                    .map((ev) => {
                      // Real source of truth for THIS event's ticket status
                      // — not the generic currentQueue, which only tracks
                      // the regular walk-in/appointment queue.
                      const isOnThisEventQueue = !!activeEventTickets[ev.id];

                      return (
                        <View key={ev.id} style={styles.eventRow}>
                          <View style={styles.eventRowLeft}>
                            <View style={styles.eventIconBox}>
                              <Ionicons
                                name="calendar-outline"
                                size={16}
                                color={COLORS.white}
                              />
                            </View>
                            <View style={styles.eventRowInfo}>
                              <View style={styles.eventBadgeRow}>
                                <View style={styles.eventBadge}>
                                  <Text style={styles.eventBadgeText}>
                                    EVENT
                                  </Text>
                                </View>
                                <Text
                                  style={styles.eventName}
                                  numberOfLines={1}
                                >
                                  {ev.name}
                                </Text>
                              </View>
                              {!!ev.description && (
                                <Text
                                  style={styles.eventDescription}
                                  numberOfLines={1}
                                >
                                  {ev.description}
                                </Text>
                              )}
                            </View>
                          </View>

                          <AnimatedPressable
                            style={[
                              styles.eventJoinButton,
                              isOnThisEventQueue &&
                                styles.eventJoinButtonOnQueue,
                              (office.is_full || officeClosed(office) ||
                                (joinBlocked && !isOnThisEventQueue)) &&
                                styles.eventJoinButtonDisabled,
                            ]}
                            onPress={() => joinEventQueue(office, ev)}
                            disabled={
                              isOnThisEventQueue
                                ? false
                                : !!office.is_full || joinBlocked
                            }
                          >
                            <Text
                              style={[
                                styles.eventJoinButtonText,
                                isOnThisEventQueue &&
                                  styles.eventJoinButtonTextOnQueue,
                              ]}
                            >
                              {isOnThisEventQueue
                                ? "On Queue"
                                : office.is_full
                                  ? "Full"
                                  : joinBlocked
                                    ? "Feedback required"
                                    : officeClosed(office)
                                      ? "Closed"
                                      : "Join"}
                            </Text>
                          </AnimatedPressable>
                        </View>
                      );
                    })}
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <CurrentQueueModal
        visible={showQueueModal}
        studentId={studentId}
        onClose={() => setShowQueueModal(false)}
        onCancelled={() => fetchCurrentQueue(studentId)}
      />

      <FeedbackModal
        visible={showFeedbackModal}
        transaction={pendingFeedback}
        studentId={studentId}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitted={() => {
          setShowFeedbackModal(false);
          fetchPendingFeedback(studentId);
        }}
      />

      {serviceNeedTarget && (
        <View style={styles.needModalOverlay}>
          <View style={styles.needModal}>
            <Text style={styles.needModalTitle}>
              Service currently unavailable
            </Text>
            <Text style={styles.needModalBody}>
              {serviceNeedTarget.name} at {serviceNeedTarget.office_name} is not
              accepting queues right now. Submit a need request so staff know
              demand.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <AnimatedPressable
                style={[styles.parentDecline, { flex: 1 }]}
                onPress={() => setServiceNeedTarget(null)}
              >
                <Text style={styles.parentDeclineText}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.parentApprove, { flex: 1 }]}
                onPress={() => submitServiceNeed(serviceNeedTarget)}
              >
                <Text style={styles.parentApproveText}>I need this</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      )}

      <UnavailableServicesModal
        visible={showUnavailableModal}
        onClose={() => {
          setShowUnavailableModal(false);
          fetchUnavailableServices(studentId);
        }}
        studentId={studentId}
      />

      <RequeueModal
        visible={showRequeueModal}
        studentId={studentId}
        ticketId={requeueTicket?.id ?? null}
        queueNumber={requeueTicket?.queue_number}
        onResolved={(action) => {
          respondedRequeueTicketId.current = requeueTicket?.id ?? null;
          setShowRequeueModal(false);
          setRequeueTicket(null);
          fetchCurrentQueue(studentId);
        }}
      />

      <ProceedModal
        visible={showProceedModal}
        info={
          currentQueue
            ? {
                queueNumber: currentQueue.queue_number,
                officeName: currentQueue.office_name,
                windowName: currentQueue.window_name,
                status: currentQueue.status,
              }
            : null
        }
        kind={proceedKind}
        onAcknowledge={() => {
          const status = (currentQueue?.status || "").toLowerCase();
          if (currentQueue?.id) {
            acknowledgedProceedKey.current =
              proceedKind === "next"
                ? `${currentQueue.id}:next`
                : `${currentQueue.id}:${status}`;
          }
          setShowProceedModal(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  liveGrid: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    gap: 6,
  },
  liveRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
  },
  liveLabel: { fontSize: 12, color: COLORS.gray, fontWeight: "600" },
  liveValue: {
    flexShrink: 1,
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "800",
    textAlign: "right",
  },
  liveMonitorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    backgroundColor: COLORS.cream,
  },
  liveMonitorText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 48,
  },

  greetingCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    ...SHADOWS.glow,
  },

  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.sm + 2,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
  },

  // Pending feedback banner
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  feedbackBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  feedbackBannerTextCol: {
    flex: 1,
    gap: 2,
  },
  feedbackBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  feedbackBannerSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "500",
  },

  // Proceed / next banners (web parity)
  proceedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  proceedBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  proceedBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
  proceedBannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  nextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.infoLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  nextBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.info,
  },

  // Current Queue
  currentQueueCard: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  currentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  currentTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
  },
  queueBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm + 2,
  },
  queueNumberLarge: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -0.6,
  },
  queueDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: COLORS.primarySoft,
  },
  queueInfoCol: {
    flex: 1,
    gap: 5,
  },
  queueMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  queueOffice: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    flexShrink: 1,
  },
  queueWindow: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "500",
    flexShrink: 1,
  },
  noQueueState: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  noQueueIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  noQueueTextCol: {
    flex: 1,
    gap: 2,
  },
  noQueue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  noQueueHint: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.secondary,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
    fontWeight: "500",
  },
  sectionBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },

  // Office card
  officeCard: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  officeIconAndName: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flex: 1,
    marginRight: SPACING.sm + 2,
  },
  officeIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  officeName: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
    flex: 1,
  },
  officeDescription: {
    color: COLORS.gray,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    fontWeight: "500",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  activeText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  fullBadge: {
    backgroundColor: COLORS.dangerLight ?? "#FBE8E8",
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  fullBadgeText: {
    color: COLORS.danger ?? "#D3453B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Card footer
  cardFooter: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
  joinButtonDisabled: {
    backgroundColor: COLORS.gray ?? "#9CA3AF",
    opacity: 0.85,
  },

  // Office Event row (nested under its office card)
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    marginTop: -SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  eventRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm + 2,
    flex: 1,
    marginRight: SPACING.sm,
  },
  eventIconBox: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.md - 2,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eventRowInfo: {
    flex: 1,
    gap: 2,
  },
  eventBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  eventBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  eventName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.secondary,
    flexShrink: 1,
  },
  eventDescription: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "500",
  },
  eventJoinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  eventJoinButtonOnQueue: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  eventJoinButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  eventJoinButtonTextOnQueue: {
    color: COLORS.primary,
  },
  eventJoinButtonDisabled: {
    backgroundColor: COLORS.gray ?? "#9CA3AF",
    opacity: 0.85,
  },

  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cream ?? COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
    ...SHADOWS.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.gray,
    marginTop: 2,
    textAlign: "center",
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.cream,
    padding: SPACING.xxxl,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    ...SHADOWS.sm,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  profileIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 27,
  },
  profileText: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  studentName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 2,
  },
  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },

  todayChipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },

  greetingDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 18,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  portalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
    marginRight: 6,
  },

  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  parentLinkCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  parentLinkTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
    color: COLORS.text,
  },
  parentLinkBody: { color: COLORS.gray, marginBottom: 10, lineHeight: 18 },
  parentLinkActions: { flexDirection: "row", gap: 10 },
  parentApprove: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  parentApproveText: { color: "#fff", fontWeight: "700" },
  parentDecline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  parentDeclineText: { color: COLORS.gray, fontWeight: "600" },
  unavailableSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  unavailableTitle: { fontWeight: "700", marginBottom: 10, color: COLORS.text },
  unavailableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  unavailableName: { fontWeight: "600", color: COLORS.text },
  unavailableOffice: { fontSize: 12, color: COLORS.gray },
  needBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  needBtnText: { color: COLORS.primary, fontWeight: "600", fontSize: 12 },
  requestedLabel: { fontSize: 12, color: COLORS.gray, fontStyle: "italic" },
  needModalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
    zIndex: 100,
  },
  needModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  needModalTitle: {
    fontWeight: "800",
    fontSize: 17,
    marginBottom: 8,
    color: COLORS.text,
  },
  needModalBody: { color: COLORS.gray, lineHeight: 20 },
});
