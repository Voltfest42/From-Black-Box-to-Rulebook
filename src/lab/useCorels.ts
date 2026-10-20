import { useEffect, useRef, useState } from 'react';
import type { CorelsMessage, CorelsRequest } from '../workers/corels.worker';
import { listExtraction, type Extraction } from './engine';

export interface CorelsRun {
  key: string;
  extraction: Extraction | null;
  nodes: number;
  error: string | null;
}

/**
 * Runs CORELS in a worker whenever `job` names a new key; `null` stops it. The
 * request is only built (and the black box asked for its labels) when a search starts.
 */
export function useCorels(job: { key: string; request: () => CorelsRequest } | null): CorelsRun | null {
  const [run, setRun] = useState<CorelsRun | null>(null);
  const requestRef = useRef(job?.request);
  useEffect(() => {
    requestRef.current = job?.request;
  });
  const key = job?.key ?? null;

  useEffect(() => {
    if (key === null || !requestRef.current) return;
    const w = new Worker(new URL('../workers/corels.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<CorelsMessage>) => {
      const m = event.data;
      if (m.kind === 'event' && m.event.kind === 'progress') setRun({ key, extraction: null, nodes: m.event.nodes, error: null });
      if (m.kind === 'done') setRun({ key, extraction: listExtraction(m.result.list, m.result.certified), nodes: m.result.nodes, error: null });
      if (m.kind === 'error') setRun({ key, extraction: null, nodes: 0, error: m.message });
      if (m.kind === 'done' || m.kind === 'error') w.terminate();
    };
    w.postMessage(requestRef.current());
    return () => w.terminate();
  }, [key]);

  return run && run.key === key ? run : null;
}
