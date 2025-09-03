---
sidebar_position: 40
title: Understanding Sparse Data (Vector vs. Scalar)
---

Spreadsheets usually contain many empty cells. Ignoring these is critical for performance.

## Reading

Read sparse data by using `ICellRange.entries()` or `ICellRange.forEach()`.

#### Values

The following examples shows an iterator finding the total value of a set of number over a potentially large area.

```typescript title="Add all number is a range."
let total: number = 0;
// This will only visit cells that have values.
for (const value of sheet.getRange('A1:Z300')) {
  // ignore types that are not a number.
  if (typeof value === 'number') {
    total += value;
  }
}
console.log('The Total is: ' + total);
```

#### Cell Data

There are times when visiting values more options are needed. In this case `ICellRange.entries()` and
`ICellRange.forEach()` have `ICellRange.IteratorOptions` and provide a `ICell.IteratorContext` that can be used to get the cell information.

Using the previous example we use the context to only process even rows.

```typescript title="Total only numbers on even rows."
let total: number = 0;
const range = sheet.getRange('A1:Z300');
// This will only visit cells that have values.
for (const entry of range.entries()) {
  const value:Scalar = entry.value;
  // ignore types that are not a number. and any value not on an even row.
  if (typeof value === 'number' && entry.context.getCoords().rowIndex % 2) {
    total += value;
  }
}
console.log('The Total for event row is: ' + total);
```

## Writing

Write sparse data by either using `ICellRange.startIncrementalUpdates()` or creating `Tuples`.

## Reading and Writing

This example demonstrates how to use an `IncrementalUpdater` to efficiently update cells in a
range by copying data from one range to another. This method is particularly useful for sparse
data where only certain cells have values, and updates need to be applied iteratively.

```typescript title="Example: Copying Sparse Data to Another Range"
// Assume we already have an `IWorkbook`.
let sheet: ISheet = workbook.getSelectedSheet();

// Step 1: Get the source range that contains the sparse data to be copied.
//         Here, we assume we are copying data from range 'A1:B3'.
const from: ICellRange = sheet.getRange('A1:B3');

// Step 2: Define the target range where data will be copied.
//         We reposition the target range by moving it to the right of the
//         source range. In this case, we shift the target range to the
//         right by the number of columns in the source range.
const to: ICellRange = from.offsetBy(0, from.getColumnCount());

// Step 3: Create an `IncrementalUpdater` for the target range.
//         This updater will allow us to efficiently push updates to the
//         target range as we iterate over the source range.
//
//         Here, we use `startIncrementalUpdates` to work with sparse data efficiently.
const updates: ICellRange = to.startIncrementalUpdates();

/**
 * Step 4: Iterate over each cell in the source range and copy the data to the target range.
 *
 * - `forEach`: Iterates through each cell in the range.
 * - `context.getCoords()`: Retrieves the coordinates (row, column) of the
 *    current cell being iterated.
 *
 *   **Hint:** The coordinates retrieved by `context.getCoords()` are relative
 *    to their respective ranges.
 *    This means you can use them directly in the target range without needing
 *    to apply any transformations.
 *
 * - `push`: Adds the data to the target range based on the context's coordinates.
 */
from.forEach((value, context): void => {
  // Example transformation or action on the value (can be any logic or calculation).
  let valueUpdate = value; // In this case, we're just copying the value without changes.

  // Push the copied value into the target range at the corresponding coordinates.
  updates.push(context.getCoords(), valueUpdate);
});

/**
 * Step 5: Apply the updates to the target range.
 *
 * - `apply`: Once all updates are pushed, this method applies the changes to the sheet.
 *    This ensures that all updates are executed efficiently and at once,
 *    rather than cell by cell.
 */
updates.apply(); // Finalize and apply all the updates to the target range.
