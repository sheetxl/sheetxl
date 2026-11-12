import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, it } from 'vitest';

import { Workbook, WorkbookIO, type IWorkbook } from '@sheetxl/sdk';

import { IOPlugin } from '..';

WorkbookIO.install(IOPlugin);

/**
 * Writes the async workbooks used to exercise `defer` by hand: open one, read the
 * module in the script editor, recalculate, undo and redo.
 *
 * Opt-in: runs only when `SHEETXL_ASYNC_FIXTURES` names the directory to write to, e.g.
 * `SHEETXL_ASYNC_FIXTURES=./async-fixtures npx vitest run src/__tests__/async.fixtures.node.test.ts`
 * from `packages/io`. The DADJOKE module is read from `templates-scripting/templates/dadJoke.ts`,
 * beside this repository, so the sample has one source.
 */
const OUT = process.env.SHEETXL_ASYNC_FIXTURES;
const DADJOKE = path.resolve(__dirname, '../../../../../templates-scripting/templates/dadJoke.ts');

/** Writes `rows` of `[what, formula, note]` under a header, one case a row. */
const writeCases = (workbook: IWorkbook, rows: [string, string, string][]): void => {
  const sheet = workbook.getWorksheetAt(0)!;
  sheet.getRange('A1:C1').setValues([['Case', 'Formula', 'Expect']]);
  rows.forEach(([what, formula, note], i) => {
    sheet.getRange(`A${i + 2}`).setValue(what);
    sheet.getRange(`B${i + 2}`).setValue(formula);
    sheet.getRange(`C${i + 2}`).setValue(note);
  });
};

const save = async (workbook: IWorkbook, name: string): Promise<void> => {
  await workbook.getCalculation().ready();
  const buffer = await WorkbookIO.writeArrayBuffer(workbook, { format: 'SheetXL' });
  fs.mkdirSync(OUT!, { recursive: true });
  fs.writeFileSync(path.join(OUT!, name), new Uint8Array(buffer));
};

describe.runIf(!!OUT)('async fixtures', () => {

  it('async-delay.sxl: the built-in DELAY', async () => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    writeCases(workbook, [
      ['one call', '=DELAY(2000,5)', '5 after 2s'],
      ['over its call', '=DELAY(2000,5)*2', '10'],
      ['two calls', '=DELAY(1000,1)+DELAY(3000,2)', '3'],
      ['nested', '=DELAY(1000,DELAY(1000,7))', '7'],
      ['dependent', '=B2+1', '6 once B2 lands'],
      ['range over pending', '=SUM(B2:B3)', '15'],
      ['IFERROR over pending', '=IFERROR(B2,"waiting")', '5'],
      ['volatile', '=DELAY(1500,RAND())', 'a number'],
      ['filled down (copy me)', '=DELAY(1000,ROW())', 'the row'],
    ]);
    await save(workbook, 'async-delay.sxl');
    workbook.close();
  }, 60_000);

  it('async-dadjoke.sxl: DADJOKE on defer, the module in the editor', async () => {
    const workbook = new Workbook();
    const scripts = workbook.getScripts();
    await scripts.start();
    const module = await scripts.createModule({ source: fs.readFileSync(DADJOKE, 'utf8') });
    scripts.addModule('scripts', module!, { replace: true });
    await workbook.getCalculation().ready();
    writeCases(workbook, [
      ['one joke', '=DADJOKE()', 'Puntificating… then a joke'],
      ['by term', '=DADJOKE("cat")', 'a cat joke'],
      ['same term again', '=DADJOKE("cat")', 'another cat joke, same request'],
      ['dependent', '=LEN(B2)', 'length of the initial, then of the joke'],
      ['over its call', '=DADJOKE("dog")&" 🐶"', 'joke + dog'],
      ['two calls', '=DADJOKE("cow")&" / "&DADJOKE("fish")', 'two jokes'],
      ['no such term', '=DADJOKE("zzzqqq")', '#N/A'],
      ['ISERROR over it', '=ISERROR(B8)', 'FALSE, then TRUE'],
      ['filled down (copy me)', '=DADJOKE("dog")', 'one request for the column'],
    ]);
    await save(workbook, 'async-dadjoke.sxl');
    workbook.close();
  }, 60_000);
});
