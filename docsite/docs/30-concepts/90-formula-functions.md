---
sidebar_position: 900
title: User Defined Functions
---

Functions enable users to create calculators by enter a value that starts with a `=`, `+`, `-`.
They take inputs, perform operations, and produce outputs.

<!-- TODO - Add a screenshot or a way to open a sheet with ScriptEditor active -->
<!-- :::tip
To see a working example of the included functions use the
[User Defined Functions](https://www.sheetxl.com/examples/udfs) Workbook example.
::: -->

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

Inputs can be any of the following types:

* **Scalar**: `number`, `string`, `boolean`, `Error`, or `RichType`. These represent single values.
* **Range**: `IRange`, `IReferenceRange`. A shaped 2D representation of values.
* **Materialized Ranges**: These are specified with `[]`.

<!-- TODO - Explain IRange (and link to), IReferenceRange and Materialized Ranges -->

:::info
:construction: **RichType** is under development.
:::

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

* **Flattening**: If a parameter expects a lower dimension than provided, The input values will auto flatten.
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

When more than a single value is returned the values will `spill` into adjacent cells.

If multiples are returns as either an array or an `IRange` the result will be shown as a spill.

#### Spill Behavior

* A one-dimensional array will spill horizontally (across columns).
* A two-dimensional array or an `IRange` with multiple rows and columns will spill both horizontally and vertically.
* If the spill area is blocked by existing data or other formulas, A spill error (FormulaError.Spill) will be displayed.

### Async

Functions that perform long-running or asynchronous operation (e.g., fetching data from a network) should return a `Promise<T>` that resolves to the result.

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
 * Simulates a count down clock
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
If the formula is cleared or the sheet is closed the `subscription.unsubscribe()` will be called.
:::

### Volatile

Volatile functions are functions whose results are recalculated on every calculation cycle, even if their inputs haven't changed. This is important for functions like `RAND()`, `NOW()`, and `TODAY()`, which produce different results each time they are called.

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

Functions can throw either `FormulaError` or standard JavaScript Error. Any unhandled or unknown error thrown
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
