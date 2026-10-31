/** Isolated audio/event regression tests. Never contacts production. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  assert = require("assert/strict"),
  Module = require("module"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, ".."),
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uq-alerts-"));
global.__alerts = {
  data: {},
  token: "session-fixture",
  plays: 0,
  vibrations: 0,
  cancels: 0,
  patterns: [],
};
const mocks = {
  storage: `module.exports={getItem:async(k)=>global.__alerts.data[k]||null,setItem:async(k,v)=>{global.__alerts.data[k]=v}}`,
  session: `exports.getSessionToken=async()=>global.__alerts.token`,
  native: `exports.Platform={OS:'android'};exports.Vibration={cancel:()=>{global.__alerts.cancels++},vibrate:(pattern,repeat)=>{global.__alerts.vibrations++;global.__alerts.patterns.push({pattern,repeat})}}`,
  audio: `exports.setAudioModeAsync=async()=>{};exports.createAudioPlayer=()=>({play:()=>global.__alerts.plays++,pause:()=>{},remove:()=>{}})`,
};
for (const [k, v] of Object.entries(mocks))
  fs.writeFileSync(path.join(tmp, k + ".js"), v);
const result = esbuild.buildSync({
  entryPoints: [path.join(root, "utils/queue-alerts.ts")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  loader: { ".wav": "dataurl" },
  plugins: undefined,
  alias: {
    "@react-native-async-storage/async-storage": path.join(tmp, "storage.js"),
    "react-native": path.join(tmp, "native.js"),
    "expo-audio": path.join(tmp, "audio.js"),
  },
  external: ["./session-storage"],
});
const mod = new Module(
  path.join(root, "utils", "queue-alerts-test.cjs"),
  module,
);
mod.paths = module.paths;
const old = mod.require.bind(mod);
mod.require = (x) =>
  x === "./session-storage"
    ? { getSessionToken: async () => global.__alerts.token }
    : old(x);
mod._compile(
  result.outputFiles[0].text,
  path.join(root, "utils/queue-alerts-test.cjs"),
);
const q = mod.exports;
(async () => {
  let checks = 0;
  const test = (condition, label) => {
    assert(condition, label);
    checks++;
    console.log("PASS", label);
  };
  const event = (id, ahead = 5) => ({
    id: 1,
    event_id: id,
    ticket_id: 41,
    type: "position_update",
    ahead,
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });
  for (const ahead of [5, 4, 3, 2, 1])
    test(
      await q.claimQueueEvent(event("event-" + ahead, ahead)),
      `distinct ${ahead}-ahead event claimed`,
    );
  test(
    !(await q.claimQueueEvent(event("event-3", 3))),
    "same event from poll/push does not claim twice",
  );
  test(
    (
      await Promise.all([
        q.claimQueueEvent(event("race")),
        q.claimQueueEvent(event("race")),
      ])
    ).filter(Boolean).length === 1,
    "concurrent foreground claims serialized",
  );
  test(
    !q.isFresh({ ...event("old"), expires_at: 1 }),
    "expired event rejected",
  );
  test(
    !q.isFresh({ ticket_id: 41 }),
    "legacy ticket history never replayed as an alarm",
  );
  global.__alerts.token = null;
  test(
    !(await q.claimQueueEvent(event("loggedout"))),
    "logged-out session never claims alarm",
  );
  global.__alerts.token = "session-fixture";
  await q.playQueueCue({ type: "called" });
  test(global.__alerts.plays === 1, "actual turn starts alarm audio");
  test(global.__alerts.vibrations === 1, "actual turn starts vibration");
  q.stopQueueAlarm();
  await q.playQueueCue({ type: "position_update", ahead: 1 });
  await new Promise((r) => setTimeout(r, 1550));
  test(
    global.__alerts.plays === 6,
    "one-ahead countdown plays five cues after prior turn cue",
  );
  q.stopQueueAlarm();
  const initial = global.__alerts.vibrations;
  q.holdQueueVibration("student:7:41");
  test(
    global.__alerts.vibrations === initial + 1 &&
      global.__alerts.patterns.at(-1).repeat === true,
    "modal starts repeating native vibration",
  );
  q.holdQueueVibration("student:7:41");
  test(
    global.__alerts.vibrations === initial + 1,
    "same ticket countdown advances without restarting vibration",
  );
  const cancellations = global.__alerts.cancels;
  q.releaseQueueVibration("old-ticket");
  test(
    global.__alerts.cancels === cancellations,
    "stale cleanup cannot cancel current owner",
  );
  await q.playQueueCue({ type: "called" });
  test(
    global.__alerts.cancels === cancellations,
    "new turn audio cannot cancel modal vibration",
  );
  q.releaseQueueVibration("student:7:41");
  test(
    global.__alerts.cancels === cancellations + 1,
    "background/unmount releases vibration",
  );
  q.holdQueueVibration("student:7:41");
  test(
    global.__alerts.vibrations === initial + 2,
    "foreground resumes repeating vibration",
  );
  q.stopQueueAlarm();
  test(
    global.__alerts.cancels === cancellations + 2,
    "OK or logout cancels vibration",
  );
  // Capture 20-second audio timeout rather than sleeping: modal haptic must survive it.
  const originalTimeout = global.setTimeout;
  let audioExpiry;
  global.setTimeout = (fn, ms, ...args) =>
    ms === 20000
      ? ((audioExpiry = fn), originalTimeout(() => {}, 1))
      : originalTimeout(fn, ms, ...args);
  q.holdQueueVibration("student:7:41");
  await q.playQueueCue({ type: "called" });
  const beforeExpiry = global.__alerts.cancels;
  assert(audioExpiry);
  audioExpiry();
  test(
    global.__alerts.cancels === beforeExpiry,
    "20-second audio timeout does not expire held vibration",
  );
  q.stopQueueAlarm();
  global.setTimeout = originalTimeout;
  const beforeLate = global.__alerts.vibrations,
    playBefore = global.__alerts.plays;
  const late = q.playQueueCue({ type: "called" });
  q.stopQueueAlarm();
  await late;
  test(
    global.__alerts.vibrations === beforeLate &&
      global.__alerts.plays === playBefore,
    "late audio init cannot restart cue after OK",
  );
  console.log(`${checks} isolated queue-alert checks passed.`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    q.stopQueueAlarm();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete global.__alerts;
  });
