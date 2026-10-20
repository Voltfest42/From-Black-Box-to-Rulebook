import { useEffect, useState, type KeyboardEvent } from 'react';

export const SPEEDS = { slow: 1500, normal: 800, fast: 300 } as const;
export type Speed = keyof typeof SPEEDS;

/** What the player controls need: anything with numbered steps can be played. */
export interface PlaybackControls {
  /** Current step (0 = the starting picture) and the number of steps. */
  step: number;
  steps: number;
  playing: boolean;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  togglePlay: () => void;
  stepBy: (delta: number) => void;
  seek: (step: number) => void;
}

/**
 * A recorded run, ready to step through: the picture before anything happened
 * (states[0]) and after every step, with a sentence for each step.
 */
export interface Recording<S> {
  states: readonly S[];
  /** captions[i] says what step i did (captions[0] describes the start). */
  captions: readonly string[];
}

export interface Playback<S> extends PlaybackControls {
  state: S;
  caption: string;
}

/**
 * Steps through a recording. The position is stored together with the
 * recording it belongs to, so a new recording (another seed, other settings)
 * starts again at step 0.
 */
export function usePlayback<S>(recording: Recording<S>, initialSpeed: Speed = 'normal', startAtEnd = false): Playback<S> {
  const controls = useSteps(recording.states.length - 1, recording, initialSpeed, 1, startAtEnd);
  return { ...controls, state: recording.states[controls.step], caption: recording.captions[controls.step] ?? '' };
}

/**
 * Plain numbered steps with the same controls, for figures whose stages are
 * computed on the fly. Plays at half speed, since each stage has more to read.
 */
export function useStepper(steps: number, resetKey: unknown, initialSpeed: Speed = 'slow'): PlaybackControls {
  return useSteps(steps, resetKey, initialSpeed, 2, false);
}

function useSteps(steps: number, resetKey: unknown, initialSpeed: Speed, slowdown: number, startAtEnd: boolean): PlaybackControls {
  const fresh = { key: resetKey, step: startAtEnd ? steps : 0, playing: false };
  const [position, setPosition] = useState(fresh);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const current = position.key === resetKey ? position : fresh;

  const update = (change: (p: { step: number; playing: boolean }) => { step: number; playing: boolean }) =>
    setPosition((prev) => ({ key: resetKey, ...change(prev.key === resetKey ? prev : fresh) }));

  useEffect(() => {
    if (!current.playing) return;
    const timer = window.setInterval(() => {
      setPosition((prev) => {
        if (prev.key !== resetKey) return prev;
        const step = Math.min(prev.step + 1, steps);
        return { key: resetKey, step, playing: step < steps };
      });
    }, SPEEDS[speed] * slowdown);
    return () => window.clearInterval(timer);
  }, [current.playing, resetKey, speed, steps, slowdown]);

  return {
    step: Math.min(current.step, steps),
    steps,
    playing: current.playing,
    speed,
    setSpeed,
    togglePlay: () =>
      update((p) => (p.playing ? { ...p, playing: false } : { step: p.step >= steps ? 0 : p.step, playing: true })),
    stepBy: (delta) => update((p) => ({ step: clamp(p.step + delta, 0, steps), playing: false })),
    seek: (step) => update(() => ({ step: clamp(step, 0, steps), playing: false })),
  };
}

/** Arrow keys / Home / End step through a figure while focus is inside it. */
export function handlePlaybackKeys(event: KeyboardEvent, playback: PlaybackControls): void {
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
  const actions: Record<string, () => void> = {
    ArrowRight: () => playback.stepBy(1),
    ArrowLeft: () => playback.stepBy(-1),
    Home: () => playback.seek(0),
    End: () => playback.seek(playback.steps),
  };
  const action = actions[event.key];
  if (action) {
    event.preventDefault();
    action();
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
