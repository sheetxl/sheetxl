/* cspell: disable */
import { Scalar, FormulaError } from '@sheetxl/primitives';

const MAX_OCT = 536870911; // OCT2DEC(3777777777)
const MIN_OCT = -536870912; // OCT2DEC4000000000)
const MAX_BIN = 511; // BIN2DEC(111111111)
const MIN_BIN = -512; // BIN2DEC(1000000000)
// const MAX_HEX = 549755813887;
// const MIN_HEX = -549755813888;

const toBitValue = (number: any): number => {
  const type = typeof number;
  if (type === 'boolean') {
    return number ? 1 : 0;
  }
  if (type === 'number') {
    // integer
    if (number < 0 || number > 281474976710655 || Math.floor(number) !== number) throw FormulaError.BuiltIn.Num;
    return number;
  }
  if (type === 'string') {
    let asNumber: number = 0;
    try {
      asNumber = number * 1;
    } catch (e) {}
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
  }
  throw FormulaError.BuiltIn.Value;
}

/**
 * @summary Converts a binary number to decimal
 * @param number is the binary number you want to convert
 */
export function BIN2DEC(number: number): number {
  const numberStr = number.toString();
  if (numberStr.length > 10) return Number.NaN;

  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return parseInt(numberStr.substring(1), 2) + MIN_BIN;
  } else {
    return parseInt(numberStr, 2);
  }
}

/**
 * @summary Converts a binary number to hexadecimal
 * @param number is the binary number you want to convert
 * @param places is the number of characters to use
 */
export function BIN2HEX(number: number, places?: number): string {
  const numberStr = number.toString();
  if (numberStr.length > 10) throw FormulaError.BuiltIn.Num;

  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return (parseInt(numberStr.substring(1), 2) + 1099511627264).toString(16).toUpperCase();
  }
  // convert BIN to HEX
  const result = parseInt(number as any, 2).toString(16);
  if (places === undefined) {
    return result.toUpperCase();
  }

  if (places < 0)  throw FormulaError.BuiltIn.Num;
  // truncate places in case it is not an integer
  places = Math.trunc(places);
  if (places >= result.length) {
    return ('0'.repeat(places - result.length) + result).toUpperCase();
  }

  throw FormulaError.BuiltIn.Num;
}

/**
 * @summary Converts a binary number to octal
 * @param number is the binary number you want to convert
 * @param places is the number of characters to use
 */
export function BIN2OCT(number: number, places?: number): string {
  let numberStr: string = number.toString();
  if (numberStr.length > 10) throw FormulaError.BuiltIn.Num;

  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return (parseInt(numberStr.substring(1), 2) + 1073741312).toString(8);
  }

  const result = parseInt(number as any, 2).toString(8);
  if (places === undefined) {
    return result.toUpperCase();
  }

  if (places < 0) throw FormulaError.BuiltIn.Num;
  // truncate places in case it is not an integer
  places = Math.trunc(places);
  if (places >= result.length) {
    return ('0'.repeat(places - result.length) + result);
  }
  throw FormulaError.BuiltIn.Num;
}

/**
 * @summary Returns a bitwise 'And' of two numbers
 * @param number1 is the decimal representation of the binary number you want to evaluate
 * @param number2 is the decimal representation of the binary number you want to evaluate
 */
export function BITAND(number1: Scalar, number2: Scalar): number {
  number1 = toBitValue(number1);
  number2 = toBitValue(number2);
  return number1 & number2;
}

/**
 * @summary Returns a number shifted left by shift_amount bits
 * @param number is the decimal representation of the binary number you want to evaluate
 * @param shiftAmount is the number of bits that you want to shift Number left by
 */
export function BITLSHIFT(number: Scalar, shiftAmount: number): number {
  number = toBitValue(number);
  shiftAmount = Math.trunc(shiftAmount);
  if (Math.abs(shiftAmount) > 53) return Number.NaN;

  const result = (shiftAmount >= 0) ? number * 2 ** shiftAmount : Math.trunc(number / 2 ** -shiftAmount);
  if (result > 281474976710655) return Number.NaN;

  return result;
}

/**
 * @summary Returns a bitwise 'Or' of two numbers
 * @param number1 is the decimal representation of the binary number you want to evaluate
 * @param number2 is the decimal representation of the binary number you want to evaluate
 */
export function BITOR(number1: Scalar, number2: Scalar): number {
  number1 = toBitValue(number1);
  number2 = toBitValue(number2);
  return number1 | number2;
}

/**
 * @summary Returns a number shifted right by shift_amount bits
 * @param number is the decimal representation of the binary number you want to evaluate
 * @param shiftAmount is the number of bits that you want to shift Number left by
 */
export function BITRSHIFT(number: Scalar, shiftAmount: number): number {
  number = toBitValue(number);
  return BITLSHIFT(number, -shiftAmount);
}

/**
 * @summary Returns a bitwise 'Exclusive Or' of two numbers
 * @param number1 is the decimal representation of the binary number you want to evaluate
 * @param number2 is the decimal representation of the binary number you want to evaluate
 */
export function BITXOR(number1: Scalar, number2: Scalar): number {
  number1 = toBitValue(number1);
  number2 = toBitValue(number2);
  return number1 ^ number2;
}

/**
 * @summary Converts a decimal number to binary
 * @param number is the decimal integer you want to convert
 * @param places is the number of characters to use
 */
export function DEC2BIN(number: number, places?: number): string {
  if (number < MIN_BIN || number > MAX_BIN)  throw FormulaError.BuiltIn.Num;
  // if the number is negative, valid place values are ignored and it returns a 10-character binary number.
  if (number < 0) {
    return '1' + '0'.repeat(9 - (512 + number).toString(2).length) + (512 + number).toString(2);
  }

  const result = parseInt(number as any, 10).toString(2);
  if (places === undefined) {
    return result;
  }

  // if places is not an integer, it is truncated
  places = Math.trunc(places);
  if (places <= 0)  throw FormulaError.BuiltIn.Num;
  if (places < result.length) throw FormulaError.BuiltIn.Num;

  return ('0'.repeat(places - result.length) + result);
}

/**
 * @summary Converts a decimal number to hexadecimal
 * @param number is the decimal integer you want to convert
 * @param places is the number of characters to use
 */
export function DEC2HEX(number: number, places?: number): string {
  if (number < -549755813888 || number > 549755813888) throw FormulaError.BuiltIn.Num;
  // if the number is negative, valid place values are ignored and it returns a 10-character binary number.
  if (number < 0) {
    return (1099511627776 + number).toString(16).toUpperCase();
  }

  const result = parseInt(number as any, 10).toString(16);
  if (places === undefined) {
    return result.toUpperCase();
  }

  // if places is not an integer, it is truncated
  places = Math.trunc(places);
  if (places <= 0) throw FormulaError.BuiltIn.Num;
  if (places < result.length) throw FormulaError.BuiltIn.Num;
  return '0'.repeat(places - result.length) + result.toUpperCase();
}

/**
 * @summary Converts a decimal number to octal
 * @param number is the decimal integer you want to convert
 * @param places is the number of characters to use
 */
export function DEC2OCT(number: number, places?: number): string {
  if (number < -536870912 || number > 536870912) throw FormulaError.BuiltIn.Num;
  // if the number is negative, valid place values are ignored and it returns a 10-character binary number.
  if (number < 0) {
    return (number + 1073741824).toString(8);
  }

  const result = parseInt(number as any, 10).toString(8);
  if (places === undefined) {
    return result.toUpperCase();
  }

  // if places is not an integer, it is truncated
  places = Math.trunc(places);
  if (places <= 0) throw FormulaError.BuiltIn.Num;
  if (places < result.length) throw FormulaError.BuiltIn.Num;
  return '0'.repeat(places - result.length) + result;
}

/**
 * @summary Converts a Hexadecimal number to binary
 * @param number is the hexadecimal number you want to convert
 * @param places is the number of characters to use
 */
export function HEX2BIN(number: string, places?: number): string | number {
  if (number.length > 10 || !/^[0-9a-fA-F]*$/.test(number)) return Number.NaN;
  // to check if the number is negative
  const ifNegative = (number.length === 10 && number.substring(0, 1).toLowerCase() === 'f');
  // convert HEX to DEC
  const toDecimal = ifNegative ? parseInt(number, 16) - 1099511627776 : parseInt(number, 16);
  // if number is lower than -512 or grater than 511, return error
  if (toDecimal < MIN_BIN || toDecimal > MAX_BIN) return Number.NaN;
  // if the number is negative, valid place values are ignored and it returns a 10-character binary number.
  if (ifNegative) {
    return '1' + '0'.repeat(9 - (toDecimal + 512).toString(2).length) + (toDecimal + 512).toString(2);
  }
  // convert decimal to binary
  const toBinary = toDecimal.toString(2);
  if (places === undefined) {
    return toBinary;
  }

  // if places is not an integer, it is truncated
  places = Math.trunc(places);
  if (places <= 0 || places < toBinary.length) return Number.NaN;
  return '0'.repeat(places - toBinary.length) + toBinary;
}

/**
 * @summary Converts a hexadecimal number to decimal
 * @param number is the hexadecimal number you want to convert
 */
export function HEX2DEC(number: string): number {
  if (!/^[0-9A-Fa-f]{1,10}$/.test(number)) return Number.NaN;

  // Convert hexadecimal number to decimal
  const decimal = parseInt(number, 16)

  // Return decimal number
  return decimal >= 549755813888 ? decimal - 1099511627776 : decimal
}

/**
 * @summary Converts a hexadecimal number to octal
 * @param number is the hexadecimal number you want to convert
 * @param places is the number of characters to use
 */
export function HEX2OCT(number: string, places?: number): string {
  if (number.length > 10 || !/^[0-9a-fA-F]*$/.test(number)) throw FormulaError.BuiltIn.Num;

  // convert HEX to DEC
  const toDecimal = HEX2DEC(number);
  if (toDecimal > MAX_OCT || toDecimal < MIN_OCT) throw FormulaError.BuiltIn.Num;

  return DEC2OCT(toDecimal, places);
}


/**
 * @summary Converts an octal number to binary
 * @param number is the octal number you want to convert
 * @param places is the number of characters to use
 */
// TODO: need to check the test cases
export function OCT2BIN(number: string, places?: number): string {
  // office: If number is not a valid octal number, OCT2BIN returns the #NUM! error value.
  // office: If places is nonnumeric, OCT2BIN returns the #VALUE! error value.

  // 1. If number's length larger than 10, returns #NUM!
  if (number.length > 10) throw FormulaError.BuiltIn.Num
  // In microsoft Excel, if places is larger than 10, it will return #NUM!
  if (places > 10) throw FormulaError.BuiltIn.Num;
  // 2. office: If places is negative, OCT2BIN returns the #NUM! error value.
  if (places !== undefined && places < 0) throw FormulaError.BuiltIn.Num;

  // if places is not an integer, it is truncated
  // office: If places is not an integer, it is truncated.
  places = Math.trunc(places);

  // to check if the Oct number is negative
  const isNegative = (number.length === 10 && number.substring(0, 1) === '7');
  // convert OCT to DEC
  const toDecimal: number = OCT2DEC(number);
  // 2.
  // office: If number is negative, it cannot be less than 7777777000, and if number is positive, it cannot be greater than 777.
  // MiN_BIN = -512, MAX_BIN = 511
  if (toDecimal < MIN_BIN || toDecimal > MAX_BIN) throw FormulaError.BuiltIn.Num;

  // if number is negative, ignores places and return a 10-character binary number
  // office: If number is negative, OCT2BIN ignores places and returns a 10-character binary number.
  if (isNegative) {
    return '1' + '0'.repeat(9 - (512 + toDecimal).toString(2).length) + (512 + toDecimal).toString(2);
  }

  // convert DEC to BIN
  const result: string = toDecimal.toString(2);
  if (places === 0) {
    return result;
  }

  // office: If OCT2BIN requires more than places characters, it returns the #NUM! error value.
  if (places < result.length) throw FormulaError.BuiltIn.Num;

  return '0'.repeat(places - result.length) + result;
}

/**
 * @summary Converts an octal number to decimal
 * @param number is the octal number you want to convert
 */
export function OCT2DEC(number: string): number {
  // In microsoft Excel, if number contains more than ten characters (10 digits), it will return #NUM!
  if (number.length > 10) throw FormulaError.BuiltIn.Num;
  // If number is not a valid octal number, OCT2DEC returns the #NUM! error value.
  for (const n of number) {
    if (n < '0' || n > '7') throw FormulaError.BuiltIn.Num;
  }

  // convert to DEC
  const result = parseInt(number, 8);
  return (result >= 536870912) ? result - 1073741824 : result;
  //  536870912(4000000000) : -536870912;   1073741823(7777777777) : -1
}

/**
 * @summary Converts an octal number to hexadecimal
 * @param number is the octal number you want to convert
 * @param places is the number of characters to use
 */
export function OCT2HEX(number: string, places?: number): string | number {
  if (number.length > 10) return Number.NaN;
  // office: If number is not a valid octal number, OCT2DEC returns the #NUM! error value.
  for (const n of number) {
    if (n < '0' || n > '7') return Number.NaN;
  }
  // if places is not an integer, it is truncated
  places = Math.trunc(places);
  // office: If places is negative, OCT2HEX returns the #NUM! error value.
  if (places < 0 || places > 10) return Number.NaN;

  // convert OCT to DEC
  const toDecimal = OCT2DEC(number);
  const toHex = DEC2HEX(toDecimal);

  if (places === 0) return toHex;
  if (places < toHex.length) return Number.NaN;

  return '0'.repeat(places - toHex.length) + toHex;
}

