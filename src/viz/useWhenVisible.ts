import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Computes a figure's heavy result only once the figure is close to the screen,
 * and just after the browser has painted, so opening a chapter stays quick.
 * Returns null until the result is ready. A new `key` recomputes.
 */
export function useWhenVisible<T>(compute: () => T, key: string): { ref: RefObject<HTMLDivElement | null>; value: T | null } {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<{ key: string; value: T } | null>(null);
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || result?.key === key) return;
    const timer = window.setTimeout(() => setResult({ key, value: computeRef.current() }), 30);
    return () => window.clearTimeout(timer);
  }, [visible, key, result?.key]);

  return { ref, value: result?.key === key ? result.value : null };
}
