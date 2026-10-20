import { useId } from 'react';
import type { Instance } from '../../core/data/dataset';
import { describeRobot, toRobot } from '../../core/data/robots';
import { Shape } from './Shape';
import { JACKET_COLOURS } from './shapes';
import styles from './RobotPortrait.module.css';

/** A large drawing of one robot, with every trait visible. */
export function RobotPortrait({ robot, size = 120 }: { robot: Instance; size?: number }) {
  const r = toRobot(robot);
  const id = useId().replace(/:/g, '');
  const jacket = JACKET_COLOURS[r.jacket];
  const patternId = `jacket-${id}`;

  return (
    <svg viewBox="0 0 130 150" width={size} height={(size * 150) / 130} className={styles.portrait} role="img" aria-label={describeRobot(robot)}>
      <defs>
        <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={jacket.fill} />
          {jacket.pattern === 'stripes' && <rect x="0" width="3" height="8" fill="rgb(255 255 255 / 0.35)" />}
          {jacket.pattern === 'dots' && <circle cx="4" cy="4" r="1.6" fill="rgb(0 0 0 / 0.25)" />}
          {jacket.pattern === 'diagonal' && <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke="rgb(255 255 255 / 0.4)" strokeWidth="2" />}
        </pattern>
      </defs>

      {/* Antenna, legs, arms */}
      <line x1="60" y1="17" x2="60" y2="8" className={styles.line} />
      <circle cx="60" cy="6" r="3" className={styles.dark} />
      <line x1="50" y1="126" x2="48" y2="144" className={styles.line} />
      <line x1="70" y1="126" x2="72" y2="144" className={styles.line} />
      <line x1="33" y1="92" x2="16" y2="108" className={styles.line} />
      <line x1="87" y1="92" x2="104" y2="80" className={styles.line} />

      {/* What it holds, in the right hand */}
      {r.holding === 0 && (
        <g className={styles.item}>
          <line x1="106" y1="78" x2="106" y2="34" className={styles.blade} />
          <line x1="99" y1="78" x2="113" y2="78" className={styles.line} />
          <line x1="106" y1="78" x2="106" y2="88" className={styles.line} />
        </g>
      )}
      {r.holding === 1 && (
        <g className={styles.item}>
          <path d="M105 80 Q100 64 108 52" className={styles.string} />
          <ellipse cx="109" cy="40" rx="10" ry="12" className={styles.balloon} />
        </g>
      )}
      {r.holding === 2 && (
        <g className={styles.item}>
          <line x1="105" y1="90" x2="105" y2="30" className={styles.line} />
          <path d="M105 31 L126 38 L105 46 Z" className={styles.flag} />
        </g>
      )}

      {/* Body in its jacket, then the tie */}
      <Shape shape={r.body} cx={60} cy={96} r={29} fill={`url(#${patternId})`} className={styles.outline} />
      {r.tie && <path d="M56 70 L64 70 L62 76 L66 98 L60 105 L54 98 L58 76 Z" className={styles.tie} />}

      {/* Neck and head */}
      <rect x="56" y="58" width="8" height="10" className={styles.neck} />
      <Shape shape={r.head} cx={60} cy={38} r={20} className={styles.head} />
      <circle cx="52.5" cy="34" r="3" className={styles.dark} />
      <circle cx="67.5" cy="34" r="3" className={styles.dark} />
      {r.smiling ? <path d="M51 44 Q60 52 69 44" className={styles.mouth} /> : <line x1="52" y1="46" x2="68" y2="46" className={styles.mouth} />}
    </svg>
  );
}
