import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FeedbackModal, {
  PendingFeedbackTransaction,
} from '@/components/feedback/feedback-modal';
import CurrentQueueModal from '@/components/queue/current-queue-modal';
import LiveQueueModal from '@/components/queue/live-queue-modal';
import { API, API_URL } from '@/constants/backend';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import Skeleton from '../../components/ui/skeleton';
import StatusBadge from '../../components/ui/status-badge';
import {
  COLORS,
  ICON_SIZES,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../../constants/theme';

interface Office {
  id: number;
  name: string;
  slug: string;
  description: string;
  open_windows: number;
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
  registrar: 'document-text-outline',
  scholarship: 'ribbon-outline',
  finance: 'cash-outline',
  cashier: 'cash-outline',
  library: 'library-outline',
  clinic: 'medkit-outline',
  guidance: 'heart-outline',
  it: 'desktop-outline',
  admission: 'person-add-outline',
  security: 'shield-checkmark-outline',
  osa: 'people-outline',
  'student-affairs': 'people-outline',
};

const POLL_INTERVAL_MS = 3000;

function OfficeCardSkeleton() {
  return (
    <View style={styles.officeCard}>
      <View style={styles.cardTop}>
        <View style={styles.officeIconAndName}>
          <Skeleton width={44} height={44} radius={RADIUS.md} />
          <Skeleton width={130} height={16} style={{ marginLeft: SPACING.md }} />
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
  const [studentName, setStudentName] = useState('');
  const [picture, setPicture] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQueue, setCurrentQueue] = useState<any>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [studentId, setStudentId] = useState<number>(0);
  const [now, setNow] = useState(new Date());

  // Tracks whether the student currently has an active ticket for each
  // event, keyed by event id — e.g. { [eventId]: true }. This is separate
  // from `currentQueue` (which only covers the regular walk-in/appointment
  // queue) because event tickets live under their own
  // office-queue.php?action=event endpoint with its own active_ticket.
  const [activeEventTickets, setActiveEventTickets] = useState<Record<number, boolean>>({});

  // The student's most recent completed transaction that hasn't been
  // rated yet, if any. While this is set, joining any queue (regular
  // or event) is blocked and the FeedbackModal is shown instead.
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedbackTransaction | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [showLiveQueueModal, setShowLiveQueueModal] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    loadUser();
    fetchOffices();
    fetchEvents();

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();

    const clockInterval = setInterval(() => setNow(new Date()), 1000);

    const interval = setInterval(async () => {
      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsed = JSON.parse(user);
      fetchCurrentQueue(parsed.id);
      fetchActiveEventTickets(parsed.id);
      fetchPendingFeedback(parsed.id);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(clockInterval);
      clearInterval(interval);
    };
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
        const user = await AsyncStorage.getItem('user');
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
    }, [events])
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
            const res = await fetch(
              `${API_URL}/office-queue.php?action=event&event_id=${ev.id}&office_id=${ev.office_id}&student_id=${sid}`
            );
            const data = await res.json();
            return [ev.id, data.success && !!data.active_ticket] as const;
          } catch {
            return [ev.id, false] as const;
          }
        })
      );

      setActiveEventTickets(Object.fromEntries(results));
    } catch (e) {
      console.log('Fetch Active Event Tickets Error:', e);
    }
  };

  useEffect(() => {
    if (!studentId || events.length === 0) return;
    fetchActiveEventTickets(studentId);
  }, [studentId, events]);

  const loadUser = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsed = JSON.parse(user);
      setStudentId(parsed.id);
      setStudentName(
        parsed.name ||
          parsed.full_name ||
          `${parsed.first_name ?? ''} ${parsed.last_name ?? ''}`.trim()
      );
      setPicture(parsed.picture ?? null);
      try {
        const res = await fetch(
          `${API.getStudentProfile}?student_id=${parsed.id}`
        );

        const data = await res.json();

        if (data.success) {
          setPicture(data.student.picture);

          await AsyncStorage.setItem(
            "user",
            JSON.stringify({
              ...parsed,
              picture: data.student.picture,
            })
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
      const res = await fetch(API.getCurrentQueue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      const data = await res.json();
      setCurrentQueue(data.success ? data.queue : null);
    } catch (e) {
      console.log(e);
    }
  };

  const fetchPendingFeedback = async (sid: number) => {
    try {
      const res = await fetch(`${API.getPendingFeedback}?student_id=${sid}`);
      const data = await res.json();
      setPendingFeedback(data.success && data.pending ? data.transaction : null);
    } catch (e) {
      console.log('Fetch Pending Feedback Error:', e);
    }
  };

  const fetchOffices = async () => {
    try {
      const response = await fetch(API.getOffice);
      const data = await response.json();

      if (data.success) {
        setOffices(data.offices);
      }
    } catch (error) {
      console.log('Fetch Offices Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/office-queue.php?action=events`);
      const data = await response.json();

      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.log('Fetch Events Error:', error);
    }
  };

  const joinQueue = (office: Office) => {
    if (pendingFeedback) {
      setShowFeedbackModal(true);
      return;
    }
    if (showLiveQueueModal) setShowLiveQueueModal(false);
    router.push(`/student/queues/office-queue?office=${office.slug}`);
  };

  const joinEventQueue = (office: Office, event: OfficeEvent) => {
    if (pendingFeedback) {
      setShowFeedbackModal(true);
      return;
    }
    router.push(`/student/queues/office-queue?office=${office.slug}&event_id=${event.id}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getQueueStatusText = () => {
    return currentQueue ? "On Queue" : "Ready to Queue";
  };

  const getQueueStatusColor = () => {
    return currentQueue ? "#F59E0B" : "#22C55E";
  };

  const getQueueStatusBackground = () => {
    return currentQueue
      ? "rgba(245,158,11,0.18)"
      : "rgba(34,197,94,0.18)";
  };

  const getOfficeIcon = (slug: string): keyof typeof Ionicons.glyphMap => {
    const key = Object.keys(OFFICE_ICONS).find((k) => slug.toLowerCase().includes(k));
    return key ? OFFICE_ICONS[key] : 'business-outline';
  };

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], gap: SPACING.lg }}>
          {/* Greeting */}
       <View style={styles.greetingCard}>

  {/* Top */}
  <View style={styles.profileRow}>

    <View style={styles.profileIcon}>
      {picture ? (
        <Image
          source={{
            uri: `${API_URL}/${picture}`,
          }}
          style={styles.profileImage}
        />
      ) : (
        <Ionicons
          name="person"
          size={24}
          color={COLORS.primary}
        />
      )}
    </View>

    <View style={styles.profileText}>
      <View style={styles.greetingTopRow}>
        <Text style={styles.greetingLabel}>
          {getGreeting()}
        </Text>

        <Text style={styles.todayChipText}>
          {now.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </Text>
      </View>

      <View style={styles.greetingTopRow}>
        <Text
          numberOfLines={1}
          style={[styles.studentName, { flex: 1 }]}
        >
          {studentName || "Student"}
        </Text>

        <Text style={styles.todayChipTime}>
          {now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </Text>
      </View>
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

        <Text style={styles.subtitle}>
          UniQueue Student Portal
        </Text>
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

        <Text style={styles.statusText}>
          {getQueueStatusText()}
        </Text>
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
                <Text style={styles.feedbackBannerTitle}>Rate your last visit</Text>
                <Text style={styles.feedbackBannerSubtitle} numberOfLines={1}>
                  {pendingFeedback.office_name} · {pendingFeedback.queue_number} — join a new queue after rating
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </AnimatedPressable>
          )}

          {/* Current Queue */}
          <AnimatedPressable
            style={styles.currentQueueCard}
            disabled={!currentQueue}
            onPress={() => setShowQueueModal(true)}
          >
            <View style={styles.currentTitleRow}>
              <View style={styles.currentTitleLeft}>
                <Ionicons name="ticket-outline" size={16} color={COLORS.primary} />
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
                    <Ionicons name="business-outline" size={ICON_SIZES.sm} color={COLORS.gray} />
                    <Text style={styles.queueOffice} numberOfLines={1}>
                      {currentQueue.office_name}
                    </Text>
                  </View>
                  <View style={styles.queueMetaRow}>
                    <Ionicons name="albums-outline" size={ICON_SIZES.sm} color={COLORS.gray} />
                    <Text style={styles.queueWindow} numberOfLines={1}>
                      {currentQueue.window_name ?? 'Not yet assigned'}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </View>
            ) : (
              <View style={styles.noQueueState}>
                <View style={styles.noQueueIcon}>
                  <Ionicons name="time-outline" size={ICON_SIZES.md} color={COLORS.primaryLight} />
                </View>
                <View style={styles.noQueueTextCol}>
                  <Text style={styles.noQueue}>No active queue right now</Text>
                  <Text style={styles.noQueueHint}>Join one of the offices below to get started</Text>
                </View>
              </View>
            )}
          </AnimatedPressable>

          {/* Offices */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Available Offices</Text>
              <Text style={styles.sectionSubtitle}>Choose where you'd like to line up</Text>
            </View>

            {!loading && offices.length > 0 && (
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{offices.length} open</Text>
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
                <Ionicons name="business-outline" size={ICON_SIZES.xl} color={COLORS.primaryLight} />
              </View>
              <Text style={styles.emptyTitle}>No offices available</Text>
              <Text style={styles.emptyText}>Check back later — offices open throughout the day.</Text>
            </View>
          ) : (
            <View style={{ gap: SPACING.lg }}>
              {offices.map((office) => (
                <View key={office.id} style={styles.officeCard}>
                  <View style={styles.cardTop}>
                    <View style={styles.officeIconAndName}>
                      <View style={styles.officeIconBox}>
                        <Ionicons name={getOfficeIcon(office.slug)} size={ICON_SIZES.md} color={COLORS.primary} />
                      </View>
                      <Text style={styles.officeName} numberOfLines={2}>{office.name}</Text>
                    </View>

                    <View style={styles.activeBadge}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeText}>OPEN</Text>
                    </View>
                  </View>

                  <Text style={styles.officeDescription} numberOfLines={2}>
                    {office.description}
                  </Text>

                  {/* Open windows count */}
                  <View style={styles.windowsRow}>
                    <Ionicons name="grid-outline" size={13} color={COLORS.gray} />
                    <Text style={styles.windowsText}>
                      {office.open_windows > 0
                        ? `${office.open_windows} window${office.open_windows > 1 ? 's' : ''} open`
                        : 'No open windows'}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <AnimatedPressable
                      style={[styles.joinButton, !!pendingFeedback && styles.joinButtonDisabled]}
                      onPress={() => joinQueue(office)}
                      disabled={!!pendingFeedback}
                    >
                      <Text style={styles.joinButtonText}>Join Queue</Text>
                      <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                    </AnimatedPressable>

                    <AnimatedPressable
                      style={styles.liveQueueButton}
                      onPress={() => {
                        setSelectedOffice(office);
                        setShowLiveQueueModal(true);
                      }}
                    >
                      <Ionicons name="pulse-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.liveQueueButtonText}>Live Queue</Text>
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
                              <Ionicons name="calendar-outline" size={16} color={COLORS.white} />
                            </View>
                            <View style={styles.eventRowInfo}>
                              <View style={styles.eventBadgeRow}>
                                <View style={styles.eventBadge}>
                                  <Text style={styles.eventBadgeText}>EVENT</Text>
                                </View>
                                <Text style={styles.eventName} numberOfLines={1}>{ev.name}</Text>
                              </View>
                              {!!ev.description && (
                                <Text style={styles.eventDescription} numberOfLines={1}>
                                  {ev.description}
                                </Text>
                              )}
                            </View>
                          </View>

                          <AnimatedPressable
                            style={[styles.eventJoinButton, isOnThisEventQueue && styles.eventJoinButtonOnQueue]}
                            onPress={() => joinEventQueue(office, ev)}
                          >
                            <Text style={[styles.eventJoinButtonText, isOnThisEventQueue && styles.eventJoinButtonTextOnQueue]}>
                              {isOnThisEventQueue ? 'On Queue' : 'Join'}
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

      <LiveQueueModal
        visible={showLiveQueueModal}
        office={selectedOffice}
        onClose={() => {
          setShowLiveQueueModal(false);
          setSelectedOffice(null);
        }}
        onJoinQueue={() => {
          setShowLiveQueueModal(false);
          if (selectedOffice) joinQueue(selectedOffice);
        }}
        pendingFeedback={!!pendingFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    padding: SPACING.lg,
    ...SHADOWS.glow,
  },

  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm + 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },

  // Pending feedback banner
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  feedbackBannerTextCol: {
    flex: 1,
    gap: 2,
  },
  feedbackBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  feedbackBannerSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },

  // Current Queue
  currentQueueCard: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  currentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  currentTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
  },
  queueBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
  },
  queueNumberLarge: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.6,
  },
  queueDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primarySoft,
  },
  queueInfoCol: {
    flex: 1,
    gap: 5,
  },
  queueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueOffice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  queueWindow: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
    flexShrink: 1,
  },
  noQueueState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  noQueueIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noQueueTextCol: {
    flex: 1,
    gap: 2,
  },
  noQueue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  noQueueHint: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
    fontWeight: '500',
  },
  sectionBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },

  // Office card
  officeCard: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  officeIconAndName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
    marginRight: SPACING.sm + 2,
  },
  officeIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Card footer
  cardFooter: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  joinButtonDisabled: {
    opacity: 0.45,
  },
  liveQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  liveQueueButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  windowsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  windowsText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
  },

  // Office Event row (nested under its office card)
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    marginTop: -SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  eventRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    flex: 1,
    marginRight: SPACING.sm,
  },
  eventIconBox: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.md - 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eventRowInfo: {
    flex: 1,
    gap: 2,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  eventName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    flexShrink: 1,
  },
  eventDescription: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '500',
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
    fontWeight: '700',
  },
  eventJoinButtonTextOnQueue: {
    color: COLORS.primary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.cream,
    padding: SPACING.xxxl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    fontWeight: '500',
  },
  profileRow: {
  flexDirection: 'row',
  alignItems: 'center',
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
    width: '100%',
    height: '100%',
    borderRadius: 27,
  },
  profileText: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  studentName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 2,
  },
  greetingTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  todayChipDot: {
    width: 3,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },

  todayChipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "600",
  },

  todayChipTime: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontWeight: "600",
  },

greetingDivider: {
  height: 1,
  backgroundColor: "rgba(255,255,255,0.15)",
  marginVertical: 8,
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
});