import { IFormulaContext, IFunction } from '@sheetxl/primitives';

/**
 * Calls the auto generated binding function to bind all built-in functions.
 *
 * @remarks
 * This is a stubbed implementation. The actual formula binding will be generated
 * by the build process in the sdk package.
 */
export function initialize(getContext: () => IFormulaContext): Map<string, IFunction> {
  // Return empty map for now - this will be replaced by the actual implementation
  // when the formulas are compiled by the sdk package build process.
  return new Map<string, IFunction>();
}

// Export a stub version info
export const version = "0.0.0-stub";
export const formulaCount = 0;
