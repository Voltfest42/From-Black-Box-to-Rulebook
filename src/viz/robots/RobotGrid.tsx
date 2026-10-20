import { memo } from 'react';
import { ALL_ROBOTS, toRobot } from '../../core/data/robots';
import { CELL, G, GRID_HEIGHT, GRID_WIDTH, GROUP_GAP, LEFT, robotPosition, TOP } from './layout';
import { Shape } from './Shape';
import { JACKET_COLOURS } from './shapes';
import styles from './RobotGrid.module.css';

const POSITIONS = ALL_ROBOTS.map((_, i) => robotPosition(i));

export interface RobotGridProps {
  /** Background per robot: 1 = yes, 0 = no, null = unknown (not shown). */
  tint: readonly (number | null)[];
  /** When given, these robots are outlined and the others dimmed. */
  highlight?: readonly boolean[] | null;
  /** Robots marked with a red ×, e.g. where rules and model disagree. */
  wrong?: readonly boolean[];
  /** Robots marked with a small dot, e.g. the training examples. */
  dots?: readonly boolean[];
  hovered?: number | null;
  onHover?: (index: number | null) => void;
  /** Robots ringed as "selected". */
  selected?: number | null;
  /** Click a robot to pick it. */
  onPick?: (index: number) => void;
  ariaLabel: string;
}

export function RobotGrid({ tint, highlight, wrong, dots, hovered, onHover, selected, onPick, ariaLabel }: RobotGridProps) {
  return (
    <svg
      viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
      className={`${styles.grid} ${onPick ? styles.pickable : ''}`}
      role="img"
      aria-label={ariaLabel}
      onPointerLeave={() => onHover?.(null)}
    >
      <Headers />
      {ALL_ROBOTS.map((_, i) => (
        <Glyph
          key={i}
          index={i}
          tint={tint[i]}
          state={highlight ? (highlight[i] ? 'on' : 'off') : 'plain'}
          wrong={wrong?.[i] ?? false}
          dot={dots?.[i] ?? false}
          hovered={hovered === i}
          selected={selected === i}
          onHover={onHover}
          onPick={onPick}
        />
      ))}
    </svg>
  );
}

const Glyph = memo(function Glyph({
  index,
  tint,
  state,
  wrong,
  dot,
  hovered,
  selected,
  onHover,
  onPick,
}: {
  index: number;
  tint: number | null;
  state: 'plain' | 'on' | 'off';
  wrong: boolean;
  dot: boolean;
  hovered: boolean;
  selected: boolean;
  onHover?: (index: number | null) => void;
  onPick?: (index: number) => void;
}) {
  const { x, y } = POSITIONS[index];
  const r = toRobot(ALL_ROBOTS[index]);
  const tintClass = tint === 1 ? styles.yes : tint === 0 ? styles.no : styles.unknown;
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={`${styles.glyph} ${state === 'off' ? styles.dim : ''}`}
      onPointerEnter={onHover ? () => onHover(index) : undefined}
      onPointerDown={onPick ? () => onPick(index) : undefined}
    >
      <rect width={G} height={G} rx="3" className={`${tintClass} ${state === 'on' ? styles.covered : ''} ${hovered ? styles.hovered : ''}`} />
      <Shape shape={r.head} cx={G / 2} cy={5.4} r={3.6} className={styles.figure} />
      <Shape shape={r.body} cx={G / 2} cy={12.9} r={4.4} className={styles.figure} />
      {dot && <circle cx={G - 3} cy={3} r={2} className={styles.dot} />}
      {selected && <rect x={-2.5} y={-2.5} width={G + 5} height={G + 5} rx="5" className={styles.selected} />}
      {wrong && <path d={`M3 3 L${G - 3} ${G - 3} M${G - 3} 3 L3 ${G - 3}`} className={styles.wrong} />}
    </g>
  );
});

const SHAPE_NAMES = ['round', 'square', 'octagon'];

function Headers() {
  return (
    <g aria-hidden="true">
      {JACKET_COLOURS.map((jacket, j) => {
        const x0 = LEFT + j * (3 * CELL + GROUP_GAP);
        return (
          <g key={jacket.name}>
            <rect x={x0 + 2} y={8} width={12} height={12} rx="2" fill={jacket.fill} className={styles.swatch} />
            <text x={x0 + 18} y={18} className={styles.label}>
              {jacket.name} jacket
            </text>
            {[0, 1, 2].map((h) => (
              <HeldIcon key={h} kind={h} x={x0 + h * CELL + CELL / 2 - 3} y={38} />
            ))}
          </g>
        );
      })}
      {[0, 1, 2].map((head) =>
        [0, 1, 2].map((body) => {
          const y0 = TOP + (head * 3 + body) * CELL + head * GROUP_GAP + CELL / 2;
          return (
            <g key={`${head}-${body}`}>
              <text x={LEFT - 6} y={y0 - 3} className={styles.small} textAnchor="end">
                {SHAPE_NAMES[head]} head
              </text>
              <text x={LEFT - 6} y={y0 + 9} className={styles.small} textAnchor="end">
                {SHAPE_NAMES[body]} body
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}

function HeldIcon({ kind, x, y }: { kind: number; x: number; y: number }) {
  if (kind === 0)
    return (
      <g transform={`translate(${x} ${y})`} className={styles.icon}>
        <line x1="3" y1="-8" x2="3" y2="5" />
        <line x1="-1" y1="5" x2="7" y2="5" />
      </g>
    );
  if (kind === 1)
    return (
      <g transform={`translate(${x} ${y})`} className={styles.icon}>
        <circle cx="3" cy="-3" r="4.5" />
        <line x1="3" y1="1.5" x2="3" y2="8" />
      </g>
    );
  return (
    <g transform={`translate(${x} ${y})`} className={styles.icon}>
      <line x1="0" y1="-8" x2="0" y2="8" />
      <path d="M0 -8 L8 -5 L0 -2 Z" />
    </g>
  );
}
