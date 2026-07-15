import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CurrentQueueModal from '@/components/queue/current-queue-modal';
import { API } from '@/constants/backend';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
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
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQueue, setCurrentQueue] = useState<any>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [studentId, setStudentId] = useState<number>(0);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    loadUser();
    fetchOffices();

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();

    const interval = setInterval(async () => {
      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsed = JSON.parse(user);
      fetchCurrentQueue(parsed.id);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

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

      fetchCurrentQueue(parsed.id);
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

  const joinQueue = (office: Office) => {
    router.push(`/student/queues/office-queue?office=${office.slug}`);
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
      <Ionicons
        name="person"
        size={24}
        color={COLORS.primary}
      />
    </View>

    <View style={styles.profileText}>
      <Text style={styles.greetingLabel}>
        {getGreeting()}
      </Text>

      <Text
        numberOfLines={1}
        style={styles.studentName}
      >
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

                  <View style={styles.cardFooter}>
                    <AnimatedPressable style={styles.joinButton} onPress={() => joinQueue(office)}>
                      <Text style={styles.joinButtonText}>Join Queue</Text>
                      <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                    </AnimatedPressable>
                  </View>
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
    padding: SPACING.xl,
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
});