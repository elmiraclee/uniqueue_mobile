import CustomButton from "@/components/ui/custom-button";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AppHeader from "@/components/layout/app-header";
import {
  COLORS,
  RADIUS,
  SHADOWS,
  STATUS_BG,
  STATUS_COLORS,
} from "@/constants/theme";
import { TutorialScrollView, TourTarget } from "@/components/tutorial/tutorial";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { usePortal } from "./context";
import { statusLabel } from "./domain";
export const palette = {
  ink: COLORS.text,
  muted: COLORS.gray,
  brand: COLORS.primary,
  canvas: COLORS.background,
  line: COLORS.border,
  white: "#FFFFFF",
};
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <CustomButton
      title={title}
      onPress={onPress}
      outlined={secondary}
      disabled={disabled}
      loading={loading}
    />
  );
}

/** Compact selection control; presentation only, existing handlers stay with callers. */
export function FilterChip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: selected ? COLORS.primary : COLORS.border,
        backgroundColor: selected ? COLORS.primarySoft : COLORS.white,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "600",
          color: selected ? COLORS.primary : COLORS.gray,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={{ flexBasis: "46%", flexGrow: 1, minWidth: 0, gap: 6 }}>
      <Text style={{ fontSize: 14, lineHeight: 20, color: COLORS.gray }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 20,
          lineHeight: 28,
          fontWeight: "700",
          letterSpacing: -0.35,
          color: COLORS.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
export function Card({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        s.card,
        accent && {
          backgroundColor: "#FBF4F4",
          borderColor: COLORS.border,
          borderLeftWidth: 3,
          borderLeftColor: COLORS.primary,
          borderRadius: RADIUS.md,
          ...SHADOWS.sm,
        },
      ]}
    >
      {children}
    </View>
  );
}
export const Heading = ({ children }: { children: React.ReactNode }) => (
  <Text accessibilityRole="header" style={s.heading}>
    {children}
  </Text>
);
export const Copy = ({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) => <Text style={muted ? s.meta : s.body}>{children}</Text>;
export function Status({ status }: { status: string }) {
  const color =
    status === "waiting" ? "#855019" : STATUS_COLORS[status] || COLORS.gray;
  return (
    <View
      style={[
        s.status,
        { backgroundColor: STATUS_BG[status] || COLORS.lightGray },
      ]}
    >
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "700",
          color,
          textTransform: "none",
          letterSpacing: 0.2,
        }}
      >
        {statusLabel(status).replace(/^./, (letter) => letter.toUpperCase())}
      </Text>
    </View>
  );
}
export function Notice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <View style={s.notice}>
      <Text accessibilityRole="alert" style={s.noticeText}>
        {message}
      </Text>
      {retry && <Button title="Try again" secondary onPress={retry} />}
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <Heading>{title}</Heading>
      <Copy muted>{description}</Copy>
      {action}
    </Card>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  secure = false,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  editable?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          s.input,
          focused && { borderColor: COLORS.primary, borderWidth: 2 },
          !editable && {
            backgroundColor: "transparent",
            borderColor: "transparent",
            paddingHorizontal: 0,
            paddingVertical: 0,
            minHeight: 28,
            color: COLORS.text,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={secure && !show}
        keyboardType={keyboardType}
        autoCapitalize={
          secure || keyboardType === "email-address" ? "none" : "sentences"
        }
      />
      {secure && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onPress={() => setShow((v) => !v)}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={s.link}>{show ? "Hide password" : "Show password"}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function Check({
  label,
  checked,
  onPress,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      onPress={onPress}
      style={[
        s.check,
        checked && {
          borderColor: palette.brand,
          backgroundColor: COLORS.primarySoft,
        },
      ]}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={24}
        color={palette.brand}
      />
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function ChildPicker({ required = false }: { required?: boolean }) {
  const p = usePortal();
  if (p.role !== "parent") return null;
  return (
    <Card>
      <Text style={s.label}>{required ? "Queueing for" : "Child"}</Text>
      {p.childrenError ? (
        <Notice
          message={p.childrenError}
          retry={() => void p.reloadChildren()}
        />
      ) : p.childrenLoading ? (
        <ActivityIndicator />
      ) : !p.children.length ? (
        <>
          <Copy muted>
            Add or link a child to access their queues and records.
          </Copy>
          <Button
            title="Add / link child"
            onPress={() => router.push("/parent/add-child")}
          />
        </>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {!required && (
              <FilterChip
                title="All children"
                selected={!p.child}
                onPress={() => p.chooseChild(0)}
              />
            )}
            {p.children.map((c) => (
              <FilterChip
                key={c.id}
                title={`${c.first_name} ${c.last_name}`}
                selected={p.child?.id === c.id}
                onPress={() => p.chooseChild(Number(c.id))}
              />
            ))}
          </ScrollView>
          {required && !p.child && (
            <Copy muted>Select a child before choosing an office.</Copy>
          )}
        </>
      )}
    </Card>
  );
}
export function Screen({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  back = false,
  updated,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  back?: boolean;
  updated?: Date | null;
}) {
  const p = usePortal(),
    path = usePathname();
  const home = path.endsWith("/home"),
    profile = path.endsWith("/profile"),
    history = title === "Transaction history";
  const headerTitle = home
    ? p.role === "parent"
      ? "Parent Dashboard"
      : "Queue Dashboard"
    : profile
      ? p.role === "parent"
        ? "Parent Profile"
        : "Student Profile"
      : history
        ? p.role === "parent"
          ? "Children’s transactions"
          : "Transactions"
        : title;
  return (
    <SafeAreaView edges={["left", "right"]} style={s.root}>
      <TourTarget id="portal">
        <AppHeader
          title={headerTitle}
          showBack={
            back ||
            (p.role === "student" &&
              (path.endsWith("/notifications") || path.endsWith("/history")))
          }
          onBackPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace(`/${p.role}/home` as any)
          }
        />
      </TourTarget>
      <TutorialScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand}
            />
          ) : undefined
        }
      >
        {updated && (
          <Text style={s.meta}>
            Updated{" "}
            {updated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </Text>
        )}
        {!home && !profile && (title !== headerTitle || subtitle) && (
          <View style={history ? s.card : { gap: 4 }}>
            {title !== headerTitle && (
              <Text accessibilityRole="header" style={s.heading}>
                {title}
              </Text>
            )}
            {subtitle && <Copy muted>{subtitle}</Copy>}
          </View>
        )}
        {children}
      </TutorialScrollView>
    </SafeAreaView>
  );
}
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  top: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#fff",
  },
  eyebrow: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.8,
    fontWeight: "700",
    color: palette.brand,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: palette.ink,
  },
  heading: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: COLORS.text,
  },
  body: { fontSize: 16, lineHeight: 24, color: palette.ink },
  meta: { fontSize: 14, lineHeight: 21, color: palette.muted },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: palette.ink,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: RADIUS.md,
    padding: 20,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  notice: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#AE6038",
    backgroundColor: "#FFF1E8",
    borderRadius: 8,
  },
  noticeText: { fontSize: 16, lineHeight: 24, color: "#7C3517" },
  status: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#8793A4",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    color: palette.ink,
    backgroundColor: COLORS.white,
  },
  check: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
  },
  back: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: palette.brand,
  },
  number: {
    fontSize: 44,
    lineHeight: 54,
    letterSpacing: -1.5,
    fontWeight: "700",
    color: palette.brand,
    fontVariant: ["tabular-nums"],
  },
});
