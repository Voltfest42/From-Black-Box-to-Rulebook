/**
 * Datasets are small tables of cases. A case ("instance") is an array of raw
 * feature values: a number for a numeric feature, or the index of the value
 * for a categorical one. Every label is 0 ("no") or 1 ("yes").
 */
export type Instance = readonly number[];

export interface NumericFeature {
  kind: 'numeric';
  name: string;
  min: number;
  max: number;
  /** Shown after values, e.g. "m" or "%". */
  unit?: string;
  /** Decimal places when printing a threshold. */
  decimals?: number;
}

export interface CategoricalFeature {
  kind: 'categorical';
  name: string;
  values: readonly string[];
  /** A test on this feature in plain words, e.g. (red, true) → "jacket is red". */
  describe?: (value: number, equal: boolean) => string;
}

export type Feature = NumericFeature | CategoricalFeature;

export interface Dataset {
  features: readonly Feature[];
  X: readonly Instance[];
  y: readonly number[];
}

/** Human-readable names for the two classes of a problem, e.g. "friendly" / "not friendly". */
export interface ClassNames {
  yes: string;
  no: string;
}

/** Turns raw instances into the numbers a neural network reads. */
export interface Encoder {
  /** Number of network inputs. */
  size: number;
  /** One label per input, e.g. "jacket = red" or "distance". */
  inputNames: string[];
  encode(x: Instance): Float64Array;
}

/**
 * One-hot for categorical features (one input per value), and numeric features
 * scaled to [-1, 1] from their declared range.
 */
export function makeEncoder(features: readonly Feature[]): Encoder {
  const offsets: number[] = [];
  const inputNames: string[] = [];
  for (const f of features) {
    offsets.push(inputNames.length);
    if (f.kind === 'numeric') inputNames.push(f.name);
    else for (const v of f.values) inputNames.push(`${f.name} = ${v}`);
  }
  const size = inputNames.length;
  return {
    size,
    inputNames,
    encode(x) {
      const out = new Float64Array(size);
      features.forEach((f, i) => {
        if (f.kind === 'numeric') {
          const span = f.max - f.min || 1;
          out[offsets[i]] = (2 * (x[i] - f.min)) / span - 1;
        } else {
          out[offsets[i] + x[i]] = 1;
        }
      });
      return out;
    },
  };
}

/** Every combination of values of a set of categorical features (432 for the robots). */
export function enumerateInstances(features: readonly CategoricalFeature[]): Instance[] {
  let all: number[][] = [[]];
  for (const f of features) {
    const next: number[][] = [];
    for (const prefix of all) for (let v = 0; v < f.values.length; v++) next.push([...prefix, v]);
    all = next;
  }
  return all;
}

export function isCategorical(f: Feature): f is CategoricalFeature {
  return f.kind === 'categorical';
}
