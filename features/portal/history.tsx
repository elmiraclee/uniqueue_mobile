import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import FeedbackModal from "@/components/feedback/feedback-modal";
import { serverDate } from "@/utils/server-time";
import { usePortal } from "./context";
import { request } from "./api";
import { completedStatus } from "./domain";
import { useResource } from "./use-resource";
import {
  Button,
  Card,
  ChildPicker,
  Copy,
  Empty,
  Heading,
  Notice,
  Screen,
  Status,
  s,
} from "./ui";
const statuses = [
  ["all", "All"],
  ["waiting", "Waiting"],
  ["reserved", "Reserved"],
  ["next", "Next"],
  ["called", "Called"],
  ["in_progress", "Being served"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
];
export default function HistoryScreen() {
  const p = usePortal(),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1),
    [expanded, setExpanded] = useState(0),
    [feedback, setFeedback] = useState<any>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
    setExpanded(0);
  }, [p.child?.id]);
  const load = useCallback(
    async (signal: AbortSignal) =>
      request(
        p.role === "parent"
          ? "get_parent_transactions.php"
          : "get_student_transaction.php",
        {
          [p.role === "parent" ? "parent_id" : "student_id"]: p.user.id,
          q,
          status,
          type,
          child: p.child?.id || 0,
          page,
          per_page: 10,
        },
        signal,
      ),
    [p.role, p.user.id, q, status, type, p.child?.id, page],
  );
  const r = useResource(load),
    data = r.data;
  const open = (t: any) =>
    router.push({
      pathname: `/${p.role}/ticket`,
      params: {
        ticketId: String(t.id),
        ...(p.role === "parent" ? { childId: String(t.student_id) } : {}),
      },
    } as any);
  return (
    <Screen
      title="Transaction history"
      subtitle="Active and past tickets, timelines, and CSM responses."
      refreshing={r.loading}
      onRefresh={() => void r.reload()}
    >
      <ChildPicker />
      {data?.stats && (
        <View style={s.row}>
          {[
            ["Total", data.stats.total],
            ["Active", data.stats.active],
            ["Completed", data.stats.completed],
            ["Cancelled", data.stats.cancelled],
          ].map(([label, value]) => (
            <View key={label} style={{ flexBasis: "46%", flexGrow: 1 }}>
              <View
                style={{
                  padding: 12,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Text style={[s.number, { fontSize: 22, lineHeight: 28 }]}>
                  {value ?? 0}
                </Text>
                <Copy muted>{label}</Copy>
              </View>
            </View>
          ))}
        </View>
      )}

      <Card>
        <TextInput
          style={s.input}
          accessibilityLabel="Search transactions"
          placeholder="Search queue number, office, service…"
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView
          horizontal
          contentContainerStyle={{ gap: 8 }}
          showsHorizontalScrollIndicator={false}
        >
          {statuses.map(([value, label]) => (
            <Button
              key={value}
              title={label}
              secondary={status !== value}
              onPress={() => {
                setStatus(value);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
        <View style={s.row}>
          {[
            ["all", "All types"],
            ["walkin", "Walk-in"],
            ["appointment", "Appointment"],
          ].map(([value, label]) => (
            <Button
              key={value}
              title={label}
              secondary={type !== value}
              onPress={() => {
                setType(value);
                setPage(1);
              }}
            />
          ))}
        </View>
        {(search || status !== "all" || type !== "all" || p.child) && (
          <Button
            title="Clear filters"
            secondary
            onPress={() => {
              setSearch("");
              setQ("");
              setStatus("all");
              setType("all");
              p.chooseChild(0);
              setPage(1);
            }}
          />
        )}
      </Card>
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      {r.loading && <ActivityIndicator color="#660810" />}
      {data && !data.transactions?.length && (
        <Empty
          title="No matching transactions"
          description="Try another search or clear your filters."
        />
      )}
      {(data?.transactions || []).map((t: any) => (
        <Card key={t.id}>
          <View style={s.row}>
            <Heading>#{t.queue_number}</Heading>
            <Status status={t.status} />
          </View>
          <Copy>{t.office_name}</Copy>
          {p.role === "parent" && (
            <Copy muted>
              {t.first_name} {t.last_name} · {t.sr_code}
            </Copy>
          )}
          <Copy>
            {t.service_items || t.event_name || "No recorded service items"}
          </Copy>
          <Copy muted>
            {t.type === "appointment" ? "Appointment" : "Walk-in"}
            {Number(t.priority) ? " · Priority" : ""} ·{" "}
            {serverDate(t.joined_at || t.created_at).toLocaleString()}
          </Copy>
          <Button
            title={
              expanded === t.id ? "Hide timeline & CSM" : "View timeline & CSM"
            }
            secondary
            onPress={() => setExpanded(expanded === t.id ? 0 : t.id)}
          />
          {expanded === t.id && (
            <>
              <Heading>Timeline</Heading>
              {[
                ["Joined", t.joined_at || t.created_at],
                ["Called", t.called_at],
                [
                  t.status === "cancelled" ? "Cancelled" : "Completed",
                  t.done_at,
                ],
              ]
                .filter(([, date]) => date)
                .map(([label, date]) => (
                  <View key={label}>
                    <Copy muted>{label}</Copy>
                    <Copy>{serverDate(date).toLocaleString()}</Copy>
                  </View>
                ))}
              <Copy muted>Window: {t.window_name || "Not assigned"}</Copy>
              {t.priority_reason && <Copy>Priority: {t.priority_reason}</Copy>}
              {t.feedback_rating != null ? (
                <>
                  <Heading>Submitted CSM</Heading>
                  <Copy>SQD0 · {t.feedback_rating}/5</Copy>
                  {t.feedback_comment && <Copy>{t.feedback_comment}</Copy>}
                </>
              ) : completedStatus(t.status) ? (
                <Copy muted>No CSM response recorded.</Copy>
              ) : null}
              <Button
                title="Open full ticket"
                secondary
                onPress={() => open(t)}
              />
            </>
          )}
          {completedStatus(t.status) &&
            !t.has_feedback &&
            t.feedback_rating == null && (
              <Button title="Complete CSM" onPress={() => setFeedback(t)} />
            )}
        </Card>
      ))}
      {data && (
        <Card>
          <Copy muted>
            Page {data.page || page} of {data.total_pages || 1} ·{" "}
            {data.total ?? data.total_rows ?? 0} results
          </Copy>
          <View style={s.row}>
            <Button
              title="Previous"
              secondary
              disabled={page <= 1 || r.loading}
              onPress={() => setPage((v) => v - 1)}
            />
            <Button
              title="Next"
              secondary
              disabled={page >= (data.total_pages || 1) || r.loading}
              onPress={() => setPage((v) => v + 1)}
            />
          </View>
        </Card>
      )}
      {feedback && (
        <FeedbackModal
          visible
          transaction={{ ...feedback, ticket_id: Number(feedback.id) }}
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
