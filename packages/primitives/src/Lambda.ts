import { type Scalar } from './Scalar';

/**
 * A function value, equivalent to Excel's LAMBDA — the type of a lambda-consuming
 * parameter (`BYROW`'s `fn`) and of the value `LAMBDA` itself returns.
 *
 * The first type argument is the parameter list as a tuple, the second is the return type:
 *
 * - `Lambda<[accumulator: Scalar, value: Scalar], Scalar>` — a `REDUCE`/`SCAN` accumulator.
 * - `Lambda<[row: IRange], Scalar>` — `BYROW`'s one-parameter lambda.
 * - `Lambda<[rowIndex: number, colIndex: number], Scalar>` — `MAKEARRAY`'s builder.
 * - `Lambda<Scalar[], Scalar>` — variadic, when the arity is decided per call (`MAP`).
 *
 * @typeParam Args The parameter tuple. Defaults to variadic scalars.
 * @typeParam R The return type. Defaults to `Scalar`.
 */
export type Lambda<Args extends readonly any[] = Scalar[], R = Scalar> = (...args: Args) => R;
