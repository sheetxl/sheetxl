
/**
 * An error returned from a formula calculation.
 *
 * Standard Error Codes
 *  0. #PARSE! If the formula contains a syntax error. (Not part of the OOXML spec.)
 *  1. #NULL! Intersection of two ranges that don't intersect.
 *  2. #DIV/0! Division by zero.
 *  3. #VALUE! Wrong type of argument or operand.
 *  4. #REF! Invalid cell reference.
 *  5. #NAME? Unrecognized name (function, named range, etc.).
 *  6. #NUM! Invalid numeric value.
 *  7. #N/A Value not available.
 * # Office 365
 *  8. #GETTING_DATA This is raised for long running calculations that are not yet complete.
 *
 *  (Saves as #N/A to disk)
 *  9. #SPILL! Formula's output range is blocked.
 *
 *  SpillErrorScalarSubType | "Unknown" | "Collision" | "IndeterminateSize" | "WorksheetEdge" | "OutOfMemoryWhileCalc" | "Table" | "MergedCell"
 * # Office 2023
 * 10. #CONNECT! This occurs when a data type is used that is not currently supported in this version of Excel.
 * 11. #BLOCKED! Indicates that an action or feature is blocked, possibly due to security settings, protected view, or other restrictions. Often related to online features, external links, or macros.
 * 12. #UNKNOWN! May be returned in the case of a protected workbook.
 * 13. #FIELD! Invalid field name for a data type.
 * 14. #CALC! Calculation error (often with LET or LAMBDA or a splitted array).
 * 15.
 * 16.  #BUSY! When waiting on an external data source to return data.
 * 17.
 * 18.
 * 19. #PYTHON! The Python interpreter returned the following error: Unexpected failure.
 * 20. #TIMEOUT! Indicates that the operation took too long to complete.
*/

export namespace FormulaError {

  export const Code = {
    Parse: 0, // Not ooxml
    Null: 1,
    Div0: 2,
    Value: 3,
    Ref: 4,
    Name: 5,
    Num: 6,
    NA: 7,
    GettingData: 8,
    Spill: 9,
    Connect: 10,
    Blocked: 11,
    Unknown: 12,
    Field: 13,
    Calc: 14,
    // no 15
    Busy: 16,
    // no 17, 18
    Python: 19,
    Timeout: 20,
  } as const;

  export const Label = {
    Parse: '#PARSE!',
    Null: '#NULL!',
    Div0: '#DIV/0!',
    Value: '#VALUE!',
    Ref: '#REF!',
    Name: '#NAME?',
    Num: '#NUM!',
    NA: '#N/A',
    GettingData: '#GETTING_DATA', // runtime error, persists as #N/A
    Spill: '#SPILL!',
    Connect: '#CONNECT!',
    Blocked: '#BLOCKED!',
    Unknown: '#UNKNOWN!',
    Field: '#FIELD!',
    Calc: '#CALC!',

    Busy: '#BUSY!',

    Python: '#PYTHON!',
    Timeout: '#TIMEOUT!',
  } as const;


  export class Known extends Error {
    protected _label: string;
    protected _code: number;
    protected details: any;

    constructor(code: number, label: string, message?: string, details?: ErrorOptions) {
      super(message, details);
      this._label = label;
      this._code = code;
      this.details = details;
    }
    static code: number = FormulaError.Code.Unknown;

    get isFormulaError(): true {
      return true;
    }

    getLabel(): string {
      return this._label;
    }

    getCode(): number {
      return this._code;
    }

    /**
     * Return true if two errors are same.
     *
     * @param other any object to compare.
     * @returns if two errors are the same type.
     */
    equals(other: any): boolean {
      if (!other) return false;
      // if (!other.isFormulaError) return false;
      if (this._code === (other as any)._code) return true;
      if (this._code === (other as any).code) return true;

      return false;
    }

    // TODO - make this type specific?
    get [Symbol.toStringTag](): string {
      return `[FormulaError]`;
    }

    toString(): string {
      return this.message || this._label;
    }
  }

  /**
   * #Parse!
   *
   * @remarks
   * Not part of the OOXML spec.
   */
  export class Parse extends Known {
    constructor(message?: string, details?: ErrorOptions & {
      line?: number;
      column?: number;
      offset?: number;
      length?: number;
    }) {
      super(Code.Parse, Label.Parse, message, details);
    }
    static code: number = FormulaError.Code.Parse;

    getDetails(): { line: number, column: number, offset: number, length: number } {
      const details = this.details;
      return {
        line: details?.line ?? 1,
        column: details?.column ?? 1,
        offset: details?.offset ?? 0,
        length: details?.length ?? 0,
      }
    }
  }

  /**
   * When a reference is provided that doesn't exist. Usually an invalid range specification.
   * =SUM(G5 G23)
   */
  export class Null extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Null, Label.Null, message, details)
    }
    static code: number = FormulaError.Code.Null;
  }

  /**
   * Divide by Zero.
   * * ex: The formula or function used is divided by zero.
   */
  export class Div0 extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Div0, Label.Div0, message, details)
    }
    static code: number = FormulaError.Code.Div0;
  }

  /**
   * Wrong argument in the formula. For example a string was given but a number was
   * * ex: The row index number is too small. Specify a number great than or equal to 1.
   */
  export class Value extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Value, Label.Value, message, details)
    }
    static code: number = FormulaError.Code.Value;
  }

  /**
   * Reference was remove due to a move or delete of cells.
   * * ex: Moving or deleting cells caused an invalid cell reference, or function is returning reference error.
   */
  export class Ref extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Ref, Label.Ref, message, details)
    }
    static code: number = FormulaError.Code.Ref;
  }

  /**
   * A formula has references that can not be resolved or may contain parsing errors.
   * * ex: The formula contains unrecognized text.
   */
  export class Name extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Name, Label.Name, message, details);
    }
    static code: number = FormulaError.Code.Name;
  }

  /**
   * Invalid number.
   */
  export class Num extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Num, Label.Num, message, details)
    }
    static code: number = FormulaError.Code.Num;
  }

  /**
   * Not available.
   *
   * @remarks
   * Indicates the data needed is not available.
   */
  export class NA extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.NA, Label.NA, message, details)
    }
    static code: number = FormulaError.Code.NA;
  }

  /**
   * Getting Data.
   */
  export class GettingData extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.GettingData, Label.GettingData, message, details)
    }
    static code: number = FormulaError.Code.GettingData;
  }

  /**
   * Spill.
   */
  // TODO - SpillErrorScalarSubType | "Unknown" | "Collision" | "IndeterminateSize" | "WorksheetEdge" | "OutOfMemoryWhileCalc" | "Table" | "MergedCell"
  export class Spill extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Spill, Label.Spill, message, details)
    }
    static code: number = FormulaError.Code.Spill;
  }

  /**
   * Connect.
   */
  export class Connect extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Connect, Label.Connect, message, details)
    }
    static code: number = FormulaError.Code.Connect;
  }

  /**
   * Blocked.
   */
  export class Blocked extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Blocked, Label.Blocked, message, details)
    }
    static code: number = FormulaError.Code.Blocked;
  }

  /**
   * Unknown.
   */
  export class Unknown extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Unknown, Label.Unknown, message, details)
    }
    static code: number = FormulaError.Code.Unknown;
  }

  /**
   * Field does not exist.
   *
   * @remarks
   * Indicates a field or property being access is not available.
   */
  export class Field extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Field, Label.Field, message, details)
    }
    static code: number = FormulaError.Code.Field;
  }

  /**
   * Calc.
   */
  export class Calc extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Calc, Label.Calc, message, details)
    }
    static code: number = FormulaError.Code.Calc;
  }

  /**
   * Busy.
   */
  export class Busy extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Busy, Label.Busy, message, details)
    }
    static code: number = FormulaError.Code.Busy;
  }

  /**
   * Python.
   */
  export class Python extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Python, Label.Python, message, details)
    }
    static code: number = FormulaError.Code.Python;
  }

  /**
   * Unknown.
   */
  export class Timeout extends Known {
    constructor(message?: string, details?: ErrorOptions) {
      super(Code.Timeout, Label.Timeout, message, details)
    }
    static code: number = FormulaError.Code.Timeout;
  }

}

/**
 * Preset Cell Errors.
 */
const BuiltinFormulaTypes = {};
BuiltinFormulaTypes[FormulaError.Code.Parse] = FormulaError.Parse;
BuiltinFormulaTypes[FormulaError.Code.Null] = FormulaError.Null;
BuiltinFormulaTypes[FormulaError.Code.Div0] = FormulaError.Div0;
BuiltinFormulaTypes[FormulaError.Code.Value] = FormulaError.Value;
BuiltinFormulaTypes[FormulaError.Code.Ref] = FormulaError.Ref;
BuiltinFormulaTypes[FormulaError.Code.Name] = FormulaError.Name;
BuiltinFormulaTypes[FormulaError.Code.Num] = FormulaError.Num;
BuiltinFormulaTypes[FormulaError.Code.NA] = FormulaError.NA;
BuiltinFormulaTypes[FormulaError.Code.GettingData] = FormulaError.GettingData;
BuiltinFormulaTypes[FormulaError.Code.Spill] = FormulaError.Spill;
BuiltinFormulaTypes[FormulaError.Code.Connect] = FormulaError.Connect;
BuiltinFormulaTypes[FormulaError.Code.Blocked] = FormulaError.Blocked;
BuiltinFormulaTypes[FormulaError.Code.Unknown] = FormulaError.Unknown;
BuiltinFormulaTypes[FormulaError.Code.Field] = FormulaError.Field;
BuiltinFormulaTypes[FormulaError.Code.Calc] = FormulaError.Calc;

BuiltinFormulaTypes[FormulaError.Code.Busy] = FormulaError.Busy;

BuiltinFormulaTypes[FormulaError.Code.Python] = FormulaError.Python;
BuiltinFormulaTypes[FormulaError.Code.Timeout] = FormulaError.Timeout;

const _errorInstanceByLabel: Map<string, FormulaError.Known> = new Map();
const _errorInstanceById: Map<number, FormulaError.Known> = new Map();

type ErrorClass = new (message: string, details?: ErrorOptions) => FormulaError.Known;
const _errorTypeByLabel: Map<string, ErrorClass> = new Map();
const _errorTypeById: Map<number, ErrorClass> = new Map();


const errorTypes = Object.keys(BuiltinFormulaTypes);
for (let i=0; i<errorTypes.length;i++) {
  const typeId = errorTypes[i];
  const typed = BuiltinFormulaTypes[typeId];
  _errorTypeByLabel.set(FormulaError.Label[typeId], typed);
  _errorTypeById.set(FormulaError.Code[typeId], typed);

  const instance:FormulaError.Known = new typed();

  _errorInstanceByLabel.set(instance.getLabel(), instance);
  _errorInstanceById.set(instance.getCode(), instance);
}

const FormulaErrorUnknown = _errorInstanceById.get(FormulaError.Code.Unknown);

export namespace FormulaError {

  export const BuiltIn = {
    Parse: new FormulaError.Parse(),
    Null: new FormulaError.Null(),
    Div0: new FormulaError.Div0(),
    Value: new FormulaError.Value(),
    Ref: new FormulaError.Ref(),
    Name: new FormulaError.Name(),
    Num: new FormulaError.Num(),
    NA: new FormulaError.NA(),

    GettingData: new FormulaError.GettingData(),
    Spill: new FormulaError.Spill(),
    Connect: new FormulaError.Connect(),
    Blocked: new FormulaError.Blocked(),
    Unknown: new FormulaError.Unknown(),
    Field: new FormulaError.Field(),
    Calc: new FormulaError.Calc(),

    Busy: new FormulaError.Busy(),

    Python: new FormulaError.Python(),
    Timeout: new FormulaError.Timeout(),
  } as const;

  export const getBuiltInByLabel = (label: string): FormulaError.Known => {
    return _errorInstanceByLabel.get(label);
  };

  export const newTypedError = (label: string | number, message?: string, details?: ErrorOptions): FormulaError.Known => {
    let typedError: ErrorClass;
    if (typeof label === 'string') {
      typedError = _errorTypeByLabel.get(label);
    } else {
      typedError = _errorTypeById.get(label as number);
    }
    if (!typedError) {
      typedError = FormulaError.Unknown;
    }
    return new typedError(message, details);
  };

  export const getBuiltInById = (id: number): FormulaError.Known => {
    return _errorInstanceById.get(id) || FormulaErrorUnknown;
  };

}