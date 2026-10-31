/** Unit tests for optional UI feedback; no device, audio or server access. */
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { buildSync } = require("esbuild");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "uq-feedback-"));
const state = { saved: null, fail: false, haptics: 0, plays: 0, removed: 0 };
global.__feedbackTest = state;
try {
  fs.writeFileSync(
    path.join(temp, "storage.js"),
    `module.exports={getItem:async()=>global.__feedbackTest.saved,setItem:async(k,v)=>{if(global.__feedbackTest.fail)throw Error('storage failed');global.__feedbackTest.saved=v}}`,
  );
  fs.writeFileSync(path.join(temp, "native.js"), `exports.Platform={OS:'web'}`);
  fs.writeFileSync(
    path.join(temp, "haptics.js"),
    `exports.selectionAsync=async()=>{global.__feedbackTest.haptics++};exports.notificationAsync=exports.selectionAsync;exports.NotificationFeedbackType={Error:'error',Success:'success'}`,
  );
  fs.writeFileSync(
    path.join(temp, "audio.js"),
    `exports.createAudioPlayer=()=>({seekTo:async()=>{},play:()=>{global.__feedbackTest.plays++},remove:()=>{global.__feedbackTest.removed++}})`,
  );
  buildSync({
    entryPoints: [path.resolve(__dirname, "../utils/ui-feedback.ts")],
    outfile: path.join(temp, "feedback.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    alias: {
      "@react-native-async-storage/async-storage": path.join(
        temp,
        "storage.js",
      ),
      "react-native": path.join(temp, "native.js"),
      "expo-haptics": path.join(temp, "haptics.js"),
      "expo-audio": path.join(temp, "audio.js"),
    },
    external: ["react"],
    loader: { ".wav": "dataurl" },
  });
  // Resolve React from the app, not the temporary directory.
  const Module = require("node:module");
  const mod = new Module(path.join(temp, "feedback.cjs"), module);
  mod.paths = module.paths;
  mod._compile(
    fs.readFileSync(path.join(temp, "feedback.cjs"), "utf8"),
    path.join(temp, "feedback.cjs"),
  );
  const feedback = mod.exports;
  (async () => {
    await feedback.loadFeedbackPreferences();
    await feedback.playFeedback("success");
    assert.equal(state.plays, 0, "sound is opt-in");
    await feedback.setFeedbackPreferences({ sound: true });
    assert.equal(JSON.parse(state.saved).sound, true);
    await feedback.playFeedback("tap");
    assert.equal(state.plays, 0, "taps are silent");
    await feedback.playFeedback("error");
    assert.equal(state.plays, 0, "validation errors are silent");
    await feedback.playFeedback("success");
    assert.equal(state.plays, 1, "success plays once");
    assert.equal(state.haptics, 0, "web does not request device haptics");
    state.fail = true;
    await assert.rejects(feedback.setFeedbackPreferences({ sound: false }));
    await feedback.playFeedback("success");
    assert.equal(
      state.plays,
      2,
      "failed persistence does not change preference",
    );
    feedback.disposeFeedbackAudio();
    assert.equal(state.removed, 1, "audio resources released");
    console.log("9 optional-feedback checks passed.");
  })()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => {
      delete global.__feedbackTest;
      fs.rmSync(temp, { recursive: true, force: true });
    });
} catch (error) {
  fs.rmSync(temp, { recursive: true, force: true });
  throw error;
}
