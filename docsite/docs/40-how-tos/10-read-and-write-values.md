---
sidebar_position: 10
title: Read and Write Values
---

The everyday stuff: put values in cells, read them back, clear some, and insert or delete rows and
columns. All of it goes through [ICellRange](https://api.sheetxl.com/interfaces/_sheetxl_sdk.ICellRange.html),
your handle to the live sheet. (Want to compute over values before writing them? See
[Transform Values with IRange](./15-transform-values-with-irange.md).)

### Reading and Writing Values

<strong>[ICellRange.setValues](https://api.sheetxl.com/interfaces/_sheetxl_sdk.ICellRange.html#setvalues)</strong>
and <strong>[ICellRange.getValues](https://api.sheetxl.com/interfaces/_sheetxl_sdk.ICellRange.html#getvalues)</strong>
is used to access values.

`setValues` takes a 2d array of data.

```typescript
// set some values
workbook.getRange('Sheet1!A1:B2').setValues([[100, 200], [300, 400]]);

// get some values
workbook.getRange('Sheet1!A1:C3').getValues();
```

## Clearing or Ignoring Values

The following conventions are used when setting or updating data

This convention allows users to update specific cells within a range without affecting others. If you want to update a subset of cells in a range, you can use undefined for the cells you want to leave untouched.

### Clear using `null`

- When a value is set to `null`, the corresponding cell is **cleared**. This means that any existing content in the cell is removed, and the cell will appear empty after the operation.

### Ignore using `undefined`

When a value is set to `undefined`, the corresponding cell is **ignored**. This means its content remains unchanged. The cell’s previous value is left intact, and no updates are made to that cell.

### Combined Example

In this example:

- 100 and 200 are set in the first row.
- The first cell in the second row is ignored (undefined), leaving its previous value untouched.
- The second cell in the second row is cleared (null), removing any existing value.

|  A1  |  B1  |
| ---  | ---  |
|  10  |  20  |
|  30  |  40  |

```typescript title="Combined Example"
range.setValues([[100, 200], [undefined, null]]);
```

|  A1  |  B1  |
| ---  | ---  |
| 100  | 200  |
|  30  |      |

### Inserting/Removing Cells

Inserting and removing cells or headers (rows/columns) is supported via the ICellRange interface using
<strong>[ICellRange.insert](https://api.sheetxl.com/interfaces/_sheetxl_sdk.ICellRange.html#insert)</strong> and
<strong>[ICellRange.delete](https://api.sheetxl.com/interfaces/_sheetxl_sdk.ICellRange.html#delete)</strong>.

```typescript title="Inserting/Removing Rows/Columns"
// insert column
workbook.getRange('Sheet1!B:E').insert();

// remove row
workbook.getRange('Sheet1!2:2').delete();
```
