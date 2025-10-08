/* cspell: disable */
import { FormulaError } from '@sheetxl/primitives';

// Define interfaces for type safety
interface XMLDOMParser {
  parseFromString(xml: string, mimeType: string): Document;
}

interface XPathEvaluator {
  evaluateXPathToString(xpath: string, doc: Document, namespaceResolver: any, options: object): string;
}

// Module-level cache variables
let parser: XMLDOMParser | null = null;
let fontoxpath: XPathEvaluator | null = null;
let errorLoadDOM: boolean = false;

/**
 * @summary Returns specific data from XML content using the specified XPath.
 * @param xml is a string in valid XML format.
 * @param xpath is a string in standard XPath format.
 */
export async function FILTERXML(xml: string, xpath: string): Promise<string> {
  // If we've previously failed to load dependencies, fail fast
  if (errorLoadDOM) throw FormulaError.BuiltIn.Blocked;

  if (!parser) {
    try {
      // This will work when dependencies are installed locally
      // TODO - Comment out for now to satisfy vite. Install locally for node
      // @ts-ignore - ESM URL import
      // fontoxpath = await import('fontoxpath');
      // // @ts-ignore - ESM URL import
      // const xmldom = await import('@xmldom/xmldom');
      // const DOMParser = xmldom.DOMParser;
      // parser = new DOMParser();
    } catch (importError) {
      console.warn('Error loading XML libries from bundle:', importError);
    }
  }  if (!DOMParser || !fontoxpath) {
    try {
      console.log('Falling back to ESM CDN for XML libraries');
      // Construct URLs dynamically to prevent webpack from analyzing them at build time
      const fontoxpathUrl = `${'https://esm.sh/'}fontoxpath@3.33.2`;
      const xmldomUrl = `${'https://esm.sh/'}@xmldom/xmldom@0.8.11`;

      const [fontoxpathModule, xmldomModule] = await Promise.all([
        // @ts-ignore - Dynamic ESM URL import
        import(/* webpackIgnore: true */ /* @vite-ignore */ fontoxpathUrl),
        // @ts-ignore - Dynamic ESM URL import
        import(/* webpackIgnore: true */ /* @vite-ignore */ xmldomUrl)
      ]);
      fontoxpath = fontoxpathModule;
      DOMParser = xmldomModule.DOMParser;
      parser = new DOMParser();
    } catch (cdnError) {
      console.error('Error loading XML libraries from CDN:', cdnError);
      throw new Error('Failed to load XML libraries');
    }
  }

  if (!parser) {
    errorLoadDOM = true;
    console.warn('Unable to load XML libraries');
    throw FormulaError.BuiltIn.Blocked;
  }

  try {
    const doc = parser.parseFromString(xml, 'text/xml');
    // Execute the XPath query
    const result = fontoxpath.evaluateXPathToString(
      xpath,
      doc,
      null,
      {}
    );
    return result;
  } catch (error: any) {
    throw FormulaError.BuiltIn.Value;
  }
}
