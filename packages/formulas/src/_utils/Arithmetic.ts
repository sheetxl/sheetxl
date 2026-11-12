/**
 * Excel's arithmetic rules, for the bodies that have to reproduce them INSIDE a computation
 * rather than at the boundary.
 */

/** The smallest NORMAL double; anything below it in magnitude is a subnormal. */
const MinNormalNumber = 2.2250738585072014e-308;

/**
 * Zeroes a subnormal, and folds -0 to 0 with it.
 *
 * Excel flushes a subnormal at its MULTIPLYING operators and nowhere else — a function's result
 * keeps one (`EXP(-745)` is 5E-324) and so do `+` and `-`. A body whose answer comes out of a
 * DIVISION inherits the rule and has to say so here, because JavaScript's `/` does not:
 * `ACOTH(1E307*17)` is 0 in Excel, where `1/1.7E308` is a subnormal that would otherwise survive
 * the arctangent.
 */
export const flushSubnormal = (value: number): number =>
  (value > -MinNormalNumber && value < MinNormalNumber) ? 0 : value;

/**
 * The shift Excel adds to a count or position argument before truncating it.
 *
 * It is a small ABSOLUTE constant, so a value just under an integer counts as that integer at any
 * magnitude: `LEFT("hello",0.9999999)` is "h" and `LEFT("hello",0.999999)` — one digit less — is
 * the empty string.
 *
 * Which functions shift is a PER-FUNCTION fact, not an engine one, and the family is split down
 * the middle: LEFT, RIGHT, FIND, SEARCH, REPLACE, SUBSTITUTE, CHAR, INDEX and ROUND shift, while
 * MID, REPT and UNICHAR truncate the double as it stands (`MID("hello",0.9999999,1)` is #VALUE!
 * and `UNICHAR(0.9999999)` is too). So this is applied per call site rather than in the
 * declaration.
 */
export const COUNT_EPSILON = Math.pow(2, -22);

/** A count or position argument, shifted by {@link COUNT_EPSILON} and truncated. */
export const excelCount = (count: number): number => Math.trunc(count + COUNT_EPSILON);

/**
 * The inverse hyperbolic tangent, decomposed the way a C library does it — the log form above
 * half and `log1p` below — rather than through the platform's `Math.atanh`.
 *
 * It is the spelling Excel agrees with: `ATANH(0.5)` is 0.5493061443340549,
 * which is `ln(3)/2`, where `Math.atanh(0.5)` is one ulp below; and ACOTH reaches it with
 * `y = 1/x`, where the log form keeps precision the rounded reciprocal has already lost
 * (`ACOTH(1.0000001)` is 8.405621440467199, and `Math.atanh(1/1.0000001)` is 8.40562144042724 —
 * a difference of eleven digits, not of a bit).
 */
export const atanhExcel = (y: number): number =>
  Math.abs(y) >= 0.5 ? Math.log((1 + y) / (1 - y)) / 2 : Math.log1p(2 * y / (1 - y)) / 2;

/**
 * A double read at 15 SIGNIFICANT DECIMAL DIGITS — the precision at which Excel reads one before
 * deciding which side of a boundary it falls on.
 *
 * `INT(4.35*100)` is 435 where the double is 434.99999999999994, and `ROUND(50*0.57,0)` is 29
 * because 28.4999999999999964 reads as 28.5. It is a PER-SLOT rule and not a global one — MOD,
 * QUOTIENT, EVEN and ODD read the raw double at the same position their siblings read this — so a
 * body applies it at the slots that read this way and nowhere else.
 */
export const round15 = (value: number): number => {
  if (value === 0 || !Number.isFinite(value)) return value;
  return Number(value.toPrecision(15));
};
