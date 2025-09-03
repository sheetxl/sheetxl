import { FormulaError, IRange } from '@sheetxl/primitives';

import { Types } from './_Types';

/**
 * Formula helpers.
 */
// TODO - remove
class _FormulaHelpers {
  protected Types = Types;
  protected type2Number = {
    number: Types.NUMBER,
    boolean: Types.BOOLEAN,
    string: Types.STRING,
    object: -1
  };

  /**
   * Flatten an array
   * @param {Array} arr1
   * @returns {*}
   */
  flattenDeep(arr1: any[]): any {
    if (!Array.isArray(arr1)) {
      console.log('flattenDeep invalid arg', arr1);
      arr1 = [arr1];
      // debugger;
    }
    return arr1.reduce((acc, val) => Array.isArray(val) ? acc.concat(this.flattenDeep(val)) : acc.concat(val), []);
  }

  /**
   *
   * @param obj
   * @param isArray - if it is an array: [1,2,3], will extract the first element
   * @param allowBoolean - Allow parse boolean into number
   */
  acceptNumber(obj: any, isArray: boolean=true, allowBoolean: boolean=true): number | FormulaError.Known {
    // check error
    if (obj instanceof FormulaError.Known)
      return obj;
    let asNumber:number;

    if (typeof obj === 'number') {
      asNumber = obj;
    // TRUE -> 1, FALSE -> 0
    } else if (typeof obj === 'boolean') {
      if (allowBoolean) {
        asNumber = Number(obj);
      } else {
        throw FormulaError.BuiltIn.Value;
      }
    }
    // "123" -> 123
    else if (typeof obj === 'string') {
      if (obj.length === 0) {
        throw FormulaError.BuiltIn.Value;
      }
      asNumber = Number(obj);
      // Note: the unique never-equal-to-itself characteristic of NaN
      if (asNumber !== asNumber) {
        throw FormulaError.BuiltIn.Value;
      }
    } else if ((obj as IRange)?.isIRange) {
      const asRange = (obj as IRange);
      if (!isArray) {
        // for range ref, only allow single column range ref
        // TODO - this should give a ref error if a single cell range and there is a not a trailing '#'
        if (asRange.size === 1) {
          asNumber = this.acceptNumber(asRange.getValueAt(0,0) ?? 0) as number;
        } else {
          throw FormulaError.BuiltIn.Value;
        }
      } else {
        asNumber = this.acceptNumber(asRange.getValueAt(0,0) ?? 0) as number;
      }
    } else if (Array.isArray(obj)) {
      if (!isArray) {
        // for range ref, only allow single column range ref
        // TODO - this should give a ref error if a single cell range and there is a not a trailing '#'
        if (obj[0].length === 1) {
          asNumber = this.acceptNumber(obj[0][0]) as number;
        } else {
          throw FormulaError.BuiltIn.Value;
        }
      } else {
        asNumber = this.acceptNumber(obj[0][0]) as number;
      }
    } else {
      throw new FormulaError.Value('Unknown type in FormulaHelpers.acceptNumber')
    }
    return asNumber;
  }

  /**
   * Flatten parameters to 1D array.
   * @see {@link FormulaHelpers.accept}
   * @param {Array} params - Parameter that needs to flatten.
   * @param {Types|null} valueType - The type each item should be,
   *                          null if allows any type. This only applies to literals.
   * @param {boolean} allowUnion - Allow union, e.g. (A1:C1, E4:F3)
   * @param {function} hook - Invoked after parsing each item.
   *                         of the array.
   * @param {*} [defValue=null] - The value if an param is omitted. i.e. SUM(1,2,,,,,)
   * @param {number} [minSize=1] - The minimum size of the parameters
   */
  flattenParams(params: any[], valueType: any, allowUnion: boolean, hook: (param: any, info: any) => void, defValue: any = null, minSize: any = 1): any {
    if (params.length < minSize) {
      throw new FormulaError.NA(`Argument type ${valueType} is missing.`)
      // throw RuntimeError.ARG_MISSING([valueType]);
    }
    if (defValue == null) {
      defValue = valueType === Types.NUMBER ? 0 : valueType == null ? null : '';
    }
    params.forEach(param => {
      const { isCellRef, isRangeRef, isArray } = param;
      let value = param.value;
      const isUnion = false;//value instanceof Collection;
      const isLiteral = !isCellRef && !isRangeRef && !isArray && !isUnion;
      const info = { isLiteral, isCellRef, isRangeRef, isArray, isUnion };

      if ((value as IRange)?.isIRange) {
        value = (value as IRange).getValues();
        if (isCellRef) {
          value = value[0][0];
        }
      }
      // single element
      if (isLiteral) {
        if (param.omitted)
          param = defValue;
        else
          param = this.accept(param, valueType, defValue);
        hook(param, info);
      } else if (isCellRef) { // cell reference of single range reference (A1:A1)
        hook(value, info);
      } else if (isUnion) { // union
        if (!allowUnion) throw FormulaError.BuiltIn.Value;
        param = param.value.data;
        param = this.flattenDeep(param);
        param.forEach(item => {
          hook(item, info);
        })
      } else if (isRangeRef || isArray) {
        param = this.flattenDeep(value);
        param.forEach(item => {
          hook(item, info);
        })
      }
    });
  }

  /**
   * Check if the param valid, return the parsed param.
   * If type is not given, return the un-parsed param.
   * @param {*} param
   * @param {number|null} [type] - The expected type
   *           NUMBER: Expect a single number,
   *           ARRAY: Expect an flatten array,
   *           BOOLEAN: Expect a single boolean,
   *           STRING: Expect a single string,
   *           COLLECTIONS: Expect an Array of the above types
   *           null: Do not parse the value, return it directly.
   *           The collection is not a flatted array.
   * @param {*} [defValue] - Default value if the param is not given.
   *               if undefined, this param is required, a Error will throw if not given.
   *               if null, and param is undefined, null will be returned.
   * @param {boolean} [flat=true] - If the array should be flattened,
   *                      only applicable when type is ARRAY.
   *                      If false, collection is disallowed.
   * @param {boolean} allowSingleValue - If pack single value into 2d array,
   *                     only applicable when type is ARRAY.
   * @returns {string|number|boolean|{}|Array}
   */
  accept(param: any, type: any=null, defValue: any=undefined, flat: boolean=true, allowSingleValue: boolean= false): any {
    let isArray: boolean = false;;

    if (param && ((param as IRange).isIRange || (param.value as IRange)?.isIRange)) {
      const asRange = (param.value ?? param as IRange);
      if (asRange.size === 1 || type !== Types.ARRAY) { // force a value for backward compatibility
        param = asRange.getValueAt(0,0);
      } else {
        param = asRange.getValueAt();
        isArray = true;
      }
    } else if (param?.value) {
      isArray = param.isArray;
      param = param.value;
    }

    // TODO: remove this array check
    if (Array.isArray(type))
      type = type[0];

    if (param === null || param === undefined) {
      if (defValue === undefined) {
        throw new FormulaError.NA(`Argument type ${type} is missing.`);
        // throw RuntimeError.ARG_MISSING([type]);
      }
      return defValue;
    }

    // return an un-parsed type.
    if (type === null || type === undefined)
      return param;

    if (param instanceof FormulaError.Known)
      throw param;

    if (type === Types.ARRAY) {
      if (Array.isArray(param)) {
        return flat ? this.flattenDeep(param) : param;
      // } else if (param instanceof Collection) {
      //   throw FormulaError.BuiltIn.Value;
      } else if (Array.isArray(param.value)) {
        for (let i=0; i<param.value.length; i++) {
          const arrValue = param.value[i];
          if (arrValue === null) {
            param.value[i] = defValue;
          }
        }
      } else if (allowSingleValue) {
        return flat ? [param] : [[param]];
      } else if (param.value === null) {
        return flat ? [defValue] : [[defValue]];
      }
      throw FormulaError.BuiltIn.Value;
    // } else if (type === Types.COLLECTIONS) {
    //   return param;
    }

    // the only possible type for expectSingle=true are: string, boolean, number;
    // If array encountered, extract the first element.
    // extract first element from array
    if (isArray) {
      param = param[0][0];
    }
    const paramType = this.type(param);
    if (type === Types.STRING) {
      if (paramType === Types.BOOLEAN)
        param = param ? 'TRUE' : 'FALSE';
      else
        param = `${param}`
    } else if (type === Types.BOOLEAN) {
      if (paramType === Types.STRING)
        throw FormulaError.BuiltIn.Value;
      if (paramType === Types.NUMBER)
        param = Boolean(param);
    } else if (type === Types.NUMBER) {
      param = this.acceptNumber(param, false);
    } else if (type === Types.NUMBER_NO_BOOLEAN) {
      param = this.acceptNumber(param, false, false);
    } else {
      throw FormulaError.BuiltIn.Value;
    }
    return param;
  }

  // TODO - remove this
  type(variable: any): number {
    if ((variable as IRange).isIRange) {
      return Types.RANGE_REF;
    }
    //   const asRange = (variable as IRange);
    //   if (asRange.size === 1) {
    //     variable = asRange.getValueAt(0,0);
    //   } else {
    //     variable = asRange.getValues();
    //   }
    // }
    let type = this.type2Number[typeof variable];
    if (type === -1) {
      if (Array.isArray(variable))
        type = Types.ARRAY;
      else if (variable.ref) {
        if (variable.ref.from) {
          type = Types.RANGE_REF;
        } else {
          type = Types.CELL_REF;
        }
      }
      // else if (variable instanceof Collection)
      //   type = Types.COLLECTIONS;
    }
    return type;
  }
}

export const FormulaHelpers = new _FormulaHelpers();