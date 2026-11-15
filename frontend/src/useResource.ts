import { useEffect, useRef, useState } from 'react';

/** Fetch a fresh resource for each identity or route; late responses cannot replace newer data. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [identity, route] = dependencies;
  const previous = useRef({ identity, route });
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    // Reset external resource state before starting a request for this identity.
    // oxlint-disable-next-line react/set-state-in-effect
    if (previous.current.identity !== identity || previous.current.route !== route) setData(null);
    previous.current = { identity, route };
    // Reset the request indicators while retaining a same-resource refresh.
    // oxlint-disable-next-line react/set-state-in-effect
    setError(null); setLoading(true);
    loadRef.current(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) { setData(null); setError(reason); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The caller supplies the identity and route that determine this resource.
  }, [identity, route, version]);
  return { data, error, loading, refresh: () => setVersion(v => v + 1) };
}

