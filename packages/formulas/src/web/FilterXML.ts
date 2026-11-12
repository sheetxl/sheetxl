/* cspell: disable */
import { FormulaContext, FormulaError, type IFormulaContext, type Scalar } from '@sheetxl/primitives';

interface FilterPayload {
  xml: string;
  xpath: string;
}

/**
 * Returns specific data from XML content using the specified XPath.
 * @param xml is a string in valid XML format.
 * @param xpath is a string in standard XPath format.
 */
export function FILTERXML(xml: string, xpath: string): Scalar[][] {
  // If we've previously failed to load dependencies, fail fast
  if (errorLoadDOM) throw FormulaError.BuiltIn.Blocked;
  if (parser && fontoxpath) return evaluateXPath(xml, xpath);
  // Only the one-time load of the XML libraries is asynchronous: the answer waits on it, once.
  FormulaContext.defer(loadAndFilter, { xml, xpath });
  return FormulaError.BuiltIn.Busy as unknown as Scalar[][];
}

/** Loads the XML libraries once, then answers every call; none of them can be answered without. */
async function loadAndFilter(calls: readonly IFormulaContext.DeferredCall<Scalar[][]>[]): Promise<void> {
  if (!parser || !fontoxpath) {
    try {
      // Shared across calls: a recalculation can restart a cell whose previous attempt is still in
      // flight, and two concurrent loads would each fetch and each report. One attempt, one answer.
      loadingFromCDN ??= loadFromCDN();
      await loadingFromCDN;
    } catch (cdnError: any) {
      // Guarded by the latch, which every waiter on the shared attempt reaches: report the first
      // failure and stay quiet after. Latching also stops later recalculations from re-attempting —
      // Node can never succeed here (its ESM loader refuses an `https:` specifier), so the first
      // failure is the final answer.
      if (!errorLoadDOM) {
        errorLoadDOM = true;
        // A warning, not an error, and the message without the stack: an environment that cannot
        // host the XML libraries is a capability limit, not a fault. The cell still says so.
        console.warn(`FILTERXML is unavailable: XML libraries could not be loaded (${cdnError?.message ?? cdnError}).`);
      }
    }
  }
  if (!parser || !fontoxpath) {
    if (!errorLoadDOM) {
      errorLoadDOM = true;
      console.warn('Unable to load XML libraries');
    }
    for (const call of calls) call.reject(FormulaError.BuiltIn.Blocked);
    return;
  }
  for (const call of calls) {
    const { xml, xpath } = call.payload as FilterPayload;
    try {
      call.resolve(evaluateXPath(xml, xpath));
    } catch (error: unknown) {
      call.reject(error);
    }
  }
}

function evaluateXPath(xml: string, xpath: string): Scalar[][] {
  try {
    const doc = parser!.parseFromString(xml, 'text/xml');
    // Execute the XPath query
    const result = fontoxpath!.evaluateXPathToString(
      xpath,
      doc,
      null,
      {}
    );
    return [[result]];
  } catch (error: any) {
    throw FormulaError.BuiltIn.Value;
  }
}

/**
 * Loads the XML libraries from an ESM CDN, once.
 *
 * @remarks
 * The URLs are built from fragments so a bundler cannot statically analyze them, and the import is
 * marked ignorable — these must stay a runtime fetch, not a build-time dependency.
 */
const loadFromCDN = async (): Promise<void> => {
  const fontoxpathUrl = `${'https://esm.sh/'}fontoxpath@3.33.2`;
  const xmldomUrl = `${'https://esm.sh/'}@xmldom/xmldom@0.8.11`;

  const [fontoxpathModule, xmldomModule] = await Promise.all([
    // @ts-ignore - Dynamic ESM URL import
    import(/* webpackIgnore: true */ /* @vite-ignore */ fontoxpathUrl),
    // @ts-ignore - Dynamic ESM URL import
    import(/* webpackIgnore: true */ /* @vite-ignore */ xmldomUrl)
  ]);
  fontoxpath = fontoxpathModule;
  // NOTE: assign via a local — `DOMParser = ...` would clobber the browser global
  // (and throw a ReferenceError in Node ESM, where no global binding exists).
  const DOMParserCtor: new () => XMLDOMParser = xmldomModule.DOMParser;
  parser = new DOMParserCtor();
};

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
/** The single in-flight (or settled) CDN load, so concurrent calls share one attempt. */
let loadingFromCDN: Promise<void> | null = null;
