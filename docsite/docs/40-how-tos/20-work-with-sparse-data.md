---
sidebar_position: 20
title: Work with Sparse Data
---

Spreadsheets usually contain many empty cells. Ignoring these is critical for performance.

## Reading

Read sparse data by using `ICellRange.entries()` or `ICellRange.forEach()`.

#### Values

The following example shows an iterator finding the total of a set of numbers over a potentially large area.

```typescript title="Add all numbers in a range."
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
  // ignore types that are not a number, and any value not on an even row.
  // rowIndex is 0-based, so index 1 is Excel's row 2.
  if (typeof value === 'number' && entry.context.getCoords().rowIndex % 2 === 1) {
    total += value;
  }
}
console.log('The Total for even rows is: ' + total);
```

## Writing

Write sparse data with `ICellRange.createSparseBuilder()`: push only the cells that have values, then apply them in one update.

## Reading and Writing

This example demonstrates how to use a `SparseBuilder` to efficiently update cells in a
range by copying data from one range to another. This method is particularly useful for sparse
data where only certain cells have values, and updates need to be applied iteratively.

```typescript title="Example: Copying Sparse Data to Another Range"
// Assume we already have an `IWorkbook`.
const sheet: IWorksheet = workbook.getWorksheet();

// Step 1: Get the source range that contains the sparse data to be copied.
//         Here, we assume we are copying data from range 'A1:B3'.
const from: ICellRange = sheet.getRange('A1:B3');

// Step 2: Define the target range where data will be copied.
//         We reposition the target range by moving it to the right of the
//         source range. In this case, we shift the target range to the
//         right by the number of columns in the source range.
const shift = from.getColumnCount();
const to: ICellRange = from.getOffsetBy(0, shift);

// Step 3: Create a `SparseBuilder` for the target range.
//         This updater will allow us to efficiently push updates to the
//         target range as we iterate over the source range.
const builder: ICellRange.SparseBuilder = to.createSparseBuilder();

/**
 * Step 4: Iterate over each cell in the source range and copy the data to the target range.
 *
 * - `forEach`: Visits each cell in the range that has a value.
 * - `context.getCoords()`: The sheet coordinates (row, column) of the current cell.
 *
 *   **Hint:** Coordinates are absolute sheet positions, 0-based, for both the
 *    source cell and the `push` address. To land in the target range, shift
 *    the column by the same amount the range was shifted.
 *
 * - `push`: Adds the data to the target range at the given address.
 */
from.forEach((value, context): void => {
  // Example transformation or action on the value (can be any logic or calculation).
  const valueUpdate = value; // In this case, we're just copying the value without changes.

  const coords = context.getCoords();
  // Push the copied value into the target range at the shifted coordinates.
  builder.push({ rowIndex: coords.rowIndex, colIndex: coords.colIndex + shift }, valueUpdate);
});

/**
 * Step 5: Apply the updates to the target range.
 *
 * - `apply`: Once all updates are pushed, this method applies the changes to the sheet.
 *    This ensures that all updates are executed efficiently and at once,
 *    rather than cell by cell.
 */
builder.apply(); // Finalize and apply all the updates to the target range.
