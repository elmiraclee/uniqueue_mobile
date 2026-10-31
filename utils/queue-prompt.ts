/** Foreground prompt policy only. Backend audience/order rules are unchanged. */
export type QueuePromptKind = "countdown" | "next" | "proceed";
export function countdownAhead(event: any): number | null {
  if (
    !["position_update", "priority_bump", "appointment_bump"].includes(
      event?.type,
    ) ||
    event?.ahead == null
  )
    return null;
  const ahead = Number(event.ahead);
  return Number.isInteger(ahead) && ahead >= 1 && ahead <= 5 ? ahead : null;
}
export function queuePromptKind(event: any): QueuePromptKind | null {
  if (["called", "in_progress"].includes(event?.type)) return "proceed";
  if (event?.type === "next_in_line") return "next";
  return countdownAhead(event) == null ? null : "countdown";
}
export function queuePromptPriority(event: any): number {
  const kind = queuePromptKind(event);
  return kind === "proceed"
    ? 3
    : kind === "next"
      ? 2
      : kind === "countdown"
        ? 1
        : 0;
}
export function queuePromptMatchesTicket(event: any, ticket: any): boolean {
  if (!ticket || Number(event?.ticket_id) !== Number(ticket.id)) return false;
  const kind = queuePromptKind(event);
  if (kind === "proceed") return ticket.status === event.type;
  if (
    !["waiting", "next"].includes(ticket.status) ||
    ticket.people_ahead == null ||
    ticket.is_requeued
  )
    return false;
  return kind === "next"
    ? Number(ticket.people_ahead) === 0
    : kind === "countdown" &&
        countdownAhead(event) === Number(ticket.people_ahead);
}
