/* cspell: disable */
import { FormulaContext, FormulaError, type Scalar, type IReferenceRange, type IRange } from '@sheetxl/primitives';

/**
 * @summary Returns information about the cell.
 * @param {'address' | 'col' | 'contents' | 'row' | 'type'} infoType The type of information to return.
 * @param infoType
 * @param reference
 *
 * @remarks
 * This has similar functionality to Excel online but is missing formatting information from Excel desktop.
 * {@link https://support.office.com/client/results?authtype=unknown&lcid=1033&locale=en-us&ns=EXCEL&syslcid=1033&uilcid=1033&version=90&helpid=xlmain11.chm60173}
 */
// TODO - needs to limit to a single cell. We don't have this feature
export function CELL(
  infoType: string,
  reference: IReferenceRange
): Scalar {
  let retValue: Scalar = null;
  switch (infoType) {
    case 'address':
      // we just one the top left
      const coords = reference.getCoords();
      retValue = FormulaContext.getAddress({
        colIndex: coords.colStart,
        $colIndex: true,
        rowIndex: coords.rowStart,
        $rowIndex: true
      })
      break;
    case 'col':
      retValue = reference.getCoords().colStart + 1;
      break;
    case 'contents':
      retValue = reference.getValueAt(0, 0);
      break;
    case 'row':
      retValue = reference.getCoords().colStart + 1;
      break;
    case 'type':
      const value = reference.getValueAt(0, 0);
      if (value === null) {
        retValue = 'b';
      } else  if (typeof value === 'string') {
        retValue = 'l';
      } else {
        retValue = 'v';
      }
      break;
    default:
      retValue = FormulaError.BuiltIn.Value
  }
  FormulaContext.markVolatile();
  return retValue;
}

/**
 * @name ERROR.TYPE
 * @summary Returns a number matching an error value
 * @param errorVal is the error value for which you want the identifying number, and can be an actual error value or a reference to a cell containing an error value.
 */
export function ERROR_TYPE(errorVal: IRange): IRange {
  return errorVal
    .map((scalar: Scalar): number| FormulaError.Known => {
      if (scalar instanceof FormulaError.Known) {
        return scalar.getCode();
      }
      return FormulaError.BuiltIn.NA;
    })
    .fillEmpty(true);
}

/**
 * @summary Returns information about the current operating system.
 * @param {'DIRECTORY' | 'NUMFILE' | 'ORIGIN' | 'OSVERSION' | 'RECALC' | 'RELEASE' | 'SYSTEM' | 'USER'} typeText The type of information to return
 */
export function INFO(typeText: string): string {
  typeText = typeText.toUpperCase();
  if (typeText === 'DIRECTORY') {
    try {
      FormulaContext.markVolatile(); // in case this is a window.location
      return FormulaContext.getRuntime().getLocation();
    } catch (e) {} // may not be available in all environments
    // Fallback for other environments
    return '..';
  }
  if (typeText === 'NUMFILE') {
    return '1';
  }
  if (typeText === 'ORIGIN') {
    // TODO - context doesn't have the view information as it runs in sandbox.
    // context.getView().getTopLeft()
    // FormulaContext.markVolatile();
    return '$A$1'; // top left
  }
  if (typeText === 'RECALC') {
    return '1';
  }
  if (typeText === 'RELEASE') {
    return FormulaContext.getRuntime().getVersion();
  }
  if (typeText === 'OSVERSION') {
    return '1'; // TODO - we could get from navigator.userAgent
  }
  if (typeText === 'SYSTEM') {
    return FormulaContext.getRuntime().getOS();
  }
  // Not standard excel
  if (typeText === 'USER') {
    const licensee = FormulaContext.getRuntime().getUser();
    if (!licensee) {
      FormulaContext.formatResults('@[Red]');
      return 'Unidentified';
    }
    return licensee;
  }
  throw FormulaError.BuiltIn.Value;
}

/**
 * @summary Checks whether a reference is to an empty cell, and returns TRUE or FALSE
 * @param value is the cell or a name that refers to the cell you want to test
 */
export function ISBLANK(value: IRange): IRange {
  return value
    .map((): boolean => false)
    .fillEmpty(true);
}

/**
 * @summary Checks whether a value is an error other than #N/A, and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISERR(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return scalar instanceof FormulaError.Known && (!(scalar instanceof FormulaError.NA));
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether a value is an error, and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISERROR(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return scalar instanceof FormulaError.Known;
    })
    .fillEmpty(false);
}

/**
 * @summary Returns TRUE if the number is even
 * @param number is the value to test
 */
export function ISEVEN(number: IRange<number>): IRange<boolean> {
  return number
    .map((value: Scalar): boolean => {
      if (typeof value !== 'number') return false;
      return Math.trunc(value) % 2 === 0;
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether a reference is to a cell containing a formula, and returns TRUE or FALSE
 * @param reference is a reference to the cell you want to test.  Reference can be a cell reference, a formula, or name that refers to a cell
 */
export function ISFORMULA(reference: IReferenceRange): IRange {
  return reference.map((scalar: Scalar, coords: IRange.CellCoords) => {
    return FormulaContext.getFormulaAt(coords.rowIndex, coords.colIndex) !== null;
  }).fillEmpty(false);
}

/**
 * @summary Checks whether a value is a logical value (TRUE or FALSE), and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISLOGICAL(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return typeof scalar === 'boolean';
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether a value is #N/A, and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISNA(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return scalar instanceof FormulaError.NA;
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether a value is not text (blank cells are not text), and returns TRUE or FALSE
 * @param value is the value you want tested: a cell; a formula; or a name referring to a cell, formula, or value
 */
export function ISNONTEXT(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return typeof scalar !== 'string';
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether a value is not text (blank cells are not text), and returns TRUE or FALSE
 * @param value is the value you want tested: a cell; a formula; or a name referring to a cell, formula, or value
 */
export function ISNUMBER(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return typeof scalar === 'number';
    })
    .fillEmpty(false);
}

/**
 * @summary Returns TRUE if the number is odd
 * @param number is the value to test
 */
export function ISODD(number: IRange<number>): IRange<boolean> {
  return number
    .map((value: Scalar): boolean => {
      if (typeof value !== 'number') return false;
      return Math.trunc(value) % 2 !== 0;
    })
    .fillEmpty(false);
}

/**
 * @summary Checks whether the value is omitted, and returns TRUE or FALSE
 * @param argument is the value you want to test, such as a LAMBDA parameter
 */
export function ISOMITTED(argument: any): boolean {
  return argument === undefined;
}

/**
 * @summary Checks whether a value is a reference, and returns TRUE or FALSE
 * @param value is the value you want to test. Value can refer to a cell, a formula, or a name that refers to a cell, formula, or value
 */
export function ISREF(value: IRange): boolean {
  return (value as IReferenceRange)?.isIReferenceRange ?? false;
}

/**
 * @summary Converts a value to text in a specific number format
 * @param value is a number, a formula that evaluates to a numeric value, or a reference to a cell containing a numeric value
 */
export function ISTEXT(value: IRange): IRange {
  return value
    .map((scalar: Scalar): boolean => {
      return typeof scalar === 'string';
    })
    .fillEmpty(false);
}

/**
 * @summary Converts non-number value to a number, dates to serial numbers, TRUE to 1, anything else to 0 (zero)
 * @param value is the value to convert
 *
 * @remarks
 * We take a range to ensure that auto-spill doesn't occur.
 */
export function N(value: IRange): number {
  const scalar = value.getValueAt(0, 0);

  const type = typeof scalar;
  if (type === 'number') return scalar as number;
  if (type === 'boolean') return Number(scalar);
  if (scalar instanceof FormulaError.Known) throw scalar; // throw the value as an error

  return 0;
}

/**
 * @summary Returns the #N/A error value
 */
export function NA(): FormulaError.Known {
  return FormulaError.BuiltIn.NA;
}

/**
 * @summary Returns the sheet number of the referenced sheet
 * @param value is the name of a sheet or a reference that you want the sheet number of. If omitted the number of the sheet containing the function is returned
 */
export function SHEET(value?: string): number {
  const index = FormulaContext.getSheetIndex(value);
  if (index >= 0 ) return index + 1;
  return FormulaError.BuiltIn.NA as any;
}

/**
 * @summary Returns the number of sheets in a reference
 * @param reference is a reference for which you want to know the number of sheets it contains. If omitted the number of sheets in the workbook containing the function is returned
  */
export function SHEETS(reference?: IReferenceRange): number {
  if (!reference) return FormulaContext.getSheetCount();
  // TODO - This counts the sheets in the formula reference.
  // This works on 3D references which we don't support yet.
  // const coords = reference.getCoords();
  // const formula = FormulaContext.getFormulaAt(coords.rowStart, coords.colStart);
  // const references = formula.getReferences();
  return 1;
}

/**
 * @summary Returns an integer representing the data type of a value: number = 1; text = 2; logical value = 4; error value = 16; array = 64; compound data = 128
 * @param value is the value to check
 */
export function TYPE(value: IRange): number {
  if (value.getWidth() > 1 || value.getHeight() > 1) return 64; // Array

  const scalar = value.getValueAt(0, 0);
  const type = typeof scalar;
  if (type === 'string') return 2;
  if (type === 'boolean') return 4;
  if (scalar instanceof FormulaError.Known) return 16;

  // number or null
  return 1;
}