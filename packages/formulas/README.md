# @sheetxl/formulas

<p align="center">
  <a href="https://www.sheetxl.com" target="_blank">
    <img src="https://www.sheetxl.com/logo-text.svg" alt="SheetXL Logo" width="180" />
  </a>
</p>

A modern, type-safe library of spreadsheet functions, ready for any JavaScript or TypeScript project.

`@sheetxl/formulas` is the open-source formula library behind SheetXL — built for correctness first and simplicity second.

Every function is validated against Excel, with particular attention to coercion edge cases, empty-cell semantics, and array broadcast behavior that other implementations get wrong.

## Why @sheetxl/formulas?

We needed a formula library that was both **100% Excel-compatible** and **simple to extend** —
without registration boilerplate, engine-coupled types, or separate plumbing for UI, validation, and tooltips.

Seeing is believing. Here's `RANDARRAY` — a function with 5 arguments, dynamic spill output,
volatility tracking, and full UI integration:

| Library      | Lines          | Excel Compatible | UI Integration        |
|--------------|----------------|------------------|-----------------------|
| **SheetXL**  | **30 lines**   | **✓ Yes**        | **Automatic**         |
| LibreOffice  | ~500 lines     | ✓ Excel 2019     | Hardcoded             |
| Univer.ai    | ~400 lines     | ✗ No             | Separate registration |
| HyperFormula | —              | —                | —                     |
| formulajs    | —              | —                | —                     |

### SheetXL

```ts
/**
 * Returns an array of random numbers.
 * @param rows the number of rows in the returned array.
 * @param columns the number of columns in the returned array.
 * @param min the minimum number you would like returned.
 * @param max the maximum number you would like returned.
 * @param integer return an integer or a decimal value. TRUE for an integer, FALSE for a decimal number.
 */
export function RANDARRAY(
  rows: Omittable<number>=1,
  columns: Omittable<number>=1,
  min: Omittable<number>=0,
  max: Omittable<number>=1,
  integer: Omittable<boolean>=false
): Volatile<IRange> {
  if (min > max) return FormulaError.BuiltIn.Value!;
  const whole = integer === true;
  if (whole && (min !== Math.trunc(min) || max !== Math.trunc(max))) return FormulaError.BuiltIn.Value!;

  return FormulaContext.createRange(rows, columns, (): number => {
    // the draw is the runtime's, so a host can seed it; never `Math.random`
    if (!whole) return min + FormulaContext.getRandom() * (max - min);
    // both ends are inclusive here, and the draw never reaches 1
    const value = min + Math.floor(FormulaContext.getRandom() * (max - min + 1));
    return value > max ? max : value;
  });
};
```

No base classes. No value wrappers. No separate UI registration.
The function signature *is* the UI contract.

### Univer

- [Core implementation](https://github.com/dream-num/univer/blob/dev/packages/engine-formula/src/functions/math/randarray/index.ts)
- 6+ Registration entry points

### Libre Office

- [Core implementation](https://github.com/LibreOffice/core/blob/48621c0f0feb52a19c978359cfeb65a14ae2151c/sc/source/core/tool/interpr1.cxx#L1757)
- formula/inc/core_resource.hrc — string resources
- formula/source/core/api/FormulaCompiler.cxx — compiler registration
- include/formula/compiler.hxx and opcode.hxx — opcode declarations
- sc/inc/scfuncs.hrc — UI strings for tooltips/descriptions
- sc/source/core/tool/interpr4.cxx — dispatch table
- sc/source/core/tool/parclass.cxx — parameter class registration
- sc/source/core/tool/token.cxx — token handling
- sc/source/filter/excel/xlformula.cxx — Excel import mapping
- sc/source/filter/oox/formulabase.cxx — OOXML filter

18 files. 4,000+ lines of supporting data. C++ throughout.

## Our Philosophy

This library has a simple goal: Create a complete, correct, and easy to extend set of spreadsheet functions.

### Correctness first, Simple second

1. Every function made available has extensive unit test to ensure 100% compatibility with Excel.

2. Every function is just a simple TypeScript function. No complex spreadsheet boilerplate for type coercion,
array broadcasting, spill handling.

> Unlike competing implementations, array broadcast and spill handling are not only correct but automatic —
> function authors write application logic and the engine handles the rest.

### Completeness

Our plan is to support the complete function sets of **Microsoft Excel** and **Google Sheets**, while also embracing new and useful functions suggested by the community.

> SheetXL has all 545 function and 27 operators.
> Note: SheetXL supports all Excel functions and operators except the Connectivity Functions such as Cube and legacy RTD.

## Design Goals

Functions should be easy to write and allow you to focus on logic not spreadsheet machinery.

### Simple

- Plain type safe functions (auto type coercion).
- Instant UI integration. Dropdowns, tooltips, validation.

### DataScience API

- Vector APIs for fast easy operations on large sets of data. (Inspired by Numpy/Panda).

### Dynamic Arrays

- Range broadcast, spill, error propagation. All handled natively.

### Fast and Secure

- IRange vector API for high performance operators.
- Pure API allows for secure sand-boxing and multithreading.

### Referenceable

- UDFs and Built-in functions are all authored using the same design.
- **Permissively Licensed:** Free to use for any project under the MIT license.

## Installation

```bash
# Using npm
npm install @sheetxl/formulas @sheetxl/primitives

# Using pnpm
pnpm add @sheetxl/formulas @sheetxl/primitives
```

## Special Thanks

Our initial function implementations were borrowed heavily from the great work done on
**[formulajs](https://formulajs.info/)**. We are deeply grateful for their contribution to the community.

## Contributing

When using AI assistance (GitHub Copilot) to implement or modify functions, a scoped instructions file is automatically applied:
[`.github/instructions/formulas.instructions.md`](../../.github/instructions/formulas.instructions.md)

It covers design invariants, coercion rules, dispatch primitives, and testing requirements specific to this package.

## Full list of Excel functions

[Excel functions by category](https://support.office.com/en-us/article/excel-functions-by-category-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb)
