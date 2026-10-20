import { useId } from 'react';
import type { Machine } from '../core/extract/automaton';
import styles from './AutomatonView.module.css';

interface AutomatonViewProps {
  machine: Machine;
  symbols: readonly string[];
  /** A name under each state, e.g. "pressed ↓". */
  names?: readonly string[];
  current?: number | null;
  ariaLabel: string;
}

const W = 400;
const H = 330;
const R = 22;

/** A small state machine: states on a circle, one arrow per (from, to) pair, labelled with its symbols. */
export function AutomatonView({ machine, symbols, names, current, ariaLabel }: AutomatonViewProps) {
  const marker = `arrow-${useId().replace(/:/g, '')}`;
  const n = machine.output.length;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const ring = n === 1 ? 0 : Math.min(118, 46 + n * 16);
  const pos = Array.from({ length: n }, (_, s) => {
    const angle = Math.PI + (2 * Math.PI * s) / n;
    return { x: cx + ring * Math.cos(angle), y: cy + ring * Math.sin(angle) * 0.85 };
  });

  // Group symbols by (from, to).
  const edges = new Map<string, { from: number; to: number; labels: string[] }>();
  machine.next.forEach((row, from) =>
    row.forEach((to, a) => {
      const key = `${from}-${to}`;
      const e = edges.get(key) ?? { from, to, labels: [] };
      e.labels.push(symbols[a]);
      edges.set(key, e);
    }),
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.view} role="img" aria-label={ariaLabel}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className={styles.head} />
        </marker>
      </defs>
      {/* Start arrow */}
      <line x1={pos[machine.start].x - R - 26} y1={pos[machine.start].y} x2={pos[machine.start].x - R - 3} y2={pos[machine.start].y} className={styles.edge} markerEnd={`url(#${marker})`} />
      {[...edges.values()].map(({ from, to, labels }) => {
        const label = labels.join(', ');
        if (from === to) {
          // A loop on the outside of the ring.
          const angle = Math.atan2(pos[from].y - cy, pos[from].x - cx) || -Math.PI / 2;
          const ux = Math.cos(angle);
          const uy = Math.sin(angle);
          const px = pos[from].x + ux * R;
          const py = pos[from].y + uy * R;
          const spread = 0.55;
          const a1 = { x: pos[from].x + Math.cos(angle - spread) * R, y: pos[from].y + Math.sin(angle - spread) * R };
          const a2 = { x: pos[from].x + Math.cos(angle + spread) * R, y: pos[from].y + Math.sin(angle + spread) * R };
          const c1 = { x: a1.x + Math.cos(angle - spread) * 34, y: a1.y + Math.sin(angle - spread) * 34 };
          const c2 = { x: a2.x + Math.cos(angle + spread) * 34, y: a2.y + Math.sin(angle + spread) * 34 };
          return (
            <g key={`${from}-${to}`}>
              <path d={`M${a1.x} ${a1.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${a2.x} ${a2.y}`} className={styles.edge} markerEnd={`url(#${marker})`} />
              <text x={px + ux * 34} y={py + uy * 34 + 4} className={styles.label} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        }
        const dx = pos[to].x - pos[from].x;
        const dy = pos[to].y - pos[from].y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const bend = edges.has(`${to}-${from}`) ? 22 : 10;
        const mx = (pos[from].x + pos[to].x) / 2 + nx * bend;
        const my = (pos[from].y + pos[to].y) / 2 + ny * bend;
        // Start and end on the circles' rims.
        const start = towards(pos[from], { x: mx, y: my }, R);
        const end = towards(pos[to], { x: mx, y: my }, R + 2);
        return (
          <g key={`${from}-${to}`}>
            <path d={`M${start.x} ${start.y} Q${mx} ${my} ${end.x} ${end.y}`} className={styles.edge} markerEnd={`url(#${marker})`} />
            <text x={mx + nx * 9} y={my + ny * 9 + 4} className={styles.label} textAnchor="middle">
              {label}
            </text>
          </g>
        );
      })}
      {pos.map((p, s) => (
        <g key={s}>
          <circle cx={p.x} cy={p.y} r={R} className={`${styles.state} ${machine.output[s] ? styles.fires : ''} ${current === s ? styles.current : ''}`} />
          {machine.output[s] === 1 && <circle cx={p.x} cy={p.y} r={R - 4} className={styles.inner} />}
          <text x={p.x} y={p.y + 4} className={styles.stateLabel} textAnchor="middle">
            {s + 1}
          </text>
          {names?.[s] && <StateName x={p.x} y={p.y} cx={cx} cy={cy} text={names[s]} />}
        </g>
      ))}
    </svg>
  );
}

/** A state's name, placed just outside the ring so it stays clear of the arrows. */
function StateName({ x, y, cx, cy, text }: { x: number; y: number; cx: number; cy: number; text: string }) {
  const angle = x === cx && y === cy ? Math.PI / 2 : Math.atan2(y - cy, x - cx);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const lx = x + ux * (R + 10);
  const ly = y + uy * (R + 10) + (uy > 0.3 ? 10 : uy < -0.3 ? -4 : 4);
  const anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle';
  return (
    <text x={lx} y={ly} className={styles.name} textAnchor={anchor}>
      {text}
    </text>
  );
}

function towards(from: { x: number; y: number }, to: { x: number; y: number }, distance: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * distance, y: from.y + (dy / len) * distance };
}
