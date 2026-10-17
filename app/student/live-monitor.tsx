/**
 * Office live monitor — mobile port of the web "Live Queue" monitor
 * (web: public/assets/js/student-queue.js + api/public-live-queue.php).
 *
 * Shows every office's OPEN windows with Now serving / Next / Waiting list
 * (with estimated call time), paused state, waiting count, and highlights
 * the student's (or the parent's child's) own ticket. Polls every 3s like web.
 *
 * Params (optional): officeId, studentId | childId
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

import AppHeader from "@/components/layout/app-header";
import { API } from "@/constants/backend";
import { COLORS, RADIUS, SHADOWS, SPACING } from "@/constants/theme";
import { fetchJsonOrNull } from "@/utils/api";

const SAFE_AREA_EDGES: Edge[] =
  Platform.OS === "ios"
    ? ["top", "bottom", "left", "right"]
    : ["bottom", "left", "right"];

const POLL_MS = 3000;

type Slot = { queue_number: string; eta_label: string | null } | null;

interface MonitorWindow {
  id: number;
  name: string;
  queue_type: string | null;
  is_paused: boolean;
  status: string;
  current: Slot;
  next: Slot;
  waiting: { queue_number: string; eta_label: string | null }[];
  waiting_count: number;
  last: Slot;
}

interface MonitorOffice {
  id: number;
  name: string;
  slug?: string;
  windows: MonitorWindow[];
}

interface MonitorYou {
  window_id: number;
  office_id: number;
  queue_number: string;
}

function paramInt(v: unknown): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function LiveMonitorScreen() {
  const params = useLocalSearchParams();
  const paramOffice = paramInt(params.officeId);
  const paramStudent = paramInt(params.studentId) || paramInt(params.childId);

  const [studentId, setStudentId] = useState<number>(paramStudent);
  const [offices, setOffices] = useState<MonitorOffice[]>([]);
  const [you, setYou] = useState<MonitorYou | null>(null);
  const [activeOffice, setActiveOffice] = useState<number>(paramOffice);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userPickedOffice = useRef(paramOffice > 0);

  // Students: default to the logged-in student. Parents must pass childId.
  useEffect(() => {
    if (paramStudent > 0) return;
    (async () => {
      try {
        const role = await AsyncStorage.getItem("role");
        const raw = await AsyncStorage.getItem("user");
        if (raw && role !== "parent") {
          const u = JSON.parse(raw);
          const id = paramInt(u?.id);
          if (id > 0) setStudentId(id);
        }
      } catch {}
    })();
  }, [paramStudent]);

  const load = useCallback(async () => {
    const json = await fetchJsonOrNull(API.publicLiveQueue, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId || undefined }),
    });
    if (json?.success) {
      setError(null);
      const list: MonitorOffice[] = json.offices ?? [];
      setOffices(list);
      setYou(json.you ?? null);
      setGeneratedAt(json.generated_at ?? "");
      setActiveOffice((prev) => {
        if (prev > 0 && list.some((o) => o.id === prev)) return prev;
        // Web: auto-focus the office where the student has a ticket.
        if (!userPickedOffice.current && json.you?.office_id) {
          return json.you.office_id;
        }
        return list[0]?.id ?? 0;
      });
    } else if (!offices.length) {
      setError(json?.message || "Could not load the live queue.");
    }
    setLoading(false);
  }, [studentId, offices.length]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const office = useMemo(
    () => offices.find((o) => o.id === activeOffice) ?? null,
    [offices, activeOffice],
  );
  // Web shows only windows that are not closed.
  const openWindows = useMemo(
    () => (office?.windows ?? []).filter((w) => w.status !== "closed"),
    [office],
  );

  const isYou = (winId: number, qn?: string | null) =>
    !!you && !!qn && you.window_id === winId && you.queue_number === qn;

  return (
    <SafeAreaView style={styles.safe} edges={SAFE_AREA_EDGES}>
      <AppHeader title="Live Queue Monitor" />

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 80 }} />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : (
        <ScrollView
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
          {/* Office tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {offices.map((o) => {
              const active = o.id === activeOffice;
              const mine = you?.office_id === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => {
                    userPickedOffice.current = true;
                    setActiveOffice(o.id);
                  }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                    {o.name}
                    {mine ? " •" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!!you && (
            <View style={styles.youBanner}>
              <Text style={styles.youBannerText}>
                Your ticket: <Text style={{ fontWeight: "900" }}>{you.queue_number}</Text>
              </Text>
            </View>
          )}

          {openWindows.length === 0 ? (
            <Text style={styles.empty}>No open windows in this office right now.</Text>
          ) : (
            openWindows.map((w) => {
              const myWindow = you?.window_id === w.id;
              return (
                <View key={w.id} style={[styles.card, myWindow && styles.cardMine]}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.winName}>{w.name}</Text>
                      {!!w.queue_type && (
                        <Text style={styles.winType}>
                          {w.queue_type.charAt(0).toUpperCase() + w.queue_type.slice(1)}
                        </Text>
                      )}
                    </View>
                    {w.is_paused ? (
                      <View style={[styles.pill, { backgroundColor: COLORS.warningLight }]}>
                        <Text style={[styles.pillText, { color: COLORS.warning }]}>Paused</Text>
                      </View>
                    ) : (
                      <View style={[styles.pill, { backgroundColor: COLORS.successLight }]}>
                        <Text style={[styles.pillText, { color: COLORS.success }]}>Open</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.row}>
                    <View style={styles.cell}>
                      <Text style={styles.cellLabel}>NOW SERVING</Text>
                      <Text style={[styles.cellValue, isYou(w.id, w.current?.queue_number) && styles.youText]}>
                        {w.current?.queue_number ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.cellDivider} />
                    <View style={styles.cell}>
                      <Text style={styles.cellLabel}>NEXT</Text>
                      <Text style={[styles.cellValue, isYou(w.id, w.next?.queue_number) && styles.youText]}>
                        {w.next?.queue_number ?? "—"}
                      </Text>
                      {!!w.next?.eta_label && <Text style={styles.eta}>{w.next.eta_label}</Text>}
                    </View>
                  </View>

                  <Text style={styles.waitHead}>Waiting ({w.waiting_count})</Text>
                  {w.waiting.length === 0 ? (
                    <Text style={styles.waitEmpty}>No one waiting.</Text>
                  ) : (
                    w.waiting.map((t) => {
                      const mine = isYou(w.id, t.queue_number);
                      return (
                        <View key={t.queue_number} style={[styles.waitItem, mine && styles.waitItemMine]}>
                          <Text style={[styles.waitNum, mine && styles.youText]}>
                            {t.queue_number}
                            {mine ? "  (You)" : ""}
                          </Text>
                          {!!t.eta_label && <Text style={styles.eta}>{t.eta_label}</Text>}
                        </View>
                      );
                    })
                  )}
                  {w.waiting_count > w.waiting.length && !!w.last && (
                    <Text style={styles.more}>
                      … last in line: {w.last.queue_number}
                      {w.last.eta_label ? ` (${w.last.eta_label})` : ""}
                    </Text>
                  )}
                </View>
              );
            })
          )}

          {!!generatedAt && <Text style={styles.updated}>Last updated {generatedAt}</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  empty: { textAlign: "center", color: COLORS.gray, marginTop: 40, paddingHorizontal: 24 },
  tabs: { gap: SPACING.sm, paddingBottom: SPACING.md },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.secondary, fontWeight: "700", fontSize: 13, maxWidth: 200 },
  tabTextActive: { color: COLORS.white },
  youBanner: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  youBannerText: { color: COLORS.primary, textAlign: "center", fontWeight: "600" },
  card: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardMine: { borderColor: COLORS.primary, borderWidth: 2 },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  winName: { fontSize: 16, fontWeight: "800", color: COLORS.secondary },
  winType: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  pill: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full },
  pillText: { fontSize: 11, fontWeight: "800" },
  row: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  cell: { flex: 1, alignItems: "center", paddingHorizontal: SPACING.xs },
  cellDivider: { width: 1, backgroundColor: COLORS.border },
  cellLabel: { fontSize: 10, fontWeight: "800", color: COLORS.gray, letterSpacing: 0.6 },
  cellValue: { fontSize: 22, fontWeight: "900", color: COLORS.primary, marginTop: 2 },
  eta: { fontSize: 11, color: COLORS.gray, marginTop: 2, textAlign: "center" },
  youText: { color: COLORS.success },
  waitHead: { marginTop: SPACING.md, marginBottom: SPACING.xs, fontWeight: "800", color: COLORS.secondary },
  waitEmpty: { color: COLORS.gray, fontSize: 12 },
  waitItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  waitItemMine: { backgroundColor: COLORS.successLight, borderRadius: RADIUS.sm, paddingHorizontal: 6 },
  waitNum: { fontWeight: "700", color: COLORS.secondary },
  more: { marginTop: 6, fontSize: 12, color: COLORS.gray },
  updated: { textAlign: "center", color: COLORS.gray, fontSize: 11, marginTop: SPACING.sm },
});
