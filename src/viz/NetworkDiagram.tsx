import type { Mlp } from '../core/models/mlp';
import styles from './NetworkDiagram.module.css';

interface NetworkDiagramProps {
  net: Mlp;
  inputNames: readonly string[];
  /** Activations of every layer for one case, to light up the units. */
  activations?: readonly ArrayLike<number>[] | null;
}

const W = 380;
const ROW = 16;

/**
 * A small network drawn as columns of units. Each line is one weight: dark for
 * positive, red for negative, thicker for larger.
 */
export function NetworkDiagram({ net, inputNames, activations }: NetworkDiagramProps) {
  const layers = net.sizes;
  const height = Math.max(...layers) * ROW + 20;
  const columnX = (l: number) => 120 + (l * (W - 150)) / (layers.length - 1);
  const unitY = (l: number, j: number) => {
    const n = layers[l];
    return height / 2 + (j - (n - 1) / 2) * ROW * (l === 0 ? 1 : Math.min(1.8, (layers[0] - 1) / Math.max(1, n - 1)));
  };

  let maxWeight = 0;
  for (const w of net.W) for (const v of w) maxWeight = Math.max(maxWeight, Math.abs(v));
  maxWeight = maxWeight || 1;

  const edges = [];
  for (let l = 0; l < net.W.length; l++) {
    const n = layers[l];
    for (let j = 0; j < layers[l + 1]; j++) {
      for (let i = 0; i < n; i++) {
        const w = net.W[l][j * n + i];
        const strength = Math.abs(w) / maxWeight;
        if (strength < 0.04) continue;
        edges.push(
          <line
            key={`${l}-${j}-${i}`}
            x1={columnX(l)}
            y1={unitY(l, i)}
            x2={columnX(l + 1)}
            y2={unitY(l + 1, j)}
            className={w >= 0 ? styles.positive : styles.negative}
            strokeWidth={0.4 + 3 * strength}
            opacity={0.25 + 0.75 * strength}
          />,
        );
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className={styles.diagram} role="img" aria-label={`A network with ${layers[0]} inputs, ${layers.slice(1, -1).join(' and ')} hidden units and one output, connected by ${net.parameterCount} weights and biases.`}>
      <g>{edges}</g>
      {layers.map((n, l) =>
        Array.from({ length: n }, (_, j) => {
          const a = activations?.[l]?.[j];
          const lit = a === undefined ? 0 : l === layers.length - 1 ? a : l === 0 ? a : (a + 1) / 2;
          return (
            <circle
              key={`${l}-${j}`}
              cx={columnX(l)}
              cy={unitY(l, j)}
              r={l === 0 ? 4.5 : 6}
              className={styles.unit}
              style={a === undefined ? undefined : { fill: `color-mix(in srgb, var(--accent) ${Math.round(lit * 100)}%, var(--surface))` }}
            />
          );
        }),
      )}
      {inputNames.map((name, i) => (
        <text key={name} x={columnX(0) - 9} y={unitY(0, i) + 3.5} className={styles.label} textAnchor="end">
          {name.replace(' = ', ': ')}
        </text>
      ))}
      <text x={columnX(layers.length - 1)} y={unitY(layers.length - 1, 0) - 12} className={styles.label} textAnchor="middle">
        friendly?
      </text>
    </svg>
  );
}
