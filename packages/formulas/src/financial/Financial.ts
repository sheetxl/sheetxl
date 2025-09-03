/* cspell: disable */
import { IRange, FormulaError, FormulaContext, IRuntime } from '@sheetxl/primitives';

import { DAYS360, DATEDIF, DAYS, YEARFRAC } from '../dateTime/Date';

// TODO - STOCKHISTORY -
// TODO - IRR, XIRR, MIRR - Formula.js has this.
// TODO - UNIT TESTS from formula.js

// IRR - Formula.js has this.
// TODO - DURATION, INTRATE
// TODO - PRICEMAT (and others)

/**
 * Maximum value for epsilon used in financial calculations.
 */
const epsMax: number = 1e-7;

const defaultCurrencyFormat = (runtime: IRuntime) => {
  const currency = runtime.getCurrencySymbol();
  const group = runtime.getNumberGroupSeparator();
  const decimal = runtime.getNumberDecimalSeparator();
  return `${currency}#${group}##0${decimal}00_);[Red](${currency}#${group}##0${decimal}00)`;
}

/**
 * Checks if the end date is more than one year after the start date.
 *
 * @param start OADate value for the start date
 * @param end OADate value for the end date
 * @returns true if end date is more than one year after start date, false otherwise
 */
const isMoreThanOneYearAfter = (startDate: Date, endDate: Date): boolean => {
  // Check year difference
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  if (yearDiff > 1) return true;
  if (yearDiff < 1) return false;

  // If exactly one year difference, check month
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  if (monthDiff > 0) return true;
  if (monthDiff < 0) return false;

  // If same month, check day
  const dayDiff = endDate.getDate() - startDate.getDate();
  return dayDiff > 0;
}

function findLastCouponDate(settlementDate: Date, maturityDate: Date, frequency: number): Date {
  // Create a copy of maturity date to work with
  const result = new Date(maturityDate);

  // Set year to match settlement date's year
  result.setFullYear(settlementDate.getFullYear());

  // If the adjusted date is after settlement, we need to go back
  if (result > settlementDate) {
    // Move back by coupon periods until we're before settlement
    while (result > settlementDate) {
      result.setMonth(result.getMonth() - Math.round(12 / frequency));
    }
  } else {
    // If it's already before settlement, we might need to move forward
    const nextDate = new Date(result);
    nextDate.setMonth(nextDate.getMonth() + Math.round(12 / frequency));

    // If next coupon date is still before settlement, keep moving forward
    while (nextDate <= settlementDate) {
      result.setTime(nextDate.getTime());
      nextDate.setMonth(nextDate.getMonth() + Math.round(12 / frequency));
    }
  }

  return result;
}

function validFrequency(frequency: number): boolean {
  // Return error if frequency is neither 1, 2, or 4
  if (frequency < 1 || frequency > 4 || frequency === 3)
    return false;
  return true;
}

// TODO - use formula context
function validDate(oadate: number): boolean {
  if (oadate < 0 || oadate >= 2958466) // for fractions
    return false; // Invalid OADate range
  return true;
}

function validBasis(basis: number): boolean {
  if (basis < 0 || basis > 4) {
    return false; // Invalid OADate range
  }
  return true;
}

/**
 * @summary Returns the accrued interest for a security that pays periodic interest.
 * @param issue is the security's issue date, expressed as a serial date number
 * @param firstInterest is the security's first interest date, expressed as a serial date number
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param rate is the security's annual coupon rate
 * @param par is the security's par value
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 * @param calcMethod is a logical value: to accrued interest from issue date = TRUE; to calculate from last coupon payment date = FALSE
 *
 * @remarks
 * {@link https://support.microsoft.com/en-us/office/accrint-function-fe45d089-6722-4fb3-9379-e1f911d8dc74|Docs}
 */
// TODO - this is not correct for the frequency and basis. It needs to be fixed.
export function ACCRINT(
  issue: number, // date
  firstInterest: number, //date
  settlement: number, //date
  rate: number,
  par: number,
  frequency: number,
  basis: number=0,
  calcMethod: boolean=true
): number {
  if (!validDate(issue)
     || !validDate(firstInterest) || !validDate(settlement)
     || !validFrequency(frequency) || validBasis(basis)
  ) {
    return Number.NaN;
  }
  // Return error if either rate or par are lower than or equal to zero
  if (rate <= 0 || par <= 0) Number.NaN;
  // Return error if settlement is before or equal to issue
  if (settlement <= issue) Number.NaN;

  // Compute accrued interest
  return par * rate * YEARFRAC(issue, settlement, basis);
}

/**
 * @hidden Unimplemented
 * @summary Returns the accrued interest for a security that pays interest at maturity
 * @param issue is the security's issue date, expressed as a serial date number
 * @param settlement is the security's maturity date, expressed as a serial date number
 * @param rate is the security's annual coupon rate
 * @param par is the security's par value
 * @param basis is the type of day count basis to use
 */
export function ACCRINTM(
  issue: number, // date
  settlement: number, // date
  rate: number,
  par: number,
  basis: number=0
): number {
  if (!validDate(issue) || !validDate(settlement) || !validBasis(basis)) Number.NaN;

  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the prorated linear depreciation of an asset for each accounting period.
 * @param cost is the cost of the asset
 * @param datePurchased is the date the asset is purchased
 * @param firstPeriod is the date of the end of the first period
 * @param salvarge is the salvage value at the end of life of the asset.
 * @param period is the period
 * @param rate is the rate of depreciation
 * @param basis year_basis : 0 for year of 360 days, 1 for actual, 3 for year of 365 days.
 */
export function AMORLINC(
  cost: number,
  datePurchased: number, // date
  firstPeriod: number,
  salvarge: number,
  period: number,
  rate: number,
  basis: number=0
): number {
  if (!validDate(datePurchased) || !validDate(firstPeriod) || !validBasis(basis)) Number.NaN;

  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the number of days from the beginning of the coupon period to the settlement date
 * @param settlement is the security's settlement date, expressed as a serial date number is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function COUPDAYBS(
  settlement: number, // date
  maturity: number, // date
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) Number.NaN;

  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the number of days from the beginning of the coupon period to the settlement date
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function COUPDAYS(
  settlement: number, // date
  maturity: number, // date
  frequency: number,
  basis: number = 0
): number {
  // Validate input parameters
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) Number.NaN;
  if (!validDate(settlement) || settlement >= maturity) Number.NaN;

  // Special case for Actual/Actual basis
  if (basis === 1) {
    // Create copies of dates to avoid modifying original values
    const settlementDate = FormulaContext.fromOADate(settlement);
    const maturityDate = FormulaContext.fromOADate(maturity);

    // Find last coupon date before settlement
    const lastCouponDate = findLastCouponDate(settlementDate, maturityDate, frequency);

    // Find next coupon date
    const nextCouponDate = new Date(lastCouponDate);
    nextCouponDate.setMonth(nextCouponDate.getMonth() + Math.round(12 / frequency));

    // Calculate actual days in coupon period
    return DATEDIF(
      FormulaContext.toOADate(lastCouponDate),
      FormulaContext.toOADate(nextCouponDate),
      'D'
    );
  }

  // Standard calculation for other basis types
  let daysInYear: number;

  switch (basis) {
    case 0: // 30/360
    case 2: // Actual/360
    case 4: // European 30/360
      daysInYear = 360;
      break;
    case 3: // Actual/365
      daysInYear = 365;
      break;
    default:
      return Number.NaN;
  }

  return daysInYear / frequency;
}

/**
 * @hidden Unimplemented
 * @summary Returns the next coupon date after the settlement date
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function COUPNCD(
  settlement: number, // date
  maturity: number, // date
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) Number.NaN;

  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the number of coupons payable between the settlement date and maturity date
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function COUPNUM(
  settlement: number, // date
  maturity: number, // date
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) Number.NaN;

  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the previous coupon date before the settlement date
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function COUPPCD(
  settlement: number, // date
  maturity: number, // date
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) Number.NaN;
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the cumulative interest paid between two periods
 * @param rate is the interest rate
 * @param nper is the total number of payment periods
 * @param pv is the present value of the investment
 * @param startPeriod is the first period in the calculation
 * @param endPeriod is the last period in the calculation
 * @param type is the timing of the payment
 */
export function CUMIPMT(
  rate: number,
  nper: number,
  pv: number,
  startPeriod: number, // date
  endPeriod: number,  // date
  type: number
): number {
  if (!validDate(startPeriod) || !validDate(endPeriod)) return Number.NaN;
  if (rate <= 0 || nper <= 0 || pv <= 0) return Number.NaN;
  if (startPeriod < 1 || endPeriod < 1 || startPeriod > endPeriod) return Number.NaN;
  if (type !== 0 && type !== 1) return Number.NaN;

  const payment = PMT(rate, nper, pv, 0, type);
  let interest = 0;
  if (startPeriod === 1) {
    if (type === 0) {
      interest = -pv;
    }
    startPeriod++;
  }

  for (let i=startPeriod; i<=endPeriod; i++) {
    interest += type === 1 ? FV(rate, i - 2, payment, pv, 1) - payment : FV(rate, i - 1, payment, pv, 0);
  }

  interest *= rate;
  return interest;
}

/**
 * @summary Returns the cumulative principal paid on a loan between two periods
 * @param rate is the interest rate
 * @param nper is the total number of payment periods
 * @param pv is the present value of the investment
 * @param startPeriod is the first period in the calculation
 * @param endPeriod is the last period in the calculation
 * @param type is the timing of the payment
 */
export function CUMPRINC(
  rate: number,
  nper: number,
  pv: number,
  startPeriod: number, // date
  endPeriod: number, // date
  type: number
): number {
  if (!validDate(startPeriod) || !validDate(endPeriod)) return Number.NaN;
  if (startPeriod > endPeriod) return Number.NaN;
  // Return error if either rate, nper, or value are lower than or equal to zero
  if (rate <= 0 || nper <= 0 || pv <= 0) return Number.NaN;
  // Return error if start < 1, end < 1, or start > end
  if (startPeriod < 1 || endPeriod < 1 || startPeriod > endPeriod) return Number.NaN;
  // Return error if type is neither 0 nor 1
  if (type !== 0 && type !== 1) return Number.NaN;

  // Compute cumulative principal
  const payment = PMT(rate, nper, pv, 0, type);
  let principal = 0;
  if (startPeriod === 1) {
    principal = type === 0 ? payment + pv * rate : payment;
    startPeriod++;
  }

  for (let i=startPeriod; i<=endPeriod; i++) {
    principal +=
      type > 0
        ? payment - (FV(rate, i - 2, payment, pv, 1) - payment) * rate
        : payment - FV(rate, i - 1, payment, pv, 0) * rate
  }

  // Return cumulative principal
  return principal;
}

/**
 * @summary Returns the depreciation of an asset for a specified period using the fixed-declining balance method
 * @param cost is the initial cost of the asset
 * @param salvage is the salvage value at the end of the life of the asset
 * @param life is the number of periods over which the asset is being depreciated (sometimes called the useful life of the asset)
 * @param period is the period for which you want to calculate the depreciation. Period must use the same units as Life
 * @param month is the number of months in the first year
 */
export function DB(
  cost: number,
  salvage: number,
  life: number,
  period: number,
  month: number=12
): number {
   // Return error if any of the parameters is negative
   if (cost < 0 || salvage < 0 || life < 0 || period < 0) return Number.NaN;
  // Return error if month is not an integer between 1 and 12
  if (month < 1 || month > 12) return Number.NaN;
  // Return error if period is greater than life
  if (period > life) return Number.NaN;
  // Return 0 (zero) if salvage is greater than or equal to cost
  if (salvage >= cost) return 0;

  // Calculate rate and preserve precision during calculation
  // Round to 3 decimal places AFTER calculation for display purposes only
  const rateUnrounded = 1 - Math.pow(salvage / cost, 1 / life);
  const rate = Math.round(rateUnrounded * 1000) / 1000;

  FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
  // First period special case
  if (period === 1) {
    return (cost * rate * month) / 12;
  }

  // Calculate intermediate periods
  let totalDepreciation = (cost * rate * month) / 12; // Initial depreciation
  for (let i=2; i<=period; i++) {
    if (i === period && period === life) {
      // Last period special case - depreciate remaining amount to reach salvage value
      return Math.max(0, cost - totalDepreciation - salvage);
    }

    const currentDepreciation = (cost - totalDepreciation) * rate;
    if (i === period) {
      return currentDepreciation; // Return current period depreciation
    }
    totalDepreciation += currentDepreciation;
  }

  // Should never reach here but included for completeness
  return 0;
}

/*
 * Double declining balance (DDB) depreciation method.
 */
/**
 * @summary Returns the depreciation of an asset for a specified period using the double-declining balance method or some other method you specify
 * @param cost is the initial cost of the asset
 * @param salvage is the salvage value at the end of the life of the asset
 * @param life is the number of periods over which the asset is being depreciated (sometimes called the useful life of the asset)
 * @param period is the period for which you want to calculate the depreciation. Period must use the same units as Life
 * @param factor is the rate at which the balance declines
 */
export function DDB(
  cost: number,
  salvage: number,
  life: number,
  period: number,
  factor: number=2 // double-declining balance
): number {
  // Return error if any of the parameters is negative or if factor is null
  if (cost < 0 || salvage < 0 || life < 0 || period < 0 || factor <= 0) return Number.NaN;
  // Return error if period is greater than life
  if (period > life) return Number.NaN;
  // Return 0 (zero) if salvage is greater than or equal to cost
  if (salvage >= cost) return 0;

  // Compute depreciation
  let total = 0;
  let current = 0;

  for (let i=1; i<=period; i++) {
    current = Math.min((cost - total) * (factor / life), cost - salvage - total);
    total += current;
  }
  // Return depreciation
  return current;
}

/**
 * @summary Returns the discount rate for a security
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param pr is the security's price per $100 face value
 * @param redemption is the security's redemption value per $100 face value
 * @param basis is the type of day count basis to use
 */
export function DISC(
  settlement: number, // date
  maturity: number, // date
  pr: number,
  redemption: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) return Number.NaN;
  if (pr <= 0 || redemption <= 0) return Number.NaN;
  if (settlement >= maturity) throw FormulaError.BuiltIn.Value;

  let basisVal:number;
  let diff:number;
  switch (basis) {
    case 0:
      basisVal = 360;
      diff = DAYS360(settlement, maturity, false);
      break
    case 1:
      basisVal = 365;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 2:
      basisVal = 360;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 3:
      basisVal = 365;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 4:
      basisVal = 360;
      diff = DAYS360(settlement, maturity, true);
      break
    default:
      return Number.NaN;
  }

  return (((redemption - pr) / redemption) * basisVal) / diff
}

/**
 * @summary Converts a dollar price, expressed as a fraction, into a dollar price, expressed as a decimal number
 * @param fractionalDollar is a number expressed as a fraction
 * @param fraction is the integer to use in the denominator of the fraction
 */
export function DOLLARDE(
  fractionalDollar: number,
  fraction: number
): number {
  fraction = Math.trunc(fraction);
  if (fraction < 0) return Number.NaN;
  if (fraction < 1) return Infinity;

  let result = fractionalDollar;

  // Add decimal part
  result += ((fractionalDollar % 1) * Math.pow(10, Math.ceil(Math.log(fraction) / Math.LN10))) / fraction;

  // Round result
  const power = Math.pow(10, Math.ceil(Math.log(fraction) / Math.LN2) + 1);
  result = Math.round(result * power) / power;

  // Return converted dollar price
  return result;
}

/**
 * @summary Converts a dollar price, expressed as a decimal number, into a dollar price, expressed as a fraction
 * @param decimalDollar is a decimal number
 * @param fraction is the integer to use in the denominator of the fraction
 */
export function DOLLARFR(
  decimalDollar: number,
  fraction: number
): number {
  fraction = Math.trunc(fraction);
  if (fraction < 0) return Number.NaN;
  if (fraction < 1) return Infinity;

  // Compute integer part
  let result = decimalDollar;
  // Add decimal part
  result += (decimalDollar % 1) * Math.pow(10, -Math.ceil(Math.log(fraction) / Math.LN10)) * fraction;

  // Return converted dollar price
  return result;
}

/**
 * @hidden Unimplemented
 * @summary Returns the annual duration of a security with periodic interest payments
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param coupon is the security's annual coupon rate
 * @param yld is the security's annual yield
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function DURATION(
  settlement: number, // date
  maturity: number, // date
  coupon: number,
  yld: number,
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) return Number.NaN;
  return undefined
}

/**
 * @summary Returns the effective annual interest rate
 * @param nominalRate is the nominal interest rate
 * @param npery is the number of compounding periods per year
 */
export function EFFECT(
  nominalRate: number,
  npery: number
): number {
  npery = Math.trunc(npery);
  return Math.pow(1 + nominalRate / npery, npery) - 1;
}

/**
 * @summary Returns the future value of an investment based on periodic, constant payments and a constant interest rate
 * @param rate is the interest rate
 * @param nper is the total number of payment periods
 * @param pmt is the payment made each period; it cannot change over the life of the investment
 * @param pv is the present value of the investment
 * @param { '0' | '1' } type Indicates when pmts are due.
 */
export function FV(
  rate: number,
  nper: number,
  pmt: number,
  pv: number=0,
  type: number=0 // end of period (0) or beginning of period (1)
): number {
  // Return future value
  let result: number;

  if (rate === 0) {
    result = pv + pmt * nper;
  } else {
    const term = Math.pow(1 + rate, nper);
    result =
      type === 1
        ? pv * term + (pmt * (1 + rate) * (term - 1)) / rate
        : pv * term + (pmt * (term - 1)) / rate
  }
  FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
  return -result;
}

/**
 * @summary Returns the future value of an initial principal after applying a series of compound interest rates
 * @param principal is the present value
 * @param schedule is an array of interest rates to apply
 */
export function FVSCHEDULE(
  principal: number,
  schedule: IRange<number>
): number {
  // Start with the initial principal
  let acc: number = principal;
  for (const rate of schedule.values({ includeMistyped: true })) {
    if (typeof rate !== 'number') throw FormulaError.BuiltIn.Value;
    // Apply the current interest rate
    acc *= (1 + rate);
  }
  return acc;
}

/**
 * @hidden Unimplemented
 * @summary Returns the interest rate for a fully invested security
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param investment is the amount invested in the security
 * @param redemption is the amount to be received at maturity
 * @param basis is the type of day count basis to use
 */
export function INTRATE(
  settlement: number, // date
  maturity: number, // date
  investment: number,
  redemption: number,
  basis: number=2
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) return Number.NaN;
  // return the interest rate for a fully invested security
  if (investment <= 0 || redemption <= 0 || settlement >= maturity) return Number.NaN;
  if (investment >= redemption) return Infinity;
  if (isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) return Number.NaN;

  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the interest payment for a given period for an investment, based on periodic, constant payments and a constant interest rate
 * @param rate is the interest rate
 * @param per is the period for which you want to find the interest and must be in the range 1 to Nper
 * @param nper is the total number of payment periods
 * @param pv is the present value of the investment
 * @param fv is the future value, or a cash balance you want to attain after the last payment is made
 * @param type is a logical value representing the timing of payment: at the end of the period = 0, at the beginning of the period = 1
 */
export function IPMT(
  rate: number,
  per: number,
  nper: number,
  pv: number,
  fv: number=0,
  type: number=0
): number {
  const pmt = PMT(rate, nper, pv, fv, type);
  if (per === 1) {
    return rate * (type ? 0 : -pv);
  }
  const ifv = type
    ? FV(rate, per - 2, pmt, pv, type) - pmt
    : FV(rate, per - 1, pmt, pv, type);
  return rate * ifv;
}

/**
 * @hidden Unimplemented
 * @summary Returns the internal rate of return for a series of cash flows
 * @param values is an array or a reference to cells that contain numbers for which you want to calculate the internal rate of return
 * @param guess is a number that you guess is close to the result of IRR
 */
export function IRR(
  values: IRange<number>,
  guess: number=0.1
): number {
  // https://github.com/formulajs/formulajs/blob/master/src/financial.js#L901

  return undefined;
  // const pmt = PMT(rate, nper, pv, fv, type);
  // if (per === 1) {
  //   return rate * (type ? 0 : -pv);
  // }
  // const ifv = type
  //   ? FV(rate, per - 2, pmt, pv, type) - pmt
  //   : FV(rate, per - 1, pmt, pv, type);
  // return rate * ifv;
}

/**
 * @summary Returns the interest paid during a specific period of an investment
 * @param rate is the interest rate
 * @param per period for which you want to find the interest
 * @param nper number of payment periods in an investment
 * @param pv lump sum amount that a series of future payments is right now
 */
export function ISPMT(
  rate: number,
  per: number,
  nper: number,
  pv: number,
): number {
  if (nper === 0) return Infinity;

  return pv * rate * (per / nper - 1);
}

/**
 * @hidden Unimplemented
 * @summary Returns the Macauley modified duration for a security with an assumed par value of $100
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param coupon is the security's annual coupon rate
 * @param yld is the security's annual yield
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function MDURATION(
  settlement: number, // date
  maturity: number, // date
  coupon: number,
  yld: number,
  frequency: number,
  basis: number=2
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) return Number.NaN;

  // return the Macauley duration for a security with an assumed par value of $100.
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the internal rate of return for a series of periodic cash flows, considering both cost of investment and interest on reinvestment of cash
 * @param values is an array or a reference to cells that contain numbers that represent a series of payments (negative) and income (positive) at regular periods
 * @param financeRate is the interest rate you pay on the money used in the cash flows
 * @param reinvestRate is the interest rate you receive on the cash flows as you reinvest them
 */
export function MIRR(
  values: number[], // contiguous range of cash flows?
  financeRate: number, // date
  reinvestRate: number
): number {
  let hasPositive: boolean = false;
  let hasNegative: boolean = false;
  const posValues: number[] = []
  const negValues: number[] = []
  for (const value of values) {
    if (value > 0) {
      hasPositive = true
      posValues.push(value)
      negValues.push(0)
    } else if (value < 0) {
      hasNegative = true
      negValues.push(value)
      posValues.push(0)
    } else {
      negValues.push(0)
      posValues.push(0)
    }
  }

  if (!hasPositive || !hasNegative) return Infinity;

  const nom = NPV(reinvestRate, ...posValues);
  if (nom === Infinity) return nom;

  const denom = NPV(financeRate, ...negValues);
  if (denom === Infinity) return nom;

  const n = values.length;
  return Math.pow((-nom * Math.pow(1 + reinvestRate, n) / denom / (1 + financeRate)),1 / (n - 1)) - 1;
}

/**
 * @summary Returns the annual nominal interest rate
 * @param effectiveRate is the effective interest rate
 * @param npery is the number of compounding periods per year@param npery
 */
export function NOMINAL(
  effectiveRate: number,
  npery: number
): number {
  npery = Math.trunc(npery);
  return (Math.pow(effectiveRate + 1, 1 / npery) - 1) * npery;
}

/**
 * @summary Returns the number of periods for an investment based on periodic, constant payments and a constant interest rate
 * @param rate is the interest rate per period. For example, use 6%/4 for quarterly payments at 6% APR
 * @param pmt is the payment made each period; it cannot change over the life of the investment
 * @param pv is the present value, or the lump-sum amount that a series of future payments is worth now
 * @param fv is the future value, or a cash balance you want to attain after the last payment is made
 * @param type is a logical value: payment at the beginning of the period = 1; payment at the end of the period = 0
 */
export function NPER(
  rate: number,
  pmt: number,
  pv: number,
  fv: number=0,
  type: number=0
): number {
  if (rate === 0) {
    if (pmt === 0) {
      return Infinity;
    }
    return (-pv - fv) / pmt;
  }
  if (type) {
    pmt *= 1 + rate;
  }
  return Math.log((pmt - fv * rate) / (pv * rate + pmt)) / Math.log(1 + rate);
}

/**
 * @summary Returns the net present value of an investment based on a discount rate and a series of future payments (negative values) and income (positive values)
 * @param rate is the rate of discount over the length of one period
 * @param value value1,value2,... are 1 to 254 payments and income, equally spaced in time and occurring at the end of each period
 */
export function NPV(
  rate: number,
  ...value: number[]
): number {
  if (value.length > 254) { // match Excel limit
    throw FormulaError.BuiltIn.Value;
  }

  let acc: number = 0;
  const valueLength = value.length;
  for (let i=valueLength-1; i >= 0; i--) {
    acc += value[i];
    if (rate === -1) {
      if (acc === 0) {
        continue;
      }
      return Infinity;
    }
    acc /= 1 + rate;
  }
  return acc;
}

/**
 * @hidden Unimplemented
 * @summary Returns the price per $100 face value of a security with an odd first period
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param issue is the security's issue date, expressed as a serial date number
 * @param firstCoupon is the security's first coupon date, expressed as a serial date number
 * @param yld is the security's annual yield
 * @param redemption is the security's redemption value per $100 face value
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function ODDFPRICE(
  settlement: number, // date
  maturity: number, // date
  issue: number, // date
  firstCoupon: number, // date
  yld: number,
  redemption: number,
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validDate(firstCoupon) ||
      !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
  // first
  // return the price per $100 face value of a security with an odd first period.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the yield of a security with an odd first period
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param issue is the security's issue date, expressed as a serial date number
 * @param firstCoupon is the security's first coupon date, expressed as a serial date number
 * @param yld is the security's annual yield
 * @param redemption is the amount to be received at maturity
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function ODDFYIELD(
  settlement: number, // date
  maturity: number, // date
  issue: number, // date
  firstCoupon: number,
  yld: number,
  redemption: number,
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validDate(firstCoupon) ||
      !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
  // return the yield of a security with an odd first period.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the price per $100 face value of a security with an odd last period
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param lastInterest is the security's last coupon date, expressed as a serial date number
 * @param rate is the interest rate
 * @param yld is the security's annual yield
 * @param redemption is the amount to be received at maturity
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function ODDLPRICE(
  settlement: number, // date
  maturity: number, // date
  lastInterest: number,
  rate: number,
  yld: number,
  redemption: number,
  frequency: number, // 1, 2, or 4
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validDate(lastInterest) ||
      !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
// last
  // return the price per $100 face value of a security with an odd last period.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the yield of a security with an odd last period
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param lastInterest is the security's last coupon date, expressed as a serial date number
 * @param rate is the interest rate
 * @param pr is the security's price
 * @param redemption is the amount to be received at maturity
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function ODDLYIELD(
  settlement: number, // date
  maturity: number, // date
  lastInterest: number,
  rate: number,
  pr: number,
  redemption: number,
  frequency: number, // 1, 2, or 4
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validDate(lastInterest) ||
      !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
  // last
  // return the yield of a security with an odd last period.
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the number of periods required by an investment to reach a specified value
 * @param rate is the interest rate
 * @param pv is the present value of the investment
 * @param fv is the desired future value of the investment
 */
export function PDURATION(
  rate: number,
  pv: number,
  fv: number
): number {
  return (Math.log(fv) - Math.log(pv)) / Math.log(1 + rate);
}

/**
 * @summary Calculates the payment for a loan based on constant payments and a constant interest rate
 * @param rate is the interest rate
 * @param nper is the total number of payment periods
 * @param pv is the present value of the investment
 * @param fv is the future value, or a cash balance you want to attain after the last payment is made
 * @param type is a logical value: payment at the beginning of the period = 1; payment at the end of the period = 0
 */
export function PMT(
  rate: number,
  nper: number,
  pv: number,
  fv: number=0,
  type: number=0
): number {
  if (rate === 0) {
    return (-pv - fv) / nper;
  }
  type = type ? 1 : 0;

  const term = Math.pow(1 + rate, nper);
  FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
  return (fv * rate + pv * rate * term) * (type ? 1 / (1 + rate) : 1) / (1 - term);
}

/**
 * @hidden Unimplemented
 * @summary Returns the price per $100 face value of a security that pays periodic interest
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param rate is the interest rate
 * @param yld is the security's annual yield
 * @param redemption is the amount to be received at maturity
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function PRICE(
  settlement: number, // date
  maturity: number, // date
  rate: number,
  yld: number,
  redemption: number,
  frequency: number, // 1, 2, or 4
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) return Number.NaN;

  // returns the price per $100 face value of a security that pays interest.
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the price per $100 face value of a discounted security
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param discount is the security's discount rate
 * @param redemption is the amount to be received at maturity
 * @param basis is the type of day count basis to use
 */
export function PRICEDISC(
  settlement: number, // date
  maturity: number, // date
  discount: number,
  redemption: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) return Number.NaN;
  // returns the price per $100 face value of a discounted security.
  if (discount <= 0 || redemption <= 0) return Number.NaN;
  if (settlement >= maturity) throw FormulaError.BuiltIn.Value;

  let basisVal: number;
  let diff: number;
  switch (basis) {
    case 0:
      basisVal = 360;
      diff = DAYS360(settlement, maturity, false);
      break
    case 1:
      basisVal = 365;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 2:
      basisVal = 360;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 3:
      basisVal = 365;
      diff = DATEDIF(settlement, maturity, 'D');
      break
    case 4:
      basisVal = 360;
      diff = DAYS360(settlement, maturity, true);
      break
    default:
      return Number.NaN;
  }

  return redemption - (discount * redemption * diff) / basisVal;
}

/**
 * @hidden Unimplemented
 * @summary Returns the price per $100 face value of a security that pays interest at maturity
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param issue is the security's issue date, expressed as a serial date number
 * @param rate is the interest rate
 * @param yld is the security's annual yield
 * @param basis is the type of day count basis to use
 */
export function PRICEMAT(
  settlement: number, // date
  maturity: number, // date
  issue: number, // date
  rate: number,
  yld: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validDate(issue) || !validBasis(basis)) return Number.NaN;

  // returns the price per $100 face value of a security that pays interest at maturity.
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns the present value of an investment: the total amount that a series of future payments is worth now
 * @param rate is the interest rate
 * @param nper is the total number of payment periods in an investment
 * @param pmt is the payment made each period and cannot change over the life of the investment
 * @param fv is the future value, or a cash balance you want to attain after the last payment is made
 * @param type is a logical value: payment at the beginning of the period = 1; payment at the end of the period = 0
 */
export function PV(
  rate: number,
  nper: number,
  pmt: number,
  fv: number=0,
  type: number=0
): number {
  type = type ? 1 : 0;
  if (rate === -1) {
    if (nper === 0) return Number.NaN;
    return Infinity
  }
  FormulaContext.formatResults(defaultCurrencyFormat(FormulaContext.getRuntime()));
  if (rate === 0) {
    return -pmt * nper - fv;
  }
  return ((1 - Math.pow(1 + rate, nper)) * pmt * (1 + rate * type) / rate - fv) / Math.pow(1 + rate, nper);
}

/**
 * @summary Returns the interest rate per period of a loan or an investment. For example, use 6%/4 for quarterly payments at 6% APR
 * @param nper is the total number of payment periods
 * @param pmt is the payment made each period and cannot change over the life of the loan or investment
 * @param pv is the present value: the total amount that a series of future payments is worth now
 * @param fv is the future value, or a cash balance you want to attain after the last payment is made
 * @param type is a logical value: payment at the beginning of the period = 1; payment at the end of the period = 0
 * @param guess is your guess for what the rate will be
 */
export function RATE(
  nper: number,
  pmt: number,
  pv: number,
  fv: number=0,
  type: number=0,
  guess: number=0.1
): number {
  if (guess <= -1) throw FormulaError.BuiltIn.Value;

  type = type ? 1 : 0;

  const iterMax: number = 20;
  let rate: number = guess;
  // Give a reasonable initial guess based on inputs
  if (rate === 0.1 && Math.abs(pmt) > Math.abs(pv) / 10) {
    // If pmts are large relative to present value, start with a higher guess
    rate = 0.2;
  }
  for (let i=0; i<iterMax; i++) {
    if (rate <= -1) return Number.NaN;
    let y: number = 0;
    if (Math.abs(rate) < epsMax) {
      y = pv * (1 + nper * rate) + pmt * (1 + rate * type) * nper + fv;
    } else {
      const f = Math.pow(1 + rate, nper);
      y = pv * f + pmt * (1 / rate + type) * (f - 1) + fv;
    }
    if (Math.abs(y) < epsMax) {
      return rate;
    }
    let dy: number = 0;
    if (Math.abs(rate) < epsMax) {
      dy = pv * nper + pmt * type * nper;
    } else {
      const f = Math.pow(1 + rate, nper);
      const df = nper * Math.pow(1 + rate, nper - 1);
      dy = pv * df + pmt * (1 / rate + type) * df + pmt * (-1 / (rate * rate)) * (f - 1);
    }
    rate -= y / dy;
  }
  return Number.NaN;
}

/**
 * @hidden Unimplemented
 * @summary Returns the amount received at maturity for a fully invested security
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param investment is the amount invested in the security
 * @param discount is the security's discount rate
 * @param basis is the type of day count basis to use
 */
export function RECEIVED(
  settlement: number, // date
  maturity: number, // date
  investment: number,
  discount: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) {
    return Number.NaN;
  }
  // returns the amount received at maturity for a fully invested security.
  // TODO - implement
  return undefined;
}

/**
 * @summary Returns an equivalent interest rate for the growth of an investment
 * @param nper is the total number of payment periods
 * @param pv is the present value of the investment
 * @param fv is the future value of the investment
 */
export function RRI(
  nper: number,
  pv: number,
  fv: number
): number {
  if (pv === 0 || (fv < 0 && pv > 0) || (fv > 0 && pv < 0)) return Number.NaN;

  return Math.pow(fv / fv, 1 / nper) - 1;
}

/**
 * @summary Returns the straight-line depreciation of an asset for one period
 * @param cost is the initial cost of the asset
 * @param salvage is the salvage value at the end of the life of the asset
 * @param life is the number of periods over which the asset is being depreciated (sometimes called the useful life of the asset)
 */
export function SLN(
  cost: number,
  salvage: number,
  life: number
): number {
  if (life === 0) Infinity; //return FormulaError.BuiltIn.Div0 as any; // Number.POSITIVE_INFINITY;

  return (cost - salvage) / life;
}

/**
 * @hidden Unimplemented
 * @summary Returns an array of historical quote data for a symbol and date range you specify.
 * @param stock Symbol of financial instrument to be considered or a Stock data type.
 * @param startDate First date to return data from.
 * @param endDate Last date to return data from.
 * @param interval A number indicating the granularity of the data; 0 - Daily, 1 - Weekly, 2 - Monthly
 * @param headers A logical value to add column header data; 0 - No column header, 1 - Show column header, 2 - Show instrument identifier and column header
 * @param properties properties1,properties2,... A number indicating which column of data to return; 0 through 5
 */
export function STOCKHISTORY(
  stock: string,
  startDate: number, // date
  endDate: number, // date
  interval: number=0, // 0=day, 1=week, 2=month
  headers: number=1, // 0=none, 1=field names, 2=field names and row numbers
  properties: number[]=[0, 1, 2, 3, 4] // 0=date, 1=open, 2=high, 3=low, 4=close, 5=volume
): Promise<IRange> {
  if (!validDate(startDate) || !validDate(endDate)) {
    throw FormulaError.BuiltIn.Num; // Is this correct?
  }
  return undefined; // TODO - implement
}

/**
 * @summary Returns the sum-of-years' digits depreciation of an asset for a specified period
 * @param cost is the initial cost of the asset
 * @param salvage is the salvage value at the end of the life of the asset
 * @param life is the number of periods over which the asset is being depreciated (sometimes called the useful life of the asset)
 * @param per is the period and must use the same units as Life
 */
export function SYD(
  cost: number,
  salvage: number,
  life: number,
  per: number
): number {
  if (per > life) return Number.NaN;
  return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
}

/**
 * @summary Returns the bond-equivalent yield for a treasury bill
 * @param settlement is the Treasury bill's settlement date, expressed as a serial date number
 * @param maturity is the Treasury bill's maturity date, expressed as a serial date number
 * @param discount is the Treasury bill's discount rate
 */
export function TBILLEQ(
  settlement: number, // date
  maturity: number, // date
  discount: number
): number {
  if (!validDate(settlement) || !validDate(maturity)) return Number.NaN;
  settlement = Math.round(settlement);
  maturity = Math.round(maturity);
  if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
    return Number.NaN;
  }
  const denom = 360 - discount * (maturity - settlement);
  if (denom === 0) return 0;
  if (denom < 0) return Number.NaN;

  return 365 * discount / denom;
}

/**
 * @summary Returns the price per $100 face value for a treasury bill
 * @param settlement is the Treasury bill's settlement date, expressed as a serial date number
 * @param maturity is the Treasury bill's maturity date, expressed as a serial date number
 * @param discount is the Treasury bill's discount rate
 */
export function TBILLPRICE(
  settlement: number, // date
  maturity: number, // date
  discount: number
): number {
  if (!validDate(settlement) || !validDate(maturity)) return Number.NaN;
  settlement = Math.round(settlement);
  maturity = Math.round(maturity);
  if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
    return Number.NaN;
  }
  const denom: number = 360 - discount * (maturity - settlement);
  if (denom === 0) return 0;
  if (denom < 0) return Number.NaN;

  return 100 * (1 - discount * (maturity - settlement) / 360);
}

/**
 * @summary Returns the yield for a treasury bill
 * @param settlement is the Treasury bill's settlement date, expressed as a serial date number
 * @param maturity is the Treasury bill's maturity date, expressed as a serial date number
 * @param pr is the Treasury Bill's price per $100 face value
 */
export function TBILLYIELD(
  settlement: number, // date
  maturity: number, // date
  pr: number
): number {
  if (!validDate(settlement) || !validDate(maturity)) return Number.NaN;

  settlement = Math.round(settlement);
  maturity = Math.round(maturity);
  if (settlement >= maturity || isMoreThanOneYearAfter(FormulaContext.fromOADate(settlement), FormulaContext.fromOADate(maturity))) {
    return Number.NaN;
  }
  return (100 - pr) * 360 / (pr * (maturity - settlement));
}

/**
 * @hidden Unimplemented
 * @summary Returns the depreciation of an asset for any period you specify, including partial periods, using the double-declining balance method or some other method you specify
 * @param cost is the initial cost of the asset
 * @param salvage is the salvage value at the end of the life of the asset
 * @param life is the number of periods over which the asset is being depreciated (sometimes called the useful life of the asset)
 * @param startPeriod is the first period in the calculation
 * @param endPeriod is the last period in the calculation
 * @param factor is the rate at which the balance declines
 * @param noSwitch switch to straight-line depreciation when depreciation is greater than the declining balance = FALSE; do not switch = TRUE
 */
export function VDB(
  cost: number,
  salvage: number,
  life: number,
  startPeriod: number,
  endPeriod: number,
  factor: number=2, // double declining balance
  noSwitch: boolean=false // switch to straight line if greater than SLN
): number {
  if (!validDate(startPeriod) || !validDate(endPeriod)) return Number.NaN;
  // returns the depreciation of an asset for any period you specify, including partial periods,
  // using the double-declining balance method or another method that you specify.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the internal rate of return for a schedule of cash flows
 * @param values is a series of cash flows that correspond to a schedule of payments in dates
 * @param dates is a schedule of payment dates that corresponds to the cash flow payments
 * @param guess is a number that you guess is close to the result of XIRR
 */
export function XIRR(
  values: IRange<number>[],
  dates: IRange<number>[],
  guess: number=0.1
): number {
  // returns the internal rate of return for a schedule of cash flows that is not necessarily periodic.
  // TODO - implement
  return undefined;
  // if (values.length !== dates.length) {
  //   throw FormulaError.BuiltIn.Value;
  // }

  // const iterMax = 20;
  // let rate: number = guess;
  // for (let i=0; i<iterMax; i++) {
  //   let y: number = 0;
  //   let dy: number = 0;
  //   for (let j=0; j<values.length; j++) {
  //     const t = (dates[j] - dates[0]) / 365.25; // TODO - check this
  //     const f = Math.pow(1 + rate, t);
  //     y += values[j] / f;
  //     dy += -t * values[j] / (f * (1 + rate));
  //   }
  //   if (Math.abs(y) < epsMax) {
  //     return rate;
  //   }
  //   rate -= y / dy;
  // }
  // return Number.NaN;
}

/**
 * @summary Returns the net present value for a schedule of cash flows
 * @param rate is the discount rate to apply to the cash flows
 * @param values is a series of cash flows that correspond to a schedule of payments in dates
 * @param dates is a schedule of payment dates that corresponds to the cash flow payments
 */
export function XNPV(
  rate: number,
  values: number[],
  dates: number[],
): number {
  let acc: number = 0;
  const valuesLength = values.length;
  for (let i=0; i<valuesLength; i++) {
    acc += values[i] / Math.pow(1 + rate, DAYS(dates[i], dates[0]) / 365);
  }
  return acc;
}

/**
 * @hidden Unimplemented
 * @summary Returns the yield on a security that pays periodic interest
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param rate is the security's annual coupon rate
 * @param pr is the security's price per $100 face value
 * @param redemption is the security's redemption value per $100 face value
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function YIELD(
  settlement: number, // date
  maturity: number, // date
  rate: number,
  pr: number,
  redemption: number,
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
  // return the yield of a security that pays period interest.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the annual yield for a discounted security. For example, a treasury bill
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param pr is the security's price per $100 face value
 * @param redemption is the security's redemption value per $100 face value
 * @param frequency is the number of coupon payments per year
 * @param basis is the type of day count basis to use
 */
export function YIELDDISC(
  settlement: number, // date
  maturity: number, // date
  pr: number,
  redemption: number,
  frequency: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validFrequency(frequency) || !validBasis(basis)) {
    return Number.NaN;
  }
  // return the annual yield for a discounted security. For example, a Treasury bill.
  // TODO - implement
  return undefined;
}

/**
 * @hidden Unimplemented
 * @summary Returns the annual yield of a security that pays interest at maturity
 * @param settlement is the security's settlement date, expressed as a serial date number
 * @param maturity is the security's maturity date, expressed as a serial date number
 * @param issue is the security's issue date, expressed as a serial date number
 * @param rate is the interest rate
 * @param pr is the security's price per $100 face value
 * @param basis is the type of day count basis to use
 */
export function YIELDMAT(
  settlement: number, // date
  maturity: number, // date
  issue: number, // date
  rate: number,
  pr: number,
  basis: number=0
): number {
  if (!validDate(settlement) || !validDate(maturity) || !validBasis(basis)) {
    return Number.NaN;
  }
  // returns t he annual yield of a security that pays interest at maturity.
  // TODO - implement
  return undefined;
}