import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Vibration } from "react-native";
import { getSessionToken } from "./session-storage";
/** Queue alerts are independent of optional UI tap/success feedback. */
let player: import("expo-audio").AudioPlayer | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let claimChain: Promise<unknown> = Promise.resolve();
let audioGeneration = 0;
let vibrationOwner: string | null = null;
export function eventKey(n: any): string {
  return String(n.event_id || `notice:${n.id}`);
}
export function isFresh(n: any): boolean {
  const expires = Number(n.expires_at || 0);
  if (expires) return expires * 1000 >= Date.now();
  return !n.ticket_id; // Old queue history must never replay as a turn alarm.
}
export async function claimQueueEvent(n: any): Promise<boolean> {
  const token = await getSessionToken();
  if (!token || !n.event_id || !isFresh(n)) return false;
  const key = "uniqueue-alert-events-v1";
  const job = claimChain.then(async () => {
    const raw = await AsyncStorage.getItem(key);
    const saved = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const events: Record<string, number> = {};
    for (const [id, stamp] of Object.entries(saved))
      if (Number(stamp) > now - 86400000) events[id] = Number(stamp);
    if (events[eventKey(n)]) return false;
    events[eventKey(n)] = now;
    await AsyncStorage.setItem(key, JSON.stringify(events));
    return (await getSessionToken()) === token;
  });
  claimChain = job.catch(() => false);
  return job;
}
/** No expiry timer: the visible foreground modal owns vibration until OK.
 * AppState/unmount/logout must release it; OS permission/DND restrictions still apply. */
export function holdQueueVibration(owner: string) {
  if (!owner || vibrationOwner === owner) return;
  vibrationOwner = owner;
  if (Platform.OS !== "web") Vibration.vibrate([0, 400, 250, 400, 800], true);
}
export function releaseQueueVibration(owner: string) {
  if (vibrationOwner !== owner) return; // A stale cleanup cannot stop a newer prompt.
  vibrationOwner = null;
  Vibration.cancel();
}
function stopAudioCue() {
  audioGeneration++;
  timers.forEach(clearTimeout);
  timers = [];
  if (!vibrationOwner) Vibration.cancel();
  try {
    player?.pause();
    player?.remove();
    player = null;
  } catch {
    /* optional audio */
  }
}
/** Explicit acknowledgement, logout or invalidated ticket stops all cue ownership. */
export function stopQueueAlarm() {
  vibrationOwner = null;
  stopAudioCue();
}
async function audio(alarm: boolean) {
  const generation = audioGeneration;
  try {
    const mod = await import("expo-audio");
    await mod.setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    });
    if (generation !== audioGeneration) return; // A late audio init must not ring after OK/logout.
    player?.remove();
    player = mod.createAudioPlayer(
      alarm
        ? require("../assets/sounds/alarm.wav")
        : require("../assets/sounds/notify.wav"),
    );
    player.volume = 1;
    player.play();
  } catch {
    /* Native notification permissions/settings still apply. */
  }
}
export async function playQueueCue(n: any) {
  const type = String(n.type || "");
  const alarm = ["called", "in_progress"].includes(type);
  if (!alarm && timers.length) return;
  stopAudioCue(); // Never clears a visible modal's acknowledged-vibration ownership.
  const generation = audioGeneration;
  if (alarm) {
    await audio(true);
    if (generation !== audioGeneration) return;
    if (Platform.OS !== "web" && !vibrationOwner)
      Vibration.vibrate([0, 800, 250, 800, 250, 800, 250, 1000], true);
    // Bound audio only. A visible prompt's vibration continues until acknowledged.
    timers.push(setTimeout(stopAudioCue, 20000));
    return;
  }
  const ahead = Number(n.ahead);
  const count =
    type === "position_update" && ahead >= 1 && ahead <= 5
      ? 6 - ahead
      : type === "next_in_line"
        ? 3
        : 1;
  for (let i = 0; i < count; i++)
    timers.push(
      setTimeout(() => {
        void audio(false);
      }, i * 350),
    );
  if (Platform.OS !== "web" && !vibrationOwner)
    Vibration.vibrate([
      0,
      ...Array.from({ length: count }, () => [200, 150]).flat(),
    ]);
  timers.push(
    setTimeout(
      () => {
        timers = [];
      },
      count * 350 + 500,
    ),
  );
}
