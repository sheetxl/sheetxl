---
sidebar_position: 40
title: Resize and Hide Rows and Columns
---

Row heights, column widths, and hidden rows and columns all live on the **headers**, the row numbers
down the left and the column letters across the top. Get them from any range and change a whole run of
rows or columns at once.

Headers hold what applies to entire rows or columns:

* Size (Width/Height)
* Visibility
* Custom Titles

```typescript title="Updating headers"
// Set 4 columns
workbook.getRange('Sheet1!B:E').getColumnHeaders().setSize(120);
// Hide some rows
workbook.getRange('Sheet1!2:20').getRowHeaders().setHidden(true);
```
