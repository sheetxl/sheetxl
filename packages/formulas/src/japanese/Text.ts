import { FormulaError, type Scalar, type IReferenceRange } from '@sheetxl/primitives';

/**
 * Returns the phonetic spelling of a text string.
 * @hidden Unimplemented Japanese.
 * @param reference Text string or a reference to a single cell or a range of cells that contain a furigana text string.
 */
export function PHONETIC(reference: IReferenceRange/*CELL*/): Scalar | undefined {
  // TODO - implement. IME-specific: extracts furigana metadata written by Japanese IME.
  return FormulaError.BuiltIn.NA;
}