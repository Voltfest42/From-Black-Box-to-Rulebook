import type { ClassNames, Feature } from '../core/data/dataset';
import { leafClass, type TreeNode } from '../core/models/tree';
import { formatTest } from '../core/rules/rule';
import styles from './TreeOutline.module.css';

/** A decision tree as an indented outline: each question, then its "yes" and "no" branches. */
export function TreeOutline({ root, features, classes }: { root: TreeNode; features: readonly Feature[]; classes: ClassNames }) {
  return (
    <div className={styles.outline} tabIndex={0} role="group" aria-label="Decision tree">
      <Node node={root} features={features} classes={classes} />
    </div>
  );
}

function Node({ node, features, classes, branch }: { node: TreeNode; features: readonly Feature[]; classes: ClassNames; branch?: 'yes' | 'no' }) {
  const prefix = branch && <span className={styles.branch}>{branch}</span>;
  if (!node.test) {
    const yes = leafClass(node) === 1;
    return (
      <div className={styles.row}>
        {prefix}
        <span className={`${styles.leaf} ${yes ? styles.yes : styles.no}`}>{yes ? classes.yes : classes.no}</span>
      </div>
    );
  }
  return (
    <div className={styles.row}>
      {prefix}
      <div className={styles.question}>
        <span className={styles.test}>{formatTest(node.test, features)}?</span>
        <ul className={styles.children}>
          <li>
            <Node node={node.yes!} features={features} classes={classes} branch="yes" />
          </li>
          <li>
            <Node node={node.no!} features={features} classes={classes} branch="no" />
          </li>
        </ul>
      </div>
    </div>
  );
}
