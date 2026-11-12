/**
 * The elimination behind MDETERM and MINVERSE — LU with partial pivoting, and no tolerance
 * anywhere in it.
 *
 * The determinant of a SINGULAR matrix is what makes the algorithm visible rather than a matter
 * of taste: Excel answers 6.661338147750939E-16 for `MDETERM({1,2,3;4,5,6;7,8,9})`, exactly 0 for
 * its transpose, and the same residue negated when its first two rows are swapped. Those are the
 * numbers the elimination leaves; a body that cuts a small pivot to zero can produce none of
 * them, and one without pivoting produces a different residue again.
 *
 * The inverse is this same decomposition followed by a forward and back SUBSTITUTION per unit
 * column. Gauss-Jordan over `[A | I]` — the textbook alternative — gives different answers on
 * the same matrices.
 */

import { flushSubnormal } from './Arithmetic';

/** An LU decomposition in place: multipliers below the diagonal, U on and above it. */
interface Decomposition {
  readonly lu: number[][];
  /** `perm[i]` is the ORIGINAL index of the row now sitting at `i`. */
  readonly perm: number[];
  /** -1 when the number of row swaps was odd. */
  readonly sign: number;
  /** A pivot came out EXACTLY zero. There is no epsilon beside this test. */
  readonly singular: boolean;
}

const decompose = (m: readonly (readonly number[])[]): Decomposition => {
  const n = m.length;
  const lu = m.map((row) => [...row]);
  const perm = Array.from({ length: n }, (_, i) => i);
  let sign = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(lu[row][col]) > Math.abs(lu[pivot][col])) pivot = row;
    }
    if (pivot !== col) {
      [lu[col], lu[pivot]] = [lu[pivot], lu[col]];
      [perm[col], perm[pivot]] = [perm[pivot], perm[col]];
      sign = -sign;
    }
    if (lu[col][col] === 0) return { lu, perm, sign, singular: true };
    for (let row = col + 1; row < n; row++) {
      const factor = lu[row][col] / lu[col][col];
      lu[row][col] = factor;
      for (let j = col + 1; j < n; j++) lu[row][j] -= factor * lu[col][j];
    }
  }
  return { lu, perm, sign, singular: false };
};

/**
 * The determinant, as the signed product of the pivots.
 *
 * The product is a multiplication, so it carries the two rules the multiplying operators do:
 * a subnormal flushes to zero (`MDETERM({1E-160,2E-160;3E-160,4E-160})` is 0, not 2E-320) and an
 * overflow is `#NUM!` rather than an infinity, which is what `NaN` means to the caller.
 */
export const determinant = (m: readonly (readonly number[])[]): number => {
  const { lu, sign, singular } = decompose(m);
  if (singular) return 0;
  let det = sign;
  for (let i = 0; i < lu.length; i++) det = flushSubnormal(det * lu[i][i]);
  return Number.isFinite(det) ? det : Number.NaN;
};

/**
 * The inverse, one unit column at a time. `null` when a pivot was zero — the caller's `#NUM!`.
 *
 * The substitution subtracts term by term rather than accumulating a sum and subtracting once;
 * the two differ in the last bit wherever the terms cancel, and only the first reproduces
 * Excel's `MINVERSE({1,2;3,4})`, which is not the exact `[[-2,1],[1.5,-0.5]]`.
 */
export const invert = (m: readonly (readonly number[])[]): number[][] | null => {
  const n = m.length;
  const { lu, perm, singular } = decompose(m);
  if (singular) return null;
  const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let c = 0; c < n; c++) {
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let value = perm[i] === c ? 1 : 0;
      for (let j = 0; j < i; j++) value -= lu[i][j] * y[j];
      y[i] = value;
    }
    for (let i = n - 1; i >= 0; i--) {
      let value = y[i];
      for (let j = i + 1; j < n; j++) value -= lu[i][j] * out[j][c];
      out[i][c] = flushSubnormal(value / lu[i][i]);
    }
  }
  return out;
};
