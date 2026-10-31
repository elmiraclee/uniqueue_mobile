import { useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
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
    ui = useClientUI(),
    [filter, setFilter] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(
      (signal: AbortSignal) =>
        request("get_account_notifications.php", undefined, signal),
      [],
    ),
    r = useResource(load, 10000);
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
      {r.loading && <ActivityIndicator color="#660810" />}
      <Card>
        <Heading>{r.data?.unread_count || 0} unread</Heading>
        <Button
          title={filter ? "Show all notices" : "Show unread only"}
          secondary
          onPress={() => setFilter((v) => !v)}
        />
        <Button
          title="Mark all as read"
          secondary
          disabled={busy || !r.data?.unread_count}
          onPress={() => void mark()}
        />
      </Card>
      {r.data && !items.length && (
        <Empty
          title={filter ? "All caught up" : "No notifications yet"}
          description="New queue and account updates will appear here."
        />
      )}
      {items.map((n: any) => (
        <Card key={n.id} accent={!n.is_read}>
          <Copy muted>
            {n.is_read ? "Read" : "Unread"}
            {n.child_name ? ` · ${n.child_name}` : ""}
          </Copy>
          <Heading>{n.title}</Heading>
          <Copy>{n.message}</Copy>
          <Copy muted>
            {[n.office_name, n.queue_number ? `#${n.queue_number}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Copy>
          <Copy muted>
            {n.created_at ? serverDate(n.created_at).toLocaleString() : ""}
          </Copy>
          {!n.is_read && (
            <Button
              title="Mark as read"
              secondary
              disabled={busy}
              onPress={() => void mark(Number(n.id))}
            />
          )}
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
        </Card>
      ))}
    </Screen>
  );
}
