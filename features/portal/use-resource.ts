import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
/** One focused, foreground request. Old account/child responses cannot commit. */
export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  interval = 0,
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState<Date | null>(null);
  const generation = useRef(0),
    current = useRef<{ run: () => Promise<void> } | null>(null);
  useFocusEffect(
    useCallback(() => {
      const n = ++generation.current;
      let alive = true,
        busy = false;
      let abort: AbortController | null = null;
      setData(null);
      setUpdated(null);
      setError("");
      setLoading(true);
      const run = async () => {
        if (
          !alive ||
          busy ||
          AppState.currentState === "background" ||
          AppState.currentState === "inactive"
        )
          return;
        busy = true;
        abort = new AbortController();
        try {
          const next = await loader(abort.signal);
          if (alive && generation.current === n) {
            setData(next);
            setError("");
            setUpdated(new Date());
          }
        } catch (e) {
          if (alive && generation.current === n && !abort.signal.aborted)
            setError(e instanceof Error ? e.message : "Unable to refresh.");
        } finally {
          busy = false;
          if (alive && generation.current === n) setLoading(false);
        }
      };
      current.current = { run };
      void run();
      const timer = interval ? setInterval(() => void run(), interval) : null;
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") void run();
        else abort?.abort();
      });
      return () => {
        alive = false;
        generation.current++;
        abort?.abort();
        if (timer) clearInterval(timer);
        sub.remove();
        current.current = null;
      };
    }, [loader, interval]),
  );
  return {
    data,
    error,
    loading,
    updated,
    reload: useCallback(async () => {
      await current.current?.run();
    }, []),
  };
}
