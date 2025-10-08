/* cspell: disable */
import { FormulaError } from '@sheetxl/primitives';

/**
 * @summary Returns a URL-encoded string
 * @param text is a string to be URL encoded
 */
export function ENCODEURL(text: string): string {
  return encodeURIComponent(text);
}

/**
 * @summary Retrieves data from a web service.
 * @param url is the URL of the web service
 */
export async function WEBSERVICE(url: string): Promise<string> {
  try {
    // Fetch without restricting content type to mimic Excel's behavior
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Accept a wide range of content types like Excel does
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
    // Handle errors like Excel would - return a #VALUE! error
    throw FormulaError.BuiltIn.Value;
  }
}
