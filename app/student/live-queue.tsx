import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { router, useLocalSearchParams } from "expo-router";

import AppHeader from "@/components/layout/app-header";
import { API } from "@/constants/backend";
import { fetchJsonOrNull, safeFetchJson } from "@/utils/api";
import { updateLiveTicketWidget } from "@/utils/live-ticket-widget";

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from "@/constants/theme";

// AppHeader already pads for the Android status bar, so only apply the
// top inset on iOS (same visual result as the old react-native SafeAreaView).
const SAFE_AREA_EDGES: Edge[] =
  Platform.OS === "ios"
    ? ["top", "bottom", "left", "right"]
    : ["bottom", "left", "right"];

interface QueueItem {
  id: number;
  queue_number: string;
  status: string;
  is_you: boolean;
  eta_minutes?: number;
  eta_time?: string | null;
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

  people_ahead: number | null;

  estimated_wait: number;

  // Web realtime estimate (same as web ticket page)
  estimated_wait_minutes?: number | null;
  estimated_call_time?: string | null;
  estimated_label?: string | null;

  queue_list: QueueItem[];
}

/** Expo Router may return string | string[] for search params. */
function paramStr(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

function paramInt(v: unknown): number {
  const n = parseInt(paramStr(v), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function LiveQueueScreen() {
  // Web parent "View Queue": ticket id + child_id
  // Mobile: queueId | ticketId | studentId | childId
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [liveQueue, setLiveQueue] = useState<LiveQueue | null>(null);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  const resolveTicketId = async (): Promise<number | null> => {
    // Direct ticket id from navigation (parent home passes active_ticket_id as queueId)
    const direct =
      paramInt(params.queueId) ||
      paramInt(params.ticketId) ||
      paramInt(params.id);
    if (direct > 0) return direct;

    const sid = paramInt(params.studentId) || paramInt(params.childId);
    if (sid <= 0) return null;

    // Resolve active ticket for this student/child
    const cur = await fetchJsonOrNull(API.getCurrentQueue, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: sid }),
    });
    // get_current_queue.php → { success, queue: { id, ... } }
    const tid =
      paramInt(cur?.queue?.id) ||
      paramInt(cur?.ticket?.id) ||
      paramInt(cur?.id);
    return tid > 0 ? tid : null;
  };

  const loadQueue = async () => {
    try {
      setErrorMsg(null);
      const ticketId = await resolveTicketId();
      if (!ticketId) {
        setErrorMsg("No active queue found for this child.");
        setLiveQueue(null);
        return;
      }

      const sid = paramInt(params.studentId) || paramInt(params.childId);
      const json = await fetchJsonOrNull(
        API.getLiveQueue,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queue_id: ticketId,
            ticket_id: ticketId,
            student_id: sid || undefined,
            child_id: sid || undefined,
          }),
        },
        "Live Queue Error",
      );

      if (json?.success) {
        setLiveQueue(json);
        updateLiveTicketWidget({
          ticketId,
          ticket: json.queue?.queue_number,
          office: json.queue?.office,
          window: json.queue?.window,
          status: json.queue?.status,
          nowServing: json.now_serving,
          peopleAhead: json.people_ahead,
          estimatedWait: json.estimated_wait,
        });
      } else {
        setErrorMsg(json?.message || "Could not load live queue");
        console.log("Live queue API:", json?.message, "ticketId=", ticketId);
      }
    } catch (error) {
      console.log("ERROR:", error);
      setErrorMsg("Network error loading live queue");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadQueue();
    } finally {
      setRefreshing(false);
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
    called: 1, // sunod na tatawagin / papasok
    waiting: 2, // naghihintay pa sa likod
    completed: 3, // tapos na
    cancelled: 4, // kinansela
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
      const priorityDiff =
        getStatusPriority(a.status) - getStatusPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return 0; // stable sort — mananatili ang orihinal na pagkakasunod-sunod kapag parehong priority
    });
  }, [queueList]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={SAFE_AREA_EDGES}>
        <AppHeader title="Live Queue" />
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 100 }}
        />
      </SafeAreaView>
    );
  }

  if (errorMsg || !liveQueue) {
    return (
      <SafeAreaView style={styles.safeArea} edges={SAFE_AREA_EDGES}>
        <AppHeader title="Live Queue" />
        <View style={{ padding: 24, alignItems: "center", marginTop: 40 }}>
          <Text
            style={{
              color: COLORS.gray,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {errorMsg || "No active queue to display."}
          </Text>
          <Text
            style={{ color: COLORS.primary, fontWeight: "700" }}
            onPress={goBack}
          >
            Go back
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={SAFE_AREA_EDGES}>
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
            <Text style={styles.statValue}>{liveQueue?.people_ahead ?? "—"}</Text>
            <Text style={styles.statLabel}>People Ahead</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {liveQueue?.estimated_wait ?? 0}
            </Text>
            <Text style={styles.statLabel}>Est. Minutes</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: 20 }]} numberOfLines={1}>
              {liveQueue?.estimated_call_time ?? "--"}
            </Text>
            <Text style={styles.statLabel}>Est. Call Time</Text>
          </View>
        </View>

        {!!liveQueue?.estimated_label && (
          <Text style={styles.etaLabel}>
            {liveQueue.estimated_call_time
              ? `Estimated call time: ${liveQueue.estimated_label}`
              : liveQueue.estimated_label}
          </Text>
        )}

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.queueItem, item.is_you && styles.youQueue]}>
            <View>
              <Text style={styles.queueItemNumber}>{item.queue_number}</Text>

              <Text style={styles.queueItemStatus}>
                {item.status.toUpperCase()}
                {item.status === "waiting" && item.eta_time
                  ? ` · Est. ${item.eta_time} (~${item.eta_minutes ?? 0} mins)`
                  : ""}
              </Text>
            </View>

            {item.is_you && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>YOU</Text>
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

  etaLabel: {
    marginTop: SPACING.sm,
    textAlign: "center",
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "700",
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
