import type { ReactNode } from 'react';
import { Caption, Figure } from '../viz/Figure';
import { PlayerControls } from '../viz/PlayerControls';
import { handlePlaybackKeys, useStepper } from '../viz/usePlayback';
import styles from './ClipperFigure.module.css';

interface Stage {
  name: string;
  caption: string;
  detail: ReactNode;
}

const STAGES: Stage[] = [
  {
    name: 'Weigh the cases',
    caption: 'Every training case starts with the same weight. Later, cases the rules get wrong will weigh more, so the next rule focuses on them.',
    detail: <p>124 robots, each weighing 1.</p>,
  },
  {
    name: 'Pick examples',
    caption: 'Sample a handful of cases, favouring the heavy ones, and put them in a prompt for a coding model.',
    detail: (
      <pre className={styles.code}>{`Friendly:     round head, round body, red jacket…
Not friendly: square head, octagon body, blue jacket…
…
Write a Python function rule(robot) that returns
True for the friendly robots.`}</pre>
    ),
  },
  {
    name: 'The model writes a rule',
    caption: 'The language model answers with a rule as a small Python function. Any expression of the features is allowed, not just the AND of a few tests.',
    detail: (
      <pre className={styles.code}>{`def rule(robot):
    return (robot.jacket == "red"
            or robot.head == robot.body)`}</pre>
    ),
  },
  {
    name: 'Score it on all the data',
    caption: 'The rule is run on the whole training set, as ordinary code, and scored the way SLIPPER scored its rules. If it doesn’t help, it is thrown away; the language model never grades its own work.',
    detail: <p>Run on all 124 robots → confidence-rated score → keep, or reject.</p>,
  },
  {
    name: 'Reweight and repeat',
    caption: 'Cases the kept rule handles well now weigh less; the others weigh more. Back to the start, round after round.',
    detail: <p>Weights updated, as in boosting. A new round begins.</p>,
  },
  {
    name: 'The final model',
    caption: 'The result is a short list of rules as plain code. Using it needs no language model at all: it is as transparent, and as cheap to run, as any hand-written rule set.',
    detail: <p>In the paper: a median of 4.5 to 13.5 rules per dataset.</p>,
  },
];

export function ClipperFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const playback = useStepper(STAGES.length - 1, 'clipper');
  const stage = STAGES[playback.step];
  const R = 110;
  const loop = STAGES.slice(0, 5);

  return (
    <Figure number={number} title="CLIPPER (2026): a 1999 rule learner with a language model inside" tryThis={tryThis} onKeyDown={(e) => handlePlaybackKeys(e, playback)}>
      <p className={styles.note}>A diagram of the method, not a live run: no language model runs in this page, and the example rule is illustrative.</p>
      <div className={styles.layout}>
        <svg viewBox="-170 -150 340 300" className={styles.loop} role="img" aria-label={`The CLIPPER loop: ${loop.map((s) => s.name).join(', then ')}. Current step: ${stage.name}.`}>
          <defs>
            <marker id="clipper-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" className={styles.head} />
            </marker>
          </defs>
          <circle r={R} className={styles.ring} />
          {loop.map((s, i) => {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / loop.length;
            const next = -Math.PI / 2 + ((i + 0.62) * 2 * Math.PI) / loop.length;
            const x = R * Math.cos(angle);
            const y = R * Math.sin(angle);
            const active = playback.step === i;
            return (
              <g key={s.name}>
                <line x1={R * Math.cos(angle + 0.28)} y1={R * Math.sin(angle + 0.28)} x2={R * Math.cos(next)} y2={R * Math.sin(next)} className={styles.arrow} markerEnd="url(#clipper-arrow)" />
                <rect x={x - 62} y={y - 17} width={124} height={34} rx={8} className={`${styles.box} ${active ? styles.active : ''} ${i === 2 ? styles.llm : ''}`} />
                <text x={x} y={y + 4} textAnchor="middle" className={styles.label}>
                  {s.name}
                </text>
              </g>
            );
          })}
          <text y={-6} textAnchor="middle" className={styles.centre}>
            SLIPPER’s loop
          </text>
          <text y={12} textAnchor="middle" className={styles.centreSmall}>
            (Cohen &amp; Singer, 1999)
          </text>
        </svg>
        <div className={`${styles.detail} ${playback.step === STAGES.length - 1 ? styles.finalDetail : ''}`}>
          <p className={styles.stageName}>
            Step {playback.step + 1}: {stage.name}
          </p>
          {stage.detail}
        </div>
      </div>
      <PlayerControls playback={playback} />
      <Caption>{stage.caption}</Caption>
    </Figure>
  );
}
