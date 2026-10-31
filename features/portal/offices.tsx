import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import UnavailableServicesModal from "@/components/queue/unavailable-services-modal";
import { COLORS } from "@/constants/theme";
import { TourTarget } from "@/components/tutorial/tutorial";
import { usePortal } from "./context";
import { request } from "./api";
import { Office, officeProblem } from "./domain";
import { useResource } from "./use-resource";
import { Button, ChildPicker, Copy, Empty, Notice, Screen, s } from "./ui";
import { dashboardStyles as d } from "./dashboard-styles";
const officeIcon = (
  slug: string,
): React.ComponentProps<typeof Ionicons>["name"] => {
  if (/registrar/.test(slug)) return "document-text-outline";
  if (/cashier|finance/.test(slug)) return "cash-outline";
  if (/scholarship/.test(slug)) return "ribbon-outline";
  if (/library/.test(slug)) return "library-outline";
  if (/clinic/.test(slug)) return "medkit-outline";
  if (/guidance/.test(slug)) return "heart-outline";
  return "business-outline";
};
/** The original Home office cards also power the dedicated parent/discovery route. */
export function OfficesContent({ embedded = false }: { embedded?: boolean }) {
  const p = usePortal(),
    params = useLocalSearchParams(),
    [search, setSearch] = useState(""),
    [searchFocused, setSearchFocused] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const id = Number(params.forStudentId);
    if (id && p.children.some((c) => Number(c.id) === id)) p.chooseChild(id);
  }, [params.forStudentId, p.children]);
  const load = useCallback(async (signal: AbortSignal) => {
    const [a, b] = await Promise.all([
      request("get_offices.php", undefined, signal),
      request("office-queue.php?action=events", undefined, signal),
    ]);
    return { offices: (a.offices || []) as Office[], events: b.events || [] };
  }, []);
  const r = useResource(load, 30000),
    canChoose = p.role === "student" || !!p.child;
  const go = (o: Office, event?: number) =>
    router.push({
      pathname: `/${p.role}/office-queue`,
      params: {
        office: o.slug,
        ...(p.child ? { forStudentId: String(p.child.id) } : {}),
        ...(event ? { event_id: String(event) } : {}),
      },
    } as any);
  const match = (name: string, description?: string | null) =>
    `${name} ${description || ""}`.toLowerCase().includes(search.toLowerCase());
  const content = (
    <>
      {!embedded && <ChildPicker required />}
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      {r.loading && <ActivityIndicator color={COLORS.primary} />}
      <TourTarget id="offices">
        <View style={d.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={d.sectionTitle}>
              Available Offices
            </Text>
            <Text style={d.sectionSubtitle}>
              Choose where you’d like to line up
            </Text>
          </View>
          {r.data && (
            <View style={d.sectionBadge}>
              <Text style={d.sectionBadgeText}>
                {r.data.offices.length} offices
              </Text>
            </View>
          )}
        </View>
      </TourTarget>
      <View
        style={[
          s.input,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 0,
          },
          searchFocused && { borderColor: COLORS.primary, borderWidth: 2 },
        ]}
      >
        <Ionicons name="search-outline" size={20} color={COLORS.gray} />
        <TextInput
          accessibilityLabel="Search offices and events"
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search offices and events"
          placeholderTextColor={COLORS.gray}
          style={
            {
              flex: 1,
              minWidth: 0,
              fontSize: 16,
              lineHeight: 24,
              color: COLORS.text,
              paddingVertical: 14,
              outlineStyle: "none",
            } as any
          }
        />
      </View>
      {(r.data?.offices || [])
        .filter(
          (o) =>
            match(o.name, o.description) ||
            (r.data?.events || []).some(
              (e: any) =>
                Number(e.office_id) === Number(o.id) &&
                match(e.name, e.description),
            ),
        )
        .map((o) => {
          const problem = officeProblem(o, p.role),
            events = (r.data?.events || []).filter(
              (e: any) =>
                Number(e.office_id) === Number(o.id) &&
                (!search ||
                  match(o.name, o.description) ||
                  match(e.name, e.description)),
            );
          return (
            <View key={o.id} style={d.officeCard}>
              <View style={d.cardTop}>
                <View style={d.officeIconAndName}>
                  <View style={d.officeIconBox}>
                    <Ionicons
                      name={officeIcon(o.slug)}
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text accessibilityRole="header" style={d.officeName}>
                    {o.name}
                  </Text>
                </View>
                <View style={problem ? d.fullBadge : d.activeBadge}>
                  {!problem && <View style={d.activeDot} />}
                  <Text style={problem ? d.fullBadgeText : d.activeText}>
                    {problem ? (o.is_full ? "FULL" : "UNAVAILABLE") : "OPEN"}
                  </Text>
                </View>
              </View>
              {!!o.description && (
                <Text style={d.officeDescription}>{o.description}</Text>
              )}
              {(problem || o.open_time) && (
                <Text
                  style={[
                    d.officeDescription,
                    { paddingBottom: 0, marginTop: 0 },
                  ]}
                >
                  {problem ||
                    `Hours today: ${o.open_time?.slice(0, 5)} – ${o.close_time?.slice(0, 5) || "—"}${o.cutoff_time ? ` · cutoff ${o.cutoff_time.slice(0, 5)}` : ""}`}
                </Text>
              )}
              <View
                style={[
                  d.cardFooter,
                  { gap: 10, flexDirection: "row", alignItems: "stretch" },
                ]}
              >
                <View style={{ flex: 1.25 }}>
                  <Button
                    title="Join Queue"
                    disabled={!canChoose || !!problem || !!r.error}
                    onPress={() => go(o)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Monitor"
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: `/${p.role}/live-monitor`,
                        params: {
                          officeId: String(o.id),
                          ...(p.child ? { childId: String(p.child.id) } : {}),
                        },
                      } as any)
                    }
                  />
                </View>
              </View>
              {events.map((e: any) => (
                <View
                  key={e.id}
                  style={[
                    d.eventRow,
                    { flexDirection: "column", alignItems: "stretch", gap: 10 },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <View style={d.eventIconBox}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={d.eventName}>{e.name}</Text>
                      <Text style={d.eventDescription}>
                        {e.description || "Multi-step campus event"}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title="View event steps"
                    secondary
                    disabled={!canChoose || !!r.error}
                    onPress={() => go(o, Number(e.id))}
                  />
                </View>
              ))}
            </View>
          );
        })}
      {r.data &&
        !r.data.offices.some(
          (o) =>
            match(o.name, o.description) ||
            (r.data?.events || []).some(
              (e: any) =>
                Number(e.office_id) === Number(o.id) &&
                match(e.name, e.description),
            ),
        ) && (
          <Empty
            title="No matching offices"
            description="Try another office or event name, or clear your search."
          />
        )}
      <Button
        title="Request an unavailable service"
        secondary
        disabled={!canChoose || !!p.childrenError}
        onPress={() => setUnavailable(true)}
      />
      {unavailable && (
        <UnavailableServicesModal
          visible
          studentId={p.actor.studentId}
          parentId={p.role === "parent" ? p.user.id : undefined}
          childName={p.child?.first_name}
          onClose={() => setUnavailable(false)}
        />
      )}
    </>
  );
  return embedded ? (
    <View style={{ gap: 16 }}>{content}</View>
  ) : (
    <Screen
      title="Join a queue"
      subtitle="Choose your office or continue an event."
      back
      refreshing={r.loading}
      onRefresh={() => {
        void r.reload();
        void p.reloadChildren();
      }}
      updated={r.updated}
    >
      {content}
    </Screen>
  );
}
export default function OfficesScreen() {
  return <OfficesContent />;
}
