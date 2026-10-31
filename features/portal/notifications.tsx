import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS } from "@/constants/theme";
import { serverDate } from "@/utils/server-time";
import { useNotifications } from "@/components/notification/use-notification";
import { useClientUI } from "@/components/client/client-ui";
import { usePortal } from "./context";
import { request } from "./api";
import { useResource } from "./use-resource";
import { Button, Card, Copy, Empty, Heading, Notice, Screen } from "./ui";
export default function NotificationsScreen() {
  const p = usePortal(),
    global = useNotifications(),
    ui = useClientUI();
  const [filter, setFilter] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    (signal: AbortSignal) =>
      request("get_account_notifications.php", undefined, signal),
    [],
  );
  const r = useResource(load, 10000);
  const mark = async (id?: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await request(
        "mark_notification_read.php",
        id == null ? {} : { notification_id: id },
      );
      await Promise.all([r.reload(), global.refresh()]);
    } catch (e) {
      ui.notify(
        e instanceof Error ? e.message : "Could not update notice.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  const items = (r.data?.notifications || []).filter(
    (n: any) => !filter || !n.is_read,
  );
  return (
    <Screen
      title="Notifications"
      subtitle="Queue updates and account notices in one place."
      refreshing={r.loading}
      onRefresh={() => {
        void r.reload();
        void global.refresh();
      }}
    >
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      <Card>
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={COLORS.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Heading>{r.data?.unread_count || 0} unread</Heading>
            <Copy muted>Stay up to date with your queue.</Copy>
          </View>
        </View>
        <View style={styles.segments}>
          {[false, true].map((unread) => (
            <Pressable
              key={String(unread)}
              accessibilityRole="button"
              accessibilityLabel={
                unread ? "Show unread only" : "Show all notices"
              }
              accessibilityState={{ selected: filter === unread }}
              onPress={() => setFilter(unread)}
              style={[
                styles.segment,
                filter === unread && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  filter === unread && { color: COLORS.primary },
                ]}
              >
                {unread ? "Unread" : "All updates"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Mark all as read"
          secondary
          disabled={busy || !r.data?.unread_count}
          loading={busy}
          onPress={() => void mark()}
        />
      </Card>
      {r.loading && !r.data && (
        <ActivityIndicator
          accessibilityLabel="Loading notifications"
          color={COLORS.primary}
        />
      )}
      {r.data && !items.length && (
        <Empty
          title={filter ? "All caught up" : "No notifications yet"}
          description="New queue and account updates will appear here."
        />
      )}
      {items.map((n: any) => (
        <Card key={n.id} accent={!n.is_read}>
          <View style={styles.summary}>
            <View
              style={[
                styles.typeIcon,
                {
                  backgroundColor:
                    n.type === "cancelled"
                      ? COLORS.dangerLight
                      : n.type === "completed"
                        ? COLORS.successLight
                        : COLORS.infoLight,
                },
              ]}
            >
              <Ionicons
                name={
                  n.type === "completed"
                    ? "checkmark-circle-outline"
                    : n.type === "cancelled"
                      ? "close-circle-outline"
                      : n.type === "called"
                        ? "megaphone-outline"
                        : "notifications-outline"
                }
                size={20}
                color={
                  n.type === "cancelled"
                    ? COLORS.danger
                    : n.type === "completed"
                      ? COLORS.success
                      : COLORS.info
                }
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Copy muted>
                {n.is_read ? "Read" : "Unread"}
                {n.child_name ? ` · ${n.child_name}` : ""}
              </Copy>
              <Heading>{n.title}</Heading>
            </View>
            {!n.is_read && (
              <View accessibilityLabel="Unread" style={styles.dot} />
            )}
          </View>
          <Copy>{n.message}</Copy>
          {!!(n.office_name || n.queue_number) && (
            <Copy muted>
              {[n.office_name, n.queue_number ? `#${n.queue_number}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </Copy>
          )}
          <Copy muted>
            {n.created_at ? serverDate(n.created_at).toLocaleString() : ""}
          </Copy>
          <View style={{ gap: 8 }}>
            {Number(n.ticket_id) > 0 && (
              <Button
                title="View ticket"
                onPress={() =>
                  router.push({
                    pathname: `/${p.role}/ticket`,
                    params: { ticketId: String(n.ticket_id) },
                  } as any)
                }
              />
            )}
            {!n.is_read && (
              <Button
                title="Mark as read"
                secondary
                disabled={busy}
                onPress={() => void mark(Number(n.id))}
              />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  segments: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentActive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  segmentText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: COLORS.gray,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
