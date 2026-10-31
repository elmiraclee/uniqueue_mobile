import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  useNotifications,
  isAlarmType,
} from "@/components/notification/use-notification";
import ProceedModal from "@/components/queue/proceed-modal";
import { usePortal } from "./context";
import { request } from "./api";
/** Account-wide foreground call prompt, not tied to a particular dashboard. */
export default function AlertGate() {
  const p = usePortal(),
    n = useNotifications(),
    seen = useRef(new Set<number>()),
    [alert, setAlert] = useState<any>(null);
  useEffect(() => {
    if (alert) return;
    let alive = true;
    const candidate = n.notifications.find(
      (row) =>
        !row.is_read &&
        isAlarmType(row.type) &&
        !seen.current.has(Number(row.id)),
    );
    if (!candidate) return;
    void request("get_ticket_detail.php", {
      ticket_id: candidate.ticket_id,
      ...(p.role === "parent"
        ? { parent_id: p.user.id }
        : { student_id: p.user.id }),
    })
      .then((data) => {
        if (!alive) return;
        // Never replay an old call after the ticket has already completed or been cancelled.
        if (["next", "called", "in_progress"].includes(data.ticket?.status))
          setAlert({ ...candidate, ticket: data.ticket });
        else seen.current.add(Number(candidate.id));
      })
      .catch(() => {
        /* Inbox remains available. Polling can retry on the next feed. */
      });
    return () => {
      alive = false;
    };
  }, [n.notifications, alert, p.role, p.user.id]);
  const acknowledge = () => {
    if (!alert) return;
    const selected = alert;
    for (const row of n.notifications)
      if (row.ticket_id === selected.ticket_id)
        seen.current.add(Number(row.id));
    setAlert(null);
    void n.markAsRead(Number(selected.id));
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
      kind={alert?.ticket.status === "next" ? "next" : "proceed"}
      info={
        alert
          ? {
              queueNumber: alert.ticket.queue_number,
              officeName: alert.child_name
                ? `${alert.child_name} · ${alert.ticket.office_name}`
                : alert.ticket.office_name,
              windowName: alert.ticket.window_name,
              status: alert.ticket.status,
            }
          : null
      }
      onAcknowledge={acknowledge}
    />
  );
}
