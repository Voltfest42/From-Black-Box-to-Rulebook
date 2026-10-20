import type { Instance, NumericFeature } from '../../core/data/dataset';
import type { DecisionTree, TreeNode } from '../../core/models/tree';
import { leafClass } from '../../core/models/tree';
import type { Test } from '../../core/rules/rule';

/** A model's P(yes) sampled on a regular grid over two numeric features. */
export interface Field {
  columns: number;
  rows: number;
  /** values[r * columns + c], row 0 at the bottom. */
  values: Float64Array;
}

export function computeField(proba: (x: Instance) => number, features: readonly [NumericFeature, NumericFeature], columns = 96, rows = 72): Field {
  const values = new Float64Array(columns * rows);
  const [fx, fy] = features;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = fx.min + ((c + 0.5) / columns) * (fx.max - fx.min);
      const y = fy.min + ((r + 0.5) / rows) * (fy.max - fy.min);
      values[r * columns + c] = proba([x, y]);
    }
  }
  return { columns, rows, values };
}

/** A rectangle of the map, in data units, with the class predicted inside it. */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  label: number;
}

/** The leaves of a tree over two numeric features, as rectangles. */
export function leafBoxes(tree: DecisionTree, features: readonly [NumericFeature, NumericFeature]): Box[] {
  const boxes: Box[] = [];
  const walk = (node: TreeNode, bounds: [number, number, number, number]) => {
    if (!node.test) {
      boxes.push({ x0: bounds[0], x1: bounds[1], y0: bounds[2], y1: bounds[3], label: leafClass(node) });
      return;
    }
    const t = node.test;
    if (t.kind !== 'num') throw new Error('leafBoxes only handles numeric tests');
    const [lo, hi] = t.feature === 0 ? [0, 1] : [2, 3];
    const yes: [number, number, number, number] = [...bounds];
    const no: [number, number, number, number] = [...bounds];
    yes[lo] = Math.max(yes[lo], t.threshold);
    no[hi] = Math.min(no[hi], t.threshold);
    walk(node.yes!, yes);
    walk(node.no!, no);
  };
  walk(tree.root, [features[0].min, features[0].max, features[1].min, features[1].max]);
  return boxes;
}

/** The box a single conjunction of numeric tests carves out of the map. */
export function testsBox(tests: readonly Test[], features: readonly [NumericFeature, NumericFeature], label = 1): Box {
  const b = { x0: features[0].min, x1: features[0].max, y0: features[1].min, y1: features[1].max, label };
  for (const t of tests) {
    if (t.kind !== 'num') continue;
    if (t.feature === 0) {
      if (t.above) b.x0 = Math.max(b.x0, t.threshold);
      else b.x1 = Math.min(b.x1, t.threshold);
    } else if (t.above) b.y0 = Math.max(b.y0, t.threshold);
    else b.y1 = Math.min(b.y1, t.threshold);
  }
  return b;
}

/** Cell centres of a coarse grid where two labelers disagree (for drawing × marks). */
export function disagreements(a: (x: Instance) => number, b: (x: Instance) => number, features: readonly [NumericFeature, NumericFeature], columns = 40, rows = 30): Instance[] {
  const out: Instance[] = [];
  const [fx, fy] = features;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = [fx.min + ((c + 0.5) / columns) * (fx.max - fx.min), fy.min + ((r + 0.5) / rows) * (fy.max - fy.min)];
      if (a(x) !== b(x)) out.push(x);
    }
  }
  return out;
}
