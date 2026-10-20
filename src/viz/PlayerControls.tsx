import type { PlaybackControls, Speed } from './usePlayback';
import styles from './PlayerControls.module.css';

const SPEED_LABELS: Record<Speed, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' };

export function PlayerControls({ playback }: { playback: PlaybackControls }) {
  const { step, steps, playing, speed, setSpeed, togglePlay, stepBy, seek } = playback;
  const atStart = step === 0;
  const atEnd = step === steps;

  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <button type="button" onClick={() => seek(0)} disabled={atStart} aria-label="Back to the start" title="Back to the start (Home)">
          <Icon d="M6 5v14M19 5l-9 7 9 7z" />
        </button>
        <button type="button" onClick={() => stepBy(-1)} disabled={atStart} aria-label="Step back" title="Step back (←)">
          <Icon d="M15 5l-8 7 8 7z" />
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
          title={playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
        >
          {playing ? <Icon d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <Icon d="M7 4l13 8-13 8z" />}
        </button>
        <button type="button" onClick={() => stepBy(1)} disabled={atEnd} aria-label="Step forward" title="Step forward (→)">
          <Icon d="M9 5l8 7-8 7z" />
        </button>
        <button type="button" onClick={() => seek(steps)} disabled={atEnd} aria-label="Jump to the end" title="Jump to the end (End)">
          <Icon d="M18 5v14M5 5l9 7-9 7z" />
        </button>
      </div>

      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={steps}
        value={step}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="Step"
        aria-valuetext={`Step ${step} of ${steps}`}
      />
      <span className={styles.counter} aria-live="off">
        Step {step} / {steps}
      </span>

      <div className={styles.speed} role="radiogroup" aria-label="Playback speed">
        {(Object.keys(SPEED_LABELS) as Speed[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            className={speed === s ? styles.speedActive : undefined}
            onClick={() => setSpeed(s)}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d={d} fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
