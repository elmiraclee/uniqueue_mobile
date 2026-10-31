import { router, usePathname, useIsFocused, useFocusEffect } from "expo-router";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import NotificationModal from "../notification/notification-modal";
import { useNotifications } from "../notification/use-notification";
import { TourTarget, useTutorial } from "../tutorial/tutorial";
import { useClientUI } from "../client/client-ui";
import { useOptionalPortal } from "../../features/portal/context";
import { ASSET_BASE_URL } from "../../constants/backend";
import { logoutClient } from "../../utils/client-fetch";
interface HeaderProps {
  title?: string;
  onNotificationPress?: () => void;
  onBackPress?: () => void;
  showBack?: boolean;
}
export default function AppHeader({
  title,
  onNotificationPress,
  onBackPress,
  showBack,
}: HeaderProps) {
  const focused = useIsFocused();
  const portal = useOptionalPortal(),
    { width } = useWindowDimensions();
  const avatarRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [menu, setMenu] = useState(false),
    [menuTop, setMenuTop] = useState(76);
  const [failedPhoto, setFailedPhoto] = useState("");
  const user = portal?.user;
  const name =
    user?.full_name ||
    user?.name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Your account";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((v: string) => v[0])
    .join("")
    .toUpperCase();
  const picture = user?.picture || user?.google_picture;
  const photo = picture
    ? picture.startsWith("http")
      ? picture
      : `${ASSET_BASE_URL}/${picture}`
    : "";
  const openMenu = () =>
    avatarRef.current?.measureInWindow((_x, y, _w, h) => {
      setMenuTop(Math.max(insets.top + 56, Math.min(y + h + 8, 160)));
      setMenu(true);
    });
  const logout = () => {
    setMenu(false);
    ui.confirm({
      title: "Logout from this device?",
      message:
        "Your account remains active. This device’s stored session and live-ticket widget will be cleared.",
      confirmLabel: "Logout",
      onConfirm: () => {
        void logoutClient().catch((e: unknown) =>
          ui.notify(
            e instanceof Error
              ? e.message
              : "Could not logout. Please try again.",
            "error",
          ),
        );
      },
    });
  };
  const path = usePathname(),
    insets = useSafeAreaInsets(),
    guide = useTutorial(),
    ui = useClientUI();
  useFocusEffect(useCallback(() => () => setMenu(false), []));
  const [visible, setVisible] = useState(false);
  const { unreadCount } = useNotifications();
  const label =
    title ||
    (path.includes("/home")
      ? "Queue Dashboard"
      : path.includes("/queue")
        ? "Transactions"
        : path.includes("/profile")
          ? path.startsWith("/parent")
            ? "Parent Profile"
            : "Student Profile"
          : "UniQueue");
  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {showBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBackPress || (() => router.back())}
          style={s.icon}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <TourTarget id="header">
          <View style={s.left}>
            {!(width < 360 && showBack) && (
              <Image
                source={require("../../assets/images/logo.png")}
                style={s.logo}
              />
            )}
            <Text numberOfLines={2} accessibilityRole="header" style={s.title}>
              {label}
            </Text>
          </View>
        </TourTarget>
      </View>
      <TourTarget id="help">
        <Pressable
          accessibilityLabel="Open guided tutorial"
          accessibilityRole="button"
          onPress={() => void guide.start()}
          onLongPress={() =>
            ui.confirm({
              title: "Restart guided tutorial?",
              message:
                "Start from the first step. No account or transaction data will change.",
              confirmLabel: "Restart guide",
              onConfirm: () => void guide.start(true),
            })
          }
          style={s.icon}
        >
          <Ionicons
            name="help-circle-outline"
            size={23}
            color={COLORS.primary}
          />
        </Pressable>
      </TourTarget>
      <TourTarget id="bell">
        <Pressable
          accessibilityLabel={`Notifications, ${unreadCount} unread`}
          accessibilityRole="button"
          onPress={() => {
            setVisible(true);
            onNotificationPress?.();
          }}
          style={s.icon}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.primary}
          />
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </TourTarget>
      {!!portal && (
        <Pressable
          ref={avatarRef}
          accessibilityRole="button"
          accessibilityLabel="Open account menu"
          accessibilityState={{ expanded: menu }}
          onPress={openMenu}
          style={s.accountButton}
        >
          <View style={s.avatar}>
            {photo && failedPhoto !== photo ? (
              <Image
                source={{ uri: photo }}
                onError={() => setFailedPhoto(photo)}
                style={s.avatarImage}
              />
            ) : (
              <Text style={s.initials}>{initials}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={12} color={COLORS.primary} />
        </Pressable>
      )}
      <Modal
        visible={menu && focused}
        transparent
        animationType="none"
        onRequestClose={() => setMenu(false)}
      >
        <View style={s.menuOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account menu"
            style={StyleSheet.absoluteFill}
            onPress={() => setMenu(false)}
          />
          <View
            testID="account-dropdown"
            accessibilityViewIsModal
            style={[
              s.menu,
              { top: menuTop, right: 16, width: Math.min(width - 32, 280) },
            ]}
          >
            <View style={s.menuIdentity}>
              <Text style={s.menuName}>{name}</Text>
              <Text style={s.menuRole}>
                {portal?.role === "parent" ? "Parent / Guardian" : "Student"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View profile"
              onPress={() => {
                setMenu(false);
                router.push(`/${portal?.role}/profile` as any);
              }}
              style={s.menuItem}
            >
              <Ionicons
                name="person-circle-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={s.menuLabel}>View profile</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={logout}
              style={[s.menuItem, s.logoutItem]}
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={[s.menuLabel, { color: COLORS.primary }]}>
                Logout
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <NotificationModal
        visible={visible || (focused && guide.notificationStep)}
        onClose={() => {
          setVisible(false);
          if (guide.notificationStep) guide.pause();
        }}
      />
    </View>
  );
}
const s = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderBottomWidth: 2,
    borderColor: COLORS.primary,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 28, height: 32, resizeMode: "contain" },
  title: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: -0.35,
    color: COLORS.text,
    flexShrink: 1,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  accountButton: {
    minWidth: 44,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryTint,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  initials: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  menuOverlay: { flex: 1, backgroundColor: "rgba(16,24,40,0.12)" },
  menu: {
    position: "absolute",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    padding: 8,
    boxShadow: "0 8px 24px rgba(16,24,40,0.16)",
  },
  menuIdentity: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  menuName: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  menuRole: { fontSize: 14, lineHeight: 20, color: COLORS.gray, marginTop: 2 },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
  },
  menuLabel: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  logoutItem: { backgroundColor: COLORS.primarySoft },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 3,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
