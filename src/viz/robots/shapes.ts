/** SVG geometry for drawing robots, shared by the big portrait and the small grid glyphs. */

/** Points of a regular octagon around (cx, cy), flat sides on top and bottom. */
export function octagonPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let k = 0; k < 8; k++) {
    const angle = Math.PI / 8 + (k * Math.PI) / 4;
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(' ');
}

/** The real jacket colours (content, not data encoding), with a pattern name for each. */
export const JACKET_COLOURS = [
  { name: 'red', fill: '#dc2626', pattern: 'stripes' },
  { name: 'yellow', fill: '#facc15', pattern: 'dots' },
  { name: 'green', fill: '#16a34a', pattern: 'diagonal' },
  { name: 'blue', fill: '#2563eb', pattern: 'plain' },
] as const;
