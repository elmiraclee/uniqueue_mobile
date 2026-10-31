import {
  Actor,
  actorFields,
  flag,
  Office,
  officeProblem,
} from "../portal/domain";
export type Service = {
  id: number;
  name: string;
  category?: string;
  amount?: number | null;
  price?: number | null;
  requirements: string[];
  choices?: { id: number; label: string; requirements?: string[] }[];
  use_academic_period?: boolean;
  pay_at_cashier?: boolean;
};
export type Copy = { period: string; school_year: string };
export type Draft = {
  type: "walkin" | "appointment";
  selected: number[];
  quantities: Record<number, number>;
  choices: Record<number, number>;
  academic: Record<number, Copy[]>;
  checks: string[];
  slip: boolean;
  priority: boolean;
  reason: string;
  proof: boolean;
  source: number;
};
export const newDraft = (): Draft => ({
  type: "walkin",
  selected: [],
  quantities: {},
  choices: {},
  academic: {},
  checks: [],
  slip: false,
  priority: false,
  reason: "",
  proof: false,
  source: 0,
});
export function requirements(items: Service[], d: Draft) {
  return [
    ...new Set(
      items
        .filter((i) => d.selected.includes(i.id))
        .flatMap((i) => [
          ...(i.requirements || []),
          ...(i.choices?.find((c) => c.id === d.choices[i.id])?.requirements ||
            []),
        ]),
    ),
  ];
}
export function detailsProblem(
  items: Service[],
  d: Draft,
  periods: string[],
  years: string[],
): string {
  if (!d.selected.length) return "Select at least one service.";
  if (d.selected.some((id) => !items.some((i) => i.id === id)))
    return "A selected service is no longer available. Reload this form.";
  for (const i of items.filter((i) => d.selected.includes(i.id))) {
    const q = d.quantities[i.id] || 1;
    if (!Number.isInteger(q) || q < 1 || q > 99)
      return `Choose between 1 and 99 copies for ${i.name}.`;
    if (i.choices?.length && !i.choices.some((c) => c.id === d.choices[i.id]))
      return `Choose an option for ${i.name}.`;
    if (flag(i.use_academic_period, false)) {
      const rows = d.academic[i.id] || [];
      if (
        rows.length < q ||
        rows
          .slice(0, q)
          .some(
            (c) =>
              !periods.includes(c.period) || !years.includes(c.school_year),
          )
      )
        return `Choose a valid period and school year for every copy of ${i.name}.`;
    }
  }
  return "";
}
export function regularPayload(
  actor: Actor,
  office: Office,
  items: Service[],
  d: Draft,
  periods: string[],
  years: string[],
) {
  const scope = actorFields(actor),
    problem =
      officeProblem(office, actor.role) ||
      detailsProblem(items, d, periods, years);
  if (problem) throw new Error(problem);
  if (
    !flag(
      d.type === "walkin" ? office.walkin_enabled : office.appointment_enabled,
    )
  )
    throw new Error("This queue type is disabled.");
  if (d.type === "appointment" && !d.slip)
    throw new Error("Confirm your appointment slip.");
  if (
    d.type === "walkin" &&
    requirements(items, d).some((r) => !d.checks.includes(r))
  )
    throw new Error("Confirm all service requirements.");
  if (actor.role === "parent" && !d.proof)
    throw new Error("Confirm physical ID / authorization for the counter.");
  if (flag(office.priority_enabled) && d.priority && !d.reason.trim())
    throw new Error("Enter your priority reason.");
  return {
    ...scope,
    mode: "regular",
    office_id: office.id,
    type: d.type,
    appointment_slip_confirmed: d.type === "appointment" && d.slip,
    parent_proof_confirmed: actor.role === "parent" && d.proof,
    priority: flag(office.priority_enabled) && d.priority,
    priority_reason:
      flag(office.priority_enabled) && d.priority ? d.reason.trim() : "",
    service_items: d.selected.map((id) => {
      const item = items.find((i) => i.id === id)!;
      const choice = item.choices?.find((c) => c.id === d.choices[id]);
      return {
        service_item_id: id,
        quantity: d.quantities[id] || 1,
        ...(choice ? { choice_id: choice.id, choice_label: choice.label } : {}),
        ...(flag(item.use_academic_period, false)
          ? {
              academic: (d.academic[id] || [])
                .slice(0, d.quantities[id] || 1)
                .map((c) => ({ ...c, academic_period: c.period })),
            }
          : {}),
      };
    }),
  };
}
export function fees(items: Service[], d: Draft) {
  let total = 0,
    complete = true;
  for (const i of items.filter((i) => d.selected.includes(i.id))) {
    const value = i.amount ?? i.price;
    if (value == null || !Number.isFinite(Number(value))) complete = false;
    else total += Number(value) * (d.quantities[i.id] || 1);
  }
  return { total, complete };
}
