import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { AppState } from "react-native";
import { useNotifications } from "@/components/notification/use-notification";
import ProceedModal from "@/components/queue/proceed-modal";
import { usePortal } from "./context";
import { request } from "./api";
import { eventKey, isFresh, stopQueueAlarm } from "@/utils/queue-alerts";
import {
  countdownAhead,
  queuePromptKind,
  queuePromptMatchesTicket,
  queuePromptPriority,
} from "@/utils/queue-prompt";
/** One live foreground prompt. Current turn preempts a proximity notice; stale positions never queue up. */
export default function AlertGate() {
  const p = usePortal(),
    n = useNotifications();
  const seen = useRef(new Set<string>()),
    revision = useRef(0),
    current = useRef<any>(null);
  const [alert, setAlert] = useState<any>(null),
    [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const generation = ++revision.current;
    if (!active) return;
    let alive = true;
    const pending = n.notifications.filter(
      (row) =>
        !row.is_read &&
        queuePromptKind(row) &&
        isFresh(row) &&
        !seen.current.has(eventKey(row)),
    );
    // Once displayed, expiry/read on another device does not silently dismiss an otherwise-valid prompt.
    if (
      current.current &&
      !seen.current.has(eventKey(current.current)) &&
      !pending.some((row) => eventKey(row) === eventKey(current.current))
    )
      pending.push(current.current);
    const candidates = [...pending].sort(
      (a, b) => queuePromptPriority(b) - queuePromptPriority(a),
    );
    if (!candidates.length) return;
    void (async () => {
      const details = new Map<number, Promise<any>>();
      let failed = false;
      for (const candidate of candidates) {
        const id = Number(candidate.ticket_id);
        if (!id) continue;
        if (!details.has(id))
          details.set(
            id,
            request("get_ticket_detail.php", {
              ticket_id: id,
              ...(p.role === "parent"
                ? { parent_id: p.user.id }
                : { student_id: p.user.id }),
            }),
          );
        let data: any;
        try {
          data = await details.get(id);
        } catch {
          failed = true;
          continue;
        }
        if (!alive || generation !== revision.current) return;
        if (seen.current.has(eventKey(candidate))) continue;
        if (queuePromptMatchesTicket(candidate, data.ticket)) {
          const next = { ...candidate, ticket: data.ticket };
          current.current = next;
          setAlert(next);
          return;
        }
        seen.current.add(eventKey(candidate));
      }
      if (!alive || generation !== revision.current) return;
      // Invalid/completed/held tickets must not keep a false proximity/turn alarm alive.
      if (!failed && current.current) {
        current.current = null;
        setAlert(null);
        stopQueueAlarm();
      }
    })();
    return () => {
      alive = false;
    };
  }, [n.notifications, active, p.role, p.user.id]);
  const acknowledge = () => {
    const selected = current.current;
    if (!selected) return;
    revision.current++;
    stopQueueAlarm();
    seen.current.add(eventKey(selected));
    current.current = null;
    setAlert(null);
    void n.markAsRead(Number(selected.id));
    // A countdown OK stays on the current screen; next/called retain the existing ticket shortcut.
    if (queuePromptKind(selected) !== "countdown")
      router.push({
        pathname: `/${p.role}/ticket`,
        params: {
          ticketId: String(selected.ticket_id),
          ...(p.role === "parent"
            ? { childId: String(selected.ticket.student_id) }
            : {}),
        },
      } as any);
  };
  return (
    <ProceedModal
      visible={!!alert}
      kind={queuePromptKind(alert) || "proceed"}
      vibrationKey={
        alert ? `${p.role}:${p.user.id}:${alert.ticket_id}` : undefined
      }
      info={
        alert
          ? {
              queueNumber: alert.ticket.queue_number,
              officeName: alert.child_name
                ? `${alert.child_name} · ${alert.ticket.office_name}`
                : alert.ticket.office_name,
              windowName: alert.ticket.window_name,
              status: alert.ticket.status,
              peopleAhead: countdownAhead(alert),
            }
          : null
      }
      onAcknowledge={acknowledge}
    />
  );
}
