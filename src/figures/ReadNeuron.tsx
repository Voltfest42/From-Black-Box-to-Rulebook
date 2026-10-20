import { useMemo, useState, type ReactNode } from 'react';
import { allInputs, mOfN, neuronFires, subsetSearch, worstCase, type Literal, type Neuron, type SubsetStep } from '../core/extract/subsets';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure } from '../viz/Figure';
import { PlayerControls } from '../viz/PlayerControls';
import { handlePlaybackKeys, usePlayback, type Recording } from '../viz/usePlayback';
import figureStyles from './figures.module.css';
import styles from './ReadNeuron.module.css';

const INPUTS = ['smiling', 'has a tie', 'red jacket', 'holds a sword', 'round head'];

const PRESETS: { name: string; neuron: Neuron }[] = [
  { name: 'Any two of three', neuron: { weights: [2, 2, 2, 0, 0], bias: -3 } },
  { name: 'A must-have', neuron: { weights: [4, 1.5, 1.5, 1.5, 0], bias: -5 } },
  { name: 'A veto', neuron: { weights: [2, 2, 2, 0, -6], bias: -1 } },
  { name: 'Messy, like a trained one', neuron: { weights: [1.7, -0.4, 2.3, 1.1, -2.6], bias: -1.5 } },
];

function literalText(l: Literal): string {
  return l.value === 1 ? INPUTS[l.input] : `not ${INPUTS[l.input]}`;
}

function subsetText(neuron: Neuron, subset: readonly number[]): string {
  if (subset.length === 0) return 'nothing at all';
  return subset.map((i) => literalText({ input: i, value: neuron.weights[i] > 0 ? 1 : 0 })).join(' + ');
}

interface SearchState {
  steps: readonly SubsetStep[];
  current: SubsetStep | null;
}

export function ReadNeuronFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <ReadNeuron number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function ReadNeuron({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [neuron, setNeuron] = useState<Neuron>(PRESETS[0].neuron);
  // After the reader drags a slider, show the finished search straight away.
  const [edited, setEdited] = useState(false);
  const [showMofN, setShowMofN] = useState(false);
  const [hoveredRule, setHoveredRule] = useState<number | null>(null);

  const search = useMemo(() => subsetSearch(neuron), [neuron]);
  const mofn = useMemo(() => mOfN(neuron), [neuron]);
  const inputs = useMemo(() => allInputs(INPUTS.length), []);

  const recording: Recording<SearchState> = useMemo(() => {
    const states: SearchState[] = [{ steps: [], current: null }];
    const captions = ['Press play to search: smallest groups of conditions first.'];
    search.steps.forEach((step, i) => {
      states.push({ steps: search.steps.slice(0, i + 1), current: step });
      const what = subsetText(neuron, step.subset);
      captions.push(
        step.outcome === 'skipped'
          ? `Skip ${what}: it contains a rule already found, so it can only repeat it.`
          : step.outcome === 'rule'
            ? `Try ${what}: even if every other input does its worst, the total is ${step.worst.toFixed(1)}, above 0. It always fires: a rule!`
            : `Try ${what}: in the worst case the total is only ${step.worst.toFixed(1)}, so it might not fire. Not a rule.`,
      );
    });
    return { states, captions };
  }, [search, neuron]);
  const playback = usePlayback(recording, 'fast', edited);
  const { steps: done, current } = playback.state;
  const rulesSoFar = done.filter((s) => s.outcome === 'rule');
  const examinedSoFar = done.filter((s) => s.outcome !== 'skipped').length;

  const setWeight = (i: number, w: number) => {
    setEdited(true);
    setNeuron((n) => ({ ...n, weights: n.weights.map((x, j) => (j === i ? w : x)) }));
  };

  // Cells covered by what's being looked at: the subset under test, or a hovered rule.
  const focus: number[] | null = hoveredRule !== null ? rulesSoFar[hoveredRule]?.subset ?? null : current && current.outcome !== 'skipped' ? current.subset : null;
  const covered = (x: readonly number[]) => focus !== null && focus.every((i) => x[i] === (neuron.weights[i] > 0 ? 1 : 0));

  return (
    <Figure number={number} title="Read a neuron: which inputs guarantee it fires?" tryThis={tryThis} onKeyDown={(e) => handlePlaybackKeys(e, playback)}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Example neuron">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" aria-pressed={neuron === p.neuron} onClick={() => {
                setEdited(false);
                setNeuron(p.neuron);
              }}>
              {p.name}
            </button>
          ))}
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.neuron}>
          <h4 className={styles.heading}>The neuron</h4>
          <p className={styles.formula}>It fires when the weighted inputs plus the bias add up to more than 0.</p>
          {INPUTS.map((name, i) => (
            <label key={name} className={styles.weightRow}>
              <span className={styles.inputName}>{name}</span>
              <input type="range" min={-6} max={6} step={0.5} value={neuron.weights[i]} onChange={(e) => setWeight(i, Number(e.target.value))} aria-label={`Weight of ${name}`} />
              <output className={neuron.weights[i] < 0 ? styles.negative : undefined}>{fmt(neuron.weights[i])}</output>
            </label>
          ))}
          <label className={`${styles.weightRow} ${styles.bias}`}>
            <span className={styles.inputName}>bias</span>
            <input type="range" min={-10} max={4} step={0.5} value={neuron.bias} onChange={(e) => {
                setEdited(true);
                setNeuron((n) => ({ ...n, bias: Number(e.target.value) }));
              }} aria-label="Bias" />
            <output className={neuron.bias < 0 ? styles.negative : undefined}>{fmt(neuron.bias)}</output>
          </label>
        </div>

        <div>
          <h4 className={styles.heading}>Every possible input ({inputs.length})</h4>
          <ul className={styles.table} aria-label={`The neuron fires for ${inputs.filter((x) => neuronFires(neuron, x)).length} of the ${inputs.length} combinations of inputs.`}>
            {inputs.map((x) => {
              const fires = neuronFires(neuron, x);
              return (
                <li key={x.join('')} className={`${styles.cell} ${fires ? styles.fires : styles.quiet} ${covered(x) ? styles.covered : ''}`} title={`${x.map((v, i) => (v ? INPUTS[i] : `not ${INPUTS[i]}`)).join(', ')}: ${fires ? 'fires' : 'does not fire'}`}>
                  {x.map((v, i) => (
                    <span key={i} className={v ? styles.on : styles.off} />
                  ))}
                </li>
              );
            })}
          </ul>
          <p className={figureStyles.note}>
            Each square is one combination: its five dots are the inputs in the order listed, filled for “yes”. Orange squares fire.
            {focus && ' Outlined squares are the ones the conditions being looked at cover.'}
          </p>
        </div>
      </div>

      <PlayerControls playback={playback} />
      <Caption>{playback.caption}</Caption>

      <div className={styles.results}>
        <div>
          <h4 className={styles.heading}>Rules found</h4>
          {rulesSoFar.length === 0 ? (
            <p className={styles.empty}>None yet.</p>
          ) : (
            <ol className={styles.rules}>
              {rulesSoFar.map((step, i) => (
                <li key={step.subset.join()} onPointerEnter={() => setHoveredRule(i)} onPointerLeave={() => setHoveredRule(null)}>
                  IF <b>{step.subset.length === 0 ? 'always' : subsetText(neuron, step.subset).replaceAll(' + ', ' AND ')}</b> THEN fire
                </li>
              ))}
            </ol>
          )}
          <p className={figureStyles.note}>
            Groups tested: {examinedSoFar} · skipped: {done.length - examinedSoFar} · of {search.total} possible groups
          </p>
        </div>
        <div>
          <label className={figureStyles.checkbox}>
            <input type="checkbox" checked={showMofN} onChange={(e) => setShowMofN(e.target.checked)} />
            Show the M-of-N version (Towell &amp; Shavlik, 1993)
          </label>
          {showMofN && (
            <div className={styles.mofn}>
              <p>
                Weights that are close are grouped and averaged:{' '}
                {mofn.groups.map((g, i) => (
                  <span key={i} className={styles.group}>
                    {'{'}
                    {g.literals.map(literalText).join(', ')}
                    {'}'} ≈ {fmt(g.weight)}
                  </span>
                ))}
              </p>
              {mofn.rules.length === 0 ? (
                <p>It can never fire.</p>
              ) : (
                <ol className={styles.rules}>
                  {mofn.rules.map((r, i) => (
                    <li key={i}>
                      IF{' '}
                      <b>
                        {r.counts
                          .flatMap((k, g) => (k === 0 ? [] : [k === mofn.groups[g].literals.length && k === 1 ? literalText(mofn.groups[g].literals[0]) : `at least ${k} of {${mofn.groups[g].literals.map(literalText).join(', ')}}`]))
                          .join(' AND ') || 'always'}
                      </b>{' '}
                      THEN fire
                    </li>
                  ))}
                </ol>
              )}
              <p className={figureStyles.note}>
                {mofn.rules.length} M-of-N rule{mofn.rules.length === 1 ? '' : 's'} instead of {search.rules.length} ordinary ones. Because the weights were averaged, they
                agree with the real neuron on {Math.round(mofn.fidelity * inputs.length)} of the {inputs.length} inputs.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className={figureStyles.note}>
        Worst case for the current group: {current ? `${fmt(worstCase(neuron, new Set(current.subset)))}` : '–'}. Only the helpful condition for each input is ever tried: “yes” for a positive
        weight, “not” for a negative one.
      </p>
    </Figure>
  );
}

function fmt(x: number): string {
  return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1).replace(/\.0$/, '');
}
