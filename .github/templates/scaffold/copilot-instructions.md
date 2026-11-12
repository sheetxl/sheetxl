# {{PROJECT_NAME}} — SheetXL Project

This project was created with `create-sheetxl`. It uses `@sheetxl/sdk` as a headless Excel-compatible spreadsheet engine and `@sheetxl/io` for reading and writing files (xlsx, csv, json, sxl).

> **Note for Copilot**: This is an end-user SDK project, not the SheetXL monorepo. Monorepo internals (pnpm workspace, vitest dual-target builds, package layers, obfuscation) do not apply here.

---

## SDK API Reference

The detailed API patterns are in the instruction files — Copilot loads these automatically:

- `.github/instructions/sdk.instructions.md` — creating workbooks, reading/writing values, file I/O, formula engine
- `.github/instructions/sheet-data.instructions.md` — range navigation, cursor pattern, styling, formula authoring

Read those files before generating any SheetXL code.

---

## Project Structure

```
src/          Source files
{{ENTRY}}     Main entry point
package.json
```

---

## Running the Project

```bash
{{RUN_COMMAND}}
```

---

## MCP Integration

The SheetXL MCP server is configured in `.vscode/mcp.json`. It exposes live workbook tools to AI agents — use them to inspect, read, and modify sheets interactively during a session without writing scripts.

MCP tools complement the SDK: use MCP for exploration and one-off operations, use the SDK in source code for repeatable logic.

---

## Key Patterns

### Install IO plugin once (at app entry)
```typescript
import { WorkbookIO } from '@sheetxl/sdk';
import { IOPlugin } from '@sheetxl/io';

WorkbookIO.install(IOPlugin);
```

### Read → edit → write
```typescript
const workbook = await WorkbookIO.read('input.xlsx');
const sheet = workbook.getSelectedWorksheet();

sheet.getRange('A1').setValue('Hello');

await WorkbookIO.writeFile('output.xlsx', workbook);
```

### Formulas — await whenCalculationReady() before reading results
```typescript
sheet.getRange('D1').setValue('=SUM(A1:C1)');
await workbook.whenCalculationReady();
const result = sheet.getRange('D1').getValue();
```

For navigation-heavy writes, cursor patterns, and range styling — see `sheet-data.instructions.md`.
