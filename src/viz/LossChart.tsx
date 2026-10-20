import styles from './LossChart.module.css';

const W = 300;
const H = 110;
const PAD = { left: 36, right: 8, top: 8, bottom: 22 };

/** The training error falling over time: one point per epoch. */
export function LossChart({ losses, epochs, label = 'Training error' }: { losses: readonly number[]; epochs: number; label?: string }) {
  const max = Math.max(0.1, ...losses.slice(0, 1), ...losses);
  const sx = (e: number) => PAD.left + (e / Math.max(1, epochs)) * (W - PAD.left - PAD.right);
  const sy = (v: number) => H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);
  const points = losses.map((v, e) => `${sx(e + 1).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const last = losses[losses.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.chart}
      role="img"
      aria-label={losses.length === 0 ? `${label}: not trained yet.` : `${label} after ${losses.length} rounds: ${last.toFixed(3)}, down from ${losses[0].toFixed(3)}.`}
    >
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className={styles.axis} />
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} className={styles.axis} />
      <text x={PAD.left - 4} y={PAD.top + 8} className={styles.tick} textAnchor="end">
        {max.toFixed(1)}
      </text>
      <text x={PAD.left - 4} y={H - PAD.bottom} className={styles.tick} textAnchor="end">
        0
      </text>
      <text x={(PAD.left + W) / 2} y={H - 5} className={styles.tick} textAnchor="middle">
        training rounds (epochs) →
      </text>
      <text x={PAD.left + 6} y={PAD.top + 9} className={styles.title}>
        {label}
      </text>
      {losses.length > 1 && <polyline points={points} className={styles.line} />}
    </svg>
  );
}
