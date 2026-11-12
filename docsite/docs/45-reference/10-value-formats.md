---
sidebar_position: 10
title: Value Formats
---

How values look when they go in and out of a cell as text: what `getText()` returns, what
`setValue()` does with a string, and how the two round-trip. If you're writing an agent, a test
fixture, or anything that shows values to people, this is the page.

---

## API Overview

| Method | Direction | Behavior |
|---|---|---|
| `getValue()` | read | Native JS type — number, boolean, string, error, or `null` |
| `getValues()` | read | 2D array of native JS types |
| `getText()` | read | Display string with string-prefix type annotation |
| `setValue(native)` | write | Stores value directly, no parsing |
| `setValue(string)` | write | Parses using Excel conventions (same as typing into a cell) |
| `setValue(string, { textParser: false })` | write | Stores string literally, no Excel parsing |

---

## Recommended Format for Agent I/O

`getValue()` returns raw internal values — useful for programmatic computation in
UDFs and data pipelines, but requires format knowledge to interpret numbers, dates,
and percentages correctly. For example, a date returns `34495` and a percentage
returns `0.04` — the display meaning is lost without the format context.

`getText()` is the recommended format for agent I/O because it returns values exactly
as the user sees them — `10/23/1995` and `4%` — with type annotation via the `'`
prefix for strings. No format knowledge required, and output round-trips naturally
through `setValue()`.

**Agents should not do arithmetic on cell values directly.** The calculation engine
handles this correctly at scale. If computation is needed, write a formula — the
engine computes, the agent reads the result via `getText()`.

---

## Reading Values

### `getValue()` — Native Type

Returns the raw stored value as a native JS type:

```typescript
cell.getValue()  // → 1234                    (number)
cell.getValue()  // → true                    (boolean)
cell.getValue()  // → "hello"                 (string)
cell.getValue()  // → FormulaError.BuiltIn.NA (error)
cell.getValue()  // → null                    (blank cell)
```

### `getText()` — Display String

Returns values exactly as seen on screen. **Strings are prefixed with a single quote
(`'`)** to distinguish them from numbers, booleans, and errors — matching Excel's own
text-prefix convention. All other types are undecorated.

```typescript
cell.getText()  // → 4%          (number 0.04, percent format — no prefix)
cell.getText()  // → 2024-01-01  (date serial, date format — no prefix)
cell.getText()  // → 'hello      (string — single quote prefix)
cell.getText()  // → #N/A        (error — no prefix)
cell.getText()  // → TRUE        (boolean — no prefix)
cell.getText()  // → '           (empty string — bare single quote)
cell.getText()  // → ''          (blank cell — empty JS string, no quote)
```

#### Type reference

| Cell contains | `getText()` | `getText({ hideStringPrefix: true })` |
|---|---|---|
| Number `1234` | `1234` | `1234` |
| Number `0.04`, percent format | `4%` | `4%` |
| Date serial, date format | `2024-01-01` | `2024-01-01` |
| Boolean | `TRUE` or `FALSE` | `TRUE` or `FALSE` |
| Error | `#N/A`, `#VALUE!`, etc. | `#N/A`, `#VALUE!`, etc. |
| String `hello` | `'hello` | `hello` |
| String `#N/A` | `'#N/A` | `#N/A` |
| String `TRUE` | `'TRUE` | `TRUE` |
| Explicit empty string | `'` | _(empty)_ |
| Blank cell | _(empty)_ | _(empty)_ |

**A bare `'` means the cell explicitly contains an empty string; a blank cell reads as an
empty string.** Both display identically to the user but are semantically distinct —
`COUNTA(A1)` returns `0` for a blank cell and `1` for `""`. Reports that list a range's
cells leave blank cells out entirely.

#### `hideStringPrefix`

Suppresses the single quote prefix, returning bare display values. Use for UI rendering
and clipboard operations where type annotation is not needed:

```typescript
cell.getText({ hideStringPrefix: true })  // → hello    (string — no prefix)
cell.getText({ hideStringPrefix: true })  // → #N/A     (error or string — now ambiguous)
```

Note that suppressing the prefix makes strings, errors, and booleans visually
indistinguishable when their display values collide (e.g. a string `"TRUE"` vs boolean
`TRUE`). Prefer the default for any context where type matters.

| Context | `hideStringPrefix` | Lossless? |
|---|---|---|
| Agent I/O, unit test fixtures | `false` (default) | ✓ |
| Human rendering, UI clipboard | `true` | ✗ |

#### Many cells at once

`getText()` describes one cell. On a range it answers for the top-left cell. To read a
whole range, use `getValues()` for the native values, or `getCells()` / `forEach()` and
call `getText()` on each cell.

To *describe* a range, sheet, or workbook (its values, formulas, formats, and structure in
one readable report) return it from the CLI or the MCP `run` tool and the report renders
for you. The same `'` convention marks strings there:

```bash
npx sheetxl -e "wb.getRange('Sales!A2:C3')" book.xlsx
```

The report renderers live in `@sheetxl/query`; see the [CLI guide](../20-getting-started/4-cli.mdx).

---

## Writing Values

### `setValue(native)` — Native Type

Non-string values are stored directly with no parsing:

```typescript
cell.setValue(1234)                    // number
cell.setValue(true)                    // boolean
cell.setValue(FormulaError.BuiltIn.NA) // error
cell.setValue(null)                    // blank cell
```

### `setValue(string)` — Excel-Convention Parsing

String inputs are parsed using Excel conventions — the same rules as typing into a cell:

| Input string | Stored as | Displays as |
|---|---|---|
| `'1234'` | number `1234` | `1234` |
| `'4%'` | number `0.04`, percent format | `4%` |
| `'$1,234'` | number `1234`, currency format | `$1,234` |
| `'2024-01-01'` | date serial, date format | `2024-01-01` |
| `'=SUM(A1:A10)'` | formula | computed result |
| `"'hello"` | string `hello`, quotePrefix format | `hello` |
| `"'123"` | string `123`, quotePrefix format | `123` |

**Forcing text with a leading apostrophe:** prefix the value with `'` — matching Excel's
own text-prefix convention. `setValue("'123")` stores the string `"123"`, not the number
`123`.

### `setValue(string, { textParser: false })` — Literal String

Skips all parsing. The string is stored exactly as provided:

```typescript
cell.setValue("'123")                         // stores string "123"  (apostrophe stripped, quotePrefix set)
cell.setValue("'123", { textParser: false })  // stores string "'123" (apostrophe kept, no parsing)
cell.setValue("4%",   { textParser: false })  // stores string "4%"   (not parsed as 0.04)
```

---

## Round-Trip: `getText` &lt;-&gt; `setValue`

`getText()` output round-trips naturally through `setValue()` — an agent reading output
and writing input uses the same surface representation throughout:

| `getText()` | `setValue(...)` | Stores |
|---|---|---|
| `4%` | `'4%'` | `0.04`, percent format |
| `2024-01-01` | `'2024-01-01'` | date serial, date format |
| `1234` | `'1234'` | number `1234` |
| `'hello` | `"'hello"` | string `hello`, quotePrefix format |
| `'#N/A` | `"'#N/A"` | string `#N/A`, quotePrefix format |
| `#N/A` | `'#N/A'` | `#N/A` as FormulaError |

The format anchor is always **what the user sees**. Neither an agent nor a fixture author
needs to think about internal storage values.

> **For guaranteed round-tripping of all values**, including strings that contain
> delimiters or newlines, use `getValues()` / `setValues()` with native JS types.

---

## Notes for Test Fixture Authors

- **Inputs** — use `setValue` string syntax (what the user would type), or native JS
  types for programmatic precision. `true` (boolean) and `'TRUE'` (string that parses to
  boolean) are not the same.
- **Expected values** — use `getText()` default format: strings prefixed with `'`,
  everything else undecorated.
- **Blank vs empty string** — a blank cell is left out of a fixture; `'` (bare single quote)
  means the cell explicitly contains an empty string.
- **`textParser: false`** — only use when testing that a literal string survives storage
  without Excel parsing.
