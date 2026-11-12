# Precedents and dependents

The calculation graph, walked as a tree in both directions. Available on **both** `ICell` and
`ICellRange` — the graph is indexed by range, so a range answers in one call rather than a
fan-out, and the cell form is that same call over a 1×1.

The Sales sheet has a two-level chain: `B2` and `C2` feed `D2` (`=B2*C2`), and `D2` feeds `D6`
(`=SUM(D2:D4)`).

## Downstream — what breaks if I change this

```bash
sheetxl -e "wb.getRange('C2').getCell()" expressions.xlsx
```

```text
## Dependents
  D2    2398.8  =B2*C2
    D6  6308.8  =SUM(D2:D4)
```

Indentation is the hop count, so **the depth of the chain is visible** rather than inferred.
Editing `C2` moves `D2`, and `D2` moves the sheet total at `D6` — a cell you would not have
thought to check. A flat `direct` / `all` pair would report the same two addresses while
throwing away the fact that one is behind the other.

Each node carries its payload at the right altitude: a single cell shows its value and its
formula, a multi-cell range shows its size. A range node is never expanded into cells.

## Upstream — what is this value made of

```bash
sheetxl -e "wb.getRange('D6').getCell()" expressions.xlsx
```

```text
## Precedents
  D2:D4    3×1
    B2:C4  3×2
```

`D6` reads `D2:D4` directly, but those are themselves formulas, so one hop further up are the
raw Units and Price columns at `B2:C4`. That second level is the set a change to `D6` can
actually be wrong about.

## The same questions on a range

```bash
sheetxl -e "wb.getRange('A1:D4')" expressions.xlsx
```

```text
## Dependents
  D2:D4  3×1  =B2*C2
    D6   6308.8  =SUM(D2:D4)
  B6     400  =SUM(B2:B4)
  D6     ↑ shown above
```

The union over every cell in the block. Three things to read here:

- **`D2:D4  3×1  =B2*C2`** — the block is a *uniform* formula region, so it names the shared
  formula instead of just its size. A range whose cells do not agree has no single formula to
  name and prints its size alone.
- **`↑ shown above`** — `D6` is reached twice, once under `D2:D4` and once directly. Marked
  rather than walked again; its subtree is already printed. Convergence like this is the normal
  shape of a model, which is exactly why it does **not** share a glyph with a cycle.
- Precedents of `A1:D4` are `B2:C4` — **not filtered against the range itself.** The block
  contains both the formulas and their inputs, and it says so. "What does this block read" and
  "what does it read from outside" are different questions.

## Bounds and marks

Each stated in the output rather than applied silently:

| bound | default | what you see |
|---|---|---|
| depth | 3 | `…deeper levels not walked · raise maxDepth (3) for more` |
| nodes | 50 | `…truncated at 50 nodes · raise maxNodes for more` |
| re-convergence | — | `↑ shown above` |
| cycle | — | `↺ circular` |

**The two revisit marks are deliberately different.** `↑` is a node reached by a second branch —
ordinary. `↺` is a node reached again while still on the current branch: a genuine circular
reference, either a defect or a deliberate iterative calculation, and always a finding. A tree
that spent one glyph on both would hide the second inside the noise of the first:

```text
## Precedents
  E2      (empty)  =E1+1
    E1    (empty)  =E2+1
      E2  ↺ circular
  ↺ circular reference — the chain returns to a cell already on this branch
```

## Empty sections are absent

```bash
sheetxl -e "wb.getRange('B2').getCell()" expressions.xlsx
```

```text
## Dependents
  D2    2398.8  =B2*C2
    D6  6308.8  =SUM(D2:D4)
  B6    400  =SUM(B2:B4)
```

There is no `## Precedents` heading at all — `B2` is typed-in data, nothing feeds it, and a
`None` heading would be pure token cost on the commonest case in any workbook.

Two formulas read `B2`, and one of those feeds a third. That asymmetry is the normal shape of a
model: the inputs have no precedents and the deepest dependent trees.
