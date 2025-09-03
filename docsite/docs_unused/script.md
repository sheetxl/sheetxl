---
sidebar_position: 4
title: 🧠 Formula Functions and Macro Functions
description: Formula Functions and Macro Functions
---

## 🧠 Formula Functions and Macro Functions

SheetXL supports two types of functions:

### Formula Function 🧮

A function that returns a value and can be used in a cell formula.

### Macro Function ⚙️

An imperative function that can manipulate workbooks or sheets directly. These
are triggered by an event such as workbook open or by a user action (e.g. 'onOpen', buttons, menu items).

|                  | **Formula Function** 🧮                  | **Macro Function** ⚙️                          |
|------------------|-------------------------------------------|------------------------------------------------|
| **Purpose**      | Compute values                            | Perform actions or side effects                |
| **Used In**      | Formula Calculations                      | Scripting                                      |
| **Return Type**  | `number`, `string`, `Range`, etc.         | `void` or `() => void` (cleanup function)      |
| **Input Types**  | A list of primitives or `IFormulaContext` | A single argument `'IWorkbook'`, `'ISheet'`, `'ICellRange'`, `'ICellRanges'` |
| **Examples**     | `SUM(A1:A3)`, `IF(A1 > 10, "High", "")`   | `onOpen(sheet: ISheet) { sheet.range("A1").setValue("Hello!") }` |

---

### 📌 Formula Function Example

``` ts
export function DOUBLE(input: IRange): IRange {
  return input.map(v => (typeof v === 'number' ? v * 2 : v));
}
```

Used in a spreadsheet cell:

``` ts
=DOUBLE(A1:A3)
```

---

### 📌 Macro Function Example

``` ts
export function clearSheet(sheet: ISheet): void {
  sheet.getUsedRange().clear();
}
```

Used as a macro or button action:

``` ts
workbook.getScripting().executeMacro("clearSheet");
```

---
