/**
 * Declares that a parameter takes ONE argument and receives it UNPACKED into a list.
 *
 * The length comes from the argument's CONTENTS, which is what separates it from every repeating
 * form — there the length comes from the argument COUNT:
 *
 * ```
 * IRR(values: Flatten<number>, guess?: number)   IRR(A1:A5)  → values is [1,2,3,4,5]   ONE argument
 * SUM(number: IRange<number>[])                  SUM(A1:A5)  → number is [IRange]      ONE argument
 * ```
 *
 * ### What "unpacked" means depends on the element type
 *
 * | `T` | the list holds | example |
 * | --- | --- | --- |
 * | a scalar (`number`, `string`, `Scalar`) | the argument's MEMBERS, blanks skipped | `NETWORKDAYS`'s holidays |
 * | a range (`IRange`, `IReferenceRange`) | the argument's AREAS | `INDEX((A1:B2,C3:D4),…)` |
 *
 * Both are the same mechanism at different granularity — the marshaller picks the unit from the
 * element type — and a blank drops out of either. The scalar case is the common one; the range case
 * exists because a reference UNION is a single argument holding several areas: a parameter that does
 * not declare `Flatten` refuses one outright (`#VALUE!` — `TRANSPOSE((A1:A3,C1:C3))`), and a
 * body that declares it answers for the union itself, in one line, the way the built-ins do:
 * `AREAS` counts the areas, `SUM` adds them, `ROWS` answers `#REF!` to more than one, the lookups
 * `#N/A`.
 *
 * At the type level it is `T[]`, so the body reads the list directly.
 *
 * @example
 * ```ts
 * export function IRR(values: Flatten<number>, guess?: number): number { ... }
 * export function NETWORKDAYS(start: Date, end: Date, holidays?: Flatten<Scalar>): number { ... }
 * export function INDEX(array: Flatten<IRange>, rowNum?: number, ...): any { ... }
 * ```
 */
export type Flatten<T> = T[];
