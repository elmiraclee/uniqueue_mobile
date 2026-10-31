import { useEffect, useState } from "react";
import { Switch, View, Text, StyleSheet, Platform } from "react-native";
import { COLORS } from "@/constants/theme";
import {
  loadFeedbackPreferences,
  setFeedbackPreferences,
  useFeedbackPreferences,
} from "@/utils/ui-feedback";
import { useClientUI } from "@/components/client/client-ui";
export default function FeedbackPreferences() {
  const preferences = useFeedbackPreferences(),
    ui = useClientUI();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadFeedbackPreferences();
  }, []);
  const update = async (key: "sound" | "haptics", value: boolean) => {
    setBusy(true);
    try {
      await setFeedbackPreferences({ [key]: value });
    } catch {
      ui.notify("Could not save this preference. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>
        App experience
      </Text>
      {(
        [
          {
            key: "sound",
            title: "Interface sounds",
            copy: "A soft chime for successful actions.",
          },
          {
            key: "haptics",
            title: "Haptic feedback",
            copy: "Subtle feedback on supported phones.",
          },
        ] as const
      ).map((item) => (
        <View key={item.key} style={s.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.copy}>{item.copy}</Text>
          </View>
          <Switch
            accessibilityLabel={item.title}
            disabled={busy}
            value={preferences[item.key]}
            onValueChange={(value) => void update(item.key, value)}
            trackColor={{ false: "#B8BDC6", true: COLORS.primary }}
            thumbColor="#fff"
            {...(Platform.OS === "web" ? { activeThumbColor: "#fff" } : {})}
          />
        </View>
      ))}
      <Text style={s.copy}>
        Queue alert sounds are separate and follow your device’s notification
        settings.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    gap: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heading: {
    fontSize: 18,
    lineHeight: 25,
    color: COLORS.text,
    fontWeight: "700",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: COLORS.text,
  },
  copy: { fontSize: 14, lineHeight: 21, color: COLORS.gray },
});
