import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import AppHeader from "@/components/layout/app-header";
import { API } from "@/constants/backend";

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from "@/constants/theme";

interface QueueItem {
  id: number;
  queue_number: string;
  status: string;
  is_you: boolean;
}

interface LiveQueue {
  queue: {
    id: number;
    queue_number: string;
    office: string;
    window: string;
    status: string;
    joined_at: string;
  };

  now_serving: string | null;

  people_ahead: number;

  estimated_wait: number;

  queue_list: QueueItem[];
}

export default function LiveQueueScreen() {
  const { queueId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);

  const [liveQueue, setLiveQueue] =
    useState<LiveQueue | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

const loadQueue = async () => {
  try {
    const response = await fetch(API.getLiveQueue, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queue_id: Number(queueId),
      }),
    });

    const json = await response.json();

    if (json.success) {
      setLiveQueue(json);
    } else {
      console.log(json.message);
    }

  } catch (error) {
    console.log("ERROR:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadQueue();

    const interval = setInterval(() => {
      loadQueue();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const queueList = liveQueue?.queue_list ?? [];

  // Base sa eksaktong enum ng `status` column sa `queue_tickets` table:
  // 'waiting', 'called', 'in_progress', 'completed', 'cancelled'
  const STATUS_PRIORITY: Record<string, number> = {
    in_progress: 0, // kasalukuyang pinapapasok — laging nasa taas
    called: 1,      // sunod na tatawagin / papasok
    waiting: 2,     // naghihintay pa sa likod
    completed: 3,   // tapos na
    cancelled: 4,   // kinansela
  };

  const getStatusPriority = (status: string) => {
    const key = status.toLowerCase().trim();
    return key in STATUS_PRIORITY ? STATUS_PRIORITY[key] : 2.5; // fallback kung may bagong status na hindi pa listed
  };

  // Re-sort tuwing may bagong data mula sa polling (loadQueue every 3s) —
  // kaya kahit walang reload, automatic na naaayos ang pagkakasunod-sunod.
  // NOTE: itong useMemo ay dapat palaging tumakbo bago ang anumang early
  // return (tulad ng loading check sa ibaba), para consistent lagi ang
  // bilang ng hooks sa bawat render — kung hindi, "Rendered more hooks
  // than during the previous render" ang lalabas.
  const sortedQueueList = useMemo(() => {
    return [...queueList].sort((a, b) => {
      const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return 0; // stable sort — mananatili ang orihinal na pagkakasunod-sunod kapag parehong priority
    });
  }, [queueList]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="Live Queue" />
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 100 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>

      <AppHeader title="Live Queue" />

      {/* Summary section — fixed height, no scrolling */}
      <View style={styles.summary}>

        {/* Office + Queue hero card */}
        <View style={styles.heroCard}>

          <View style={styles.heroTopRow}>

            <View style={styles.heroOfficeCol}>
              <Text style={styles.officeName} numberOfLines={1}>
                {liveQueue?.queue.office}
              </Text>
              <Text style={styles.window} numberOfLines={1}>
                {liveQueue?.queue.window}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {liveQueue?.queue.status.toUpperCase()}
              </Text>
            </View>

          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottomRow}>

            <View style={styles.numberBlock}>
              <Text style={styles.label}>YOUR NUMBER</Text>
              <Text style={styles.queueNumber} numberOfLines={1}>
                {liveQueue?.queue.queue_number}
              </Text>
            </View>

            <View style={styles.heroInnerDivider} />

            <View style={styles.numberBlock}>
              <Text style={styles.servingLabel}>NOW SERVING</Text>
              <Text style={styles.servingNumber} numberOfLines={1}>
                {liveQueue?.now_serving ?? "--"}
              </Text>
            </View>

          </View>

        </View>

        {/* Primary stats — People Ahead & Estimated Minutes */}
        <View style={styles.statsRow}>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{liveQueue?.people_ahead ?? 0}</Text>
            <Text style={styles.statLabel}>People Ahead</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{liveQueue?.estimated_wait ?? 0}</Text>
            <Text style={styles.statLabel}>Est. Minutes</Text>
          </View>

        </View>

        {/* Queue list header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Live Queue</Text>
          <Text style={styles.listCount}>{sortedQueueList.length} in line</Text>
        </View>

      </View>

      {/* Queue list — fills remaining space, scrolls only if needed */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sortedQueueList}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View
            style={[
              styles.queueItem,
              item.is_you && styles.youQueue,
            ]}
          >
            <View>
              <Text style={styles.queueItemNumber}>
                {item.queue_number}
              </Text>

              <Text style={styles.queueItemStatus}>
                {item.status.toUpperCase()}
              </Text>
            </View>

            {item.is_you && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>
                  YOU
                </Text>
              </View>
            )}
          </View>
        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Fixed-height summary area (no scroll)
  summary: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.md,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  heroOfficeCol: {
    flex: 1,
  },

  officeName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.white,
  },

  window: {
    marginTop: 2,
    color: "rgba(255,255,255,.8)",
    fontSize: 12,
    fontWeight: "500",
  },

  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },

  statusText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.3,
  },

  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: SPACING.sm,
  },

  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  numberBlock: {
    flex: 1,
    alignItems: "center",
  },

  heroInnerDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: SPACING.sm,
  },

  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  queueNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.white,
    marginTop: 3,
  },

  servingLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  servingNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.white,
    marginTop: 3,
  },

  // Primary stats — People Ahead & Estimated Minutes
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    ...SHADOWS.sm,
  },

  statCard: {
    flex: 1,
    alignItems: "center",
  },

  statDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  statValue: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -0.5,
  },

  statLabel: {
    marginTop: 4,
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },

  sectionTitle: {
    ...TYPOGRAPHY.title,
    fontSize: 15,
    color: COLORS.secondary,
  },

  listCount: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
  },

  // Scrollable live queue list
  list: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },

  queueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    backgroundColor: COLORS.cream,

    borderRadius: RADIUS.md,

    borderLeftWidth: 4,
    borderLeftColor: "transparent",

    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,

    marginBottom: SPACING.xs + 2,

    ...SHADOWS.sm,
  },

  queueItemNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.secondary,
  },

  queueItemStatus: {
    marginTop: 1,
    fontSize: 11,
    color: COLORS.gray,
    textTransform: "capitalize",
  },

  youQueue: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },

  youBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: 4,
  },

  youText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 11,
  },
});