import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/theme";
import { playFeedback } from "@/utils/ui-feedback";
import { useNotifications } from "@/components/notification/use-notification";
import { usePortal } from "./context";
export default function PortalTabs() {
  const insets = useSafeAreaInsets(),
    { role } = usePortal(),
    { unreadCount } = useNotifications();
  const tab = (
    name: string,
    title: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
    active: React.ComponentProps<typeof Ionicons>["name"],
  ) => (
    <Tabs.Screen
      key={name}
      name={name}
      options={{
        title,
        tabBarAccessibilityLabel: title,
        tabBarBadge:
          name === "notifications" && unreadCount > 0
            ? unreadCount > 99
              ? "99+"
              : unreadCount
            : undefined,
        tabBarIcon: ({ color, focused }) => (
          <View style={[s.icon, focused && s.selected]}>
            <Ionicons
              name={focused ? active : icon}
              color={
                focused
                  ? COLORS.white
                  : typeof color === "string"
                    ? color
                    : COLORS.gray
              }
              size={22}
            />
          </View>
        ),
      }}
    />
  );
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          void playFeedback("tap");
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarLabelStyle: {
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "600",
          marginTop: 2,
          marginHorizontal: 0,
          paddingHorizontal: 0,
        },
        tabBarIconStyle: { height: 32 },
        tabBarItemStyle: { paddingVertical: 2, paddingHorizontal: 0 },
        tabBarBadgeStyle: {
          backgroundColor: COLORS.danger,
          color: COLORS.white,
          fontSize: 14,
        },
        tabBarStyle: {
          height: 72 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          paddingHorizontal: 4,
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          elevation: 0,
          ...Platform.select({
            web: { boxShadow: "0 -1px 8px rgba(0,0,0,.03)" },
            default: {},
          }),
        },
      }}
    >
      {role === "student"
        ? [
            tab("home", "Home", "home-outline", "home"),
            tab("queue", "Transactions", "receipt-outline", "receipt"),
            tab("profile", "Profile", "person-outline", "person"),
          ]
        : [
            tab("home", "Home", "home-outline", "home"),
            tab("add-child", "Add", "person-add-outline", "person-add"),
            tab("history", "History", "time-outline", "time"),
            tab(
              "notifications",
              "Alerts",
              "notifications-outline",
              "notifications",
            ),
            tab("profile", "Profile", "person-outline", "person"),
          ]}
    </Tabs>
  );
}
const s = StyleSheet.create({
  icon: {
    minWidth: 48,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: COLORS.primary },
});
