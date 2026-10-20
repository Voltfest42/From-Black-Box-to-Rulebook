/** Fixed-size sets of case indices, as bits: fast intersections for rule searches. */
export type Bits = Uint32Array<ArrayBuffer>;

export function emptyBits(n: number): Bits {
  return new Uint32Array(Math.ceil(n / 32));
}

export function bitsFrom(n: number, has: (i: number) => boolean): Bits {
  const b = emptyBits(n);
  for (let i = 0; i < n; i++) if (has(i)) b[i >>> 5] |= 1 << (i & 31);
  return b;
}

export function hasBit(b: Bits, i: number): boolean {
  return (b[i >>> 5] & (1 << (i & 31))) !== 0;
}

export function and(a: Bits, b: Bits): Bits {
  const out = new Uint32Array(a.length);
  for (let k = 0; k < a.length; k++) out[k] = a[k] & b[k];
  return out;
}

export function or(a: Bits, b: Bits): Bits {
  const out = new Uint32Array(a.length);
  for (let k = 0; k < a.length; k++) out[k] = a[k] | b[k];
  return out;
}

/** Is every member of a also in b? */
export function isSubset(a: Bits, b: Bits): boolean {
  for (let k = 0; k < a.length; k++) if ((a[k] & ~b[k]) !== 0) return false;
  return true;
}

export function count(b: Bits): number {
  let c = 0;
  for (let k = 0; k < b.length; k++) {
    let v = b[k];
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    c += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return c;
}

export function isEmpty(b: Bits): boolean {
  for (let k = 0; k < b.length; k++) if (b[k] !== 0) return false;
  return true;
}

/** Calls visit(i) for every member, in increasing order; stops early when visit returns false. */
export function forEachBit(b: Bits, visit: (i: number) => boolean | void): void {
  for (let k = 0; k < b.length; k++) {
    let v = b[k];
    while (v !== 0) {
      const low = v & -v;
      const i = (k << 5) + (31 - Math.clz32(low));
      if (visit(i) === false) return;
      v ^= low;
    }
  }
}
