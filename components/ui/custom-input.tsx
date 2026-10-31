import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
export default function CustomInput({
  style,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: TextInputProps) {
  const [visible, setVisible] = useState(false),
    [focused, setFocused] = useState(false);
  const flat = StyleSheet.flatten(style) || {};
  const { marginBottom, ...inputStyle } = flat;
  return (
    <View style={{ marginBottom: marginBottom ?? 14 }}>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel || props.placeholder}
        placeholderTextColor={COLORS.gray}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          s.input,
          inputStyle,
          focused && { borderColor: COLORS.primary, borderWidth: 2 },
          secureTextEntry && { paddingRight: 54 },
          props.editable === false && { backgroundColor: COLORS.lightGray },
        ]}
        secureTextEntry={!!secureTextEntry && !visible}
        autoCapitalize={secureTextEntry ? "none" : props.autoCapitalize}
        autoCorrect={secureTextEntry ? false : props.autoCorrect}
      />
      {secureTextEntry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          accessibilityState={{ selected: visible }}
          hitSlop={4}
          onPress={() => setVisible((v) => !v)}
          style={s.eye}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={22}
            color={COLORS.primary}
          />
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#8793A4",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  eye: {
    position: "absolute",
    right: 2,
    top: 2,
    bottom: 2,
    minWidth: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
