import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { usePortal } from "./context";
import { request, query } from "./api";
import { Actor, actorFields } from "./domain";
import { useResource } from "./use-resource";
import {
  Button,
  ChildPicker,
  Copy,
  Empty,
  Heading,
  Notice,
  Screen,
  Status,
} from "./ui";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { ASSET_BASE_URL } from "@/constants/backend";
import { TourTarget } from "@/components/tutorial/tutorial";
import { dashboardStyles as d } from "./original-student-styles";
import { parentStyles as ps } from "./original-parent-styles";
import { OfficesContent } from "./offices";
import { updateLiveTicketWidget } from "@/utils/live-ticket-widget";
import FeedbackModal from "@/components/feedback/feedback-modal";
import { formatDuration } from "@/utils/format-duration";
export default function HomeScreen() {
  const p = usePortal(),
    [feedback, setFeedback] = useState<any>(null);
  useFocusEffect(
    useCallback(() => {
      void p.reloadChildren();
    }, [p.reloadChildren]),
  );
  const childrenKey = p.children.map((c) => c.id).join(",");
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const idFields =
        p.role === "parent"
          ? { parent_id: p.user.id }
          : { student_id: p.user.id };
      const [offices, feedback, queues] = await Promise.all([
        request("get_offices.php", undefined, signal),
        request(
          `${p.role === "parent" ? "get_parent_pending_feedback.php" : "get_pending_feedback.php"}?${query(idFields)}`,
          undefined,
          signal,
        ),
        Promise.all(
          (p.role === "parent" && !p.actor.studentId
            ? childrenKey
                .split(",")
                .filter(Boolean)
                .map(
                  (id) =>
                    ({
                      role: "parent",
                      id: p.user.id,
                      studentId: Number(id),
                    }) as Actor,
                )
            : p.actor.studentId
              ? [{ role: p.role, id: p.user.id, studentId: p.actor.studentId }]
              : []
          ).map(async (a) => {
            const data = await request(
              "get_current_queue.php",
              actorFields(a),
              signal,
            );
            return (data.queues || []).map((q: any) => ({
              ...q,
              student_id: a.studentId,
            }));
          }),
        ).then((groups) => ({ queues: groups.flat() })),
      ]);
      const liveQueues = await Promise.all(
        (queues.queues || []).map(async (q: any) => {
          if (q.status === "reserved") return q;
          const detail = await request(
            "get_queue_details.php",
            {
              ...actorFields({
                role: p.role,
                id: p.user.id,
                studentId: Number(q.student_id || p.actor.studentId),
              }),
              ticket_id: q.id,
            },
            signal,
          );
          return { ...q, ...detail.queue };
        }),
      );
      return {
        offices,
        feedback:
          p.role === "parent"
            ? feedback.pending || []
            : feedback.transactions ||
              (feedback.transaction ? [feedback.transaction] : []),
        queues: liveQueues,
      };
    },
    [p.role, p.user.id, p.actor.studentId, childrenKey],
  );
  const r = useResource(loader, 5000),
    name = p.user.first_name || p.user.full_name?.split(" ")[0] || "there";
  useEffect(() => {
    const t =
      r.data?.queues.find((q: any) => q.status !== "reserved") ||
      r.data?.queues[0];
    if (t)
      void updateLiveTicketWidget({
        ticketId: t.id,
        ticket: t.queue_number,
        office: t.office_name,
        window: t.window_name,
        status: t.status,
      });
  }, [r.data]);
  const open = (id: number, childId = p.child?.id) =>
    router.push({
      pathname: `/${p.role}/ticket`,
      params: {
        ticketId: String(id),
        ...(childId ? { childId: String(childId) } : {}),
      },
    } as any);
  const fullName =
    p.user.full_name ||
    `${p.user.first_name || ""} ${p.user.last_name || ""}`.trim() ||
    name;
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  const current = r.data?.queues[0],
    stats = r.data?.offices.stats;
  const picture = p.user.picture || p.user.google_picture;
  const photo = picture
    ? picture.startsWith("http")
      ? picture
      : `${ASSET_BASE_URL}/${picture}`
    : "";
  const tickets = r.data?.queues || [];
  return (
    <Screen
      title={p.role === "parent" ? "Parent Dashboard" : "Queue Dashboard"}
      onRefresh={() => {
        void r.reload();
        void p.reloadChildren();
      }}
      refreshing={r.loading}
    >
      <TourTarget id="dashboard">
        <Text
          style={{ fontSize: 16, fontWeight: "700", color: COLORS.primary }}
        >
          Queue overview
        </Text>
      </TourTarget>
      {p.role === "student" ? (
        <View style={d.greetingCard}>
          <View style={d.profileRow}>
            <View style={d.profileIcon}>
              {photo ? (
                <Image source={{ uri: photo }} style={d.profileImage} />
              ) : (
                <Ionicons name="person" size={24} color={COLORS.primary} />
              )}
            </View>
            <View style={d.profileText}>
              <Text style={d.greetingLabel}>{greeting}</Text>
              <Text style={d.studentName}>{fullName}</Text>
            </View>
            <View style={d.todayChip}>
              <Ionicons name="calendar-outline" size={14} color="#fff" />
              <Text style={d.todayChipText}>
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </View>
          <View style={d.greetingDivider} />
          <View style={d.bottomRow}>
            <View style={d.portalRow}>
              <Ionicons
                name="school-outline"
                size={15}
                color="rgba(255,255,255,.85)"
              />
              <Text style={d.subtitle}>UniQueue Student Portal</Text>
            </View>
            <View
              style={[
                d.statusPill,
                { backgroundColor: "rgba(255,255,255,.14)" },
              ]}
            >
              <View
                style={[
                  d.statusDot,
                  { backgroundColor: current ? "#FCEED8" : "#DFF6DD" },
                ]}
              />
              <Text style={d.statusText}>
                {current ? "On queue" : "Ready to queue"}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[ps.hero, { marginBottom: 0 }]}>
          <Text style={ps.greeting}>{greeting}</Text>
          <Text style={ps.name}>{fullName}</Text>
          <Text style={ps.sub}>
            Parent / Guardian · {p.children.length}{" "}
            {p.children.length === 1 ? "child" : "children"} linked
          </Text>
          <View style={ps.heroStats}>
            {[
              ["Children", p.children.length],
              [
                "Active queues",
                p.child
                  ? tickets.length
                  : p.children.reduce(
                      (n, c) =>
                        n +
                        Number(c.active_count || (c.active_ticket_id ? 1 : 0)),
                      0,
                    ),
              ],
              ["Offices open", stats?.open_offices ?? "—"],
            ].map(([label, value]) => (
              <View key={String(label)} style={ps.heroStat}>
                <Text style={ps.heroStatValue}>{value}</Text>
                <Text style={ps.heroStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {r.error && (
        <Notice
          message={`${r.error}${r.data ? " Previously loaded information may be out of date." : ""}`}
          retry={() => void r.reload()}
        />
      )}
      {r.loading && <ActivityIndicator color={COLORS.primary} />}
      {!!r.data?.feedback.length && <Heading>Complete your CSM</Heading>}
      {(r.data?.feedback || [])
        .filter(
          (f: any) => !p.child || Number(f.student_id) === Number(p.child.id),
        )
        .map((f: any) => (
          <View
            key={f.ticket_id}
            style={[
              d.feedbackBanner,
              { alignItems: "stretch", flexDirection: "column" },
            ]}
          >
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <View style={d.feedbackBannerIcon}>
                <Ionicons name="star" size={18} color={COLORS.warning} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={d.feedbackBannerTitle}>Rate your last visit</Text>
                <Text style={d.feedbackBannerSubtitle}>
                  {f.office_name} · #{f.queue_number}
                  {f.first_name ? ` · ${f.first_name} ${f.last_name}` : ""}
                </Text>
              </View>
            </View>
            <Copy muted>
              Complete the client satisfaction survey before queueing at this
              office again.
            </Copy>
            <Button title="Complete CSM" onPress={() => setFeedback(f)} />
          </View>
        ))}
      {p.role === "parent" && p.child && <ChildPicker />}
      {p.role === "parent" && !p.child ? (
        <>
          <TourTarget id="children">
            <Heading>Linked children</Heading>
          </TourTarget>
          {p.children.length
            ? p.children.map((c) => (
                <View key={c.id} style={ps.childCard}>
                  <View style={ps.childTop}>
                    <View style={ps.avatar}>
                      <Text style={ps.avatarText}>
                        {(c.first_name?.[0] || "") + (c.last_name?.[0] || "")}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={ps.cardTitle}>
                        {c.first_name} {c.last_name}
                      </Text>
                      <Text style={ps.cardMeta}>
                        {c.sr_code} · {c.school_level} {c.grade_year}
                      </Text>
                      <Text style={ps.cardMeta}>{c.relationship}</Text>
                    </View>
                    <View
                      style={[
                        ps.acctBadge,
                        c.account_status === "profile_only" &&
                          ps.acctBadgeProfile,
                      ]}
                    >
                      <Text style={ps.acctBadgeText}>
                        {c.account_status === "profile_only"
                          ? "Profile only"
                          : "Student account"}
                      </Text>
                    </View>
                  </View>
                  {tickets
                    .filter((t: any) => Number(t.student_id) === Number(c.id))
                    .map((t: any) => (
                      <View key={t.id} style={[ps.ticketBox, { gap: 8 }]}>
                        <View style={ps.ticketRow}>
                          <Text style={ps.ticketOffice}>{t.office_name}</Text>
                          <Status status={t.status} />
                        </View>
                        <Text style={ps.queueNum}>#{t.queue_number}</Text>
                        {t.status === "reserved" ? (
                          <Copy muted>
                            Reserved — activates after{" "}
                            {t.depends_on_queue_number
                              ? `#${t.depends_on_queue_number}`
                              : "the previous ticket"}
                            .
                          </Copy>
                        ) : (
                          <View style={ps.liveGrid}>
                            {[
                              ["People Ahead", t.people_ahead ?? "—"],
                              [
                                "Estimated Wait",
                                formatDuration(t.estimated_wait_minutes),
                              ],
                              [
                                "Assigned Window",
                                t.window_name || "Not yet assigned",
                              ],
                              [
                                "Estimated Call Time",
                                t.estimated_call_time ||
                                  t.estimated_label ||
                                  "—",
                              ],
                            ].map(([label, value]) => (
                              <View key={String(label)} style={ps.liveRow}>
                                <Text style={ps.liveLabel}>{label}</Text>
                                <Text style={ps.liveValue}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Button
                          title="View ticket"
                          secondary
                          onPress={() => open(t.id, Number(c.id))}
                        />
                        <Button
                          title="Live board"
                          secondary
                          onPress={() =>
                            router.push({
                              pathname: "/parent/live-queue",
                              params: {
                                childId: String(c.id),
                                officeId: String(t.office_id || ""),
                              },
                            } as any)
                          }
                        />
                        <Button
                          title="Office live monitor"
                          secondary
                          onPress={() =>
                            router.push({
                              pathname: "/parent/live-monitor",
                              params: {
                                childId: String(c.id),
                                officeId: String(t.office_id || ""),
                              },
                            } as any)
                          }
                        />
                      </View>
                    ))}
                  {!tickets.some(
                    (t: any) => Number(t.student_id) === Number(c.id),
                  ) && <Text style={ps.noTicketText}>No active queue</Text>}
                  <Button
                    title="View this child"
                    secondary
                    onPress={() => p.chooseChild(Number(c.id))}
                  />
                  <Button
                    title="Join queue for child"
                    onPress={() => {
                      p.chooseChild(Number(c.id));
                      router.push({
                        pathname: "/parent/queue",
                        params: { forStudentId: String(c.id) },
                      } as any);
                    }}
                  />
                </View>
              ))
            : !p.childrenLoading && (
                <Empty
                  title="No linked children yet"
                  description="Add an Elementary profile or request approval to link an existing student account."
                  action={
                    <Button
                      title="Add / link child"
                      onPress={() => router.push("/parent/add-child")}
                    />
                  }
                />
              )}
        </>
      ) : (
        <>
          {tickets.length
            ? tickets.map((t: any) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel="View live ticket"
                  onPress={() => open(t.id)}
                  style={d.currentQueueCard}
                >
                  <View style={d.currentTitleRow}>
                    <View style={d.currentTitleLeft}>
                      <Ionicons
                        name="ticket-outline"
                        size={18}
                        color={COLORS.primary}
                      />
                      <TourTarget id="current-ticket">
                        <Text accessibilityRole="header" style={d.currentTitle}>
                          {t.status === "reserved"
                            ? "Reserved queue"
                            : "Current Queue"}
                        </Text>
                      </TourTarget>
                    </View>
                    <Status status={t.status} />
                  </View>
                  <View style={d.queueBody}>
                    <Text style={d.queueNumberLarge}>{t.queue_number}</Text>
                    <View style={d.queueDivider} />
                    <View style={d.queueInfoCol}>
                      <Text style={d.queueOffice}>{t.office_name}</Text>
                      <Text style={d.queueWindow}>
                        {t.window_name || "Not yet assigned"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.gray}
                    />
                  </View>
                  {t.status !== "reserved" && (
                    <View style={d.liveGrid}>
                      {[
                        ["People Ahead", t.people_ahead ?? "—"],
                        [
                          "Estimated Wait",
                          formatDuration(t.estimated_wait_minutes),
                        ],
                        [
                          "Assigned Window",
                          t.window_name || "Not yet assigned",
                        ],
                        [
                          "Estimated Call Time",
                          t.estimated_call_time || t.estimated_label || "—",
                        ],
                      ].map(([label, value]) => (
                        <View key={String(label)} style={d.liveRow}>
                          <Text style={d.liveLabel}>{label}</Text>
                          <Text style={d.liveValue}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {t.status === "reserved" && (
                    <Copy muted>
                      Activates after{" "}
                      {t.depends_on_office_name || "the previous office"}
                      {t.depends_on_queue_number
                        ? ` · #${t.depends_on_queue_number}`
                        : ""}
                      .
                    </Copy>
                  )}
                  {t.is_requeued && !t.requeue_confirmed && (
                    <Notice message="This ticket was skipped. Open it to rejoin or cancel." />
                  )}
                </Pressable>
              ))
            : r.data && (
                <View style={d.currentQueueCard}>
                  <View style={d.noQueueState}>
                    <View style={d.noQueueIcon}>
                      <Ionicons
                        name="time-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                    </View>
                    <View style={d.noQueueTextCol}>
                      <Text style={d.noQueue}>No active queue right now</Text>
                      <Text style={d.noQueueHint}>
                        Join one of the offices below to get started
                      </Text>
                    </View>
                  </View>
                </View>
              )}
        </>
      )}
      {p.role === "parent" &&
        !p.child &&
        (p.children.length > 0 || !!p.childrenError) && <ChildPicker />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open live monitor"
        style={[d.liveMonitorBtn, { minHeight: 44 }]}
        onPress={() =>
          router.push({
            pathname: `/${p.role}/live-monitor`,
            params: p.child ? { childId: String(p.child.id) } : {},
          } as any)
        }
      >
        <Ionicons name="tv-outline" size={18} color={COLORS.primary} />
        <Text style={d.liveMonitorText}>View Live Queue Monitor</Text>
      </Pressable>
      {p.role === "student" ? (
        <>
          <View style={d.statsRow}>
            {[
              ["Offices Open", stats?.open_offices ?? "—"],
              ["Waiting Today", stats?.total_waiting ?? "—"],
              [
                "Est. Wait",
                stats?.est_wait_mins != null ? `~${stats.est_wait_mins}m` : "—",
              ],
            ].map(([label, value]) => (
              <View key={String(label)} style={d.statCard}>
                <Text style={d.statValue}>{value}</Text>
                <Text style={d.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <OfficesContent embedded />
        </>
      ) : (
        <Button
          title="Join a queue"
          disabled={!p.children.length}
          onPress={() => router.push("/parent/queue")}
        />
      )}
      {r.updated && <Copy muted>Updated {r.updated.toLocaleTimeString()}</Copy>}
      <Button
        title="Transaction history"
        secondary
        onPress={() =>
          router.push(
            `/${p.role}/${p.role === "student" ? "queue" : "history"}` as any,
          )
        }
      />
      {feedback && (
        <FeedbackModal
          visible
          transaction={{
            ...feedback,
            type: feedback.type || "walkin",
            created_at: feedback.created_at || "",
          }}
          studentId={Number(feedback.student_id || p.user.id)}
          onClose={() => setFeedback(null)}
          onSubmitted={() => {
            setFeedback(null);
            void r.reload();
          }}
        />
      )}
    </Screen>
  );
}
