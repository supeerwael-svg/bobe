import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

export function useAsyncData<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ data: previous.data, loading: true }));
    load().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false });
      },
      (error: unknown) => {
        if (!cancelled) setState({ error, loading: false });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
