import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  changedVisibleWindows,
  monitorSnapshots,
  MonitorOffice,
  MonitorTicket,
  parseMonitorPreferences,
} from "@/utils/monitor-model";
import { usePortal } from "./context";
import { positiveId } from "./domain";
import { request } from "./api";
import { useResource } from "./use-resource";
import {
  Button,
  Card,
  Check,
  Copy,
  Empty,
  Heading,
  Notice,
  Screen,
  s,
} from "./ui";
export default function MonitorScreen() {
  const p = usePortal(),
    params = useLocalSearchParams(),
    childId =
      positiveId(params.childId) ||
      positiveId(params.studentId) ||
      p.actor.studentId,
    paramOffice = positiveId(params.officeId),
    key = `monitor:v3:${p.role}:${p.user.id}`;
  const [hidden, setHidden] = useState<number[]>([]),
    [active, setActive] = useState(paramOffice),
    [windowId, setWindow] = useState(0),
    [manage, setManage] = useState(false),
    [sound, setSound] = useState(false),
    [ready, setReady] = useState(false),
    [prefsError, setPrefsError] = useState(""),
    [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const audio = useAudioPlayer(require("../../assets/sounds/notify.wav")),
    before = useRef<Record<string, string> | null>(null),
    audioRef = useRef(audio),
    soundRef = useRef(sound),
    hiddenRef = useRef(hidden),
    saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  audioRef.current = audio;
  soundRef.current = sound;
  hiddenRef.current = hidden;
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (alive) {
          const pref = parseMonitorPreferences(raw);
          setHidden(pref.hidden);
          if (!paramOffice) setActive(pref.active);
        }
      })
      .catch(() => {
        if (alive) setPrefsError("Office preferences could not be read.");
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [key, paramOffice]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const payload = JSON.stringify({ hidden, active });
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, payload))
      .catch(() => {
        if (alive) setPrefsError("Office preferences could not be saved.");
      });
    return () => {
      alive = false;
    };
  }, [hidden, active, key, ready]);
  const load = useCallback(
    async (signal: AbortSignal) =>
      request(
        "public_live_queue.php",
        childId
          ? {
              student_id: childId,
              ...(p.role === "parent"
                ? { parent_id: p.user.id, child_id: childId }
                : {}),
            }
          : {},
        signal,
      ),
    [childId, p.role, p.user.id],
  );
  const r = useResource(load, 3000),
    offices = (r.data?.offices || []) as MonitorOffice[],
    shown = offices.filter((o) => !hidden.includes(Number(o.id))),
    office = shown.find((o) => Number(o.id) === active) || shown[0],
    win =
      office?.windows.find((w) => Number(w.id) === windowId) ||
      office?.windows.find((w) => w.status !== "closed") ||
      office?.windows[0],
    you = r.data?.you;
  useEffect(() => {
    if (!r.data) return;
    const snapshot = monitorSnapshots(r.data.offices || []),
      changes = changedVisibleWindows(
        before.current,
        snapshot,
        hiddenRef.current,
      );
    before.current = snapshot;
    if (changes.length && soundRef.current)
      void audioRef.current
        .seekTo(0)
        .then(() => audioRef.current.play())
        .catch(() => {
          setSound(false);
          setPrefsError(
            "Sound is unavailable. You can still follow ticket cards.",
          );
        });
  }, [r.data]);
  useFocusEffect(
    useCallback(() => {
      before.current = null;
      return () => {
        audioRef.current.pause();
        before.current = null;
      };
    }, []),
  );
  const toggle = (id: number) => {
    if (!hidden.includes(id) && shown.length <= 1) return;
    setHidden((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
    before.current = null;
  };
  const ticket = (t: MonitorTicket | null, label: string) => {
    const id = `${office?.id}:${win?.id}:${label}:${t?.queue_number}`,
      mine =
        you?.queue_number === t?.queue_number && you?.window_id === win?.id;
    return (
      <Card key={id} accent={!!mine}>
        <Copy muted>
          {label}
          {mine ? " · Your ticket" : ""}
        </Copy>
        <Text style={s.number}>{t?.queue_number || "—"}</Text>
        {t?.eta_label && <Copy>{t.eta_label}</Copy>}
        {t && (
          <Button
            title={expanded[id] ? "Hide details" : "Show details"}
            secondary
            onPress={() => setExpanded((v) => ({ ...v, [id]: !v[id] }))}
          />
        )}
        {expanded[id] && (
          <>
            <Copy>
              {win?.name} ·{" "}
              {t?.type === "appointment"
                ? "Appointment"
                : t?.type === "walkin"
                  ? "Walk-in"
                  : "Queue ticket"}
            </Copy>
            <Copy muted>
              Estimates can change. Student names are never shown on the public
              board.
            </Copy>
          </>
        )}
      </Card>
    );
  };
  return (
    <Screen
      title="Live queue monitor"
      subtitle="Campus-wide office and window updates."
      back
      refreshing={r.loading}
      onRefresh={() => void r.reload()}
      updated={r.updated}
    >
      {r.error && (
        <Notice
          message={`${r.error} ${r.data ? "Displayed tickets may be stale." : ""}`}
          retry={() => void r.reload()}
        />
      )}
      {prefsError && <Notice message={prefsError} />}
      {r.loading && <ActivityIndicator color="#660810" />}
      <Card>
        <Check
          label="Play a chime for visible queue changes"
          checked={sound}
          onPress={() => {
            setSound((v) => !v);
            if (sound) audio.pause();
            before.current = null;
          }}
        />
        <Copy muted>
          Monitor sound works while this screen is open. Device push
          notifications are separate.
        </Copy>
        <Button
          title={manage ? "Done managing offices" : "Manage visible offices"}
          secondary
          onPress={() => setManage((v) => !v)}
        />
        {manage &&
          offices.map((o) => (
            <Check
              key={o.id}
              label={o.name}
              checked={!hidden.includes(Number(o.id))}
              disabled={!hidden.includes(Number(o.id)) && shown.length <= 1}
              onPress={() => toggle(Number(o.id))}
            />
          ))}
      </Card>
      {!shown.length && offices.length > 0 && (
        <Button title="Restore all offices" onPress={() => setHidden([])} />
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {shown.map((o) => (
          <Button
            key={o.id}
            title={o.name}
            secondary={Number(office?.id) !== Number(o.id)}
            onPress={() => {
              setActive(Number(o.id));
              setWindow(0);
            }}
          />
        ))}
      </ScrollView>
      {office && <Heading>{office.name}</Heading>}
      {office && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {office.windows.map((w) => (
            <Button
              key={w.id}
              title={`${w.name}${w.status === "closed" ? " · Closed" : w.is_paused ? " · Paused" : ""}`}
              secondary={w.id !== win?.id}
              onPress={() => setWindow(Number(w.id))}
            />
          ))}
        </ScrollView>
      )}
      {win ? (
        <>
          <Card>
            <Heading>{win.name}</Heading>
            <Copy>
              {win.status === "closed"
                ? "Closed"
                : win.is_paused
                  ? "Paused"
                  : "Open"}{" "}
              ·{" "}
              {win.queue_type === "both"
                ? "Walk-in / Appointment"
                : win.queue_type === "appointment"
                  ? "Appointment"
                  : "Walk-in"}
            </Copy>
          </Card>
          {ticket(win.current, "Now serving")}
          {ticket(win.next, "Next in line")}
          <Heading>Waiting · {win.waiting_count}</Heading>
          {(win.waiting || []).map((t) => ticket(t, "Waiting"))}
          {!win.waiting?.length && <Copy muted>No other waiting tickets.</Copy>}
          {win.last && ticket(win.last, "Last in line")}
        </>
      ) : (
        !r.loading &&
        !r.error && (
          <Empty
            title="No windows to display"
            description="Choose another office, or check again later."
          />
        )
      )}
    </Screen>
  );
}
