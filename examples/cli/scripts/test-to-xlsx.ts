/**
 * Generates an XLSX workbook from a JSON formula test fixture.
 * Each test fixture becomes its own sheet tab, showing inputs, the formula
 * result, and the expected output side-by-side.
 *
 * Usage, from this directory's package (`examples/cli`):
 *   sheetxl -f scripts/test-to-xlsx.ts --out UNIQUE.xlsx -- --test UNIQUE.json
 *
 * Path resolution for `--test`:
 *   1. Absolute path → used as-is.
 *   2. Relative path → resolved under `$SHEETXL_IN` when set, otherwise from CWD.
 *
 * Similarly, a relative `--out` is resolved under `$SHEETXL_OUT`. This lets a launch config or CI
 * environment pin the fixture and output directories once — pointing `$SHEETXL_IN` at
 * `packages/sdk/src/__tests__/functions` makes `--test statistical/AVEDEV.json` work
 * from anywhere.
 *
 * This is implemented as a SheetXL runner script so the full `@sheetxl/sdk` can be used.
 * This can be launched using either a CLI entry point or imported as a module.
 * See https://sheetxl.com/docs/guides/how-tos/write-a-runner-script for more details.
 */
import { readFileSync } from 'node:fs';

import { AddressUtils, ICellStyle, Workbook, type IWorkbook, type IWorksheet, type ICellRange } from '@sheetxl/sdk';

import { type RunFunction, type RunContext, resolvePath } from '@sheetxl/runner';

// ---------------------------------------------------------------------------
// Types mirroring the `JSON test fixture format`
// Text fixtures Input and expected value formats follow ICellRange serialization conventions — setValue()
// string syntax for inputs, getText() default format for expected values
// (strings prefixed with ', everything else undecorated).
// See the see: [Value serialization format](../../../docsite/docs/30-concepts/32-value-serialization-format.md).
// ---------------------------------------------------------------------------

type ScalarValue = string | number | boolean | null;

/**
 * We have two fixture formats:
 * 1. DetailedTestFixture: for complex tests with multiple inputs and a multi-cell expected result range.
 *    This format adds a unit test per tab.
 */
interface DetailedTestFixture {
  label:   string;
  formula: string;
  expect:  ScalarValue[][] | string;

  inputs?:  Record<string, ScalarValue[][]>;
  comment?: string;
}

/**
 * We have two fixture formats:
 * 2. SimpleTestFixture: for straightforward formula tests with no inputs and single expected value.
 *    This format adds a unit test per row.
 */
interface SimpleTestFixture {
  label:   string;
  simple: Record<string, ScalarValue | ScalarValue[][]>;
}

type TestFixture = DetailedTestFixture | SimpleTestFixture;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load and validate a JSON test fixture, throwing on any problem. */
function loadFixture(jsonPath: string): TestFixture[] {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch (err: any) {
    const reason = err.code === 'ENOENT' ? 'file not found' : err.message;
    throw new Error(`Cannot read test fixture '${jsonPath}': ${reason}`);
  }

  let fixtures: TestFixture[];
  try {
    fixtures = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Test fixture '${jsonPath}' is not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error(`Test fixture '${jsonPath}' must be a non-empty JSON array of test fixtures.`);
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

interface SummaryRow {
  sheetName: string;
  label:     string;
  testCount: number;
  kind:      'simple' | 'detailed';
  /** Where the sheet's link lands — the same cell the writer left selected. Unqualified (`A3`). */
  anchor:    string;
}

class SummaryBuilder {
  private rows: SummaryRow[] = [];
  readonly runDate: Date = new Date();

  record(row: SummaryRow): void {
    this.rows.push(row);
  }

  write(sheet: IWorksheet): void {

    // TODO - Add any failure. (via an equals?)
    // TODO - add conditional formatting to highlight mismatched results.
    // TODO - add SheetXL icon and a splash of color.

    // Title
    const title = sheet.getRange('A1');
    title.setValue("Test Run Summary");
    title.getStyle().getFont().setWeight(700).setSize(14);

    sheet.getRange('A2').setValue("Run date:");
    sheet.getRange('B2').setValue(`${this.runDate.toISOString().replace('T', ' ').slice(0, 19)} UTC`);

    const totalTests = this.rows.reduce((s, r) => s + r.testCount, 0);
    sheet.getRange('A3').setValue("Total tests:");
    sheet.getRange('B3').setValue(totalTests);

    // Header row (row 5)
    const headerRow = 5;
    const cols = ['A', 'B', 'C', 'D'];
    const headers = ['Sheet', 'Label', 'Kind', 'Test count'];
    for (let c = 0; c < headers.length; c++) {
      const cell = sheet.getRange(`${cols[c]}${headerRow}`);
      cell.setValue(`${headers[c]}`);
      cell.getStyle().getFont().setWeight(700);
    }

    // Data rows
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i];
      const rowIdx = headerRow + 1 + i;
      // The sheet name is the link. A leading `#` is what makes it a location in THIS workbook
      // rather than a url, and the name has to be quoted/escaped for the address — every one of
      // these starts with a digit ('1. AVEDEV'), and a label may carry an apostrophe of its own.
      const target = AddressUtils.sheetAndRangeToString(
        AddressUtils.sheetNameToString(r.sheetName)!,
        r.anchor
      );
      const cellSheet = sheet.getRange(`A${rowIdx}`).setValue(`'${r.sheetName}`);
      cellSheet.setHyperlink({ address: `#${target}` });
      cellSheet.getStyle().setNamed(ICellStyle.BuiltInName.Hyperlink);
      sheet.getRange(`B${rowIdx}`).setValue(`${r.label}`);
      sheet.getRange(`C${rowIdx}`).setValue(`${r.kind}`);
      sheet.getRange(`D${rowIdx}`).setValue(r.testCount);
    }

    sheet.getRange('A:D').autoFit();
  }
}

// ---------------------------------------------------------------------------
// Sheet writers
// ---------------------------------------------------------------------------

/**
 * Write one row per simple test case.
 *   Column A – formula text  (=FORMULATEXT(C{n}))
 *   Column B – expected value from the JSON fixture
 *   Column C – the formula under test  (=ACCRINT(…) etc.)
 *
 * Row 1 holds the fixture label; row 2 holds column headers.
 * Test rows start at row 3.
 *
 * @returns the first test's row anchor (A3) so the caller can move the workbook
 *          selection there — a reader starts at the top of the list, not past its end.
 *
 * Navigation pattern used here:
 *   - `anchor` is a single root cell (A1); all other positions are derived from it.
 *   - `getRowAfter()` walks the cursor to the next row. Called on the written range to
 *     skip past spilled multi-row values without any manual index arithmetic.
 *   - `getColumnAt(n)` addresses a peer column on the same row (0-based **absolute** index —
 *     independent of the cursor's own column, so the cursor can live anywhere).
 *   - `getResizeBy(0, n)` expands a 1×1 cell rightward for multi-column style operations.
 *     ('By' suffix = relative delta, matching Excel's getResizedRange convention.)
 *   - `getAddress()` retrieves the A1-style address, used for FORMULATEXT formula strings.
 */
async function writeSimpleFixtureSheet(
  sheet: IWorksheet,
  fig: SimpleTestFixture,
  summary: SummaryBuilder,
  sheetName: string,
): Promise<ICellRange> {
  const entries = Object.entries(fig.simple);

  // Row 1 – label: anchor all subsequent navigation from A1
  const anchor = sheet.getRange('A1');
  anchor.setValue(`'${fig.label}`);
  anchor.getStyle().getFont().setWeight(700);

  // Row 2 – column headers: navigate from anchor, extend rightward for bulk style
  const headerRow = anchor.getRowAfter();                              // A2
  headerRow.getEntireRows().getStyle().getFont().setWeight(700);   // row bold in one call
  headerRow.setValue("'Formula");
  headerRow.getColumnAt(1).setValue("'Expected");                    // B2

  let maxResultsColumns = 1;
  for (const [formula, expectedValue] of entries) {
    if (Array.isArray(expectedValue)) {
      maxResultsColumns = Math.max(maxResultsColumns, expectedValue[0]?.length ?? 1);
    }
  }

  const actualColumnStart = 2 + maxResultsColumns;
  headerRow.getColumnAt(actualColumnStart).setValue("'Actual");

  sheet.getView().setFreezePanes({ coords: { rowIndex: 2 } });

  // cursor tracks the current data row — always lives in column A (index 0)
  const firstRow = headerRow.getRowAfter().getColumnAt(0); // A3 — first data row
  let currentRow = firstRow;
  for (const [formula, expectedValue] of entries) {
    // We do this is a bit out of order so that we can account for a 2d Expected results
    // B{row} – expected value (may spill over multiple rows for 2-D arrays)
    let expectedRange: ICellRange;
    if (Array.isArray(expectedValue)) {
      expectedRange = currentRow.getColumnAt(1).setValues(expectedValue);
    } else {
      expectedRange = currentRow.getColumnAt(1).setValue(expectedValue);
    }

    // advance to the right
    // single cell
    const formulaRange = expectedRange.getColumnAt(actualColumnStart).getTopLeft();
    // A{row} – human-readable formula text;
    currentRow.getColumnAt(0).setValue(`=FORMULATEXT(${formulaRange.getAddress()})`);

    // determined by writtenRange
    formulaRange.setValue(`=${formula}`); // does not return the spill range as this is calculated async
    // we could put await sheet.getCalculation().ready(); here
    const formulaExpr = `=IF(${expectedRange.getTopLeft().getAddress()}=${formulaRange.getAddress()}, "PASS", "FAIL")`; // for testing
    const resultsRange = formulaRange.getColumnBy(maxResultsColumns + 1);
    resultsRange.setValue(formulaExpr);
    // currentRow.getColumnAt(3).setValue(`=IF(${expectedRange.toString()}, ${actualRange.getAddress()}#), "PASS", "FAIL"), "ERROR")`);

    // Advance cursor past any spilled rows: getRowAfter() on the *written range*
    // (not cursor) naturally skips past however many rows setValues consumed.
    currentRow = expectedRange.getRowAfter().getColumnAt(0);
  }

  await sheet.getCalculation().ready();
  sheet.getEntireRange().autoFit({ expandOnly: true });

  summary.record({
    sheetName, label: fig.label, testCount: entries.length, kind: 'simple',
    anchor: firstRow.getAddress()
  });

  return firstRow;
}

async function writeDetailedFixtureSheet(sheet: IWorksheet, fig: DetailedTestFixture, summary: SummaryBuilder, sheetName: string): Promise<ICellRange> {
// ------------------------------------------------------------------
  // Detailed fixture: single formula with optional input data.
  // ------------------------------------------------------------------
  const detailedFig = fig as DetailedTestFixture;

  // 1. Write input data at the exact cell addresses the formula uses.
  if (detailedFig.inputs) {
    for (const [addr, data] of Object.entries(detailedFig.inputs)) {
      const range: ICellRange = sheet.getRange(addr);
      if (Array.isArray(data)) {
        range.setValues(data);
      } else {
        range.setValue(data);
      }
    }
  }

  // some unit tests will have no inputs.
  let usedRange = sheet.getUsedRange();
  const maxInputRow = usedRange ? usedRange.getCoords().rowEnd : 0; // zero-based, so this is the last used row index. If no used range, start at 0.

  // 2. Meta data
  let range: ICellRange = sheet.getRange(`A${maxInputRow + 3}`); // zero based

  range = range.setValue(`'${detailedFig.label}`).getRowAfter();
  if (detailedFig.comment) {
    range = range.setValue(`'${detailedFig.comment}`).getRowAfter();
  }
  range = range.setValue(`'${detailedFig.formula}`).getRowAfter();

  range = range.getRowAfter(); // blank row before results

  range.getStyle().getFont().setWeight(700);
  const rowExpectedLabel = range.getCoords().rowStart;
  range = range.setValue("Expected").getRowAfter();
  range = range.setValue(`'${detailedFig.formula}`).getRowAfter();

  // 3. Write expected results.
  if (Array.isArray(detailedFig.expect)) {
    range = range.setValues(detailedFig.expect);
  } else {
    range = range.setValue(detailedFig.expect);
  }
  range.getStyle().getBorders().setOutline({ style: 'double', color: 'blue' });

  const expectedRange = range; // save to compare
  // bump columns by width + 1
  range = range
    .getColumnAfter() // next column after data
    .getOffsetBy(0, 1) // 1 more for visual spacing
    .getResizeTo(1, 1) // ensure row range is 1x1 as setValues may have expanded
    .getRowAt(rowExpectedLabel); // back up to results anchor

  range.getStyle().getFont().setWeight(700);
  range = range.setValue("Actual").getRowAfter();
  const formulaRange = range.getOffsetBy(1, 0);
  range = range.setValue(`=FORMULATEXT(${formulaRange.getAddress()})`).getRowAfter();

  // 4. Write the formula result.
  range = range.setValue(`=${detailedFig.formula}`);
  const rangeCalced = range;
  // move the user selection to the result for easy viewing.
  await range.select({ preserveSelectedSheet: true });

  range.getResizeTo(expectedRange.getRowCount(), expectedRange.getColumnCount()).getStyle().getBorders().setOutline({ style: 'double', color: 'blue' });
  range = range.getOffsetBy(0, expectedRange.getColumnCount() + 1); // next column + 1 for spacing

  const rangePassTest = rangeCalced.getOffsetBy(0, expectedRange.getColumnCount() + 1); // expected range shifted right to match actual range
  const exprPassText = `=IF(${expectedRange.getTopLeft().getAddress()}=${formulaRange.getAddress()}, "PASS", "FAIL")`; // for testing
  rangePassTest.setValue(exprPassText);

  // ------------------------------------------------------------------
  // 5. Write a quick equals. This does a cell by cell results
  // ------------------------------------------------------------------
  // rangeCalced is already a single cell but topLeft for illustrative purposes.
  // range.setValue(`=${expectRange.getAddress()}=${rangeCalced.getTopLeft().getAddress()}#`);

  summary.record({
    sheetName, label: fig.label, testCount: 1, kind: 'detailed',
    // `rangeCalced` is the formula result — the cell this writer selected above.
    anchor: rangeCalced.getTopLeft().getAddress()
  });

  return range;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main: RunFunction = async (ctx: RunContext): Promise<IWorkbook> => {
  const { error, log, wb: ctxWorkbook } = ctx;

  const testArg = ctx.args.kv['test'];
  if (!testArg || typeof testArg !== 'string') {
    throw new Error('Please specify a test fixture with --test <file.json>');
  }

  const fixtures = loadFixture(resolvePath(testArg));

  let workbook: IWorkbook | null = ctxWorkbook;
  if (!workbook) {
    workbook = new Workbook();
    await workbook.getCalculation().start();
  }

  // The host's workbook may be blank — the CLI hands every script one, so `wb` is never null —
  // or it may hold real content. Claim the starter sheet when there is nothing to lose; only
  // append when the workbook already has something worth keeping, so the output never carries a
  // leftover empty tab ahead of the summary.
  const firstSheet: IWorksheet = workbook.getWorksheetAt(0);
  const summarySheet: IWorksheet =
    (workbook.getWorksheets().getCount() === 1 && !firstSheet.getUsedRange())
      ? firstSheet
      : workbook.addWorksheet();
  summarySheet.setName('Summary');

  const summary = new SummaryBuilder();

  for (let i=0; i<fixtures.length; i++) {
    const fig = fixtures[i];
    try { // catch invalid test fixture data to report which one is the problem
      const label = fig.label;
      const sheetName = toSheetName(i, label);

      if ((fig as SimpleTestFixture).simple) {
        if ((Object.keys((fig as SimpleTestFixture).simple)).length === 0) continue; // empty test;
        const sheet: IWorksheet = workbook.addWorksheet(sheetName);
        const selectRange = await writeSimpleFixtureSheet(sheet, fig as SimpleTestFixture, summary, sheetName);
        await selectRange.select({ preserveSelectedSheet: true });
      } else {
        const sheet: IWorksheet = workbook.addWorksheet(sheetName);
        await writeDetailedFixtureSheet(sheet, fig as DetailedTestFixture, summary, sheetName);
      }
    } catch (err: any) {
      error(`Error processing test fixture '${fixtures[i].label}': ${err.message}`);
      throw err;
    }
  }

  // Populate summary sheet now that all fixtures have been processed.
  summary.write(summarySheet);
  await summarySheet.select();

  // Wait for all calculation results to be computed. // Note needed as the runner will do this but here
  // for clarity.
  await workbook.getCalculation().ready();

  log(`✓ Populated ${fixtures.length} sheets from ${testArg}`);

  return workbook;
}

export default main;

/** Build a valid Excel sheet name: max 31 chars, no [ ] * / \ ? : */
function toSheetName(index: number, label: string): string {
  const prefix = `${index + 1}. `;
  const clean  = label.replace(/[[\]*/\\?:]/g, '-');
  return (prefix + clean).slice(0, 31);
}
