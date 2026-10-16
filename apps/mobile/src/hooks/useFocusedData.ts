import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

/**
 * Loads a screen's data from the backend and keeps it fresh without any
 * cache/query library:
 *
 * - on first open AND every time the screen/tab becomes active again (tabs
 *   stay mounted, so this is what makes e.g. Dashboard reflect a meal just
 *   added on the Meals tab, or data changed from the Web app);
 * - on pull-to-refresh (`refresh`, drives RefreshControl's `refreshing`);
 * - on an explicit `retry` after an error.
 *
 * `data` is `null` only while there is nothing to show yet (first load, a
 * retry, or after `load` changes - e.g. History's selected date), so a
 * screen can show a loading state instead of a misleading empty state.
 * Background refetches keep the current data on screen until the new
 * result arrives. Only the most recent request's result is ever applied,
 * so a slow response can never overwrite a newer one.
 *
 * `load` must be memoized (useCallback); it should never throw - every
 * mobile API module already returns failures as values.
 */
export function useFocusedData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latestRequest = useRef(0);
  const loadedWith = useRef<(() => Promise<T>) | null>(null);

  const run = useCallback(
    async (mode: "background" | "pull" | "reset") => {
      const requestId = ++latestRequest.current;
      if (mode === "reset" || loadedWith.current !== load) {
        loadedWith.current = load;
        setData(null);
      }
      if (mode === "pull") {
        setRefreshing(true);
      }

      const result = await load();
      if (requestId !== latestRequest.current) {
        return;
      }
      setData(result);
      setRefreshing(false);
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      void run("background");
    }, [run]),
  );

  const refresh = useCallback(() => void run("pull"), [run]);
  const retry = useCallback(() => void run("reset"), [run]);
  const reload = useCallback(() => void run("background"), [run]);

  return { data, refreshing, refresh, retry, reload };
}
