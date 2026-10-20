import type { SVGProps } from 'react';
import { octagonPoints } from './shapes';

/** A round, square or octagonal shape of "radius" r around (cx, cy). */
export function Shape({ shape, cx, cy, r, ...rest }: { shape: number; cx: number; cy: number; r: number } & SVGProps<SVGElement>) {
  const props = rest as SVGProps<SVGCircleElement> & SVGProps<SVGRectElement> & SVGProps<SVGPolygonElement>;
  if (shape === 0) return <circle cx={cx} cy={cy} r={r} {...props} />;
  if (shape === 1) {
    const side = r * 1.8;
    return <rect x={cx - side / 2} y={cy - side / 2} width={side} height={side} rx={r * 0.12} {...props} />;
  }
  return <polygon points={octagonPoints(cx, cy, r * 1.04)} {...props} />;
}
