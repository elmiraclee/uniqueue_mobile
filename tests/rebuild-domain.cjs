/* Runs the real pure production domain/model. No remote requests or records. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  Module = require("node:module"),
  esbuild = require("esbuild");
function load(file) {
  const code = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, "..", file)],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  }).outputFiles[0].text;
  const m = new Module(file, module);
  m._compile(code, file);
  return m.exports;
}
const D = load("features/portal/domain.ts"),
  Q = load("features/queue/model.ts");
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("PASS " + name);
}
const student = { role: "student", id: 7, studentId: 7 },
  parent = { role: "parent", id: 3, studentId: 7 };
const office = {
  id: 1,
  name: "Registrar",
  slug: "registrar",
  can_join: true,
  walkin_enabled: true,
  appointment_enabled: true,
  priority_enabled: true,
  parent_queue_enabled: true,
};
const item = {
  id: 11,
  name: "Transcript",
  requirements: ["Valid ID"],
  choices: [{ id: 2, label: "Official", requirements: ["Authorization"] }],
  use_academic_period: true,
  amount: 100,
};
const valid = () => ({
  ...Q.newDraft(),
  selected: [11],
  choices: { 11: 2 },
  quantities: { 11: 2 },
  academic: {
    11: [
      { period: "First", school_year: "2026-2027" },
      { period: "Second", school_year: "2025-2026" },
    ],
  },
  checks: ["Valid ID", "Authorization"],
});
const payload = (draft = valid(), actor = student, o = office) =>
  Q.regularPayload(
    actor,
    o,
    [item],
    draft,
    ["First", "Second"],
    ["2026-2027", "2025-2026"],
  );
test("Student scope never trusts another student ID", () =>
  assert.throws(() => D.actorFields({ ...student, studentId: 8 }), /scope/));
test("Parent needs an explicitly selected child", () =>
  assert.throws(() => D.actorFields({ ...parent, studentId: 0 }), /Choose/));
test("Parent and child identity fields are separate", () =>
  assert.deepEqual(D.actorFields(parent), {
    parent_id: 3,
    child_id: 7,
    student_id: 7,
  }));
test("Student payload cannot contain parent identity", () =>
  assert.deepEqual(D.actorFields(student), { student_id: 7 }));
for (const bad of [0, -1, NaN, Infinity, "abc", 1.5])
  test("Reject invalid ID " + bad, () => assert.equal(D.positiveId(bad), 0));
test("String and array route IDs normalize safely", () =>
  assert.equal(D.positiveId(["7"]), 7));
test("Disabled parent queue is enforced", () =>
  assert.match(
    D.officeProblem({ ...office, parent_queue_enabled: false }, "parent"),
    /disabled/,
  ));
test("Parent queue restriction does not block students", () =>
  assert.equal(
    D.officeProblem({ ...office, parent_queue_enabled: false }, "student"),
    "",
  ));
test("Full office cannot be joined", () =>
  assert.throws(
    () => payload(valid(), student, { ...office, is_full: true }),
    /capacity/,
  ));
test("Closed office preserves server reason", () =>
  assert.throws(
    () =>
      payload(valid(), student, {
        ...office,
        can_join: false,
        availability_reason: "Holiday",
      }),
    /Holiday/,
  ));
test("Both queue types disabled blocks joining", () =>
  assert.match(
    D.officeProblem(
      { ...office, walkin_enabled: false, appointment_enabled: false },
      "student",
    ),
    /No queue/,
  ));
test("Zero fee is known, not unknown", () =>
  assert.deepEqual(Q.fees([{ id: 11, amount: 0 }], valid()), {
    total: 0,
    complete: true,
  }));
test("Unknown fee never becomes a complete total", () =>
  assert.deepEqual(Q.fees([{ id: 11, amount: null }], valid()), {
    total: 0,
    complete: false,
  }));
test("Fee includes quantities", () =>
  assert.equal(Q.fees([item], valid()).total, 200));
test("Per-copy academic selection is serialized", () =>
  assert.equal(
    payload().service_items[0].academic[1].academic_period,
    "Second",
  ));
test("Lowered quantity trims old academic rows", () => {
  const d = valid();
  d.quantities[11] = 1;
  assert.equal(payload(d).service_items[0].academic.length, 1);
});
test("Missing choice blocks final submission", () => {
  const d = valid();
  d.choices = {};
  assert.throws(() => payload(d), /option/);
});
test("Unavailable selection blocks submission", () =>
  assert.throws(() => payload({ ...valid(), selected: [99] }), /no longer/));
test("Empty services blocked", () =>
  assert.throws(() => payload({ ...valid(), selected: [] }), /at least/));
test("Base requirements are enforced at submission", () =>
  assert.throws(
    () => payload({ ...valid(), checks: ["Authorization"] }),
    /requirements/,
  ));
test("Choice requirements are enforced at submission", () =>
  assert.throws(
    () => payload({ ...valid(), checks: ["Valid ID"] }),
    /requirements/,
  ));
test("Disabled appointment type cannot be submitted", () =>
  assert.throws(
    () =>
      payload({ ...valid(), type: "appointment", slip: true }, student, {
        ...office,
        appointment_enabled: false,
      }),
    /disabled/,
  ));
test("Appointment needs a physical slip", () =>
  assert.throws(() => payload({ ...valid(), type: "appointment" }), /slip/));
test("Appointment slip replaces walk-in checklist", () =>
  assert.equal(
    payload({ ...valid(), type: "appointment", slip: true, checks: [] })
      .appointment_slip_confirmed,
    true,
  ));
test("Parent proof is mandatory for submission", () =>
  assert.throws(() => payload(valid(), parent), /physical/));
test("Parent proof serializes explicitly", () =>
  assert.equal(
    payload({ ...valid(), proof: true }, parent).parent_proof_confirmed,
    true,
  ));
test("Priority needs a reason", () =>
  assert.throws(() => payload({ ...valid(), priority: true }), /reason/));
test("Disabled priority never leaks into payload", () => {
  const data = payload(
    { ...valid(), priority: true, reason: "Old value" },
    student,
    { ...office, priority_enabled: false },
  );
  assert.equal(data.priority, false);
  assert.equal(data.priority_reason, "");
});
test("Every academic copy is required", () => {
  const d = valid();
  d.academic[11].pop();
  assert.throws(() => payload(d), /every copy/);
});
test("Unconfigured academic period rejected", () => {
  const d = valid();
  d.academic[11][0].period = "Old";
  assert.throws(() => payload(d), /valid period/);
});
test("Quantity bounds enforce 99 copy maximum", () =>
  assert.match(
    Q.detailsProblem(
      [item],
      { ...valid(), quantities: { 11: 100 } },
      ["First", "Second"],
      ["2026-2027", "2025-2026"],
    ),
    /1 and 99/,
  ));
test("Choice requirements deduplicate safely", () =>
  assert.deepEqual(
    Q.requirements(
      [{ ...item, requirements: ["Valid ID", "Valid ID"] }],
      valid(),
    ),
    ["Valid ID", "Authorization"],
  ));
test("Missing estimate is not interpreted as zero people", () =>
  assert.equal(
    D.ticketHeadline({ status: "waiting", people_ahead: null }),
    "Waiting for a live estimate",
  ));
test("Reserved ticket never claims next-in-line", () =>
  assert.match(
    D.ticketHeadline({ status: "reserved", people_ahead: 0 }),
    /Reserved/,
  ));
test("Closed/terminal tickets never treated as active", () => {
  for (const status of ["completed", "done", "expired", "cancelled"])
    assert.equal(D.activeStatus(status), false);
});
test("Numeric/string configuration flags normalize", () => {
  assert.equal(D.flag("0"), false);
  assert.equal(D.flag("1"), true);
  assert.equal(D.flag(null), true);
});
console.log(`\n${passed} domain checks passed.`);
