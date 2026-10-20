import { useState, type ReactNode } from 'react';
import { Figure } from '../viz/Figure';
import figureStyles from './figures.module.css';
import styles from './CombinationsFigure.module.css';

/** log10 of 2ⁿ. */
const powerOfTen = (n: number) => n * Math.log10(2);

const EXAMPLES: { label: string; log10: number; note: string; reference?: boolean }[] = [
  { label: 'A 5-input neuron (Figure 2.1)', log10: powerOfTen(5), note: '32' },
  { label: 'One robot-network unit (Figure 2.2)', log10: Math.log10(27_783), note: '27,783' },
  { label: 'A 1990s DNA network, 57 inputs', log10: powerOfTen(57), note: '1.4 × 10¹⁷' },
  { label: 'Seconds since the Big Bang', log10: Math.log10(4.35e17), note: '4 × 10¹⁷', reference: true },
  { label: 'Atoms in the observable universe', log10: 80, note: '~10⁸⁰', reference: true },
  { label: 'A tiny 28 × 28 black-and-white image', log10: powerOfTen(784), note: '10²³⁶' },
];

const MAX = 240;
const W = 640;
const LABEL = 250;
const ROW = 30;

export function CombinationsFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [inputs, setInputs] = useState(20);
  const log10 = powerOfTen(inputs);
  const seconds = log10 - 9; // at a billion tests per second

  return (
    <Figure number={number} title="The wall: groups of inputs to test, as networks grow" tryThis={tryThis}>
      <svg viewBox={`0 0 ${W} ${EXAMPLES.length * ROW + 34}`} className={styles.chart} role="img" aria-label="Number of groups of inputs to test, on a scale of powers of ten: 32 for a 5-input neuron, 10 to the 17 for a 57-input network, 10 to the 236 for a 784-input image, against 10 to the 80 atoms in the universe.">
        {[0, 50, 100, 150, 200].map((t) => {
          const x = LABEL + (t / MAX) * (W - LABEL - 60);
          return (
            <g key={t}>
              <line x1={x} x2={x} y1={0} y2={EXAMPLES.length * ROW} className={styles.grid} />
              <text x={x} y={EXAMPLES.length * ROW + 16} className={styles.tick} textAnchor="middle">
                10{superscript(t)}
              </text>
            </g>
          );
        })}
        {EXAMPLES.map((e, i) => {
          const y = i * ROW + 6;
          const width = (e.log10 / MAX) * (W - LABEL - 60);
          return (
            <g key={e.label}>
              <text x={LABEL - 8} y={y + 13} className={styles.label} textAnchor="end">
                {e.label}
              </text>
              <rect x={LABEL} y={y} width={Math.max(2, width)} height={18} rx="3" className={e.reference ? styles.reference : styles.bar} />
              <text x={LABEL + Math.max(2, width) + 6} y={y + 13} className={styles.value}>
                {e.note}
              </text>
            </g>
          );
        })}
        <text x={LABEL} y={EXAMPLES.length * ROW + 30} className={styles.tick}>
          groups to test, on a scale of powers of ten (each grid line is 10⁵⁰ times the one before)
        </text>
      </svg>

      <div className={styles.calculator}>
        <label className={figureStyles.inputLabel}>
          Inputs:
          <input type="range" min={1} max={300} value={inputs} onChange={(e) => setInputs(Number(e.target.value))} aria-label="Number of inputs" />
          <output className={styles.inputs}>{inputs}</output>
        </label>
        <p role="status">
          {inputs} yes/no inputs have <b>{formatPower(log10)}</b> groups. At a billion tests per second, testing them all takes <b>{formatDuration(seconds)}</b>.
        </p>
      </div>
    </Figure>
  );
}

function superscript(n: number): string {
  const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n)
    .split('')
    .map((d) => digits[Number(d)])
    .join('');
}

function formatPower(log10: number): string {
  if (log10 < 6) return Math.round(10 ** log10).toLocaleString('en');
  const exponent = Math.floor(log10);
  const mantissa = 10 ** (log10 - exponent);
  return `${mantissa.toFixed(1)} × 10${superscript(exponent)}`;
}

/** A duration of 10^log10Seconds seconds, in words. */
function formatDuration(log10Seconds: number): string {
  const s = 10 ** log10Seconds;
  if (s < 1e-3) return 'less than a millisecond';
  if (s < 1) return plural(Math.round(s * 1000), 'millisecond');
  if (s < 120) return plural(Math.round(s), 'second');
  if (s < 7200) return plural(Math.round(s / 60), 'minute');
  if (s < 172_800) return plural(Math.round(s / 3600), 'hour');
  if (s < 3.15e7 * 2) return plural(Math.round(s / 86_400), 'day');
  const years = log10Seconds - Math.log10(3.15e7);
  if (years < 6) return `${Math.round(10 ** years).toLocaleString('en')} years`;
  const ages = years - Math.log10(1.38e10);
  if (ages < 0) return `${formatPower(years)} years`;
  return `${formatPower(ages)} times the age of the universe`;
}

function plural(n: number, unit: string): string {
  return `${n.toLocaleString('en')} ${unit}${n === 1 ? '' : 's'}`;
}
