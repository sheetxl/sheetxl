/**
 * Excel's circular trigonometry, which is not the platform library's.
 *
 * Excel's `SIN` `COS` `TAN` disagree with a correctly-rounded library in the FOURTH significant
 * digit near a multiple of pi/2 — `SIN(PI())` is 1.22514845490862E-16 where the true sine of the
 * double `PI()` is 1.2246467991473532E-16 — because Excel reduces the argument against pi
 * ROUNDED TO A 64-BIT SIGNIFICAND (the x87 80-bit extended constant) rather than against pi. The
 * difference is a constant, not noise to be tolerated at 15 digits.
 *
 * The reduction has to be carried at more than double precision: `k` reaches 2^27/(pi/2), about
 * 8.5E7, so `k * PI_HI/2` needs the exact product rather than the rounded one. That is what the
 * double-double helpers below are for. The answer is re-evaluated from the reduced argument
 * rather than perturbed from the library's: perturbing keeps the ordinary arguments exact and
 * loses the reduced ones.
 */

/** pi as a double — the high half of the x87 constant. */
const PI_HI = Math.PI;
/**
 * The rest of it: `PI_HI + PI_LO` is pi rounded to 64 significand bits, exactly. Excel's own
 * `SIN(PI())` is this number.
 */
const PI_LO = 1.22514845490862e-16;

/** `|x|` at or above which Excel refuses a circular trig argument outright. */
export const MAX_TRIG_ARGUMENT = 2 ** 27;

/** Dekker's splitter for a 53-bit significand. */
const SPLIT = 134217729; // 2^27 + 1

/** `a + b` with the rounding error, exactly. */
const twoSum = (a: number, b: number): [number, number] => {
  const s = a + b;
  const bb = s - a;
  return [s, (a - (s - bb)) + (b - bb)];
};

/** `a * b` with the rounding error, exactly (Dekker — JavaScript has no FMA). */
const twoProduct = (a: number, b: number): [number, number] => {
  const p = a * b;
  const ca = SPLIT * a, ah = ca - (ca - a), al = a - ah;
  const cb = SPLIT * b, bh = cb - (cb - b), bl = b - bh;
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
};

/**
 * Reduces `x` against the x87 pi to `[quadrant, hi, lo]`, where `hi + lo` is the remainder in
 * roughly [-pi/4, pi/4] and `quadrant` is `k mod 4`.
 */
const reduce = (x: number): [number, number, number] => {
  const half = PI_HI / 2;
  const k = Math.round(x / half);
  const [p, pe] = twoProduct(k, half);
  const [s, se] = twoSum(x, -p);
  const [hi, lo] = twoSum(s, se - pe - k * (PI_LO / 2));
  return [((k % 4) + 4) % 4, hi, lo];
};

/** sine and cosine of `hi + lo`, first order in the tail — the tail is at most an ulp of `hi`. */
const sinTail = (hi: number, lo: number): number => Math.sin(hi) + Math.cos(hi) * lo;
const cosTail = (hi: number, lo: number): number => Math.cos(hi) - Math.sin(hi) * lo;

/** Excel's sine. The caller owns the {@link MAX_TRIG_ARGUMENT} refusal. */
export function x87Sin(x: number): number {
  const [quadrant, hi, lo] = reduce(x);
  switch (quadrant) {
    case 0: return sinTail(hi, lo);
    case 1: return cosTail(hi, lo);
    case 2: return -sinTail(hi, lo);
    default: return -cosTail(hi, lo);
  }
}

/** Excel's cosine. The caller owns the {@link MAX_TRIG_ARGUMENT} refusal. */
export function x87Cos(x: number): number {
  const [quadrant, hi, lo] = reduce(x);
  switch (quadrant) {
    case 0: return cosTail(hi, lo);
    case 1: return -sinTail(hi, lo);
    case 2: return -cosTail(hi, lo);
    default: return sinTail(hi, lo);
  }
}

/**
 * Excel's tangent, which is the quotient of the two above and not a function of its own.
 * `TAN(x)` is exactly `SIN(x)/COS(x)` everywhere, including at the poles, where the quotient is
 * what produces the large finite answer (`TAN(PI()/2)` is 1.6324552277619072E16).
 */
export const x87Tan = (x: number): number => x87Sin(x) / x87Cos(x);
