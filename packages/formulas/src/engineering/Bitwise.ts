/* cspell: disable */
import {
  FormulaContext, FormulaError,
  type AcceptError, type Omittable, type Scalar, type NoLift
} from '@sheetxl/primitives';

/**
 * Converts a binary number to decimal.
 * @param number is the binary number you want to convert.
 */
export function BIN2DEC(number: NoLift<Omittable<Scalar>>): number {
  const numberStr = toNumeral(number, BIN_DIGITS);
  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return parseInt(numberStr.substring(1), 2) + MIN_BIN;
  } else {
    return parseInt(numberStr, 2);
  }
}

/**
 * Converts a binary number to hexadecimal.
 * @param number is the binary number you want to convert.
 * @param places is the number of characters to use.
 */
export function BIN2HEX(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  const numberStr = toNumeral(number, BIN_DIGITS);
  number = parseInt(numberStr, 2);

  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return (parseInt(numberStr.substring(1), 2) + 1099511627264).toString(16).toUpperCase();
  }
  // convert BIN to HEX
  const result = (number as number).toString(16);
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
 * Converts a binary number to octal.
 * @param number is the binary number you want to convert.
 * @param places is the number of characters to use.
 */
export function BIN2OCT(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  const numberStr = toNumeral(number, BIN_DIGITS);
  number = parseInt(numberStr, 2);

  if (numberStr.length === 10 && numberStr.substring(0, 1) === '1') {
    return (parseInt(numberStr.substring(1), 2) + 1073741312).toString(8);
  }

  const result = (number as number).toString(8);
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
 * Returns a bitwise 'And' of two numbers.
 * @param number1 is the decimal representation of the binary number you want to evaluate.
 * @param number2 is the decimal representation of the binary number you want to evaluate.
 */
export function BITAND(
  number1: AcceptError<Scalar>,
  number2: AcceptError<Scalar>
): number {
  number1 = toBitValue(number1); // left to right
  number2 = toBitValue(number2);
  return bitwise(number1, number2, (x, y) => x & y);
}

/**
 * Returns a number shifted left by shiftAmount bits.
 * @param number is the decimal representation of the binary number you want to evaluate.
 * @param shiftAmount is the number of bits that you want to shift Number left by.
 */
export function BITLSHIFT(
  number: AcceptError<Scalar>,
  shiftAmount: AcceptError<Scalar>
): number {
  number = toBitValue(number); // left to right
  const shift = toShiftAmount(shiftAmount);
  // Zero shifts to zero by any amount — `BITLSHIFT(0,60)` is 0 where `BITLSHIFT(1,60)` is #NUM!.
  if (number === 0) return 0;
  if (Math.abs(shift) > 53) return Number.NaN;
  if (shift < 0) return Math.trunc(number / 2 ** -shift);

  // A shift of FORTY-NINE or more is 0, whatever is shifted — `BITLSHIFT(1,49)` and
  // `BITLSHIFT(2^48-1,49)` alike — while 48 is `#NUM!` for both. That boundary is not a register
  // width: it sits one past the 48-bit field and does not depend on how many bits the value
  // itself occupies.
  if (shift > 48) return 0;
  // Below it the ANSWER has to fit the field, so the two limits do not nest: `BITLSHIFT(13,47)`
  // is #NUM! — the bits are still there but past the field. Done in BigInt because `13 * 2^47`
  // is past a double's exact range.
  const shifted = BigInt(number) << BigInt(shift);
  return shifted > BigInt(MAX_BIT) ? Number.NaN : Number(shifted);
}

/**
 * Returns a bitwise 'Or' of two numbers.
 * @param number1 is the decimal representation of the binary number you want to evaluate.
 * @param number2 is the decimal representation of the binary number you want to evaluate.
 */
export function BITOR(
  number1: AcceptError<Scalar>,
  number2: AcceptError<Scalar>
): number {
  number1 = toBitValue(number1); // left to right
  number2 = toBitValue(number2);
  return bitwise(number1, number2, (x, y) => x | y);
}

/**
 * Returns a number shifted right by shiftAmount bits.
 * @param number is the decimal representation of the binary number you want to evaluate.
 * @param shiftAmount is the number of bits that you want to shift Number left by.
 */
export function BITRSHIFT(
  number: AcceptError<Scalar>,
  shiftAmount: AcceptError<Scalar>
): number {
  number = toBitValue(number); // left to right
  return BITLSHIFT(number, -toShiftAmount(shiftAmount));
}

/**
 * Returns a bitwise 'Exclusive Or' of two numbers.
 * @param number1 is the decimal representation of the binary number you want to evaluate.
 * @param number2 is the decimal representation of the binary number you want to evaluate.
 */
export function BITXOR(
  number1: AcceptError<Scalar>,
  number2: AcceptError<Scalar>
): number {
  number1 = toBitValue(number1); // left to right
  number2 = toBitValue(number2);
  return bitwise(number1, number2, (x, y) => x ^ y);
}

/**
 * Converts a decimal number to binary.
 * @param number is the decimal integer you want to convert.
 * @param places is the number of characters to use.
 */
export function DEC2BIN(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  number = toDecimalValue(number);
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
 * Converts a decimal number to hexadecimal.
 * @param number is the decimal integer you want to convert.
 * @param places is the number of characters to use.
 */
export function DEC2HEX(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  number = toDecimalValue(number);
  if (number < -549755813888 || number >= 549755813888) throw FormulaError.BuiltIn.Num;
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
 * Converts a decimal number to octal.
 * @param number is the decimal integer you want to convert.
 * @param places is the number of characters to use.
 */
export function DEC2OCT(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  number = toDecimalValue(number);
  if (number < -536870912 || number >= 536870912) throw FormulaError.BuiltIn.Num;
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
 * Converts a Hexadecimal number to binary.
 * @param number is the hexadecimal number you want to convert.
 * @param places is the number of characters to use.
 */
export function HEX2BIN(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string | number {
  places = toPlaces(places); // right-to-left
  const numeral = toNumeral(number, HEX_DIGITS);
  // to check if the number is negative
  const ifNegative = (numeral.length === 10 && numeral.substring(0, 1).toLowerCase() === 'f');
  // convert HEX to DEC
  const toDecimal = ifNegative ? parseInt(numeral, 16) - 1099511627776 : parseInt(numeral, 16);
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
 * Converts a hexadecimal number to decimal.
 * @param number is the hexadecimal number you want to convert.
 */
export function HEX2DEC(number: NoLift<Omittable<Scalar>>): number {
  // Convert hexadecimal number to decimal
  const decimal = parseInt(toNumeral(number, HEX_DIGITS), 16)

  // Return decimal number
  return decimal >= 549755813888 ? decimal - 1099511627776 : decimal
}

/**
 * Converts a hexadecimal number to octal.
 * @param number is the hexadecimal number you want to convert.
 * @param places is the number of characters to use.
 */
export function HEX2OCT(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  // convert HEX to DEC
  const toDecimal = HEX2DEC(toNumeral(number, HEX_DIGITS));
  if (toDecimal > MAX_OCT || toDecimal < MIN_OCT) throw FormulaError.BuiltIn.Num;

  return DEC2OCT(toDecimal, places);
}

/**
 * Converts an octal number to binary.
 * @param number is the octal number you want to convert.
 * @param places is the number of characters to use.
 */
export function OCT2BIN(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string {
  places = toPlaces(places); // right-to-left
  const numeral = toNumeral(number, OCT_DIGITS);
  // If places is larger than 10, return #NUM!
  if (places !== undefined && places > 10) throw FormulaError.BuiltIn.Num;
  // If places is negative, OCT2BIN return #NUM!.
  if (places !== undefined && places < 0) throw FormulaError.BuiltIn.Num;

  // If places is not an integer, truncate.
  places = (places === undefined) ? Number.NaN : Math.trunc(places);

  // to check if the Oct number is negative
  const isNegative = (numeral.length === 10 && numeral.substring(0, 1) === '7');
  // convert OCT to DEC
  const toDecimal: number = OCT2DEC(numeral);
  // If number is negative, it cannot be less than 7777777000, and if number is positive, it cannot be greater than 777.
  // MiN_BIN = -512, MAX_BIN = 511
  if (toDecimal < MIN_BIN || toDecimal > MAX_BIN) throw FormulaError.BuiltIn.Num;

  // if number is negative, ignore places and return a 10-character binary number
  if (isNegative) {
    return '1' + '0'.repeat(9 - (512 + toDecimal).toString(2).length) + (512 + toDecimal).toString(2);
  }

  // convert DEC to BIN
  const result: string = toDecimal.toString(2);
  if (places === 0) {
    return result;
  }

  // If OCT2BIN requires more than places characters, return #NUM!.
  if (places < result.length) throw FormulaError.BuiltIn.Num;

  return '0'.repeat(places - result.length) + result;
}

/**
 * Converts an octal number to decimal.
 * @param number is the octal number you want to convert.
 */
export function OCT2DEC(number: NoLift<Omittable<Scalar>>): number {
  // convert to DEC
  const result = parseInt(toNumeral(number, OCT_DIGITS), 8);
  return (result >= 536870912) ? result - 1073741824 : result;
  //  536870912(4000000000) : -536870912;   1073741823(7777777777) : -1
}

/**
 * Converts an octal number to hexadecimal.
 * @param number is the octal number you want to convert.
 * @param places is the number of characters to use.
 */
export function OCT2HEX(
  number: NoLift<Omittable<AcceptError<Scalar>>>,
  places?: NoLift<Omittable<AcceptError<Scalar>>>
): string | number {
  places = toPlaces(places); // right-to-left
  const numeral = toNumeral(number, OCT_DIGITS);
  // if places is not an integer, it is truncated
  places = (places === undefined) ? Number.NaN : Math.trunc(places); // Math.trunc(undefined) was NaN
  // If places is negative, OCT2HEX return #NUM!.
  if (places < 0 || places > 10) return Number.NaN;

  // convert OCT to DEC
  const toDecimal = OCT2DEC(numeral);
  const toHex = DEC2HEX(toDecimal);

  // A negative value ignores `places` and returns the ten-character field, the same rule the
  // negative branch of every other name in the family follows.
  if (places === 0 || toDecimal < 0) return toHex;
  if (places < toHex.length) return Number.NaN;

  return '0'.repeat(places - toHex.length) + toHex;
}

// A numeral argument is read as its DIGITS in its own base: at most ten of them, and nothing
// else. A sign, a fraction, or a digit the base does not have is #NUM! (BIN2DEC(0.5),
// BIN2HEX(2), OCT2DEC(8), ...).
const BIN_DIGITS = /^[01]{1,10}$/;
const OCT_DIGITS = /^[0-7]{1,10}$/;
const HEX_DIGITS = /^[0-9a-fA-F]{1,10}$/;

const MAX_OCT = 536870911; // OCT2DEC(3777777777)
const MIN_OCT = -536870912; // OCT2DEC(4000000000)
const MAX_BIN = 511; // BIN2DEC(111111111)
const MIN_BIN = -512; // BIN2DEC(1000000000)
// const MAX_HEX = 549755813887;
// const MIN_HEX = -549755813888;

/** The width of every base field: ten characters, in binary, octal and hexadecimal alike. */
const FIELD_WIDTH = 10;

/**
 * The `places` slot of every padding name.
 *
 * @remarks
 * Four positions, and each is its own answer (memory: blank-slot-vs-blank-cell): ABSENT and an
 * omitted comma both mean "do not pad"; a BLANK CELL is the number zero, and zero places is
 * `#NUM!`. A BOOLEAN is the odd one — `#VALUE!`, where at almost every other numeric slot in the
 * library it would convert — and text goes through the number parser, so `"4"` and `" 2 "` are
 * counts while `"abc"` and `""` are `#VALUE!` and `"10%"`, `"1E10"` and `"-2.5"` parse and then
 * fail the DOMAIN as `#NUM!`.
 *
 * The count is truncated and must land in 1..10; the field is ten characters wide, so eleven
 * places cannot be filled by any answer.
 */
const toPlaces = (places: Scalar | undefined): number | undefined => {
  if (places === undefined) return undefined;
  if (typeof places === 'boolean') throw FormulaError.BuiltIn.Value;
  const count = Math.trunc(places === null ? 0 : FormulaContext.parseAsNumber(places));
  // The domain is checked HERE, before the body decides whether to use the count at all: a
  // NEGATIVE number ignores `places` and pads to the full field, but an invalid `places` is still
  // #NUM! — `DEC2BIN(-9,0)` refuses rather than answering the ten-character form.
  if (count < 1 || count > FIELD_WIDTH) throw FormulaError.BuiltIn.Num;
  return count;
};

/**
 * The `number` slot of the three `DEC2*` names: a decimal, TRUNCATED toward zero.
 *
 * @remarks
 * The truncation happens BEFORE the field's bounds are checked, which is what lets `DEC2BIN(511.9)`
 * answer `111111111` and `DEC2BIN(-512.9)` answer the most negative value rather than refusing
 * both — and it is why `DEC2BIN(1E-300)` is `0` and not `1`. A blank cell is zero, and an OMITTED
 * argument — the required slot's third position — is `#N/A`.
 */
const toDecimalValue = (value: Scalar | undefined): number => {
  if (FormulaError.isError(value)) throw value;
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  if (value === null) return 0;
  if (typeof value === 'boolean') throw FormulaError.BuiltIn.Value;
  return Math.trunc(FormulaContext.parseAsNumber(value));
};

/**
 * The `number` slot of every `X2Y` name: the numeral, as TEXT, in the base it reads.
 *
 * @remarks
 * The digits are tested against what the CALLER wrote, not against the number it parses to, and
 * that is the whole rule: `" 1 "`, `"1.0"` and `"+1"` are `#NUM!` even though all three read as
 * one, because none of them is a numeral. An EMPTY string is the numeral zero, and so is a blank
 * CELL; a BOOLEAN is `#VALUE!` rather than a numeral; and an OMITTED argument — the required
 * slot's third position — is `#N/A`. A number arrives having already lost any leading zeros the
 * user typed, and is spelled back out to be tested on the same terms.
 */
const toNumeral = (value: Scalar | undefined, digits: RegExp): string => {
  // The slot declares `AcceptError`, so an error arrives as a VALUE and has to be re-thrown —
  // `BIN2HEX(NA(),4)` is #N/A and not the #VALUE! a "this is not text" branch would give.
  if (FormulaError.isError(value)) throw value;
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  if (value === null) return '0';
  if (typeof value === 'boolean') throw FormulaError.BuiltIn.Value;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string') throw FormulaError.BuiltIn.Value;
  if (text === '') return '0';
  if (!digits.test(text)) throw FormulaError.BuiltIn.Num;
  return text;
};

/** The `BIT*` field: a 48-bit unsigned integer, `2^48 - 1` at the top. */
const MAX_BIT = 281474976710655;

/**
 * An argument as the `BIT*` six read it: a non-negative INTEGER inside the 48-bit field.
 *
 * @remarks
 * Text converts on the same terms a number does and is then held to the same domain — a negative
 * or a fraction is `#NUM!` whichever spelling it arrived in, so `BITAND("-2.5",25)` is `#NUM!` and
 * not a silently truncated 24.
 */
const toBitValue = (number: any): number => {
  // The slots declare `AcceptError` so that the six read LEFT TO RIGHT — `BITAND("zz",NA())` is
  // the first slot's #VALUE! and not the second's #N/A — which means an error arrives here as a
  // value and has to be re-raised.
  if (FormulaError.isError(number)) throw number;
  const type = typeof number;
  if (type === 'boolean') {
    return number ? 1 : 0;
  }
  // A blank cell, and an omitted argument, are ZERO — `BITAND(13,)` is 0 rather than a refusal.
  if (number === null || number === undefined) return 0;
  let value: number;
  if (type === 'number') {
    value = number;
  } else if (type === 'string') {
    value = FormulaContext.parseAsNumber(number);
  } else {
    throw FormulaError.BuiltIn.Value;
  }
  if (value < 0 || value > MAX_BIT || Math.floor(value) !== value) throw FormulaError.BuiltIn.Num;
  return value;
}

/**
 * The shift COUNT as the two shift names read it: truncated toward zero, with a blank cell and an
 * omitted argument both zero and a boolean converting.
 */
const toShiftAmount = (shiftAmount: Scalar): number => {
  if (FormulaError.isError(shiftAmount)) throw shiftAmount;
  if (shiftAmount === null || shiftAmount === undefined) return 0;
  if (typeof shiftAmount === 'boolean') return shiftAmount ? 1 : 0;
  return Math.trunc(FormulaContext.parseAsNumber(shiftAmount));
};

/**
 * A bitwise operation over the WHOLE 48-bit field.
 *
 * @remarks
 * JavaScript's `&`, `|` and `^` coerce their operands to 32 bits, which silently discards the top
 * sixteen bits of a field that is carried in full: `BITOR(2^47, 2^47)` would be 0
 * and `BITOR(2^48-1, 2^48-1)` -1. The operation is done in `BigInt` and comes back as a Number,
 * which is exact — the field is well inside 2^53.
 */
const bitwise = (a: number, b: number, op: (x: bigint, y: bigint) => bigint): number =>
  Number(op(BigInt(a), BigInt(b)));