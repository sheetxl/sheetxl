/* cspell: disable */
import {
  FormulaContext, FormulaError,
  type IFormulaContext, type Scalar, type Omittable
} from '@sheetxl/primitives';

interface ImportPayload {
  url: string;
  delimiter: string;
}

const NOT_FOUND = 'Resource at url not found.';

/** Comma, unless the file name says tab-separated. The name, not the content, decides. */
function delimiterFromName(url: string): string {
  const path = url.split(/[?#]/, 1)[0];
  return /\.tsv$/i.test(path) ? '\t' : ',';
}

/** One request per distinct URL and delimiter; a request no cell still wants is aborted. */
async function runImportData(
  calls: readonly IFormulaContext.DeferredCall<Scalar[][]>[],
  ctx: IFormulaContext.IDeferContext
): Promise<void> {
  await ctx.byPayload(calls, async (payload: ImportPayload, group: readonly IFormulaContext.DeferredCall<Scalar[][]>[]): Promise<void> => {
    const controller = new AbortController();
    let wanted = group.length;
    for (const call of group) {
      call.onCancel((): void => { if (--wanted === 0) controller.abort(); });
    }
    let text: string;
    try {
      const response = await ctx.fetch(payload.url, {
        signal: controller.signal,
        headers: { Accept: 'text/csv, text/tab-separated-values, text/plain, */*' }
      });
      if (!response.ok) throw new FormulaError.NA(NOT_FOUND);
      text = await response.text();
    } catch (error: unknown) {
      if (FormulaError.isError(error, FormulaError.Code.Blocked)) throw new FormulaError.NA(error.message);
      throw FormulaError.isError(error) ? error : new FormulaError.NA(NOT_FOUND);
    }
    const rows = await ctx.parseText(text, { delimiter: payload.delimiter });
    const result: Scalar[][] = rows.length > 0 ? rows : [[null]];
    // An empty field is nothing, not zero (Google Sheets: ISBLANK is TRUE).
    for (const call of group) call.resolve(result, { keepBlanks: true });
  });
}

/**
 * Imports data at a given url in .csv (comma-separated value) or .tsv (tab-separated value) format.
 * @param url the url of the .csv or .tsv data, including protocol (e.g. `http://`).
 * @param delimiter the single character between fields. It may not be a double quote, or whitespace other than a tab. Default is inferred from the file name: comma for CSV, tab for TSV.
 * @param locale a language and region locale code to use when parsing the data (`"en_US"`). Default is the workbook's locale.
 *
 * @example
 *  =IMPORTDATA("https://api.covidtracking.com/v1/us/daily.csv")
 *
 * @remarks
 * * The cell shows `#BUSY!` until the data arrives, then spills one row per line.
 * * Each field is read as if it were typed into a cell: numbers, dates and `TRUE`/`FALSE` become
 *   values, anything else stays text, and an empty field is blank.
 * * A url that cannot be fetched is `#N/A`.
 * * In a browser the server must allow cross-origin requests (CORS), or the workbook's fetcher
 *   must reach it another way. Otherwise the `#N/A` says the site is restricted.
 * * A recalculation does not ask again; the data is kept while the workbook is open, and a
 *   workbook opens with the data it was saved with.
 *   *Refresh All* does.
 * * `locale` is accepted for compatibility; fields are read with the workbook's locale.
 *
 * @category Sheets
 */
export function IMPORTDATA(
  url: string,
  delimiter?: Omittable<string>,
  locale?: Omittable<string>
): Scalar[][] {
  if (delimiter !== undefined && (delimiter.length !== 1 || delimiter === '"' || (delimiter !== '\t' && /\s/.test(delimiter)))) {
    throw new FormulaError.Value(`IMPORTDATA delimiter value is ${delimiter}. It should be a single character that is not a double quote or a blank space.`);
  }
  const address = url.trim();
  if (!address) throw new FormulaError.NA(NOT_FOUND);
  const payload: ImportPayload = {
    url: address,
    delimiter: delimiter ?? delimiterFromName(address)
  };
  FormulaContext.defer(runImportData, payload);
  return [[FormulaError.BuiltIn.Busy as unknown as Scalar]];
}
