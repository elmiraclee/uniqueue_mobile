import { useCallback, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useClientUI } from "@/components/client/client-ui";
import { clearLiveTicketWidget } from "@/utils/live-ticket-widget";
import { usePortal } from "../portal/context";
import { request } from "../portal/api";
import { useResource } from "../portal/use-resource";
import { Button, Card, Copy, Empty, Heading, Notice } from "../portal/ui";
export default function Relationships() {
  const p = usePortal(),
    ui = useClientUI(),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const key = p.role === "parent" ? "parent_id" : "student_id";
      const [links, requests] = await Promise.all([
        request(
          `${p.role === "parent" ? "get_parent_children.php" : "get_student_linked_parents.php"}?${key}=${p.user.id}`,
          undefined,
          signal,
        ),
        request(
          `get_parent_link_requests.php?${key}=${p.user.id}`,
          undefined,
          signal,
        ),
      ]);
      return {
        links: p.role === "parent" ? links.children || [] : links.parents || [],
        requests: requests.requests || [],
      };
    },
    [p.role, p.user.id],
  );
  const r = useResource(load);
  const mutate = async (endpoint: string, body: any) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const res = await request(endpoint, body);
      if (endpoint === "unlink_relationship.php") await clearLiveTicketWidget();
      ui.notify(res.message || "Relationship updated.");
      await Promise.all([r.reload(), p.reloadChildren()]);
    } catch (e) {
      ui.notify(e instanceof Error ? e.message : "Could not update.", "error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const respond = (id: number, action: "approve" | "decline") =>
    ui.confirm({
      title:
        action === "approve"
          ? "Approve this parent / guardian?"
          : "Decline link request?",
      message:
        action === "approve"
          ? "Approval gives this person access to your queue and transaction records. Only approve someone you recognise."
          : "No access will be granted.",
      confirmLabel: action === "approve" ? "Approve" : "Decline",
      onConfirm: () =>
        void mutate("student_respond_link_request.php", {
          request_id: id,
          action,
        }),
    });
  return (
    <>
      <Heading>
        {p.role === "parent" ? "Linked children" : "Parents & guardians"}
      </Heading>
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      {r.loading && <ActivityIndicator />}
      {r.data && !r.data.links.length && (
        <Empty
          title="No active links"
          description="Linked accounts appear here. Unlinking never deletes accounts or history."
        />
      )}
      {(r.data?.links || []).map((link: any) => (
        <Card key={link.link_id}>
          <Heading>
            {p.role === "parent"
              ? `${link.first_name} ${link.last_name}`
              : link.full_name}
          </Heading>
          <Copy muted>
            {link.relationship}
            {link.sr_code ? ` · ${link.sr_code}` : ""}
          </Copy>
          <Button
            title="Unlink relationship"
            secondary
            disabled={busy}
            onPress={() =>
              ui.confirm({
                title: "Unlink this relationship?",
                message:
                  "Parent access to this student’s queues and records will end. Both accounts receive a notice. Profiles and past transactions remain.",
                confirmLabel: "Unlink",
                danger: true,
                onConfirm: () =>
                  void mutate("unlink_relationship.php", {
                    link_id: Number(link.link_id),
                  }),
              })
            }
          />
        </Card>
      ))}
      {p.role === "parent" && (
        <Button
          title="Add / link child"
          secondary
          onPress={() => router.push("/parent/add-child")}
        />
      )}
      <Heading>Pending link requests</Heading>
      {r.data && !r.data.requests.length && (
        <Copy muted>No pending requests.</Copy>
      )}
      {(r.data?.requests || []).map((row: any) => (
        <Card key={row.id}>
          <Heading>
            {p.role === "student"
              ? row.full_name
              : `${row.first_name} ${row.last_name}`}
          </Heading>
          {p.role === "parent" ? (
            <Copy muted>
              Waiting for student approval. No access is granted until approved.
            </Copy>
          ) : (
            <>
              <Copy>Only approve a parent or guardian you recognise.</Copy>
              <Button
                title="Approve"
                disabled={busy}
                onPress={() => respond(Number(row.id), "approve")}
              />
              <Button
                title="Decline"
                secondary
                disabled={busy}
                onPress={() => respond(Number(row.id), "decline")}
              />
            </>
          )}
        </Card>
      ))}
    </>
  );
}
