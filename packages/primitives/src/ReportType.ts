/**
 * Declares the parameter's type as ADVISORY: the engine delivers it when it can, and hands the
 * body whatever actually arrived when it cannot, instead of answering `#VALUE!` on the body's
 * behalf.
 *
 * @remarks
 * Excel has no marshalling contract. A function there is called with the operands as they are and
 * calls library helpers for whatever it needs — `LARGE` asks for a range's values and gets every
 * area of a union, `ROWS` never dereferences at all and answers `#REF!` when it sees two areas,
 * `SUMPRODUCT` demands one rectangle and fails on the same argument. Three answers, no rule: the
 * body's own access pattern is the whole of it.
 *
 * A declared surface cannot express that, and modelling it would mean a marker per behavior. This
 * is the boundary instead — ONE marker saying "the type is what the caller is told, not a
 * guarantee to the body". The declared `T` still reaches the function help, the wizard and the
 * linter, because that IS what the slot means to a user; it just stops being a gate.
 *
 * | argument | plain `IRange` | `ReportType<IRange>` |
 * | --- | --- | --- |
 * | `A1:A5` | the range | the range |
 * | `(A1:A5,B1:B2)` — a union | `#VALUE!`, the call never runs | the areas, as `IRange[]` |
 * | a value, an error | `#VALUE!` / propagates | the value, the error |
 *
 * At the type level it is `T` — like {@link AcceptError}, and for the same reason: the marker is a
 * RULE, not a type. A body that declares it and then assumes `T` will crash on the argument the
 * marker exists to deliver, so narrow first. {@link IFunctionArguments.getKindAt} is total over
 * what can arrive and {@link IFunctionArguments.getAreaCountAt} answers the union question the
 * kind cannot — a plain reference is one area, a union is more.
 *
 * Its use is meant to stay countable: a slot earns it with a concrete behavior that needs it,
 * never speculatively.
 *
 * @example
 * ```ts
 * export function ROWS(array: ReportType<IRange>): Scalar {
 *   if (FormulaContext.getArgs().getAreaCountAt(0) > 1) return FormulaError.BuiltIn.Ref!;
 *   return array.getRowCount();
 * }
 * ```
 */
export type ReportType<T> = T;
