import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

export function useApi<T>(
  loader: () => Promise<T>,
  dependencies: DependencyList = [],
) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const generation = useRef(0);
  const hasData = useRef(false);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    // Keep the current view mounted during background refreshes. Showing a
    // full-page loading state on every poll/WebSocket event causes visible flicker.
    if (!hasData.current) setLoading(true);
    setError(null);
    try {
      const value = await loaderRef.current();
      if (id === generation.current) {
        hasData.current = true;
        setData(value);
      }
    } catch (err) {
      if (id === generation.current)
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los datos.",
        );
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh, ...dependencies]);
  return { data, loading, error, refresh, setData };
}
