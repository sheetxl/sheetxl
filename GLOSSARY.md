# SheetXL

Terms for how SheetXL describes a sheet to a reader: the areas a report names, and how it says
where a sheet follows a pattern and where it does not.

## Language

### Features and their areas

**Feature**:
One fact a cell can carry and a sheet can be divided by: its formula, its fill, its number
format, or simply being filled. Every area below is about one feature at a time.
_Avoid_: attribute, property, layer

**Filled**:
The feature of holding anything at all: a value, a formula, an error. Areas of this feature are
called contentful.
_Avoid_: non-empty, used, occupied

**Payload**:
The value of the feature that an area carries: the formula in its relative form (`=B2*10` and
`=B3*10` are one payload), the color, or "filled".
_Avoid_: key, value, content

**Region**:
A rectangle of cells that all carry the same payload, cut as large as the sheet's division allows.
A region has no exceptions.
_Avoid_: area, range (a range is any rectangle you name; a region is one the sheet defines)

**Partition**:
The regions of a sheet for one feature, none overlapping. Cells that do not carry the feature (a
typed value in a formula partition, a blank in any) belong to no region of it.
_Avoid_: map, index, layout

**Block**:
A region of the filled feature: a solid rectangle of data with no blank inside it. One blank in an
area of data splits it into several blocks.
_Avoid_: table (a table is an object someone defined), data region

**Current region**:
The rectangle of filled cells that touch one another, blanks inside included: what Excel selects
with Ctrl+Shift+*. A table with a sparse column is one current region and several blocks.
_Avoid_: surrounding range, data block

**Zone**:
For one feature, the largest area whose regions line up (stacked in the same columns, or side by
side in the same rows) where one payload, or one repeating tile of payloads, covers most of the
cells. A zone is a rectangle; zones of one feature never overlap. It starts and ends with its
payload, and stops at a spanning blank or where its payload stops. A region has no exceptions; a
zone is mostly one payload and names its exceptions as breaks. For the filled feature, a zone is
the same rectangle as the current region: "current region" is Excel's name for it, "contentful
zone" is the name when its holes are reported.
_Avoid_: envelope, span, extent, pattern; and run, which is one-dimensional

**Run**:
The longest stretch of one payload along the direction a zone is stacked: down a column for a
zone of stacked regions, along a row for regions side by side. A plain zone is its runs plus its
breaks. A tiled zone is described by its tile, not by runs.
_Avoid_: using run for a 2D area. (The `run` tool, which executes a script, is unrelated.)

**Tile**:
The smallest rectangle of payloads that repeats at a fixed step down the rows, across the columns,
or both, counted from the zone's first cell: the copy unit someone filled. A plain zone has a
one-cell tile; rows that alternate two formulas have a two-row tile.
_Avoid_: pattern, period, stripe

### Exceptions

**Break**:
A cell inside a zone that does not carry the zone's payload, or the tile's payload at its place:
it carries another payload (a different formula, another color), none of the feature (a typed
value among formulas, an unfilled cell among yellow ones), or nothing at all. Breaks are counted
in cells.
_Avoid_: exception (reads as an error thrown), gap, outlier, override

**Hole**:
A break that holds nothing at all: no value, no formula. An unfilled cell among yellow ones that
holds a value is a break, not a hole.
_Avoid_: gap, missing cell

**Spanning blank**:
A row or column that holds nothing across the whole width (or height) of the zone it would
otherwise cross. It is a
boundary the author drew, so a zone ends there rather than having a hole.
_Avoid_: separator, spacer

## Example

A1:F1 holds headers. A2:B41 and D2:E41 hold typed values. Column C holds `=B2*10` filled down rows
2 to 41, with `999` typed into C21. Column F holds notes in 27 of rows 2 to 41.

- The formula partition of column C has two **regions**, C2:C20 and C22:C41, with the same
  **payload**. C21 belongs to no formula region. The header C1 is not a break: the zone starts at
  its first formula.
- Together they are one **zone**, C2:C41, with one **break**: the typed value at C21.
- C2:C20 and C22:C41 are each also a **run**; the break at C21 is where one run ends and the next
  begins.
- The filled partition has several **blocks**: A1:E41 is solid, and the notes add blocks wherever
  column F is filled. The whole table is one **current region**, A1:F41, and one contentful
  **zone** with 13 **holes**, the empty notes.
