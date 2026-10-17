/** Port of web formatDuration() (student-dashboard.js / parent-dashboard.js). */
export function formatDuration(minutes: unknown): string {
  if (minutes === null || minutes === undefined || minutes === "") return "—";
  if (typeof minutes === "string" && minutes.trim() === "< 1") return "< 1 min";
  const n = Number(minutes);
  if (!isFinite(n)) return String(minutes);
  if (n < 0) return "—";
  if (n > 0 && n < 1) return "< 1 min";
  const total = Math.round(n);
  if (total < 60) return total + (total <= 1 ? " min" : " mins");
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  let label = hours + (hours === 1 ? " hr" : " hrs");
  if (mins > 0) label += " " + mins + (mins === 1 ? " min" : " mins");
  return label;
}
