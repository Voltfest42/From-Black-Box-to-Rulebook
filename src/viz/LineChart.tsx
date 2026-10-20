import styles from './LineChart.module.css';

export interface Series {
  name: string;
  /** CSS colour, e.g. 'var(--series-1)'. */
  color: string;
  dashed?: boolean;
  points: readonly { x: number; y: number }[];
}

interface LineChartProps {
  series: readonly Series[];
  xLabel: string;
  yLabel: string;
  yMin?: number;
  yMax?: number;
  formatY?: (y: number) => string;
  ariaLabel: string;
}

const W = 560;
const H = 260;
const PAD = { left: 48, right: 16, top: 12, bottom: 40 };

/** Several series on linear axes, with a legend and values at each point on hover (via title). */
export function LineChart({ series, xLabel, yLabel, yMin = 0, yMax = 1, formatY = (y) => `${Math.round(y * 100)}%`, ariaLabel }: LineChartProps) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const yTicks = niceTicks(yMin, yMax);
  const xTicks = [...new Set(xs)].sort((a, b) => a - b);

  return (
    <div className={styles.wrap}>
      <ul className={styles.legend} aria-label="Legend">
        {series.map((s) => (
          <li key={s.name}>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="1" x2="21" y1="5" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '4 3' : undefined} />
            </svg>
            {s.name}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={ariaLabel}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} className={styles.grid} />
            <text x={PAD.left - 6} y={sy(t) + 3.5} className={styles.tick} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - PAD.bottom + 15} className={styles.tick} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} className={styles.axis} textAnchor="middle">
          {xLabel}
        </text>
        <text transform={`translate(12 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} className={styles.axis} textAnchor="middle">
          {yLabel}
        </text>
        {series.map((s) => (
          <g key={s.name}>
            <polyline points={s.points.map((p) => `${sx(p.x)},${sy(Math.max(yMin, Math.min(yMax, p.y)))}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
            {!s.dashed &&
              s.points.map((p) => (
                <circle key={p.x} cx={sx(p.x)} cy={sy(Math.max(yMin, Math.min(yMax, p.y)))} r="3.5" fill={s.color}>
                  <title>
                    {s.name}, {p.x}: {formatY(p.y)}
                  </title>
                </circle>
              ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Ticks at a round step (1, 2 or 5 × a power of ten) giving about five lines. */
function niceTicks(min: number, max: number): number[] {
  const rough = (max - min) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough * 0.75) ?? rough;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + 1e-9; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}
