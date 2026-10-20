import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Instance, NumericFeature } from '../../core/data/dataset';
import { formatNumber } from '../../core/rules/rule';
import type { Box, Field } from './field';
import styles from './DecisionMap.module.css';

export interface MapPoint {
  x: Instance;
  /** Class colour; undefined draws a neutral point. */
  label?: number;
  kind: 'example' | 'query';
}

/** Converts data coordinates to the SVG's pixel coordinates. */
export interface MapScale {
  sx: (v: number) => number;
  sy: (v: number) => number;
}

interface DecisionMapProps {
  features: readonly [NumericFeature, NumericFeature];
  /** The black box's decision, drawn as shading. */
  field?: Field | null;
  boxes?: readonly Box[];
  /** Highlight one box (e.g. the rule under the pointer). */
  activeBox?: number | null;
  points?: readonly MapPoint[];
  /** Places where rules and model disagree. */
  disagree?: readonly Instance[];
  onPick?: (x: Instance) => void;
  /** Extra drawing on top, in pixel space. */
  children?: (scale: MapScale) => ReactNode;
  ariaLabel: string;
}

const W = 520;
const H = 380;
const PAD = { left: 46, right: 12, top: 10, bottom: 38 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** The guard's world as a map: distance across, light up. */
export function DecisionMap({ features, field, boxes = [], activeBox, points = [], disagree = [], onPick, children, ariaLabel }: DecisionMapProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const theme = useThemeVersion();
  const [fx, fy] = features;
  const scale: MapScale = {
    sx: (v) => PAD.left + ((v - fx.min) / (fx.max - fx.min)) * PLOT_W,
    sy: (v) => PAD.top + PLOT_H - ((v - fy.min) / (fy.max - fy.min)) * PLOT_H,
  };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, el.width, el.height);
    if (!field) return;
    const css = getComputedStyle(el);
    const yes = parseColour(css.getPropertyValue('--yes-soft'));
    const no = parseColour(css.getPropertyValue('--no-soft'));
    const image = ctx.createImageData(field.columns, field.rows);
    for (let r = 0; r < field.rows; r++) {
      for (let c = 0; c < field.columns; c++) {
        const p = field.values[r * field.columns + c];
        // Mostly flat colours, blending only right at the boundary, so the edge is crisp.
        const t = 1 / (1 + Math.exp(-(p - 0.5) * 14));
        const k = ((field.rows - 1 - r) * field.columns + c) * 4;
        image.data[k] = no[0] + (yes[0] - no[0]) * t;
        image.data[k + 1] = no[1] + (yes[1] - no[1]) * t;
        image.data[k + 2] = no[2] + (yes[2] - no[2]) * t;
        image.data[k + 3] = 255;
      }
    }
    el.width = field.columns;
    el.height = field.rows;
    ctx.putImageData(image, 0, 0);
  }, [field, theme]);

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!onPick || !svg.current) return;
    const rect = svg.current.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const py = ((event.clientY - rect.top) / rect.height) * H;
    if (px < PAD.left || px > PAD.left + PLOT_W || py < PAD.top || py > PAD.top + PLOT_H) return;
    onPick([fx.min + ((px - PAD.left) / PLOT_W) * (fx.max - fx.min), fy.min + ((PAD.top + PLOT_H - py) / PLOT_H) * (fy.max - fy.min)]);
  };

  const xTicks = ticks(fx.min, fx.max, 5);
  const yTicks = ticks(fy.min, fy.max, 5);

  return (
    <div className={styles.wrap}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        style={{ left: `${(PAD.left / W) * 100}%`, top: `${(PAD.top / H) * 100}%`, width: `${(PLOT_W / W) * 100}%`, height: `${(PLOT_H / H) * 100}%` }}
        aria-hidden="true"
      />
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className={`${styles.svg} ${onPick ? styles.pickable : ''}`} role="img" aria-label={ariaLabel} onPointerDown={pick}>
        <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} className={styles.frame} />
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={scale.sx(t)} x2={scale.sx(t)} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H + 4} className={styles.tickLine} />
            <text x={scale.sx(t)} y={PAD.top + PLOT_H + 16} className={styles.tick} textAnchor="middle">
              {formatNumber(t, fx)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left - 4} x2={PAD.left} y1={scale.sy(t)} y2={scale.sy(t)} className={styles.tickLine} />
            <text x={PAD.left - 7} y={scale.sy(t) + 3.5} className={styles.tick} textAnchor="end">
              {formatNumber(t, fy)}
            </text>
          </g>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={H - 4} className={styles.axis} textAnchor="middle">
          {fx.name} from the guard →
        </text>
        <text transform={`translate(12 ${PAD.top + PLOT_H / 2}) rotate(-90)`} className={styles.axis} textAnchor="middle">
          {fy.name} level →
        </text>

        {boxes.map((b, i) => (
          <rect
            key={i}
            x={scale.sx(b.x0)}
            y={scale.sy(b.y1)}
            width={Math.max(0, scale.sx(b.x1) - scale.sx(b.x0))}
            height={Math.max(0, scale.sy(b.y0) - scale.sy(b.y1))}
            className={`${styles.box} ${b.label === 1 ? styles.boxYes : styles.boxNo} ${activeBox === i ? styles.boxActive : ''}`}
          />
        ))}
        {disagree.map((x, i) => (
          <path key={i} d={cross(scale.sx(x[0]), scale.sy(x[1]), 2.6)} className={styles.disagree} />
        ))}
        {points.map((p, i) =>
          p.kind === 'query' ? (
            <circle key={i} cx={scale.sx(p.x[0])} cy={scale.sy(p.x[1])} r={2.3} className={`${styles.query} ${p.label === 1 ? styles.pointYes : p.label === 0 ? styles.pointNo : ''}`} />
          ) : (
            <circle key={i} cx={scale.sx(p.x[0])} cy={scale.sy(p.x[1])} r={2.6} className={`${styles.example} ${p.label === 1 ? styles.fillYes : p.label === 0 ? styles.fillNo : ''}`} />
          ),
        )}
        {children?.(scale)}
      </svg>
    </div>
  );
}

/** Bumps when the colour scheme changes, so the canvas repaints with the new colours. */
function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => setVersion((v) => v + 1);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return version;
}

function parseColour(css: string): [number, number, number] {
  const hex = css.trim().replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const m = css.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [200, 200, 200];
}

function ticks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

function cross(x: number, y: number, r: number): string {
  return `M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}`;
}


