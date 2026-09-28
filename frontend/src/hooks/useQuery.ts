import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Refetch in the background every N ms (no loading flicker). */
  pollMs?: number;
  enabled?: boolean;
}

/**
 * Minimal data-fetching hook: loading/error state, manual reload, optional
 * polling, and protection against out-of-order responses when deps change.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[], { pollMs, enabled = true }: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (background: boolean) => {
    const id = ++requestId.current;
    if (!background) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === requestId.current) setError(err as Error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run(false);
    if (!pollMs) return;
    const timer = setInterval(() => void run(true), pollMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, run, ...deps]);

  const reload = useCallback(() => run(true), [run]);
  return { data, error, loading, reload };
}
