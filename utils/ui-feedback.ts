import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useSyncExternalStore } from "react";
type Preferences = { sound: boolean; haptics: boolean };
const KEY = "uniqueue-ui-feedback-v1";
let preferences: Preferences = { sound: false, haptics: true };
let hydrated: Promise<void> | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((fn) => fn());
export function loadFeedbackPreferences() {
  return (hydrated ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        preferences = {
          sound: data.sound === true,
          haptics: data.haptics !== false,
        };
        publish();
      }
    })
    .catch(() => {}));
}
export async function setFeedbackPreferences(update: Partial<Preferences>) {
  await loadFeedbackPreferences();
  const next = { ...preferences, ...update };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  preferences = next;
  publish();
}
export function useFeedbackPreferences() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => preferences,
    () => preferences,
  );
}
let player: import("expo-audio").AudioPlayer | null = null;
let lastTap = 0;
export async function playFeedback(kind: "tap" | "success" | "error") {
  await loadFeedbackPreferences();
  if (kind === "tap" && Date.now() - lastTap < 150) return;
  lastTap = Date.now();
  if (preferences.haptics && Platform.OS !== "web") {
    try {
      if (kind === "tap") await Haptics.selectionAsync();
      else
        await Haptics.notificationAsync(
          kind === "error"
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success,
        );
    } catch {
      /* Unsupported hardware must never block an action. */
    }
  }
  if (preferences.sound && kind === "success") {
    try {
      if (!player) {
        const audio = await import("expo-audio");
        player = audio.createAudioPlayer(
          require("../assets/sounds/ui-success.wav"),
        );
        player.volume = 0.25;
      }
      await player.seekTo(0);
      player.play();
    } catch {
      /* Browser autoplay and silent hardware can decline playback. */
    }
  }
}
export function disposeFeedbackAudio() {
  player?.remove();
  player = null;
}
