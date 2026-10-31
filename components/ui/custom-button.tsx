import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { COLORS, RADIUS } from "@/constants/theme";
import { playFeedback } from "@/utils/ui-feedback";
type Props = {
  title: string;
  onPress: () => void;
  outlined?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  danger?: boolean;
};
/** Single action style shared by authentication, portal and modal actions. */
export default function CustomButton({
  title,
  onPress,
  outlined = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  danger = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const color = danger ? COLORS.danger : COLORS.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        void playFeedback("tap");
        onPress();
      }}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: outlined ? COLORS.white : color,
          borderColor: outlined ? COLORS.border : color,
        },
        focused && s.focus,
        blocked && s.disabled,
        pressed && !blocked && s.pressed,
      ]}
    >
      {loading && <ActivityIndicator color={outlined ? color : COLORS.white} />}
      <Text style={[s.text, { color: outlined ? color : COLORS.white }]}>
        {loading ? "Please wait…" : title}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    flexShrink: 1,
    letterSpacing: -0.15,
  },
  focus: { borderColor: COLORS.info, borderWidth: 2 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.82 },
});
