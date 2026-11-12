/* cspell: disable */
import { FormulaContext, FormulaError, type IFormulaContext } from '@sheetxl/primitives';

/**
 * Returns a URL-encoded string.
 * @param text is a string to be URL encoded.
 */
export function ENCODEURL(text: string): string {
  return encodeURIComponent(text);
}

/**
 * One request per call, through the workbook's fetch (which keeps the answer); a call the sheet no
 * longer wants aborts its request.
 */
function runWebservice(
  calls: readonly IFormulaContext.DeferredCall<string>[],
  ctx: IFormulaContext.IDeferContext
): void {
  for (const call of calls) {
    const controller = new AbortController();
    call.onCancel((): void => controller.abort());
    fetchText(ctx, call.payload as string, controller.signal).then(
      (text: string): void => call.resolve(text),
      (error: unknown): void => call.reject(error)
    );
  }
}

/**
 * Retrieves data from a web service.
 * @param url is the URL of the web service.
 */
export function WEBSERVICE(url: string): string {
  FormulaContext.defer(runWebservice, url);
  // The cell shows `#GETTING_DATA` until the response lands; an error passes through a text return.
  return FormulaError.BuiltIn.GettingData as unknown as string;
}

async function fetchText(ctx: IFormulaContext.IDeferContext, url: string, signal: AbortSignal): Promise<string> {
  try {
    // Fetch without restricting content type
    const response = await ctx.fetch(url, {
      method: 'GET',
      signal,
      headers: {
        // Accept a wide range of content types
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // Add a user agent to avoid getting blocked by some servers
        'User-Agent': 'SheetXL-Formula-Function-WEBSERVICE'
      }
    });

    // Check if the response was successful
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    // Get the raw text from the response
    return await response.text();
  } catch (error: any) {
    throw FormulaError.isError(error, FormulaError.Code.Blocked) ? new FormulaError.Value(error.message) : FormulaError.BuiltIn.Value;
  }
}
