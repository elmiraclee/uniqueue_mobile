/** Shared client rules. The server remains authoritative for eligibility and ownership. */
export type Role = "student" | "parent";
export type Actor = { role: Role; id: number; studentId: number };
export type Office = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  transaction_type?: string;
  can_join?: boolean;
  is_full?: boolean;
  parent_queue_enabled?: boolean;
  walkin_enabled?: boolean;
  appointment_enabled?: boolean;
  priority_enabled?: boolean;
  availability_reason?: string;
  open_time?: string;
  close_time?: string;
  cutoff_time?: string;
};
export type Child = {
  id: number;
  first_name: string;
  last_name: string;
  sr_code: string;
  school_level?: string;
  grade_year?: string;
  relationship?: string;
  active_count?: number;
  active_ticket_id?: number | null;
  active_status?: string | null;
  active_queue_number?: string;
  active_office?: string;
  account_status?: string;
};
export const positiveId = (value: unknown) => {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
export const flag = (v: unknown, fallback = true) =>
  v == null ? fallback : v === true || v === 1 || v === "1";
export function actorFields(a: Actor) {
  if (!positiveId(a.id) || !positiveId(a.studentId))
    throw new Error(
      a.role === "parent"
        ? "Choose a linked child first."
        : "Sign in again to continue.",
    );
  if (a.role === "student" && a.id !== a.studentId)
    throw new Error("Student account scope does not match.");
  return a.role === "parent"
    ? { student_id: a.studentId, child_id: a.studentId, parent_id: a.id }
    : { student_id: a.id };
}
export function officeProblem(o: Office, role: Role): string {
  if (role === "parent" && !flag(o.parent_queue_enabled))
    return "Parent / guardian queueing is disabled for this office.";
  if (flag(o.is_full, false)) return "Daily queue capacity has been reached.";
  if (!flag(o.can_join))
    return o.availability_reason || "This office is not accepting queues now.";
  if (!flag(o.walkin_enabled) && !flag(o.appointment_enabled))
    return "No queue types are enabled.";
  return "";
}
export const activeStatus = (s: string) =>
  ["waiting", "reserved", "next", "called", "in_progress"].includes(s);
export const completedStatus = (s: string) => ["done", "completed"].includes(s);
export const statusLabel = (s: string) =>
  ({
    in_progress: "Being served",
    next: "Next in line",
    reserved: "Reserved",
    done: "Completed",
  })[s] ||
  s?.replace(/_/g, " ") ||
  "Unknown";
export function ticketHeadline(t: any) {
  if (t.status === "reserved") return "Reserved for your next office";
  if (completedStatus(t.status)) return "Transaction complete";
  if (t.status === "cancelled") return "Ticket cancelled";
  if (t.status === "expired") return "Ticket expired";
  if (t.status === "in_progress") return "You are being served";
  if (t.status === "called") return "Please proceed to your window";
  if (t.status === "next") return "Get ready — you are next";
  return t.people_ahead == null
    ? "Waiting for a live estimate"
    : `${t.people_ahead} ${Number(t.people_ahead) === 1 ? "person" : "people"} ahead`;
}
