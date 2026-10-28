import { clientAlert } from '@/components/client/client-ui';
import { TourTarget, TutorialScrollView } from '@/components/tutorial/tutorial';
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
import RequeueModal from "@/components/queue/requeue-modal";
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
import { formatDuration } from "@/utils/format-duration";
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
  active_count?: number;
}

/** One live ticket of a child (get_current_queue + get_queue_details). */
interface LiveTicket {
  id: number;
  queue_number: string;
  status: string;
  office_name: string;
  window_name?: string | null;
  people_ahead?: number;
  estimated_wait_minutes?: number | null;
  is_reserved?: boolean;
  is_requeued?: boolean;
  requeue_confirmed?: boolean;
  depends_on_queue_number?: string | null;
  depends_on_office_name?: string | null;
  called_at?: string | null;
  estimated_call_time?: string | null;
  estimated_label?: string | null;
  can_cancel?: boolean;
}

function hasActiveTicket(c: Child): boolean {
  const id = Number(c.active_ticket_id);
  return (Number.isFinite(id) && id > 0) || Number(c.active_count || 0) > 0;
}

const post = (url: string, body: any) =>
  fetchJsonOrNull(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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
  // Web parity: every child can hold their own tickets (no family-wide lock).
  const [parentIdState, setParentIdState] = useState(0);
  const [liveByChild, setLiveByChild] = useState<Record<number, LiveTicket[]>>({});
  const activeTicketCount = Object.values(liveByChild).reduce((n, l) => n + l.length, 0);
  const requeueTarget = (() => {
    for (const [cid, list] of Object.entries(liveByChild)) {
      const t = list.find((x) => x.is_requeued && !x.requeue_confirmed);
      if (t) return { childId: Number(cid), ticket: t };
    }
    return null;
  })();
  const [loadError, setLoadError] = useState<string | null>(null);
  // Web parent dashboard: "Offices open" hero stat + "Last updated" stamp.
  const [officesOpen, setOfficesOpen] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loadingRef=useRef(false);
  const generationRef=useRef(0);
  const load = useCallback(async () => {
    if(loadingRef.current)return;
    loadingRef.current=true; const generation=generationRef.current;
    try {
      const raw = await AsyncStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      setParentName(user.full_name || "Parent");
      const parentId = user.id;
      setParentIdState(Number(parentId) || 0);

      const [kidsRes, reqRes, fbRes, officeRes] = await Promise.all([
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
        fetchJsonOrNull(API.getOffice),
      ]);
      if(generation!==generationRef.current || await AsyncStorage.getItem('user')!==raw)return;
      if (officeRes?.success) {
        const list: any[] = officeRes.offices || [];
        setOfficesOpen(
          typeof officeRes.stats?.open_offices === "number"
            ? officeRes.stats.open_offices
            : list.filter((o) => !!o.is_open).length,
        );
      }

      if (kidsRes?.success) {
        const loadedChildren: Child[] = kidsRes.children || [];
        setChildren(loadedChildren);

        // Live details for each child's active tickets (people ahead, ETA, window).
        const liveEntries = await Promise.all(
          loadedChildren.filter(hasActiveTicket).map(async (child) => {
            const cur = await post(API.getCurrentQueue, { parent_id: parentId, child_id: child.id });
            const queues: any[] = cur?.success ? cur.queues || (cur.queue ? [cur.queue] : []) : [];
            const detailed = await Promise.all(
              queues.map(async (q) => {
                if (q.status === "reserved") return q as LiveTicket;
                const d = await post(API.getQueueDetails, { parent_id: parentId, child_id: child.id, ticket_id: q.id });
                return { ...q, ...(d?.success ? d.queue : {}) } as LiveTicket;
              }),
            );
            return [child.id, detailed] as const;
          }),
        );
        if(generation!==generationRef.current || await AsyncStorage.getItem('user')!==raw)return;
        setLiveByChild(Object.fromEntries(liveEntries));
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
        setLastUpdated(
          new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
        );
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
      loadingRef.current=false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Same 3-second live refresh as the web parent dashboard (parent-dashboard.js).
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 3000);
      return () => { clearInterval(t); generationRef.current++; };
    }, [load]),
  );

  const cancelTicket = (child: Child, t: LiveTicket) => {
    clientAlert(
      "Cancel queue",
      `Cancel ticket #${t.queue_number} at ${t.office_name} for ${child.first_name}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel queue",
          style: "destructive",
          onPress: async () => {
            const res = await post(API.cancelQueue, {
              parent_id: parentIdState,
              child_id: child.id,
              student_id: child.id,
              queue_id: t.id,
            });
            if (!res?.success) clientAlert("Not cancelled", res?.message || "Unable to cancel this ticket.");
            load();
          },
        },
      ],
    );
  };

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
      <TutorialScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        <TourTarget id="dashboard"><Text style={{fontSize:16,fontWeight:"700",color:COLORS.primary,marginBottom:12}}>Queue overview</Text></TourTarget>
        <View style={styles.hero}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{parentName}</Text>
          <Text style={styles.sub}>
            Parent / Guardian · {children.length}{" "}
            {children.length === 1 ? "child" : "children"} linked
            {activeTicketCount > 0 ? ` · ${activeTicketCount} active ${activeTicketCount === 1 ? "queue" : "queues"}` : ""}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{children.length}</Text>
              <Text style={styles.heroStatLabel}>Children</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{activeTicketCount}</Text>
              <Text style={styles.heroStatLabel}>Active queues</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{officesOpen ?? "—"}</Text>
              <Text style={styles.heroStatLabel}>Offices open</Text>
            </View>
          </View>
        </View>

        {pendingFeedbackList.map((fb) => (
          <View key={fb.ticket_id} style={styles.feedbackBanner}>
            <Text style={styles.feedbackBannerText}>
              <Text style={{ fontWeight: "700" }}>
                {fb.first_name} {fb.last_name}
              </Text>{" "}
              has pending CSM for Ticket #{fb.queue_number} at{" "}
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
          <View style={styles.sectionHead}>
            <TourTarget id="children"><Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Linked children</Text></TourTarget>
            <AnimatedPressable style={styles.refreshBtn} onPress={onRefresh}>
              <Ionicons name="refresh" size={14} color={COLORS.primary} />
              <Text style={styles.refreshText}>Refresh</Text>
            </AnimatedPressable>
          </View>
          {!!lastUpdated && (
            <Text style={styles.lastUpdated}>Last updated {lastUpdated}</Text>
          )}
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
                  <View
                    style={[
                      styles.acctBadge,
                      c.account_status === "profile_only" && styles.acctBadgeProfile,
                    ]}
                  >
                    <Text
                      style={[
                        styles.acctBadgeText,
                        c.account_status === "profile_only" && { color: COLORS.warning },
                      ]}
                    >
                      {c.account_status === "profile_only" ? "Profile only" : "Student account"}
                    </Text>
                  </View>
                </View>

                {(liveByChild[c.id] || []).map((t) => (
                  <View key={t.id} style={styles.ticketBox}>
                    <View style={styles.ticketRow}>
                      <Text style={styles.ticketOffice}>{t.office_name}</Text>
                      <StatusBadge status={t.status || "waiting"} />
                    </View>
                    <Text style={styles.queueNum}>#{t.queue_number}</Text>
                    {t.is_reserved ? (
                      <Text style={styles.cardMeta}>
                        Reserved — joins the line after
                        {t.depends_on_queue_number ? ` #${t.depends_on_queue_number}` : " the current ticket"}
                        {t.depends_on_office_name ? ` at ${t.depends_on_office_name}` : ""} is done.
                      </Text>
                    ) : (
                      <>
                        {(["called", "in_progress"].includes(t.status) || !!t.called_at) && (
                          <View style={styles.calledAlert}>
                            <Ionicons name="megaphone-outline" size={16} color={COLORS.success} />
                            <Text style={styles.calledAlertText}>
                              {c.first_name} is being called! Proceed now to{" "}
                              {t.window_name || "the assigned window"}.
                            </Text>
                          </View>
                        )}
                        <View style={styles.liveGrid}>
                          {[
                            ["People Ahead", typeof t.people_ahead === "number" ? String(t.people_ahead) : "—"],
                            ["Estimated Wait", formatDuration(t.estimated_wait_minutes)],
                            ["Assigned Window", t.window_name || "Not yet assigned"],
                            ["Estimated Call Time", t.estimated_label || t.estimated_call_time || "—"],
                          ].map(([label, value]) => (
                            <View key={label} style={styles.liveRow}>
                              <Text style={styles.liveLabel}>{label}</Text>
                              <Text style={styles.liveValue} numberOfLines={1}>{value}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                    <View style={{ gap: 8, width: "100%", marginTop: 8 }}>
                      <AnimatedPressable
                        style={styles.outlineBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/parent/ticket",
                            params: {
                              ticketId: String(t.id),
                              queueId: String(t.id),
                              childId: String(c.id),
                              studentId: String(c.id),
                              asParent: "1",
                            },
                          } as any)
                        }
                      >
                        <Text style={styles.outlineBtnText}>View ticket</Text>
                      </AnimatedPressable>
                      {!t.is_reserved && (
                        <AnimatedPressable
                          style={styles.outlineBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/parent/live-queue",
                              params: { queueId: String(t.id), childId: String(c.id), studentId: String(c.id) },
                            } as any)
                          }
                        >
                          <Text style={styles.outlineBtnText}>Live board</Text>
                        </AnimatedPressable>
                      )}
                      {!t.is_reserved && (
                        <AnimatedPressable
                          style={styles.outlineBtn}
                          onPress={() =>
                            router.push({
                              pathname: "/parent/live-monitor",
                              params: { childId: String(c.id) },
                            } as any)
                          }
                        >
                          <Text style={styles.outlineBtnText}>Office live monitor</Text>
                        </AnimatedPressable>
                      )}
                      {(t.can_cancel ?? (["waiting", "reserved", "next"].includes(t.status) && !t.called_at)) && (
                        <AnimatedPressable
                          style={[styles.outlineBtn, { borderColor: "#ef4444" }]}
                          onPress={() => cancelTicket(c, t)}
                        >
                          <Text style={[styles.outlineBtnText, { color: "#ef4444" }]}>Cancel queue</Text>
                        </AnimatedPressable>
                      )}
                    </View>
                  </View>
                ))}
                <View style={styles.noTicket}>
                  {!hasActiveTicket(c) && <Text style={styles.noTicketText}>No active queue</Text>}
                  {hasActiveTicket(c) ? (
                    // Web parent dashboard blocks joining while the child already
                    // has an active queue ("{first} already has an active queue.").
                    <Text style={styles.noTicketText}>{c.first_name || "This child"} already has an active queue.</Text>
                  ) : (
                    <AnimatedPressable
                      style={styles.outlineBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/parent/queue",
                          params: { forStudentId: String(c.id), childName: `${c.first_name} ${c.last_name}` },
                        } as any)
                      }
                    >
                      <Text style={styles.outlineBtnText}>Join queue for child</Text>
                    </AnimatedPressable>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </TutorialScrollView>

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

      <RequeueModal
        visible={!!requeueTarget}
        studentId={requeueTarget?.childId ?? 0}
        parentId={parentIdState}
        ticketId={requeueTarget?.ticket.id ?? null}
        queueNumber={requeueTarget?.ticket.queue_number}
        onResolved={() => load()}
      />

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
  heroStats: { flexDirection: "row", gap: 8, marginTop: SPACING.md },
  heroStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  heroStatValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroStatLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  refreshText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  lastUpdated: { fontSize: 11, color: COLORS.gray, marginBottom: SPACING.sm },
  acctBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  acctBadgeProfile: { backgroundColor: COLORS.warningLight },
  acctBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.success },
  calledAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.sm,
    padding: 8,
    marginBottom: 6,
  },
  calledAlertText: { flex: 1, color: COLORS.success, fontWeight: "700", fontSize: 13 },
  liveGrid: { gap: 4, marginTop: 2 },
  liveRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  liveLabel: { fontSize: 12, color: COLORS.gray },
  liveValue: { flexShrink: 1, fontSize: 12, fontWeight: "700", color: COLORS.text, textAlign: "right" },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
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
