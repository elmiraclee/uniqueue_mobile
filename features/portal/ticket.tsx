import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { formatDuration } from "@/utils/format-duration";
import { useClientUI } from "@/components/client/client-ui";
import FeedbackModal from "@/components/feedback/feedback-modal";
import {
  updateLiveTicketWidget,
  clearLiveTicketWidget,
} from "@/utils/live-ticket-widget";
import { serverDate } from "@/utils/server-time";
import { usePortal } from "./context";
import {
  actorFields,
  activeStatus,
  completedStatus,
  positiveId,
  ticketHeadline,
} from "./domain";
import { request } from "./api";
import { useResource } from "./use-resource";
import {
  Button,
  Card,
  Copy,
  Heading,
  Metric,
  Notice,
  Screen,
  Status,
  s,
} from "./ui";
export default function TicketScreen() {
  const p = usePortal(),
    params = useLocalSearchParams(),
    ui = useClientUI(),
    ticketId =
      positiveId(params.ticketId) ||
      positiveId(params.queueId) ||
      positiveId(params.id),
    childId = positiveId(params.childId) || positiveId(params.studentId),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<any>(null),
    lock = useRef(false);
  const actor = {
    ...p.actor,
    studentId: p.role === "student" ? p.user.id : childId || p.actor.studentId,
  };
  const loader = useCallback(
    async (signal: AbortSignal) => {
      if (!ticketId)
        throw new Error("No ticket selected. Return to Home or History.");
      const data = await request(
        "get_ticket_detail.php",
        {
          ticket_id: ticketId,
          ...(p.role === "parent"
            ? {
                parent_id: p.user.id,
                ...(actor.studentId ? { student_id: actor.studentId } : {}),
              }
            : { student_id: p.user.id }),
        },
        signal,
      );
      if (!data.ticket) throw new Error("Ticket unavailable.");
      return data.ticket;
    },
    [ticketId, p.role, p.user.id, actor.studentId],
  );
  const r = useResource(loader, 3000),
    t = r.data;
  useEffect(() => {
    if (!t) return;
    if (activeStatus(t.status))
      void updateLiveTicketWidget({
        ticketId: t.id,
        ticket: t.queue_number,
        office: t.office_name,
        window: t.window_name,
        status: t.status,
        nowServing: t.now_serving,
        peopleAhead: t.people_ahead,
        estimatedWait: t.estimated_wait_minutes,
      });
    else void clearLiveTicketWidget();
  }, [t]);
  const act = async (action: "cancel" | "requeue" | "skip_cancel") => {
    if (lock.current || !t || r.error) return;
    lock.current = true;
    setBusy(true);
    try {
      const data = await request(
        action === "cancel" ? "cancel_queue.php" : "requeue_respond.php",
        {
          ...actorFields({ ...actor, studentId: Number(t.student_id) }),
          ticket_id: t.id,
          ...(action === "cancel"
            ? {}
            : { action: action === "requeue" ? "requeue" : "cancel" }),
        },
      );
      ui.notify(data.message || "Ticket updated.");
      if (action !== "requeue") await clearLiveTicketWidget();
      await r.reload();
    } catch (e) {
      ui.notify(e instanceof Error ? e.message : "Could not update.", "error");
      await r.reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const confirm = (action: "cancel" | "requeue" | "skip_cancel") =>
    ui.confirm({
      title:
        action === "requeue" ? "Rejoin this queue?" : "Cancel this ticket?",
      message:
        action === "requeue"
          ? "You will return at the end of the line."
          : "This removes this ticket from the queue. This cannot be undone.",
      confirmLabel: action === "requeue" ? "Rejoin queue" : "Cancel ticket",
      danger: action !== "requeue",
      onConfirm: () => void act(action),
    });
  return (
    <Screen
      title="Your ticket"
      subtitle={
        p.role === "parent" ? "Viewing as parent / guardian" : undefined
      }
      back
      refreshing={r.loading}
      onRefresh={() => void r.reload()}
      updated={r.updated}
    >
      {r.error && (
        <Notice
          message={`${r.error}${t ? " Last ticket details may be stale. Actions are disabled until reconnected." : ""}`}
          retry={() => void r.reload()}
        />
      )}
      {r.loading && <ActivityIndicator color="#660810" />}
      {t && (
        <>
          <Card accent>
            <Copy>
              {t.first_name} {t.last_name}
              {t.sr_code ? ` · ${t.sr_code}` : ""}
            </Copy>
            <Heading>{t.office_name}</Heading>
            <Status status={t.status} />
            <Text style={s.number}>#{t.queue_number}</Text>
            <Copy>
              {t.window_name || "Awaiting window assignment"} ·{" "}
              {t.type === "appointment" ? "Appointment" : "Walk-in"}
              {Number(t.priority) ? " · Priority" : ""}
            </Copy>
            {t.event_name && <Copy muted>{t.event_name}</Copy>}
          </Card>
          <Card>
            <Heading>
              {t.is_requeued && activeStatus(t.status)
                ? "You were skipped"
                : ticketHeadline(t)}
            </Heading>
            {t.is_requeued && activeStatus(t.status) ? (
              <>
                <Copy>
                  You are out of the line until you respond. Rejoining puts you
                  at the end.
                </Copy>
                <Button
                  title="Rejoin queue"
                  disabled={!!r.error || busy}
                  loading={busy}
                  onPress={() => confirm("requeue")}
                />
                <Button
                  title="Cancel skipped ticket"
                  secondary
                  disabled={!!r.error || busy}
                  onPress={() => confirm("skip_cancel")}
                />
              </>
            ) : t.status === "reserved" ? (
              <Copy>
                Activates after{" "}
                {t.depends_on_office_name || "your previous office"}
                {t.depends_on_queue_number
                  ? ` · #${t.depends_on_queue_number}`
                  : ""}{" "}
                completes.
              </Copy>
            ) : (
              activeStatus(t.status) && (
                <>
                  <Copy>
                    {t.all_windows_closed
                      ? "All windows are closed. Your ticket keeps its place; estimates may change."
                      : t.estimated_label ||
                        "Live estimate is not available yet."}
                  </Copy>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 20,
                      paddingVertical: 8,
                    }}
                  >
                    <Metric
                      label="People ahead"
                      value={
                        t.people_ahead == null
                          ? "Unavailable / on hold"
                          : t.people_ahead
                      }
                    />
                    <Metric
                      label="Estimated wait"
                      value={formatDuration(t.estimated_wait_minutes)}
                    />
                  </View>
                  {!t.all_windows_closed && t.estimated_call_time && (
                    <Copy muted>Estimated call: {t.estimated_call_time}</Copy>
                  )}
                  {t.now_serving && (
                    <Copy muted>Now serving #{t.now_serving}</Copy>
                  )}
                </>
              )
            )}
            {completedStatus(t.status) && (
              <>
                <Copy>
                  {t.has_feedback
                    ? "Your CSM has already been submitted. View it in History."
                    : "Thank you. You can complete the client satisfaction survey for this transaction."}
                </Copy>
                <Button
                  title={
                    t.has_feedback
                      ? "View submitted CSM in History"
                      : "Complete CSM"
                  }
                  disabled={!!r.error}
                  onPress={() =>
                    t.has_feedback
                      ? router.push({
                          pathname: `/${p.role}/history`,
                          params: {
                            ticketId: String(t.id),
                            ...(p.role === "parent"
                              ? { childId: String(t.student_id) }
                              : {}),
                          },
                        } as any)
                      : setFeedback({
                          ticket_id: t.id,
                          queue_number: t.queue_number,
                          type: t.type,
                          office_name: t.office_name,
                          done_at: t.done_at || null,
                          created_at: t.created_at || "",
                        })
                  }
                />
              </>
            )}
          </Card>
          {!!t.priority_reason && (
            <Card>
              <Heading>Priority reason</Heading>
              <Copy>{t.priority_reason}</Copy>
            </Card>
          )}
          <Heading>Services & requirements</Heading>
          {(t.service_items || []).map((item: any) => (
            <Card key={item.item_id || item.service_item_id}>
              <Heading>
                {item.name} × {item.quantity}
              </Heading>
              {item.choice_label && <Copy>{item.choice_label}</Copy>}
              {(item.academic || []).map((a: any, i: number) => (
                <Copy key={i} muted>
                  Copy {a.copy_number || i + 1} · {a.academic_period} ·{" "}
                  {a.school_year}
                </Copy>
              ))}
              {!(item.requirements || []).length && (
                <Copy muted>No specific requirements listed.</Copy>
              )}
              {(item.requirements || []).map((req: string, i: number) => (
                <Copy key={i}>• {req}</Copy>
              ))}
            </Card>
          ))}
          <Card>
            <Heading>Ticket timeline</Heading>
            {[
              ["Joined", t.joined_at || t.created_at],
              ["Called", t.called_at],
              ["Completed / closed", t.done_at],
            ]
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <View key={label}>
                  <Copy muted>{label}</Copy>
                  <Copy>{serverDate(v).toLocaleString()}</Copy>
                </View>
              ))}
            <Copy muted>
              Queued by{" "}
              {t.created_by_role === "parent" ? "parent / guardian" : "student"}
              .
            </Copy>
          </Card>
          {t.can_cancel && !t.is_requeued && (
            <Button
              title="Cancel ticket"
              secondary
              disabled={!!r.error || busy}
              loading={busy}
              onPress={() => confirm("cancel")}
            />
          )}
        </>
      )}
      {feedback && (
        <FeedbackModal
          visible
          transaction={feedback}
          studentId={Number(t?.student_id)}
          onClose={() => setFeedback(null)}
          onSubmitted={() => {
            setFeedback(null);
            ui.notify("CSM submitted.");
            void r.reload();
          }}
        />
      )}
    </Screen>
  );
}
