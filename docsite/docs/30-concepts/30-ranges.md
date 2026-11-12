---
sidebar_position: 30
title: The (Data) Science of SheetXL
---

SheetXL is a spreadsheet **and** a data science library, built on one engine.

Most tools give you one or the other. A spreadsheet API can drive a sheet, but crunching a million values
through it cell by cell is slow and clumsy. NumPy and pandas crunch numbers beautifully, but they know
nothing about cells, formats, formulas, or undo. SheetXL gives you both, as two kinds of range:

| Range | Inspired by | Its job |
| --- | --- | --- |
| **`ICellRange`** | Spreadsheets (Excel, Office Scripts) | Work with the live sheet: values, formulas, styles, rows and columns. |
| **`IRange`** | Data science (NumPy, pandas) | Compute over values: fast, in memory, and side-effect free. |

## Two ranges, one engine

Two ranges, but **one engine** underneath. The code that calculates your formulas is the same code that
runs your `IRange` work. Every built-in Excel function is written against `IRange`, the same API you use.
So your data code gets spreadsheet rules (how text becomes a number, how errors and blanks behave) for
free, and your formulas get data-science speed.

## If you know Excel's `Range`, you know `ICellRange`

`ICellRange` is what Excel and Office Scripts call `Range`: your handle to a block of cells on a sheet.
It knows which sheet it's on and how to commit a change. Set a value, restyle it, or insert a row
through it, and the sheet updates, listeners hear about it, and the user can undo it.

```ts
const prices = workbook.getRange('Inventory!B2:B100');
prices.setValues([[10], [20], [30]]);
prices.getStyle().update({ fill: 'accent1' });
```

So why isn't it just called `Range`? Because in SheetXL a plain *range* is something simpler: a block of
values, the thing formulas compute with. A *cell* range is a range that lives on a sheet.

> Studio, our full spreadsheet UI, is built entirely on `ICellRange`.

## If you know NumPy, you know `IRange`

`IRange` is a two-dimensional array of spreadsheet values. It has no idea a sheet exists, which is
exactly what makes it good at math:

- **Immutable.** `map()`, `filter()`, `resize()` and friends return a new `IRange` and never change the
  original, so you can chain freely and nothing touches the sheet by accident.
- **Vectorized.** Operations run over whole columns at once, not cell by cell, and broadcast like NumPy
  when shapes differ.
- **Cheap to reshape.** Most reshaping, like `broadcast()` or `repeat()`, shares data instead of copying
  it.
- **Portable.** No sheet means no environment. The same code runs in a browser, in Node, or in a Web
  Worker.

> Formula functions, built-in and your own, only ever see `IRange`.

## Built for mostly-empty data

Real spreadsheets are mostly empty. Column `A:A` is a million cells; maybe two hundred hold anything.
SheetXL never makes you pay for the other 999,800.

Both ranges are **sparse**: you only ever touch the cells that hold something.

- **Reading.** `values()`, `entries()` and `forEach()` skip empty cells, so a loop over a whole column
  costs what's in it, not how big it is.
- **Computing.** `IRange` math visits stored values only. Empty cells follow spreadsheet rules (the same
  idea as a pandas `SparseArray`), so the answer is the same as if you'd visited every cell.
- **Writing.** A sparse builder pushes just the cells that change and applies them in one update.

When you *do* want every cell, ask for it: `getValues()` hands back a full 2D array, and the iterators
take `includeEmpty: true`. That's perfect for a 10×10 table and expensive for a whole column, so reach for
it on purpose.

## Whole ranges first, single values when you need them

Both ranges are built for working on all of their values at once, and both let you drop to a single value
when you need one: `getValue()` on a cell range, `getValueAt(row, col)` on an `IRange`. They also share the
same verbs where they overlap (`values()`, `entries()`, `forEach()`, `getStats()`, sparse builders), so
moving between them feels familiar.

## Read, compute, write

The two kinds of range meet in a simple pattern:

1. **Read** from the sheet with an `ICellRange`.
2. **Compute** on its values as an `IRange`. `getValuesRange()` hands them to you.
3. **Write** the result back with `setValues()`, which takes an `IRange` directly.

```ts
const cells = workbook.getRange('Inventory!B2:B100');

const withTax = cells.getValuesRange()   // ICellRange → IRange
  .toType('number')
  .map(v => v * 1.1);

cells.setValues(withTax);                // IRange → back onto the sheet
```

Because that's so common, `setComputedValues()` does all three in one call. You get the `IRange`, return
a new one, and it's written back:

```ts
cells.setComputedValues(r => r.toType('number').map(v => v * 1.1));
```

## Where to next

- [Transform Values with IRange](../40-how-tos/15-transform-values-with-irange.md): broadcasting,
  masking, sparse updates, and reusable transforms, side by side with the `ICellRange` way.
- [Work with Sparse Data](../40-how-tos/20-work-with-sparse-data.md): loops that visit only the cells
  that hold something.
- [Read and Write Values](../40-how-tos/10-read-and-write-values.md): the everyday `ICellRange` calls.
- [Write a Custom Function (UDF)](../40-how-tos/60-write-a-custom-function.md): where `IRange` is the
  whole API.
