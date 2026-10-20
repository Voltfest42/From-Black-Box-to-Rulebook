import { useEffect, useRef, useState } from 'react';

/**
 * Runs a heavy computation just after the browser has painted, so the page can
 * show "working…" first. While a new result is being computed, the previous one
 * stays on screen and `pending` is true. A longer `delay` waits for the key to
 * settle, e.g. until the reader stops drawing.
 */
export function useDeferred<T>(compute: () => T, key: string, delay = 20): { value: T | null; pending: boolean } {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });
  useEffect(() => {
    if (state?.key === key) return;
    const timer = window.setTimeout(() => setState({ key, value: computeRef.current() }), delay);
    return () => window.clearTimeout(timer);
  }, [key, state?.key, delay]);
  return { value: state?.value ?? null, pending: state?.key !== key };
}
