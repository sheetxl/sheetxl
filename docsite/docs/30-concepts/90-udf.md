---
sidebar_position: 900
title: User-Defined Functions
---

User-Defined Functions (UDFs) let you extend SheetXL with your own logic — with full type safety, async support,
and the ability to operate efficiently on entire ranges.

UDFs can perform any calculation, fetch data, or manipulate ranges directly within a cell.

Define them in TypeScript, and they’re instantly available alongside built-in functions —
simply enter them using standard formula syntax (`=`, `+`, or `-`).

<!-- TODO - Add a screenshot or a way to open a sheet with ScriptEditor active -->
<!-- :::tip
To see a working example of the included functions use the
[User-Defined Functions](https://www.sheetxl.com/examples/udfs) Workbook example.
::: -->

:::info
While we use the term *User-Defined Functions* to align with the industry standard, All SheetXL built-in functions are defined using the same API and are made freely available at **[formulas source](https://github.com/sheetxl/sheetxl/tree/main/packages/formulas)**.
:::

```ts title="Simple"
/**
 * Add 2 numbers.
 * @summary Add two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

## Inputs (*parameters*)

### Type

Inputs are strong typed, but automatically **coerced** at runtime when values come from the sheet.
This allows spreadsheet users to pass mixed cell types while still benefiting from TypeScript-level type checking during development.

| Type | Description |
|------|--------------|
| [Scalar](https://api.sheetxl.com/types/_sheetxl_primitives.Scalar.html) | Represents a single value. `number`, `string`, `boolean`, `Error`, `Date`, or `IRichType`. |
| [IRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IRange.html) | A lightweight, lazy reference to a rectangular block of values. Efficient for iteration or mapping. |
| [IReferenceRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IReferenceRange.html) | A range with coordinates (used in dynamic functions such as `INDIRECT` or `SUMIF`). |
| **Materialized Range** | `T[][]` – An explicit, fully realized array of cell values. |

:::caution Performance
Materialized ranges (`T[][]`) should be **avoided** in favor of [IRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IRange.html) whenever possible.
[IRange](https://api.sheetxl.com/interfaces/_sheetxl_primitives.IRange.html) streams values directly from the workbook
without materializing them, skips empty values, and provides significant performance and memory benefits — especially
for large or sparse data.
:::

:::info
:construction: **RichType** is under development.
:::

### Coercion Rules

When a spreadsheet value is passed into a UDF, SheetXL will attempt to **coerce** it into the declared parameter type.

* **Numeric coercion** – Strings like `"42"` or `"3.14"` are converted to numbers where applicable.
* **Boolean coercion** – Non-zero numbers become `true`; zero becomes `false`.
* **Range coercion** – Single-cell ranges are automatically unwrapped to their scalar value.
* **Empty values** – Empty cells become `undefined` unless a default or optional parameter handles them.
* **Date values** - Numeric serials and parsable strings are converted to `Date` objects on input, and formatted numbers on output.
* **Error propagation** – If a referenced cell contains a `FormulaError`, it is passed through unmodified.

### Optional

1. Using `?`: Append a question mark (`?`) to the parameter name. This indicates that the parameter can be undefined.

``` ts title="Optional Parameter"
/**
 * Return Hello message
 * @param who Who is saying hello.  If omitted, defaults to "World".
 */
export function hello(who?: string): string {
  return 'Hello ' + (who ?? 'World'); // Use nullish coalescing operator
}
```

:::note
When using optional parameters, your function logic should handle the possibility of `undefined` values.
:::

2. Providing a Default Value: Assign a default value to the parameter in the function signature.

``` ts title="Default value"
/**
 * Return Hello message
 * @param who Who is saying hello
 */
export function hello(who: string='World'): number {
  return 'Hello ' + who;
}
```

### Dimensionality

Parameters can have various levels of dimensionality, from single scalar values to repeating range unions.

#### Parameter Dimensions

* **Scalar (0D):** A single value, (e.g. a number or text).
* **List (1D):** A linear array of values.
* **Range (2D):** A rectangular block of cells within the spreadsheet (e.g., `A1:C5`).
* **Range Union (3D):** A collection of multiple ranges combined (e.g., `(A1:B2, C3:D4)`).
* **Repeating Parameters (4D):** When a function uses `Repeating` or a rest parameter (`...`).

When the input's dimensionality differs from what the function expects, the input will be either flattened or wrapped.

* **Flattening**: If a parameter expects a lower dimension than provided, The input values are automatically flattened.
  * **Scalar (Single Value) Parameters**  Can only be flatten if exactly one value is provided.
  * **Empty cells or ranges** Are excluded from the flattened result.
  * **Duplicate cells** Are preserved; no deduplication occurs.
  * **Order** Values are always row-major (left-to-right, top-to-bottom).

* **Wrapping**: If a parameter expects a higher dimension, inputs will be wrapped in additional arrays until the dimensions match.

**Example:**

Consider a function defined as `SUM(...values: number[])`. This function expects a 1D list of numbers. A formula
input of `=SUM(A1:B2, (C3:D4, E5), F6)` will be flatten using the following steps:

1. Extract all numerical values from `A1:B2`, `C3:D4`, `E5`, and `F6`.
2. Create a single 1D list of these numbers, maintaining row-major order.
3. Pass this flattened list to the `SUM` function.

This allows you to use the `SUM` function with various range configurations without manually converting them to a 1D list.

### Variadic

When the number of parameters can vary, use the `...` rest parameter syntax. This creates an array of the remaining arguments.

``` ts title="Variadic Parameter"
/**
 * Add multiple numbers.
 *
 * @summary Add multiple numbers
 * @param a The first number.
 * @param b Additional numbers to add.
 */
export function add(a: number, ...b: number[]): number {
  let sum = a;
  for (const num of b) {
    sum += num;
  }
  return sum;
}
```

Example Usage:

``` excel
=ADD(1, 2, 3, 4) ( a will be 1, b will be [2, 3, 4])
```

``` excel
=ADD(5) ( a will be 5, b will be [])
```

## Output (*return*)

Functions must return a single value.

* **Scalar**:  `number`, `string`, `boolean`, `Error`.
* **Array**: An array of any primitive types.

### Ranges

If an `Array` or an `IRange` container more than once value is returned, the values will `spill` into adjacent cells.

#### Spill Behavior

* A one-dimensional array will spill horizontally (across columns).
* A two-dimensional array or an `IRange` with multiple rows and columns will spill both horizontally and vertically.
* If the spill area is blocked by existing data or other formulas, A spill error (FormulaError.Spill) will be returned.

### Async

Functions that perform long-running or asynchronous operations (e.g., fetching data from a network) should return a `Promise<T>` that resolves to the result.

``` ts title="Async"
/**
 * Simulates a delayed calculation.
 *
 * @summary Returns a number after a delay
 * @param value The input value.
 */
export async function delayedCalculation(value: number): Promise<number> {
  // Simulate a delay of 1 second
  await new Promise(resolve => setTimeout(resolve, 1000));
  return value * 2;
}
```

:::tip
The `async` keyword is not required but makes developing asynchronous functions much easier.
:::

### Streaming

For functions that need to update their output continuously (e.g., a real-time stock ticker, a countdown timer), you can return an `Observable<T>`.

``` ts title="Streaming Countdown"
/**
 * Simulates a countdown clock
 *
 * @param start The start amount
 * @param increment The amount to tick down by
 * @param delay The time in milliseconds to delay.
 */
export function countDown(start: number, increment: number=1, delay: number=1000): Observable<number> {
  return new Observable((subscriber: Subscriber<number>) => {
    let current = start;
    let timeoutId: any; // store to support clear.

    function tick() {
      if (subscriber.closed) {
        return; // Stop emitting values
      }

      subscriber.next(current);
      current -= increment;

      if (current <= 0) {
        subscriber.complete();
      } else {
        timeoutId = setTimeout(tick, delay); // Store the timeout ID to close
      }
    }

    tick(); // start

    // Return a teardown function. - Not required.
    return () => {
      clearTimeout(timeoutId); // Clear the timeout
    };
  });
}
```

:::info
If the formula is cleared or the sheet is closed, the `subscription.unsubscribe()` will be called.
:::

### Volatile

Volatile functions are recalculated on every computation cycle, even if their inputs haven't changed.
This is behavior is used for functions like `RAND()`, `NOW()`, and `TODAY()`, which produce new results each time they run.

To mark a function as volatile, add the `@volatile` tag to its comment:

``` ts title="Volatile function"
/**
 * Returns a random value from a list
 * @summary Returns a random value from the provided list
 */
export function randomValue(value: ScalarType[]): Volatile<ScalarType> {
  if (value.length === 0) {
    return null; // or perhaps throw FormulaError.Value;
  }
  return value[Math.floor(Math.random() * value.length)];
}
```

## Errors

Functions can throw either `FormulaError` or standard JavaScript Error. Any unhandled or unknown error
will be wrapped as a `FormulaError.Value`.

``` ts title="Throwing an error"
/**
 * Divides two numbers
 *
 * @summary Returns divided number
 */
export function divide(a: number, b: number): number {
  if (b === 0) throw new SheetXL.FormulaError.DIV0();
  return a/b;
}
```

Errors can also be returned using special JavaScript number values.

| JavaScript Value | FormulaError Type |
|------|--------------|
| Number.NaN | FormulaError.BuiltIn.Num |
| Infinity | FormulaError.BuiltIn.Div0 |
