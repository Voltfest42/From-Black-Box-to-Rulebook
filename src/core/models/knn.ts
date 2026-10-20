import type { Dataset, Instance } from '../data/dataset';

/**
 * k-nearest neighbours: answer with the majority of the k closest training
 * cases (distances scaled by each numeric feature's range; categorical features
 * count 1 when they differ). Simple, and a black box all the same: its "rules"
 * are the whole training set.
 */
export function knn(data: Dataset, k: number): { proba: (x: Instance) => number; label: (x: Instance) => number } {
  const scale = data.features.map((f) => (f.kind === 'numeric' ? f.max - f.min || 1 : 1));
  const distance = (a: Instance, b: Instance) =>
    data.features.reduce((s, f, i) => s + (f.kind === 'numeric' ? ((a[i] - b[i]) / scale[i]) ** 2 : a[i] === b[i] ? 0 : 1), 0);
  const proba = (x: Instance) => {
    const nearest = data.X.map((z, i) => ({ d: distance(x, z), y: data.y[i] }))
      .sort((p, q) => p.d - q.d)
      .slice(0, k);
    return nearest.reduce((s, p) => s + p.y, 0) / nearest.length;
  };
  return { proba, label: (x) => (proba(x) > 0.5 ? 1 : 0) };
}
