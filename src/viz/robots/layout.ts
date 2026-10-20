import { ALL_ROBOTS, toRobot } from '../../core/data/robots';

/**
 * All 432 robots in one picture. Rows: head shape × body shape. Columns: jacket
 * colour × what the robot holds. Inside each block of four: smiling robots on the
 * left, robots with a tie on top. With this layout most rules are visible as
 * bands and blocks: "jacket is red" is the first column group.
 */
export const G = 18; // glyph size
export const STEP = 20; // robot spacing inside a block
export const CELL = 2 * STEP + 6;
export const GROUP_GAP = 10;
export const LEFT = 80;
export const TOP = 54;

export const GRID_WIDTH = LEFT + 12 * CELL + 3 * GROUP_GAP;
export const GRID_HEIGHT = TOP + 9 * CELL + 2 * GROUP_GAP;

/** Top-left corner of robot i's glyph. */
export function robotPosition(i: number): { x: number; y: number } {
  const r = toRobot(ALL_ROBOTS[i]);
  const row = r.head * 3 + r.body;
  const col = r.jacket * 3 + r.holding;
  return {
    x: LEFT + col * CELL + r.jacket * GROUP_GAP + (r.smiling ? 0 : STEP),
    y: TOP + row * CELL + r.head * GROUP_GAP + (r.tie ? 0 : STEP),
  };
}

/** The grid layout in words, for the note under each grid. */
export const GRID_KEY =
  'Rows: head and body shape. Columns: jacket colour, then what the robot holds (sword, balloon, flag). In each block of four, smiling robots are on the left and robots with a tie are on top.';
