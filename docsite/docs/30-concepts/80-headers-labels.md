---
sidebar_position: 80
title: Headers & Labels
---


### Reading or Updating Headers

Headers contain information that is applied to entire rows or columns such as:

* Size (Width/Height)
* Visibility
* Custom Titles

```typescript title="Updating headers"
// Set 4 columns
workbook.getRange('Sheet1!B:E').getColumnHeaders().setSize(120);
// Hide some rows
workbook.getRange('Sheet1!2:20').getRowHeaders().setHidden(true);
```
