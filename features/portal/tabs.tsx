import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/constants/theme";
import { usePortal } from "./context";
/** Original mobile navigation; feature-rich details stay in the outer stack. */
export default function PortalTabs() {
  const insets = useSafeAreaInsets(),
    { role } = usePortal();
  const tab = (
    name: string,
    title: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
  ) => (
    <Tabs.Screen
      key={name}
      name={name}
      options={{
        title,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={icon}
            color={typeof color === "string" ? color : COLORS.gray}
            size={size}
          />
        ),
      }}
    />
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarLabelStyle: {
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "600",
          marginBottom: 0,
        },
        tabBarIconStyle: { height: 24 },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarStyle: {
          height: 68 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          backgroundColor: COLORS.white,
          borderTopColor: "#e5e7eb",
        },
      }}
    >
      {role === "student"
        ? [
            tab("home", "Home", "home-outline"),
            tab("queue", "Transactions", "people-outline"),
            tab("profile", "Profile", "person-outline"),
          ]
        : [
            tab("home", "Home", "people-outline"),
            tab("add-child", "Add", "person-add-outline"),
            tab("history", "History", "time-outline"),
            tab("notifications", "Alerts", "notifications-outline"),
            tab("profile", "Profile", "person-circle-outline"),
          ]}
    </Tabs>
  );
}
