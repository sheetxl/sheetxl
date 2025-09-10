# @sheetxl/formulas

<p align="center">
  <a href="https://www.sheetxl.com" target="_blank">
    <img src="https://www.sheetxl.com/logo-text.svg" alt="SheetXL Logo" width="180" />
  </a>
</p>

A modern, type-safe library of spreadsheet functions, ready for any JavaScript or TypeScript project.

`@sheetxl/formulas` is the official open-source function library for [SheetXL](https://www.sheetxl.com).
It is designed to be robust, easy to use, and compatible with popular spreadsheet applications.

## Our Philosophy

This library has a simple goal: to create a comprehensive set of spreadsheet functions written in TypeScript.

Our implementation is heavily inspired by and derived from the great work done on
**[formulajs](https://formulajs.info/)**. We are deeply grateful for their contribution to the community and aim to build upon that foundation with a modern, type-safe architecture.

Our plan is to support the complete function sets of **Microsoft Excel** and **Google Sheets**, while also embracing new and useful functions suggested by the community.

## Key Features

* **Comprehensive:** Growing support for Math, Text, Logical, Financial, and Lookup functions.
* **TypeScript First:** Written from the ground up in TypeScript for robust type safety.
* **Vector Optimized:** Functions are designed to leverage the vector API of `@sheetxl/primitives`, allowing them to efficiently operate on ranges of data (`IRange`), not just single values.
* **Engine-Agnostic & Lightweight:** A simple TypeScript API with no spreadsheet engine dependency. Its only core dependency is `@sheetxl/primitives`.
* **Permissively Licensed:** Free to use for any project under the MIT license.

## Installation

```bash
# Using npm
npm install @sheetxl/formulas @sheetxl/primitives

# Using pnpm
pnpm add @sheetxl/formulas @sheetxl/primitives
```

## Full list of Excel functions

https://support.office.com/en-us/article/excel-functions-by-category-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb
