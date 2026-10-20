import { useState, type ReactNode } from 'react';
import { GUARD_FEATURES } from '../core/data/guard';
import { trepan } from '../core/extract/trepan';
import { growTree } from '../core/models/tree';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure } from '../viz/Figure';
import { LineChart } from '../viz/LineChart';
import { useWhenVisible } from '../viz/useWhenVisible';
import { guardWorld, scoreOnMap, type GuardWorld } from './guardWorld';
import figureStyles from './figures.module.css';

const SIZES = [2, 3, 4, 6, 8, 12, 16, 20];
const NOISE = [
  { flips: 0, label: 'Clean logs' },
  { flips: 0.05, label: '5% wrong' },
  { flips: 0.15, label: '15% wrong' },
  { flips: 0.25, label: '25% wrong' },
];

interface Curves {
  world: GuardWorld;
  fromData: { x: number; accuracy: number }[];
  fromNetwork: { x: number; accuracy: number }[];
}

function computeCurves(flips: number): Curves {
  const world = guardWorld({ size: 240, flips });
  const fromData = SIZES.map((leaves) => {
    const tree = growTree(GUARD_FEATURES, world.logs.X, world.logs.y, { maxLeaves: leaves });
    return { x: leaves, accuracy: scoreOnMap((x) => tree.predict(x), world).accuracy };
  });
  const fromNetwork = SIZES.map((leaves) => {
    const tree = trepan(GUARD_FEATURES, world.logs.X, world.box.label, { maxInternal: leaves - 1, sMin: 300, seed: 1 });
    return { x: leaves, accuracy: scoreOnMap((x) => tree.predict(x), world).accuracy };
  });
  return { world, fromData, fromNetwork };
}

export function StudentFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Student number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Student({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [flips, setFlips] = useState(0.15);
  const { ref, value } = useWhenVisible(() => computeCurves(flips), String(flips));

  return (
    <Figure number={number} title="The student beats the textbook: trees learned from the logs and from the network" tryThis={tryThis}>
      <div ref={ref}>
        <div className={figureStyles.toolbar}>
          <span className={figureStyles.segmented} role="group" aria-label="Noise in the logs">
            {NOISE.map((n) => (
              <button key={n.flips} type="button" aria-pressed={flips === n.flips} onClick={() => setFlips(n.flips)}>
                {n.label}
              </button>
            ))}
          </span>
          <span className={figureStyles.note}>240 playtest log entries; the network is trained on the same logs.</span>
        </div>
        {value ? <Chart curves={value} flips={flips} /> : <p className={figureStyles.note}>Growing the trees…</p>}
      </div>
    </Figure>
  );
}

function Chart({ curves, flips }: { curves: Curves; flips: number }) {
  const last = SIZES.length - 1;
  const student = curves.fromNetwork[last].accuracy;
  const textbook = curves.fromData[last].accuracy;
  const bestData = Math.max(...curves.fromData.map((p) => p.accuracy));
  const parts = [
    `With ${SIZES[last]} leaves, the tree learned from the network matches the game on ${pct(student)} of the map, the tree learned from the logs on ${pct(textbook)}${student - textbook > 0.005 ? `: the student wins by ${pct(student - textbook)}` : ''}.`,
  ];
  if (textbook < bestData - 0.01) parts.push(`The tree from the logs peaks at ${pct(bestData)} and then gets worse as it grows, because it starts learning the wrong entries.`);
  if (student > curves.world.accuracy + 0.01) parts.push(`It even beats the network itself (${pct(curves.world.accuracy)}): a small tree can’t copy the network’s noisier wiggles.`);
  if (flips === 0) parts.push('With clean logs there is little to choose between them.');
  const caption = parts.join(' ');

  return (
    <>
      <LineChart
        series={[
          { name: 'tree learned from the network (TREPAN)', color: 'var(--series-1)', points: curves.fromNetwork.map((p) => ({ x: p.x, y: p.accuracy })) },
          { name: 'tree learned from the logs', color: 'var(--series-2)', points: curves.fromData.map((p) => ({ x: p.x, y: p.accuracy })) },
          { name: 'the network itself', color: 'var(--text-muted)', dashed: true, points: SIZES.map((x) => ({ x, y: curves.world.accuracy })) },
        ]}
        xLabel="size of the tree (leaves)"
        yLabel="matches the game's real logic"
        yMin={0.7}
        yMax={1}
        ariaLabel={caption}
      />
      <Caption>{caption}</Caption>
    </>
  );
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
