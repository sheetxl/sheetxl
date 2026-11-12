# Logging and errors

**Logging** — `log` is the run's output channel (`warn` and `error` are its diagnostic siblings and
travel separately, on stderr). It takes an argument list like `console.log`, and any argument may be
a value rather than a string. Do not use `console.log`: it bypasses the output channel, so once runs
route back through the MCP server anything written to `console` is lost.

```bash
sheetxl -e "log('used rows:', wb.getWorksheet().getUsedRange().getRowCount())" expressions.xlsx
```

Expect `used rows: 11`. The expression's own value is `undefined`, so nothing else prints.

**Logging a value renders it** — the same report returning it would produce:

```bash
sheetxl -e "log(wb.getRange('B2:B4').getStats())" expressions.xlsx
```

Expect the `# Stats` report — `Sum: 400`, `Min: 80`, `Max: 200` and the rest.

**A calculation error is a value, not a failure** — the run succeeds and the report shows it:

```bash
sheetxl -e "wb.getRange('F2').getCell()" expressions.xlsx
```

Expect `Display: #DIV/0!` with an `Errors:` line — and exit code 0.

**A runtime error fails the run** — a wrong sheet name throws, and the CLI reports the script
failure (verbosely today; error reporting is a known TODO):

```bash
sheetxl -e "wb.getWorksheet('Nope')" expressions.xlsx
```

Expect `Script '<eval>' failed` with `'Nope' not found.` in the cause.

**Multi-statement snippets** run statement by statement, and the final expression is the result —
exactly as in a REPL:

```bash
sheetxl -e "const r = wb.getRange('B2:B4'); log('sum:', r.getStats().getAggregates().sum); r.getStats().getCount()" expressions.xlsx
```

Expect `sum: 400` from the log line, then `3` as the rendered result. Each top-level statement is
awaited for you — never write `await` in a snippet. (A statement nested inside a loop or block is
not: code that needs that has outgrown a snippet and belongs in a script.)
