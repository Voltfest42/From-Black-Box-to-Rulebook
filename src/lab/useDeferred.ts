import { useEffect, useRef, useState } from 'react';

/**
 * Runs a heavy computation just after the browser has painted, so the page can
 * show "working…" first. While a new result is being computed, the previous one
 * stays on screen and `pending` is true.
 */
export function useDeferred<T>(compute: () => T, key: string): { value: T | null; pending: boolean } {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });
  useEffect(() => {
    if (state?.key === key) return;
    const timer = window.setTimeout(() => setState({ key, value: computeRef.current() }), 20);
    return () => window.clearTimeout(timer);
  }, [key, state?.key]);
  return { value: state?.value ?? null, pending: state?.key !== key };
}
