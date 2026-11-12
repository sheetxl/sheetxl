---
sidebar_position: 15
title: Transform Values with IRange
---

`IRange` is where you do the math: reshape, filter, and fill values without touching the sheet until
you're ready. If the difference between `ICellRange` and `IRange` is new to you, read
[The (Data) Science of SheetXL](../30-concepts/30-ranges.md) first. It's short.

Each example below shows the `IRange` way, and the `ICellRange` way where there is one. See the
[API Reference](https://api.sheetxl.com) and [Examples Gallery](https://api.sheetxl.com/examples) for
everything else.

## Get an `IRange` and put it back

```ts
// From the sheet
const values: IRange = cellRange.getValuesRange();

// ...transform it...

// Back to the sheet: setValues takes an IRange as happily as a 2D array
cellRange.setValues(values);
```

Or do the round trip in one call with `setComputedValues()`. Return a new `IRange` and it's written
back. The options make it a single, named undo step:

```ts
// Tile the selected values 3 down and 2 across
workbook.getSelectedRange().setComputedValues(
  r => r.repeat(3, 2),
  { autoSelect: true, description: 'Tile Values' }
);
```

## Set values

```ts
// ICellRange: writes to the sheet right away
cellRange.setValues([[1, 2, 3]]);

// IRange: returns a new range with those values; nothing else changes
const result = range.replace([[1, 2, 3]]);
```

`replace()` overlays values onto the range at an offset; it doesn't resize it. Start from a range of
the shape you want.

## Broadcast and mask

`IRange` does NumPy-style broadcasting. `repeat()` repeats values to fill a bigger shape, and `mask()`
picks, cell by cell, between two ranges based on a boolean condition (like `np.where`):

```ts
const result = range
  .replace([[1, 2, 3]])
  .repeat(3, 1)              // repeat(rows, cols): 1×3 becomes 3×3
  .mask(condition, ifTrue);  // condition: IRange<boolean>; ifTrue supplies the value where it holds
```

## Update a few cells in a big range

When only a handful of cells change, don't rewrite the whole range. Push just the changes:

```ts
// ICellRange: addresses are sheet addresses ('A1')
cellRange.createSparseBuilder()
  .push('A1', 2)
  .push('A2', 567)
  .apply();   // writes to the sheet

// IRange: coordinates are (row, col), zero-based from the range's top-left corner
const updated = range.sparseBuilder()
  .pushAt(0, 0, 2)
  .pushAt(1, 0, 567)
  .build();   // returns a new range
```

## Reuse a transform

An `IRange` transform is just a function, so write it once and use it anywhere: on a sheet, in a
custom function, or in a test.

```ts
const applyDefaults = (r: IRange): IRange =>
  r.replace([[1, 2, 3]]).repeat(3, 1);

// On the sheet
cellRange.setComputedValues(applyDefaults);

// On a standalone IRange, no sheet involved
const result = applyDefaults(range);
```

## Putting it together

Add 10% tax to a column of prices, treating text as numbers where it can and blanks as zero:

```ts
const priceCells = workbook.getRange('Inventory!B2:B100');

priceCells.setComputedValues((data: IRange) =>
  data
    .toType('number')      // coerce, the way a formula would
    .map(v => v * 1.10)    // apply tax
    .fillEmpty(0)          // fill the gaps
);
```

## See also

- [Work with Sparse Data](./20-work-with-sparse-data.md): reading only the cells that have values.
- [Write a Custom Function](./60-write-a-custom-function.md): functions receive and return `IRange`.
