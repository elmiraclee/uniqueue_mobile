import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useIsFocused, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clientFetch, getSessionToken } from "@/utils/client-fetch";
import { API_URL } from "@/constants/backend";
import { COLORS } from "@/constants/theme";
import { clientTourSteps, TourAction, TourStep } from "./steps";
type NativeView = React.ComponentRef<typeof View>;
type NativeScrollView = React.ComponentRef<typeof ScrollView>;
type Rect = { x: number; y: number; width: number; height: number };
type ScrollTarget = {
  outer: React.RefObject<NativeScrollView | null>;
  inner: React.RefObject<NativeView | null>;
};
type Target = { view: NativeView; scroll: ScrollTarget | null };
type Progress = { step: number; status: "active" | "skipped" | "completed" };
type Guide = {
  register: (key: string, target: Target | null) => void;
  start: (restart?: boolean) => Promise<void>;
  show: () => void;
  pause: () => void;
  active: boolean;
  visible: boolean;
  step: TourStep | null;
  notificationStep: boolean;
  index: number;
  count: number;
  role: string;
  rect: Rect | null;
  bounds: Rect;
  setBounds: (r: Rect) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  completeAction: (action: TourAction) => void;
  canAdvance: boolean;
  actionDone: boolean;
  runId: number;
};
const noop = () => {};
const Context = createContext<Guide>({
  register: noop,
  start: async () => {},
  show: noop,
  pause: noop,
  active: false,
  visible: false,
  step: null,
  notificationStep: false,
  index: 0,
  count: 1,
  role: "student",
  rect: null,
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  setBounds: noop,
  next: noop,
  back: noop,
  skip: noop,
  completeAction: noop,
  canAdvance: true,
  actionDone: false,
  runId: 0,
});
const ScrollContext = createContext<ScrollTarget | null>(null);
export const useTutorial = () => useContext(Context);
export const TutorialScrollView = forwardRef<NativeScrollView, ScrollViewProps>(
  function TutorialScrollView(props, external) {
    const ref = useRef<NativeScrollView>(null),
      inner = useRef<NativeView>(null!);
    const scroll = React.useMemo(() => ({ outer: ref, inner }), []);
    return (
      <ScrollContext.Provider value={scroll}>
        <ScrollView
          {...props}
          {...(Platform.OS === "web" ? {} : { innerViewRef: inner })}
          ref={(node) => {
            ref.current = node;
            if (typeof external === "function") external(node);
            else if (external) external.current = node;
          }}
        />
      </ScrollContext.Provider>
    );
  },
);
export function TourTarget({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const focused = useIsFocused(),
    ref = useRef<NativeView>(null),
    scroll = useContext(ScrollContext),
    { register } = useTutorial(),
    path = usePathname();
  const update = useCallback(() => {
    if (focused && ref.current)
      register(path + ":" + id, { view: ref.current, scroll });
  }, [id, path, register, scroll, focused]);
  useEffect(() => {
    update();
    return () => {
      if (focused) register(path + ":" + id, null);
    };
  }, [update, id, path, register, focused]);
  return (
    <View ref={ref} onLayout={update} collapsable={false}>
      {children}
    </View>
  );
}
/** Overlay is a positioned sibling INSIDE the full-size stage, never a bottom panel. */
export function TutorialStage({
  children,
  modal = false,
}: {
  children: React.ReactNode;
  modal?: boolean;
}) {
  const guide = useTutorial(),
    ref = useRef<NativeView>(null),
    size = useWindowDimensions();
  const active = guide.visible && guide.notificationStep === modal;
  const { setBounds } = guide;
  const layout = useCallback(
    (_event?: LayoutChangeEvent) => {
      if (active)
        ref.current?.measureInWindow((x, y, width, height) =>
          setBounds({ x, y, width, height }),
        );
    },
    [active, setBounds],
  );
  useEffect(() => {
    const timers = [30, 180, 500].map((delay) => setTimeout(layout, delay));
    return () => timers.forEach(clearTimeout);
  }, [layout, size.width, size.height]);
  const r = guide.rect,
    b = guide.bounds;
  const x = r ? Math.max(0, r.x - b.x - 5) : 0,
    y = r ? Math.max(0, r.y - b.y - 5) : 0;
  const w = r ? Math.min(r.width + 10, Math.max(0, b.width - x)) : 0,
    h = r ? Math.min(r.height + 10, Math.max(0, b.height - y)) : 0;
  return (
    <View
      testID={modal ? "tutorial-modal-stage" : "tutorial-stage"}
      ref={ref}
      collapsable={false}
      onLayout={layout}
      style={s.stage}
    >
      {children}
      {active && (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { zIndex: 900 }]}
        >
          {r && w > 0 && h > 0 ? (
            <>
              <View
                testID="tutorial-mask-top"
                style={[s.dim, { top: 0, left: 0, right: 0, height: y }]}
              />
              <View style={[s.dim, { top: y, left: 0, width: x, height: h }]} />
              <View
                style={[s.dim, { top: y, left: x + w, right: 0, height: h }]}
              />
              <View
                style={[s.dim, { top: y + h, left: 0, right: 0, bottom: 0 }]}
              />
              <View
                pointerEvents="none"
                testID="tutorial-highlight"
                style={[s.outline, { left: x, top: y, width: w, height: h }]}
              />
            </>
          ) : (
            <View style={[s.dim, StyleSheet.absoluteFill]} />
          )}
          <TutorialCoach modal={modal} />
        </View>
      )}
    </View>
  );
}
export function TutorialCoach({ modal = false }: { modal?: boolean }) {
  const g = useTutorial(),
    insets = useSafeAreaInsets(),
    size = useWindowDimensions();
  const [height, setHeight] = useState(272);
  if (!g.visible || g.notificationStep !== modal || !g.step) return null;
  const width = Math.min(360, (g.bounds.width || size.width) - 32);
  const availableHeight = g.bounds.height || size.height;
  const safeTop = Math.max(12, insets.top + 8),
    safeBottom = Math.max(12, insets.bottom + 8);
  const rx = g.rect ? g.rect.x - g.bounds.x : 16,
    ry = g.rect ? g.rect.y - g.bounds.y : 80,
    rh = g.rect?.height || 0;
  const below = ry + rh + 16;
  const belowSpace = Math.max(0, availableHeight - safeBottom - below);
  const aboveSpace = Math.max(0, ry - 16 - safeTop);
  const placeBelow =
    belowSpace >= height || (aboveSpace < height && belowSpace >= aboveSpace);
  // A scrollable coach stays in the free space, even on short phones or large text.
  const maxHeight = Math.max(80, placeBelow ? belowSpace : aboveSpace);
  const top = placeBelow
    ? below
    : Math.max(safeTop, ry - 16 - Math.min(height, maxHeight));
  const left = Math.max(
    16,
    Math.min(rx, (g.bounds.width || size.width) - width - 16),
  );
  const compact = maxHeight < 350;
  const skipAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip tutorial"
      onPress={g.skip}
      style={s.skip}
    >
      <Text style={s.skipText}>Skip tutorial</Text>
    </Pressable>
  );
  return (
    <View
      testID="tutorial-coach"
      onLayout={(e) => {
        const h = Math.ceil(e.nativeEvent.layout.height);
        if (h !== height) setHeight(h);
      }}
      style={[s.coach, { top, left, width, maxHeight }]}
    >
      <View style={{ padding: 16, gap: 12, flexShrink: 1, minHeight: 0 }}>
        <View style={s.between}>
          <View style={s.tag}>
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={COLORS.primary}
            />
            <Text style={s.meta}>
              {g.step.phase ? "GUIDED PRACTICE" : "QUICK TOUR"} · {g.index + 1}/
              {g.count}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause tutorial"
            onPress={g.pause}
            style={s.close}
          >
            <Ionicons name="close" size={20} color={COLORS.gray} />
          </Pressable>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: g.count, now: g.index + 1 }}
          style={s.track}
        >
          <View
            style={[
              s.progress,
              { width: `${((g.index + 1) / g.count) * 100}%` },
            ]}
          />
        </View>
        <ScrollView
          key={g.index}
          keyboardShouldPersistTaps="handled"
          style={{ flexShrink: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: 12 }}
          showsVerticalScrollIndicator
        >
          <Text accessibilityRole="header" style={s.title}>
            {g.step.title}
          </Text>
          <Text style={s.body}>{g.step.body}</Text>
          {compact && skipAction}
        </ScrollView>
        {!!g.step.action && (
          <View
            accessibilityLiveRegion="polite"
            style={[s.task, g.actionDone && s.taskDone]}
          >
            <Ionicons
              name={g.actionDone ? "checkmark-circle" : "hand-left-outline"}
              size={20}
              color={g.actionDone ? COLORS.success : COLORS.primary}
            />
            <Text style={s.taskText}>
              {g.actionDone ? "Nice! You completed this step." : g.step.task}
            </Text>
          </View>
        )}
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous tutorial step"
            accessibilityState={{ disabled: !g.index }}
            disabled={!g.index}
            onPress={g.back}
            style={[s.back, !g.index && { opacity: 0.4 }]}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={s.link}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              g.index === g.count - 1 ? "Finish tutorial" : "Next tutorial step"
            }
            accessibilityState={{ disabled: !g.canAdvance }}
            disabled={!g.canAdvance}
            onPress={g.next}
            style={[s.next, !g.canAdvance && s.disabled]}
          >
            <Text style={s.nextText}>
              {g.index === g.count - 1
                ? "Finish"
                : g.step.action && !g.actionDone
                  ? "Try this step"
                  : "Next"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
        {!compact && skipAction}
      </View>
    </View>
  );
}
export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    size = useWindowDimensions();
  const pathRef = useRef(path);
  useLayoutEffect(() => {
    pathRef.current = path;
  }, [path]);
  const startVersion = useRef(0),
    pendingNavigation = useRef<{ from: string; to: string } | null>(null);
  const targets = useRef(new Map<string, Target>());
  const [role, setRole] = useState<"student" | "parent">("student"),
    [key, setKey] = useState(""),
    [progress, setProgress] = useState<Progress | null>(null),
    [visible, setVisible] = useState(false),
    [rect, setRect] = useState<Rect | null>(null),
    [bounds, setBoundsState] = useState<Rect>({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }),
    [completed, setCompleted] = useState<Set<number>>(new Set()),
    [runId, setRunId] = useState(0);
  const steps = clientTourSteps(role),
    index = Math.min(progress?.step || 0, steps.length - 1),
    step = steps[index];
  const register = useCallback((id: string, t: Target | null) => {
    if (t) targets.current.set(id, t);
    else targets.current.delete(id);
  }, []);
  const setBounds = useCallback(
    (r: Rect) =>
      setBoundsState((old) =>
        Object.keys(r).every(
          (k) => Math.abs(old[k as keyof Rect] - r[k as keyof Rect]) < 1,
        )
          ? old
          : r,
      ),
    [],
  );
  const syncQueue = useRef<Promise<unknown>>(Promise.resolve());
  const sync = useCallback((p: Progress) => {
    const captured = getSessionToken();
    syncQueue.current = syncQueue.current
      .catch(() => {})
      .then(async () => {
        const token = await captured;
        if (token && (await getSessionToken()) === token)
          return clientFetch(API_URL + "/mobile_tour.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
      })
      .catch(() => {});
  }, []);
  const save = async (p: Progress) => {
    setProgress(p);
    if (key)
      try {
        await AsyncStorage.setItem(key, JSON.stringify(p));
      } catch {
        /* Keep the current in-memory guide usable if storage is full. */
      }
    sync(p);
  };
  const navigateStep = useCallback((r: "student" | "parent", i: number) => {
    const selected = clientTourSteps(r)[i];
    if (!selected) return;
    const destination = "/" + selected.screen;
    setRect(null);
    if (pathRef.current !== destination) {
      pendingNavigation.current = { from: pathRef.current, to: destination };
      router.replace({
        pathname: destination as any,
        params: selected.phase ? { phase: selected.phase } : {},
      });
    } else {
      pendingNavigation.current = null;
      if (selected.phase) router.setParams({ phase: selected.phase });
    }
  }, []);
  const pause = useCallback(() => {
    startVersion.current++;
    pendingNavigation.current = null;
    setVisible(false);
    setRect(null);
  }, []);
  const start = useCallback(
    async (restart = false, expectedPath?: string) => {
      const version = ++startVersion.current,
        current = () =>
          version === startVersion.current &&
          (!expectedPath || pathRef.current === expectedPath);
      try {
        const [raw, r, token] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("role"),
          getSessionToken(),
        ]);
        if (
          !current() ||
          !raw ||
          !token ||
          !["student", "parent"].includes(r || "")
        )
          return;
        const accountRole = r as "student" | "parent",
          user = JSON.parse(raw),
          k = `client-tour:native:4:${r}:${user.id}`;
        let p: Progress = { step: 0, status: "active" };
        const stored = await AsyncStorage.getItem(k);
        if (!current()) return;
        if (!restart && stored) {
          const old = JSON.parse(stored);
          if (old.status === "active")
            p = {
              step: Math.max(
                0,
                Math.min(
                  clientTourSteps(accountRole).length - 1,
                  Number(old.step) || 0,
                ),
              ),
              status: "active",
            };
        }
        const [latestRaw, latestRole] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("role"),
        ]);
        if (
          !current() ||
          latestRole !== r ||
          !latestRaw ||
          Number(JSON.parse(latestRaw).id) !== Number(user.id)
        )
          return;
        p.step = Math.max(
          0,
          Math.min(clientTourSteps(accountRole).length - 1, Math.floor(p.step)),
        );
        await AsyncStorage.setItem(k, JSON.stringify(p));
        if (!current()) return;
        setRole(accountRole);
        setKey(k);
        setProgress(p);
        setCompleted(new Set());
        setRunId((v) => v + 1);
        sync(p);
        navigateStep(accountRole, p.step);
        setVisible(true);
      } catch {
        /* Invalid accounts or unavailable storage must not open a stale guide. */
      }
    },
    [sync, navigateStep],
  );
  useEffect(
    () => () => {
      startVersion.current++;
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [raw, r] = await Promise.all([
          AsyncStorage.getItem("user"),
          AsyncStorage.getItem("role"),
        ]);
        const current = raw
          ? `client-tour:native:4:${r}:${JSON.parse(raw).id}`
          : "";
        if (alive && key && current !== key) {
          pause();
          setProgress(null);
          setKey("");
        }
      } catch {
        if (alive) setVisible(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, key, pause]);
  useEffect(() => {
    if (!path.endsWith("/home")) return;
    let alive = true;
    void (async () => {
      const [raw, r, flag] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("role"),
        AsyncStorage.getItem("client_tour_new"),
      ]);
      if (!alive || !raw) return;
      try {
        if (flag === `${r}:${JSON.parse(raw).id}`) {
          await AsyncStorage.removeItem("client_tour_new");
          if (alive && pathRef.current === path) await start(true, path);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [path, start]);
  useEffect(() => {
    if (!visible || !progress) return;
    const destination = "/" + step.screen;
    if (path === destination) {
      pendingNavigation.current = null;
      return;
    }
    const requested = pendingNavigation.current;
    if (requested?.to === destination && requested.from === path) return;
    pause();
  }, [visible, path, step.screen, progress, pause]);
  // Scroll once per step; later user scrolling is never forcibly undone.
  useEffect(() => {
    if (!visible) return;
    let stopped = false,
      attempts = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const scrollToTarget = () => {
      if (stopped) return;
      const t = targets.current.get(path + ":" + step.target),
        scroll = t?.scroll?.outer.current,
        content =
          t?.scroll?.inner.current ||
          (Platform.OS === "web" ? scroll?.getInnerViewRef() : null);
      if (!t) {
        if (++attempts < 15) timers.push(setTimeout(scrollToTarget, 80));
        return;
      }
      if (scroll && content)
        t.view.measureLayout(
          content,
          (_x, y) => {
            if (!stopped)
              scroll.scrollTo({ y: Math.max(0, y - 16), animated: false });
          },
          noop,
        );
    };
    timers.push(setTimeout(scrollToTarget, 100));
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, [visible, path, index, step.target, size.width, size.height]);
  // A short-lived layout observer tracks scrolling, orientation and expanding form controls.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRect(null);
    const measure = () => {
      const t = targets.current.get(path + ":" + step.target);
      if (!t) return;
      t.view.measureInWindow((x, y, width, height) => {
        if (cancelled || !width || !height) return;
        // On short phones, focus the heading portion of a tall informational
        // card instead of squeezing the coach into an unusably tiny strip.
        // Action targets remain fully exposed and tappable.
        const focusHeight =
          !step.action && bounds.height < 700
            ? Math.min(height, Math.max(80, bounds.height * 0.25))
            : height;
        const left = Math.max(x, bounds.x),
          right = Math.min(x + width, bounds.x + bounds.width),
          top = Math.max(y, bounds.y),
          bottom = Math.min(y + focusHeight, bounds.y + bounds.height);
        if (right <= left || bottom <= top) {
          setRect(null);
          return;
        }
        const next = {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        };
        setRect((old) =>
          old &&
          Object.keys(next).every(
            (k) => Math.abs(old[k as keyof Rect] - next[k as keyof Rect]) < 1,
          )
            ? old
            : next,
        );
      });
    };
    measure();
    const interval = setInterval(measure, 120);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, path, index, step.target, step.action, bounds]);
  useEffect(() => {
    if (visible)
      AccessibilityInfo.announceForAccessibility(
        `${step.title}. ${step.action ? step.task : step.body}`,
      );
  }, [visible, index, step.title, step.body, step.action, step.task]);
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      pause();
      return true;
    });
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") pause();
    };
    if (typeof document !== "undefined")
      document.addEventListener("keydown", escape);
    return () => {
      sub.remove();
      if (typeof document !== "undefined")
        document.removeEventListener("keydown", escape);
    };
  }, [visible, pause]);
  const close = async (status: "skipped" | "completed") => {
    pause();
    await save({ step: index, status });
    if (path === "/client-practice") router.replace(`/${role}/home`);
  };
  const resume = () => {
    if (progress?.status === "active") {
      navigateStep(role, index);
      setVisible(true);
    } else void start();
  };
  const move = (nextIndex: number) => {
    navigateStep(role, nextIndex);
    void save({ step: nextIndex, status: "active" });
  };
  const actionDone = completed.has(index),
    canAdvance = !step.action || actionDone;
  const guide: Guide = {
    register,
    start,
    show: resume,
    pause,
    active: progress?.status === "active",
    visible,
    step,
    index,
    count: steps.length,
    role,
    rect,
    bounds,
    setBounds,
    notificationStep: visible && step.target === "notice-list",
    runId,
    actionDone,
    canAdvance,
    completeAction: (action) => {
      if (visible && path === "/client-practice" && step.action === action)
        setCompleted((old) => new Set(old).add(index));
    },
    next: () => {
      if (!canAdvance) return;
      if (index === steps.length - 1) void close("completed");
      else move(index + 1);
    },
    back: () => {
      if (index) move(index - 1);
    },
    skip: () => void close("skipped"),
  };
  return (
    <Context.Provider value={guide}>
      <View style={s.root}>
        <TutorialStage>{children}</TutorialStage>
      </View>
    </Context.Provider>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, minHeight: 0 },
  dim: { position: "absolute", backgroundColor: "rgba(20,24,33,.62)" },
  outline: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#F2B9C4",
    borderRadius: 12,
  },
  coach: {
    position: "absolute",
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
    overflow: "hidden",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  meta: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: COLORS.primary,
    flexShrink: 1,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  progress: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: COLORS.text,
  },
  body: { fontSize: 16, lineHeight: 23, color: COLORS.gray },
  task: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskDone: { backgroundColor: COLORS.successLight },
  taskText: { fontSize: 14, lineHeight: 20, color: COLORS.text, flex: 1 },
  actions: { flexDirection: "row", gap: 8 },
  back: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  link: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  next: {
    flex: 1,
    minHeight: 48,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  nextText: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: "#fff" },
  disabled: { opacity: 0.5 },
  skip: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontSize: 14, lineHeight: 20, color: COLORS.gray },
});
