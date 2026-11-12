/**
 * readinglog.ts
 *
 * Illustrative SheetXL headless (Node) example — Book Reading Log.
 *
 * Builds a styled workbook entirely with the `@sheetxl/sdk` — no UI, no browser —
 * and writes it to both `.xlsx` and `.sxl`.
 *
 * Concepts demonstrated:
 *  - Workbook & sheet creation
 *  - Row-cursor pattern for variable-length data
 *  - Formulas with getAddress() (no manual row-number string building)
 *  - Range-level styling (headers, alternating rows, summary section)
 *  - Font convenience helpers: setBold() / setItalic()
 *  - Writing both .xlsx and .sxl output
 *
 * Run:
 *   pnpm --filter example-headless start
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Workbook, WorkbookIO } from '@sheetxl/sdk';
import { IOPlugin } from '@sheetxl/io';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookEntry {
  title: string;
  author: string;
  genre: string;
  /** Pages read */
  pages: number;
  /** 1–5 */
  rating: number;
  /** ISO date string, e.g. '2024-03-15' */
  dateFinished: string;
}

// ─── Sample data ─────────────────────────────────────────────────────────────

export const SAMPLE_BOOKS: BookEntry[] = [
  { title: 'The Name of the Wind',      author: 'Patrick Rothfuss',  genre: 'Fantasy',       pages: 662, rating: 5, dateFinished: '2024-01-12' },
  { title: 'Project Hail Mary',         author: 'Andy Weir',         genre: 'Sci-Fi',         pages: 476, rating: 5, dateFinished: '2024-02-03' },
  { title: 'Klara and the Sun',         author: 'Kazuo Ishiguro',    genre: 'Literary',       pages: 307, rating: 4, dateFinished: '2024-02-28' },
  { title: 'The Thursday Murder Club',  author: 'Richard Osman',     genre: 'Mystery',        pages: 382, rating: 3, dateFinished: '2024-03-15' },
  { title: 'Tomorrow, and Tomorrow',    author: 'Gabrielle Zevin',   genre: 'Literary',       pages: 401, rating: 5, dateFinished: '2024-04-01' },
  { title: 'Demon Copperhead',          author: 'Barbara Kingsolver', genre: 'Literary',      pages: 548, rating: 4, dateFinished: '2024-04-22' },
  { title: 'The Spare Man',             author: 'Mary Robinette Kowal', genre: 'Sci-Fi',      pages: 352, rating: 3, dateFinished: '2024-05-10' },
  { title: 'Fairy Tale',               author: 'Stephen King',       genre: 'Fantasy',        pages: 608, rating: 4, dateFinished: '2024-06-01' },
];

// ─── Column layout (0-based indices) ─────────────────────────────────────────

const COL = {
  TITLE:         0,  // A
  AUTHOR:        1,  // B
  GENRE:         2,  // C
  PAGES:         3,  // D
  RATING:        4,  // E  — stored as number 1-5
  STARS:         5,  // F  — formula: REPT("★", rating)
  DATE_FINISHED: 6,  // G
} as const;

const NUM_COLS = 7;

// ─── Palette ─────────────────────────────────────────────────────────────────

const COLORS = {
  headerBg:    '#2C3E50',
  headerFg:    '#FFFFFF',
  altRowBg:    '#F4F6F8',
  summaryBg:   '#EAF4FB',
  summaryBorder: '#2980B9',
  accent:      '#2980B9',
  starGold:    '#F39C12',
};

// ─── Core generator ──────────────────────────────────────────────────────────

/**
 * Builds a "Book Reading Log" workbook from an array of book entries.
 * Returns the workbook so callers can inspect, further modify, or write
 * to any format they like.
 */
export async function buildReadingLog(books: BookEntry[]): Promise<Workbook> {
  const workbook = new Workbook();
  const sheet = workbook.getSelectedWorksheet();

  // ── 1. Title banner ────────────────────────────────────────────────────────

  // Write the value to the anchor cell only, then merge — merging a range that
  // holds multiple values would otherwise discard all but one.
  sheet.getRange('A1').setValue('📚 My Reading Log');
  const bannerRange = sheet.getRange('A1').getResizeBy(0, NUM_COLS - 1);
  bannerRange.merge();
  bannerRange.getStyle().getFont().setSize(18).setBold(true).setColor(COLORS.headerBg);
  bannerRange.getStyle().getFill().setColor('#FFFFFF');

  // Row 2: subtitle / year
  sheet.getRange('A2').setValue(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`);
  const subtitleRange = sheet.getRange('A2').getResizeBy(0, NUM_COLS - 1);
  subtitleRange.merge();
  subtitleRange.getStyle().getFont().setSize(11).setColor('#7F8C8D').setItalic(true);

  // ── 2. Column headers (row 3, 0-based row index 2) ─────────────────────────

  const headerRange = sheet.getRange('A3').getResizeBy(0, NUM_COLS - 1);
  headerRange.setValues([[
    'Title', 'Author', 'Genre', 'Pages', 'Rating', 'Stars', 'Date Finished',
  ]]);

  // Style the entire header row at once — no per-cell loops
  headerRange.getStyle().getFill().setColor(COLORS.headerBg);
  headerRange.getStyle().getFont().setColor(COLORS.headerFg).setBold(true).setSize(11);
  headerRange.getStyle().getBorders().setOutline({ style: 'thin', color: COLORS.headerBg });

  // ── 3. Data rows — row-cursor pattern ─────────────────────────────────────

  // Cursor starts at A4 (row index 3, 0-based)
  let cursor = sheet.getRange('A4');
  const dataStartRow = cursor.getRowStart(); // remember for formula ranges later

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    // Write scalar columns via getColumnAt (absolute index)
    cursor.getColumnAt(COL.TITLE).setValue(`'${book.title}`);
    cursor.getColumnAt(COL.AUTHOR).setValue(`'${book.author}`);
    cursor.getColumnAt(COL.GENRE).setValue(`'${book.genre}`);
    cursor.getColumnAt(COL.PAGES).setValue(book.pages);
    cursor.getColumnAt(COL.RATING).setValue(book.rating);
    cursor.getColumnAt(COL.DATE_FINISHED).setValue(book.dateFinished);

    // Stars column: formula referencing the Rating cell for this row
    // Use getAddress() — never build "E" + rowNum manually
    const ratingCell = cursor.getColumnAt(COL.RATING);
    const starsCell  = cursor.getColumnAt(COL.STARS);
    starsCell.setValue(`=REPT("★",${ratingCell.getAddress()})`);

    // Alternating row shading — style the full row at once
    if (i % 2 === 1) {
      cursor.getResizeBy(0, NUM_COLS - 1)
        .getStyle().getFill().setColor(COLORS.altRowBg);
    }

    // Stars column: gold, centered
    starsCell.getStyle().getFont().setColor(COLORS.starGold);
    starsCell.getStyle().getAlignment().setHorizontal('center');

    // Advance cursor — always use getRowAfter() on the written range
    cursor = cursor.getRowAfter();
  }

  // ── 4. Await formula calculation before reading any results ───────────────
  await workbook.whenCalculationReady();

  // ── 5. Summary section (below data, with a blank spacer row) ──────────────

  // cursor is now one row below the last data row; skip one more for spacing
  const summaryStart = cursor.getRowAfter();
  const dataEndRow   = summaryStart.getRowStart() - 2; // last data row (0-based, inclusive)

  // Build A1-style addresses for the data columns we'll aggregate
  // getAddress() on a range gives us e.g. "D4:D11"
  const pagesColRange  = sheet.getRangeAt(dataStartRow, COL.PAGES,  dataEndRow, COL.PAGES);
  const ratingColRange = sheet.getRangeAt(dataStartRow, COL.RATING, dataEndRow, COL.RATING);

  // Summary rows: label in col A, formula in col B
  const summaryRows: Array<[string, string]> = [
    ['Books read',      `=COUNTA(${pagesColRange.getAddress()})`],
    ['Total pages',     `=SUM(${pagesColRange.getAddress()})`],
    ['Avg rating',      `=ROUND(AVERAGE(${ratingColRange.getAddress()}),1)`],
    ['Highest rated',   `=MAX(${ratingColRange.getAddress()})`],
    ['Avg pages/book',  `=ROUND(AVERAGE(${pagesColRange.getAddress()}),0)`],
  ];

  let sumCursor = summaryStart;
  for (const [label, formula] of summaryRows) {
    sumCursor.getColumnAt(COL.TITLE).setValue(`'${label}`);
    sumCursor.getColumnAt(COL.AUTHOR).setValue(formula);
    sumCursor = sumCursor.getRowAfter();
  }

  // Style the entire summary block at once
  const summaryHeight = summaryRows.length;
  const summaryBlock  = summaryStart.getResizeBy(summaryHeight - 1, 1); // 2 cols wide
  summaryBlock.getStyle().getFill().setColor(COLORS.summaryBg);
  summaryBlock.getStyle().getBorders().setOutline({ style: 'medium', color: COLORS.summaryBorder });

  // Bold the label column
  summaryStart.getResizeBy(summaryHeight - 1, 0)
    .getStyle().getFont().setBold(true);

  // ── 6. Column widths ──────────────────────────────────────────────────────
  // autoFit after all writes are done
  sheet.getRange('A1')
    .getResizeBy(dataEndRow + summaryHeight + 2, NUM_COLS - 1)
    .autoFit();

  return workbook;
}

// ─── Writer helpers ───────────────────────────────────────────────────────────

/**
 * Writes the workbook to both .xlsx and .sxl.
 * Returns the paths written.
 */
export async function writeReadingLog(
  workbook: Workbook,
  baseName: string,
): Promise<{ xlsx: string; sxl: string }> {
  const xlsxPath = `${baseName}.xlsx`;
  const sxlPath  = `${baseName}.sxl`;

  await Promise.all([
    WorkbookIO.write(workbook, xlsxPath),
    WorkbookIO.write(workbook, sxlPath),
  ]);

  return { xlsx: xlsxPath, sxl: sxlPath };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Install IO plugin, build the log, write both formats into ./output.
 */
export async function main(
  books = SAMPLE_BOOKS,
): Promise<void> {
  WorkbookIO.install(IOPlugin);

  const outDir = path.resolve(__dirname, '..', 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = path.join(outDir, 'reading-log');

  console.log(`Building reading log for ${books.length} books…`);
  const workbook = await buildReadingLog(books);

  const paths = await writeReadingLog(workbook, baseName);
  console.log(`✓ Wrote ${paths.xlsx}`);
  console.log(`✓ Wrote ${paths.sxl}  (>50× smaller, not Excel-compatible)`);
}

// Run when executed directly (e.g. `tsx src/readinglog.ts`), but not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
