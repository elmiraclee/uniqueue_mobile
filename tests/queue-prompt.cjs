/** Pure prompt policy, no network. */
const assert = require("assert/strict"),
  path = require("path"),
  Module = require("module"),
  esbuild = require("esbuild");
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../utils/queue-prompt.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
});
const mod = new Module(__filename, module);
mod._compile(built.outputFiles[0].text, __filename);
const q = mod.exports;
let checks = 0;
const test = (v, label) => {
  assert(v, label);
  checks++;
  console.log("PASS", label);
};
const ticket = {
  id: 41,
  status: "waiting",
  people_ahead: 5,
  is_requeued: false,
};
for (const ahead of [5, 4, 3, 2, 1]) {
  const event = { ticket_id: 41, type: "position_update", ahead };
  test(
    q.queuePromptKind(event) === "countdown" &&
      q.queuePromptMatchesTicket(event, { ...ticket, people_ahead: ahead }),
    `${ahead} ahead live countdown`,
  );
}
for (const ahead of [null, undefined, -1, 0, 6, 1.5, "bad"])
  test(
    q.queuePromptKind({ type: "position_update", ahead }) === null,
    `reject invalid ahead ${ahead}`,
  );
for (const type of ["priority_bump", "appointment_bump"])
  test(
    q.queuePromptKind({ type, ahead: 4 }) === "countdown",
    `${type} proximity modal`,
  );
test(
  !q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "position_update", ahead: 5 },
    { ...ticket, people_ahead: 6 },
  ),
  "stale position rejected",
);
for (const status of [
  "cancelled",
  "completed",
  "reserved",
  "held",
  "in_progress",
])
  test(
    !q.queuePromptMatchesTicket(
      { ticket_id: 41, type: "position_update", ahead: 5 },
      { ...ticket, status },
    ),
    `no countdown for ${status}`,
  );
test(
  !q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "position_update", ahead: 5 },
    { ...ticket, is_requeued: true },
  ),
  "held/requeued ticket rejected",
);
test(
  !q.queuePromptMatchesTicket(
    { ticket_id: 42, type: "position_update", ahead: 5 },
    ticket,
  ),
  "wrong ticket rejected",
);
test(
  !q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "position_update", ahead: 5 },
    { ...ticket, people_ahead: null },
  ),
  "unknown live position rejected",
);
test(
  q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "next_in_line" },
    { ...ticket, status: "next", people_ahead: 0 },
  ),
  "next in line valid at zero",
);
test(
  q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "called" },
    { ...ticket, status: "called" },
  ),
  "called valid",
);
test(
  !q.queuePromptMatchesTicket(
    { ticket_id: 41, type: "called" },
    { ...ticket, status: "completed" },
  ),
  "old call invalid",
);
test(
  q.queuePromptPriority({ type: "called" }) >
    q.queuePromptPriority({ type: "next_in_line" }) &&
    q.queuePromptPriority({ type: "next_in_line" }) >
      q.queuePromptPriority({ type: "position_update", ahead: 5 }),
  "turn supersedes next supersedes countdown",
);
console.log(`${checks} isolated prompt policy checks passed.`);
