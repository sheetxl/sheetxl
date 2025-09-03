import type { Scalar } from './Scalar';
import type { IReferenceRange } from './IReferenceRange';
import type { IRange } from './IRange';
import type { IFunction } from './IFunction';
import type { IFormulaContext } from './IFormulaContext';
import type { IRuntime } from './IRuntime';

/**
 * Default implementation of the IFormulaContext interface.
 *
 * @see IFormulaContext
 *
 * @remarks
 * This is a stubbed implementation of the IFormulaContext interface.
 * Runtime engines should provide a complete implementation.
 */
export class StubbedFormulaContext implements IFormulaContext {

  /** @inheritdoc IFormulaContext.getRange */
  getRange(value: Scalar | Scalar[][]): IRange {
    throw new NotImplementedError();
  }

  /** @inheritdoc IFormulaContext.getReference */
  getReference(coords: Readonly<IRange.Coords>, r1c1?: boolean): IReferenceRange {
    throw new NotImplementedError()
  }

    /** @inheritdoc IFormulaContext.getNumberFormat */
  getNumberFormat(formatText: string, value: Scalar): string {
    // invalid but could use ssf library
    return value?.toString() ?? '';
  }

  /** @inheritdoc IFormulaContext.fromOADate */
  fromOADate(oaDate: number): Date {
    // invalid but could use ssf library
    return new Date(oaDate);
  }

  /** @inheritdoc IFormulaContext.toOADate */
  toOADate(date: Date): number {
    // invalid but could use ssf library
    return date.getTime();
  }

  /** @inheritdoc IFormulaContext.getValueAt */
  getValueAt(row: number, column: number): Scalar | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getEntireCoords */
  getEntireCoords(): IRange.Coords {
    return defaultEntireCoords;
  }

  /** @inheritdoc IFormulaContext.isValidDate */
  isValidDate(value: any): boolean {
    if (value instanceof Date || Object.prototype.toString.call(value) === '[object Date]') {
      // Verify it's a valid date (not Invalid Date)
      return !isNaN(value.getTime());
    }
    return false;
  }

  /** @inheritdoc IFormulaContext.getPosition */
  getPosition(): Readonly<IRange.CellCoords> {
    return defaultEmptyPosition;
  }

  /** @inheritdoc IFormulaContext.getFormulaAt */
  getFormulaAt(row: number, column: number): string | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getSpillAt */
  getSpillAt(row: number, column: number): IReferenceRange | null {
    return null;
  }

  /** @inheritdoc IFormulaContext.getSheetIndex */
  getSheetIndex(sheetName?: string): number {
    return -1;
  }

  /** @inheritdoc IFormulaContext.getSheetCount */
  getSheetCount(): number | null {
    return 1;
  }

  /** @inheritdoc IFormulaContext.markVolatile */
  markVolatile(): void {
    // nothing
  }

  /** @inheritdoc IFormulaContext.formatResults */
  formatResults(numFmt: string): void {
    // nothing
  }

  /** @inheritdoc IFormulaContext.getFunction */
  getFunction(name: string): IFunction {
    return null;
  }

  /** @inheritdoc IFormulaContext.getAddress */
  getAddress(coords?: Readonly<IRange.FixableCoords | IRange.FixableCellCoords>, r1c1?: boolean): string {
    throw new NotImplementedError();
  }

  /** @inheritdoc IFormulaContext.parseAsDateTime */
  parseAsDateTime(text: string, requireDate?: boolean): number | null {
    throw new NotImplementedError();
  }

  /** @inheritdoc IFormulaContext.getRuntime */
  getRuntime(): IRuntime {
    return defaultRuntimeDetails;
  }
}

const NOT_IMPLEMENTED_ERROR = 'Not implemented in StubbedFormulaContext';
class NotImplementedError extends Error {
  constructor(message: string=NOT_IMPLEMENTED_ERROR) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

const defaultEmptyPosition: IRange.CellCoords = Object.freeze({ colIndex: 0, rowIndex: 0 });

const defaultEntireCoords: IRange.Coords = Object.freeze({
  colStart: 0, // Zero based index
  rowStart: 0, // Zero based index
  colEnd: Math.pow(2, 14)-1, // Math.pow(2, 14) // 16384 (XFD) - Excel
  rowEnd: Math.pow(2, 20)-1  // Math.pow(2, 20) // 1048576 - Excel
});

const defaultRuntimeDetails: IRuntime = {
  getCurrencySymbol: () => '$',
  getNumberDecimalSeparator: () => '.',
  getNumberGroupSeparator: () => ',',
  isDate1904: () => false,
  getLocation: () => 'unknown',
  getVersion: () => '1.0.0',
  getOS: () => 'unknown',
  getUser: () => 'unidentified',
  getDescription: () => 'Stubbed Formula Context',
}

/** @inheritdoc IFormulaContext*/
export const FormulaContext: IFormulaContext = new StubbedFormulaContext();
