import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import FeedbackModal from "@/components/feedback/feedback-modal";
import ProceedModal, { ProceedKind } from "@/components/queue/proceed-modal";
import {
  isAlarmType,
  useNotifications,
} from "@/components/notification/use-notification";
import AppHeader from "../../components/layout/app-header";
import AnimatedPressable from "../../components/ui/animated-pressable";
import StatusBadge from "../../components/ui/status-badge";
import Skeleton from "../../components/ui/skeleton";
import { API } from "@/constants/backend";
import { fetchJsonOrNull } from "@/utils/api";
import {
  clearLiveTicketWidget,
  updateLiveTicketWidget,
} from "@/utils/live-ticket-widget";
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from "../../constants/theme";

interface Child {
  id: number;
  first_name: string;
  last_name: string;
  sr_code: string;
  school_level: string;
  grade_year: string;
  account_status: string;
  relationship: string;
  is_primary: number;
  active_ticket_id: number | null;
  active_status: string | null;
  active_queue_number: string | null;
  active_office: string | null;
}

function hasActiveTicket(c: Child): boolean {
  const id = Number(c.active_ticket_id);
  return Number.isFinite(id) && id > 0;
}

export default function ParentHome() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parentName, setParentName] = useState("");
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingFeedbackList, setPendingFeedbackList] = useState<any[]>([]);
  const [feedbackTarget, setFeedbackTarget] = useState<any | null>(null);
  const feedbackBlockedIds = new Set(
    pendingFeedbackList.map((f) => Number(f.student_id)),
  );
  // One active queue per parent account (practical: parent can't be in two offices)
  const familyHasActiveQueue = children.some((c) => hasActiveTicket(c));
  const activeQueueChild = children.find((c) => hasActiveTicket(c));
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      setParentName(user.full_name || "Parent");
      const parentId = user.id;

      const [kidsRes, reqRes, fbRes] = await Promise.all([
        fetchJsonOrNull(API.getParentChildren, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: parentId }),
        }),
        fetchJsonOrNull(API.getParentLinkRequests, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: parentId }),
        }),
        fetchJsonOrNull(API.getParentPendingFeedback, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: parentId }),
        }),
      ]);

      if (kidsRes?.success) {
        const loadedChildren: Child[] = kidsRes.children || [];
        setChildren(loadedChildren);
        const activeChild = loadedChildren.find((child) =>
          hasActiveTicket(child),
        );
        if (activeChild?.active_ticket_id) {
          updateLiveTicketWidget({
            ticketId: Number(activeChild.active_ticket_id),
            ticket: activeChild.active_queue_number,
            office: activeChild.active_office,
            status: activeChild.active_status,
          });
        } else {
          clearLiveTicketWidget();
        }
        setLoadError(null);
      } else {
        setChildren([]);
        setLoadError(
          kidsRes?.message ||
            kidsRes?.error ||
            "Failed to load children. Pull to refresh.",
        );
      }
      if (reqRes?.success) setPendingRequests(reqRes.requests || []);
      if (fbRes?.success) setPendingFeedbackList(fbRes.pending || []);
    } catch (e) {
      console.warn(e);
      setLoadError("Network error. Pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  /*
  | Parents get the same alarm as their child: the shared notification
  | provider polls the parent endpoint, and anything alarm-worthy
  | (next_in_line / called / in_progress) opens the blocking prompt here.
  | The sound is the device's notification tone from the system
  | notification, so it also fires with the app in the background.
  */
  const { notifications } = useNotifications();
  const [alarm, setAlarm] = useState<any>(null);
  const acknowledgedAlarmKey = useRef<string | null>(null);

  useEffect(() => {
    // Only ring for something that just happened — the feed also carries
    // older history, which must not trigger an alarm on app open.
    const FRESH_MS = 10 * 60 * 1000;
    const latest = notifications.find((n) => {
      if (!isAlarmType(n.type)) return false;
      const ts = new Date((n.created_at ?? "").replace(" ", "T")).getTime();
      return Number.isNaN(ts) ? false : Date.now() - ts <= FRESH_MS;
    });
    if (!latest) {
      setAlarm(null);
      return;
    }

    const key = `${latest.ticket_id}:${latest.type}`;
    if (acknowledgedAlarmKey.current === key) return;

    setAlarm({ ...latest, key });
  }, [notifications]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <View style={styles.container}>
      <AppHeader title="Parent Dashboard" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{parentName}</Text>
          <Text style={styles.sub}>
            Parent / Guardian · {children.length}{" "}
            {children.length === 1 ? "child" : "children"} linked
          </Text>
        </View>

        {pendingFeedbackList.map((fb) => (
          <View key={fb.ticket_id} style={styles.feedbackBanner}>
            <Text style={styles.feedbackBannerText}>
              <Text style={{ fontWeight: "700" }}>
                {fb.first_name} {fb.last_name}
              </Text>{" "}
              has pending feedback for Ticket #{fb.queue_number} at{" "}
              {fb.office_name}
            </Text>
            <AnimatedPressable
              style={styles.feedbackCta}
              onPress={() => setFeedbackTarget(fb)}
            >
              <Text style={styles.feedbackCtaText}>Submit</Text>
            </AnimatedPressable>
          </View>
        ))}

        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending link requests</Text>
            {pendingRequests.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {r.first_name} {r.last_name} ({r.sr_code})
                </Text>
                <Text style={styles.cardMeta}>
                  {r.school_level} · {r.relationship} · waiting for approval
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Linked children</Text>
          {loadError ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: "#b91c1c" }]}>
                {loadError}
              </Text>
              <AnimatedPressable
                style={styles.primaryBtn}
                onPress={() => {
                  setLoading(true);
                  load();
                }}
              >
                <Text style={styles.primaryBtnText}>Retry</Text>
              </AnimatedPressable>
            </View>
          ) : loading ? (
            <>
              <Skeleton width="100%" height={90} radius={RADIUS.md} />
              <View style={{ height: 12 }} />
              <Skeleton width="100%" height={90} radius={RADIUS.md} />
            </>
          ) : children.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={COLORS.gray} />
              <Text style={styles.emptyText}>No children linked yet</Text>
              <AnimatedPressable
                style={styles.primaryBtn}
                onPress={() => router.push("/parent/add-child")}
              >
                <Text style={styles.primaryBtnText}>Add a child</Text>
              </AnimatedPressable>
            </View>
          ) : (
            children.map((c) => (
              <View key={c.id} style={styles.childCard}>
                <View style={styles.childTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(c.first_name?.[0] || "") + (c.last_name?.[0] || "")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {c.first_name} {c.last_name}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {c.sr_code} · {c.school_level}
                      {c.grade_year ? ` · ${c.grade_year}` : ""}
                    </Text>
                    <Text style={styles.cardMeta}>{c.relationship}</Text>
                  </View>
                </View>

                {hasActiveTicket(c) ? (
                  <View style={styles.ticketBox}>
                    <View style={styles.ticketRow}>
                      <Text style={styles.ticketOffice}>{c.active_office}</Text>
                      <StatusBadge status={c.active_status || "waiting"} />
                    </View>
                    <Text style={styles.queueNum}>
                      #{c.active_queue_number}
                    </Text>
                    <View style={{ gap: 8, width: "100%" }}>
                      <AnimatedPressable
                        style={styles.outlineBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/parent/ticket",
                            params: {
                              ticketId: String(c.active_ticket_id),
                              queueId: String(c.active_ticket_id),
                              childId: String(c.id),
                              studentId: String(c.id),
                              asParent: "1",
                            },
                          } as any)
                        }
                      >
                        <Text style={styles.outlineBtnText}>View ticket</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={styles.outlineBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/parent/live-queue",
                            params: {
                              queueId: String(c.active_ticket_id),
                              childId: String(c.id),
                              studentId: String(c.id),
                            },
                          } as any)
                        }
                      >
                        <Text style={styles.outlineBtnText}>Live board</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noTicket}>
                    <Text style={styles.noTicketText}>No active queue</Text>
                    {feedbackBlockedIds.has(c.id) ? (
                      <Text style={styles.noTicketText}>
                        Submit pending feedback first
                      </Text>
                    ) : familyHasActiveQueue ? (
                      <Text style={styles.noTicketText}>
                        {activeQueueChild
                          ? `${activeQueueChild.first_name} is already on queue. Finish or cancel that ticket first.`
                          : "Another child is already on queue. Only one active queue at a time."}
                      </Text>
                    ) : (
                      <AnimatedPressable
                        style={styles.outlineBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/parent/queue",
                            params: {
                              forStudentId: String(c.id),
                              childName: `${c.first_name} ${c.last_name}`,
                            },
                          } as any)
                        }
                      >
                        <Text style={styles.outlineBtnText}>
                          Join queue for child
                        </Text>
                      </AnimatedPressable>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {feedbackTarget && (
        <FeedbackModal
          visible={!!feedbackTarget}
          transaction={
            {
              ticket_id: feedbackTarget.ticket_id,
              queue_number: feedbackTarget.queue_number,
              office_name: feedbackTarget.office_name,
            } as any
          }
          studentId={feedbackTarget.student_id}
          onClose={() => setFeedbackTarget(null)}
          onSubmitted={() => {
            setFeedbackTarget(null);
            load();
          }}
        />
      )}

      <ProceedModal
        visible={!!alarm}
        kind={
          (alarm?.type === "next_in_line" ? "next" : "proceed") as ProceedKind
        }
        info={
          alarm
            ? {
                queueNumber: alarm.queue_number,
                officeName: alarm.child_name
                  ? `${alarm.office_name ?? ""} · ${alarm.child_name}`.trim()
                  : alarm.office_name,
                windowName: alarm.window_name,
                status: alarm.type,
              }
            : null
        }
        onAcknowledge={() => {
          acknowledgedAlarmKey.current = alarm?.key ?? null;
          setAlarm(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  greeting: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  name: { color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 4 },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  childCard: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  childTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.primary, fontWeight: "700", fontSize: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  ticketBox: {
    marginTop: SPACING.md,
    backgroundColor: "#f8fafc",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketOffice: { fontWeight: "600", color: COLORS.text },
  queueNum: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
    marginVertical: 6,
  },
  noTicket: { marginTop: SPACING.md, alignItems: "flex-start" },
  noTicketText: { color: COLORS.gray, marginBottom: 8 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "stretch",
    alignItems: "center",
  },
  outlineBtnText: { color: COLORS.primary, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: COLORS.gray, marginTop: 8, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  feedbackBanner: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  feedbackBannerText: { flex: 1, color: COLORS.text, fontSize: 13 },
  feedbackCta: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedbackCtaText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
