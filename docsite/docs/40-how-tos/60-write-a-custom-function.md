---
sidebar_position: 60
title: Write a Custom Function (UDF)
---

User-Defined Functions (UDFs) let you extend SheetXL with your own logic — with full type safety, results that
arrive later, and the ability to operate efficiently on entire ranges.

UDFs can perform any calculation, fetch data, or read ranges directly within a cell.

Define them in TypeScript, and they’re available alongside the built-in functions — call them from any formula
(a value starting with `=`, `+`, or `-`).

<!-- TODO - Add a screenshot or a way to open a sheet with ScriptEditor active -->
<!-- :::tip
To see a working example of the included functions use the
[User-Defined Functions](https://www.sheetxl.com/examples/udfs) Workbook example.
::: -->

:::info
While we use the term *User-Defined Functions* to align with the industry standard, all SheetXL built-in functions are
defined using the same API and are freely available at **[formulas source](https://github.com/sheetxl/sheetxl/tree/main/packages/formulas)**.
They are the best reference for any pattern on this page.
:::

```ts title="Simple"
/**
 * Adds two numbers.
 *
 * @param a The first number.
 * @param b The second number.
 */
export function addTwo(a: number, b: number): number {
  return a + b;
}
```

Every exported function in a script becomes a formula function. Its JSDoc is its help: the description and the
`@param` lines are what the formula bar shows while typing.

### Naming

A function is called by its own name, case-insensitively. Use `@name` to register it under another one — a name
with a dot, or one that would otherwise read as a cell address (`ROW3`, `FY2024`):

```ts title="@name"
/**
 * Adds two numbers.
 * @name ADD.TWO
 */
export function addTwo(a: number, b: number): number {
  return a + b;
}
```

A built-in function's name cannot be taken: `ADD` and `DIVIDE` are built-ins, so `add` and `divide` are refused.

## Inputs (*parameters*)

### Type

Inputs are strongly typed, and **coerced** at runtime when values come from the sheet. Spreadsheet users can pass
mixed cell types while you still get TypeScript checking during development.

| Type | Description |
|------|--------------|
| `number`, `string`, `boolean` | A single value, coerced to the type. |
| `Date` | A single value read as a date: serial numbers and date text become `Date` objects. |
| [Scalar](https://api.sheetxl.com/types/_sheetxl_primitives.Scalar.html) | A single value of any type, uncoerced: `number`, `string`, `boolean`, `FormulaError`, `IRichData`, or `null` for a blank. |
| [IRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IRange.html) | A lightweight, lazy, rectangular block of values. `IRange<number>` reads its values as numbers. |
| [IReferenceRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IReferenceRange.html) | A range that also knows where it is (its sheet and coordinates), for functions such as `ROW` or `OFFSET`. |
| `Lambda` | A function value, as `LAMBDA` makes. See the built-in `BYROW` or `MAP`. |

:::tip Performance
Prefer [IRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IRange.html) for anything that may be large.
It reads directly from the workbook without copying, skips empty cells as you iterate (`values()`), and answers
aggregates through `getStats()`. Call `getValues()` only when you truly need a
materialized 2D array.
:::

### Coercion Rules

When a spreadsheet value is passed into a UDF, SheetXL coerces it to the declared parameter type, the way Excel
does for its own functions:

| From | to `number` | to `string` | to `boolean` |
| --- | --- | --- | --- |
| A number | itself | its text | `true` unless `0` |
| Numeric text (`"42"`) | the number | itself | `#VALUE!` |
| Other text | `#VALUE!` | itself | `#VALUE!` unless `"TRUE"` / `"FALSE"` |
| A boolean | `1` / `0` | `"TRUE"` / `"FALSE"` | itself |
| A blank cell | `0` | `""` | `false` |

* **Errors** – An error argument (`NA()`, a cell holding `#N/A`) is the call's result: the function is not called,
  and the error keeps its identity. See [Errors](#errors) to receive errors instead.
* **Ranges** – A multi-cell range passed to a single-value parameter is **lifted**: the function is called once per
  cell and the results spill. `=DOUBLE(A1:A3)` spills three results. A one-cell range is just its value.
* **Unions** – A union of ranges (`(A1:B2, C3:D4)`) is `#VALUE!` at a parameter unless it is declared as a list
  (`Flatten<IRange>`), which receives each area.

### Optional

There are two ways to make a parameter optional.

1. Using `?`: append a question mark to the parameter name. The parameter is `undefined` when the argument is left
   out.

``` ts title="Optional Parameter"
/**
 * Returns a hello message.
 * @param who Who is saying hello. If omitted, "World".
 */
export function hello(who?: string): string {
  return 'Hello ' + (who ?? 'World');
}
```

2. Providing a default value in the function signature:

``` ts title="Default value"
/**
 * Returns a hello message.
 * @param who Who is saying hello.
 */
export function hello(who: string = 'World'): string {
  return 'Hello ' + who;
}
```

:::note
Only a **left-out** argument is `undefined`. A reference to a blank cell is still an argument, and is coerced like
any other (`""` for a `string`): `=HELLO(A1)` with `A1` blank returns `"Hello "`.
:::

### Lists and Variadic

A parameter typed as an array receives **one or more** arguments as a single list. A rest parameter (`...`) receives
**zero or more**:

``` ts title="Variadic Parameter"
/**
 * Adds numbers.
 *
 * @param a The first number.
 * @param b Additional numbers to add.
 */
export function addAll(a: number, ...b: number[]): number {
  let sum = a;
  for (const num of b) {
    sum += num;
  }
  return sum;
}
```

``` excel
=ADDALL(1, 2, 3, 4)    a is 1, b is [2, 3, 4]
=ADDALL(5)             a is 5, b is []
=ADDALL(1, A1:A2, 3)   a is 1, b is [A1, A2, 3]
```

A list of single values (`number[]`, `...number[]`) is **flattened**, the way `SUM` reads its arguments:

* Every value of every range argument is included, in row-major order (left to right, then top to bottom).
* Blank cells are skipped, and so are cell values that are not of the list's type — a `number[]` skips text and
  booleans in cells.
* Values typed directly into the formula are coerced: `=ADDALL(1, "2", TRUE)` is `4`.

A list of ranges (`IRange[]`) receives each argument as its own range instead, which is what the built-in `SUM`
declares (`IRange<number>[]`) to aggregate without copying.

:::tip
`Repeating<[a: A, b: B]>` declares a group of arguments that repeats, the way `SUMIFS` takes
`criteriaRange, criteria` pairs. See the built-in `SUMIFS`.
:::

## Output (*return*)

Functions return a single value:

* **Scalar**: `number`, `string`, `boolean`, `Date`, or `FormulaError`. `null` reads as a blank (shown as `0`, as a
  reference to a blank cell is).
* **Array** or **IRange**: values that spill.

A returned `Date` is written as a date serial number, and the cell is given a date format.

### Ranges

When an array, or an `IRange` with more than one value, is returned, the values **spill** into adjacent cells.

* A one-dimensional array spills across (columns).
* A two-dimensional array (`T[][]`, rows of columns) or a multi-cell `IRange` spills across and down.
* If the spill area is blocked by existing data or other formulas, the result is `#SPILL!`.

### Async

A function whose result arrives later (a `fetch`, a slow service) does not return a `Promise`. It calls
`FormulaContext.defer(executor, payload)` and returns an ordinary value, which is what the cell shows until the
result lands. The *executor* is a module-level function the engine invokes **once at the end of the recalculation
with every call made against it**, so a column of a thousand cells is one invocation, and the executor decides how
many requests that becomes.

``` ts title="Async"
import { FormulaContext, type IFormulaContext, FormulaError } from '@sheetxl/primitives';

/** Runs once per recalculation with every GEOCODE call issued in it. */
function runGeocode(
  calls: readonly IFormulaContext.DeferredCall<string>[],
  ctx: IFormulaContext.IDeferContext
): void {
  for (const call of calls) {
    ctx.fetch(`https://api.example.com/geocode?q=${encodeURIComponent(call.payload as string)}`)
      .then((r) => r.ok ? r.text() : Promise.reject(FormulaError.BuiltIn.NA))
      .then((coords) => call.resolve(coords), (e) => call.reject(e));
  }
}

/**
 * The coordinates of an address.
 *
 * @param address The address to look up.
 */
export function GEOCODE(address: string): string {
  const last = FormulaContext.defer(runGeocode, address) as string | undefined;
  return last ?? 'Locating…'; // what the cell shows while it waits
}
```

What to know:

* **The returned value is an input.** Every formula over the cell calculates from it until the result lands: return
  `FormulaError.BuiltIn.Busy` (`#BUSY!`) when dependents should see an error, as Excel's do, or text when
  `'Locating…'` is what they should show. The cell reads as `Pending` and its dependents as `Waiting`
  (`ICell.getCalculationStatus()`) until then.
* **`defer` returns the last answer** when the same question is asked again by a recalculation, and `undefined` the
  first time. Return it to keep showing the old answer while the new one is fetched.
* **The payload is the call's whole input.** The executor runs after the recalculation with no cell, so pass it
  everything it needs. It is also how a recalculation recognizes the same question: a call still waiting with an
  equal payload is left alone.
* **Use `ctx.fetch`, not the global `fetch`.** It goes through the workbook: the host's authentication, a
  per-session cache (a recalculation does not fetch again), and *Data › Refresh All*
  (`calculate({ external: true })`), which does.
* **Settle each call itself** (`resolve` / `reject`), never by its position in a response. A rejected `FormulaError`
  is shown as itself; anything else as `#VALUE!`.
* **One request per question**: `ctx.byPayload(calls, answer)` groups the calls by payload and runs `answer` once
  per distinct payload with the calls that asked it. When `answer` throws, that group's unsettled calls fail with
  the error and the other groups carry on.
* **Cancellation**: `call.onCancel(fn)` runs when the result is no longer wanted (the cell was cleared, or
  *Cancel Refresh*). Pass an `AbortController`'s signal to the fetch.
* **State** across recalculations (a page counter, a byte cache) lives in `ctx.getState(init)`, not in your module,
  and holds data, not connections.
* A `Promise<T>` return on a formula function is a compile error; a macro may still be `async`.

:::tip
Prefer one formula that answers many results (`=DADJOKES(100)` returning a `string[][]` that spills) over a
function copied down a hundred rows: one request instead of a hundred calls.
:::

#### Waiting for results

A recalculation returns before its async calls are answered: `calculate()` and `ready()` resolve with each pending
cell showing what its function returned. The calculation has the rest:

| | |
| --- | --- |
| `whenPendingDone({ timeout })` | Resolves once nothing is pending and every answer has been calculated into the workbook, including calls a first answer causes. `false` if the timeout (30 seconds by default) comes first. Excel's `CalculateUntilAsyncQueriesDone`. |
| `getPendingCount()` | How many calls are waiting for an answer. |
| `calculate({ external: true })` | *Data › Refresh All*: what the calls fetch is read from the source again, not the workbook's cache. Add `full: true` to call every function, not only the out-of-date ones. A call still running is left alone. |
| `cancelAsync({ range, scope })` | *Cancel Refresh*: the calls in the range or on the sheet (every call when absent) stop waiting, and each function's `onCancel` runs. A cell keeps what it showed; a later answer is dropped. |

``` ts title="Waiting for every answer"
const calculation = workbook.getCalculation();
sheet.getRange('B2').setFormula('=GEOCODE(A2)');
if (await calculation.whenPendingDone({ timeout: 10_000 })) {
  console.log(sheet.getRange('B2').getValue()); // the coordinates
} else {
  await calculation.cancelAsync();              // give up on what is still out
}
```

### Volatile

Volatile functions are recalculated on every calculation, even if their inputs haven't changed. This is how
`RAND()`, `NOW()`, and `TODAY()` produce new results each time.

Declare it on the return type with `Volatile<T>`:

``` ts title="Volatile function"
import { FormulaContext, type Volatile } from '@sheetxl/primitives';

/**
 * Returns a random number between two numbers.
 *
 * @param bottom The smallest number.
 * @param top The largest number.
 */
export function randomBetween(bottom: number, top: number): Volatile<number> {
  return bottom + Math.floor(FormulaContext.getRandom() * (top - bottom + 1));
}
```

Use `FormulaContext.getRandom()` and `FormulaContext.getNow()` rather than `Math.random()` and `Date.now()`: they come
from the calculation, so a test can seed them.

## Errors

Return or throw a `FormulaError` to answer with an error. Anything else thrown is shown as `#VALUE!`.

``` ts title="Throwing an error"
import { FormulaError } from '@sheetxl/primitives';

/**
 * Divides two numbers.
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) throw FormulaError.BuiltIn.Div0;
  return a / b;
}
```

A number result that is not finite is an error too:

| JavaScript Value | Result |
|------|--------------|
| `NaN` | `#NUM!` |
| `Infinity`, `-Infinity` | `#NUM!` |

An error **argument** never reaches your function: the error is the call's result (see
[Coercion Rules](#coercion-rules)). To receive it — as `IFERROR` and `ISERROR` do — declare the parameter
`AcceptError<T>` and test it with `FormulaError.isError`:

``` ts title="Receiving an error"
import { FormulaError, type AcceptError, type Scalar } from '@sheetxl/primitives';

/**
 * Returns the value, or a fallback if it is an error.
 */
export function orElse(value: AcceptError<Scalar>, fallback: Scalar): Scalar {
  return FormulaError.isError(value) ? fallback : value;
}
```

Errors *inside* a range argument are always passed to you as values; `range.hasError()` and `range.firstError()`
find them.
