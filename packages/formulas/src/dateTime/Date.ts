/* cspell: disable */
import { FormulaError, Scalar, FormulaContext } from '@sheetxl/primitives';

// TODO - remove
import { Types } from '../_utils/_Types';
// TODO - remove
import { FormulaHelpers } from '../_utils/_Helpers';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const d1900: Date = new Date(Date.UTC(1900, 0, 1));
const WEEK_STARTS = [
  undefined, 0, 1, undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, 1, 2, 3, 4, 5, 6, 0];
const WEEK_TYPES = [
  undefined,
  [1, 2, 3, 4, 5, 6, 7],
  [7, 1, 2, 3, 4, 5, 6],
  [6, 0, 1, 2, 3, 4, 5],
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  [7, 1, 2, 3, 4, 5, 6],
  [6, 7, 1, 2, 3, 4, 5],
  [5, 6, 7, 1, 2, 3, 4],
  [4, 5, 6, 7, 1, 2, 3],
  [3, 4, 5, 6, 7, 1, 2],
  [2, 3, 4, 5, 6, 7, 1],
  [1, 2, 3, 4, 5, 6, 7]
];
const WEEKEND_TYPES = [
  undefined,
  [6, 0],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  undefined,
  undefined,
  undefined,
  [0],
  [1],
  [2],
  [3],
  [4],
  [5],
  [6]
];

// Formats: h:mm:ss A, h:mm A, H:mm, H:mm:ss, H A
const timeRegex = /^\s*(\d\d?)\s*(:\s*\d\d?)?\s*(:\s*\d\d?)?\s*(pm|am)?\s*$/i;
// 12-3, 12/3
const dateRegex1 = /^\s*((\d\d?)\s*([-/])\s*(\d\d?))([\d:.apm\s]*)$/i;
// 3-Dec, 3/Dec
const dateRegex2 = /^\s*((\d\d?)\s*([-/])\s*(jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*))([\d:.apm\s]*)$/i;
// Dec-3, Dec/3
const dateRegex3 = /^\s*((jan\w*|feb\w*|mar\w*|apr\w*|may\w*|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*([-/])\s*(\d\d?))([\d:.apm\s]*)$/i;

function parseSimplifiedDate(text: string): Date {
  const fmt1 = text.match(dateRegex1);
  const fmt2 = text.match(dateRegex2);
  const fmt3 = text.match(dateRegex3);
  if (fmt1) {
    text = fmt1[1] + fmt1[3] + new Date().getFullYear() + fmt1[5];
  } else if (fmt2) {
    text = fmt2[1] + fmt2[3] + new Date().getFullYear() + fmt2[5];
  } else if (fmt3) {
    text = fmt3[1] + fmt3[3] + new Date().getFullYear() + fmt3[5];
  }
  return new Date(Date.parse(`${text} UTC`));
}

/**
 * Parse time string to date in UTC.
 * @param {string} text
 */
function parseTime(text: string): Date {
  const res = text.match(timeRegex);
  if (!res) return;

  // ["4:50:55 pm", "4", ":50", ":55", "pm", ...]
  const minutes = res[2] ? res[2] : ':00';
  const seconds = res[3] ? res[3] : ':00';
  const ampm = res[4] ? ' ' + res[4] : '';

  const date = new Date(Date.parse(`1/1/1900 ${res[1] + minutes + seconds + ampm} UTC`));
  let now = new Date();
  now = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()));

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}

/**
 * Parse a UTC date to excel serial number.
 * @param {Date|number} date - A UTC date.
 * @returns {number}
 */
function toSerial(date: Date | number): number {
  let asTime = (date as Date).getTime?.() ?? date as number;
  const addOn = (asTime > -2203891200000) ? 2 : 1;
  return Math.floor((asTime - d1900.getTime()) / 86400000) + addOn;
}

/**
 * Parse an excel serial number to UTC date.
 * @param serial
 */
function toDate(serial: number): Date {
  if (serial < 0) {
    throw FormulaError.BuiltIn.Value;
  }
  if (serial <= 60) {
    return new Date(d1900.getTime() + (serial - 1) * 86400000);
  }
  return new Date(d1900.getTime() + (serial - 2) * 86400000);
}

interface DateWithExtra {
  date: Date;
  isDateGiven?: boolean;
}

function parseDateWithExtra(serialOrString: any): DateWithExtra {
  if (serialOrString instanceof Date) return { date: serialOrString };
  let isDateGiven = true;
  let date: Date;
  if (!isNaN(serialOrString)) {
    serialOrString = Number(serialOrString);
    date = toDate(serialOrString);
  } else {
    // support time without date
    date = parseTime(serialOrString);

    if (!date) {
      date = parseSimplifiedDate(serialOrString);
    } else {
      isDateGiven = false;
    }
  }
  return { date, isDateGiven };
}

function parseDate(serialOrString: string | number | Date | any): Date {
  return parseDateWithExtra(serialOrString).date;
}

function compareDateIgnoreTime(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear()
   && date1.getUTCMonth() === date2.getUTCMonth()
   && date1.getUTCDate() === date2.getUTCDate();
}

function isLeapYear(year: number): boolean {
  if (year === 1900) {
    return true;
  }
  return new Date(year, 1, 29).getMonth() === 1;
}

/**
 * @summary Returns the number that represents the date in Microsoft Excel date-time code
 * @param year is a number from 1900 or 1904 (depending on the workbook's date system) to 9999
 * @param month is a number from 1 to 12 representing the month of the year
 * @param day is a number from 1 to 31 representing the day of the month
 */
export function DATE(year: number, month: number, day: number): number {
  if (year < 0 || year >= 10000) return Number.NaN;
  // If year is between 0 (zero) and 1899 (inclusive), Excel adds that value to 1900 to calculate the year.
  if (year < 1900) {
    year += 1900;
  }

  FormulaContext.formatResults(`Short Date`);
  return FormulaContext.toOADate(new Date(year, month - 1, day));
}

/**
 * @hidden Legacy
 * @summary Returns the number of days between two dates
 * @param startDate is a serial date number that represents the start date
 * @param endDate is a serial date number that represents the end date
 * @param unit is a string that specifies the unit of time to use
 */
export function DATEDIF(
  startDate: number, // date
  endDate: number, // date
  unit: string
): number {
  const start = FormulaContext.fromOADate(startDate);
  const end = FormulaContext.fromOADate(endDate);

  unit = unit.toLowerCase();

  if (startDate > endDate) return Number.NaN;
  const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDiff = end.getUTCMonth() - start.getUTCMonth();
  const dayDiff = end.getUTCDate() - start.getUTCDate();
  let offset: number;
  switch (unit) {
    case 'y':
      offset = monthDiff < 0 || monthDiff === 0 && dayDiff < 0 ? -1 : 0;
      return offset + yearDiff;
    case 'm':
      offset = dayDiff < 0 ? -1 : 0;
      return yearDiff * 12 + monthDiff + offset;
    case 'd':
      return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;
    case 'md':
      // The months and years of the dates are ignored.
      start.setUTCFullYear(end.getUTCFullYear());
      if (dayDiff < 0) {
        start.setUTCMonth(end.getUTCMonth() - 1)
      } else {
        start.setUTCMonth(end.getUTCMonth())
      }
      return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;
    case 'ym':
      // The days and years of the dates are ignored
      offset = dayDiff < 0 ? -1 : 0;
      return (offset + yearDiff * 12 + monthDiff) % 12;
    case 'yd':
      // The years of the dates are ignored.
      if (monthDiff < 0 || monthDiff === 0 && dayDiff < 0) {
        start.setUTCFullYear(end.getUTCFullYear() - 1);
      } else {
        start.setUTCFullYear(end.getUTCFullYear());
      }
      return Math.floor(end.getTime() - start.getTime()) / MS_PER_DAY;

  }
}

/**
 * @hidden Legacy
 * @summary Returns NA.
 * @param number is a number that is ignored
 */
export function DATESTRING(number: number): any {
  // No idea what this is doing. It exists but not documented and Excel seems to Always return NA.
  return FormulaError.BuiltIn.NA;
}

/**
 * @summary Converts a date in the form of text to a number that represents the date in Microsoft Excel date-time code
 * @param dateText is text that represents a date in a Microsoft Excel date format, between 1/1/1900 or 1/1/1904 (depending on the workbook's date system) and 12/31/9999
 */
export function DATEVALUE(
  dateText: string
): number {
  try {
    const asOADate = FormulaContext.parseAsDateTime(dateText);
    if (!asOADate) throw FormulaError.BuiltIn.Value;
    // strip the time component
    return Math.floor(asOADate);
  } catch (error: any) {
    throw FormulaError.BuiltIn.Value; // throw FormulaError.BuiltIn.Value(`Invalid date: ${dateText}`);
  }
}

/**
 * @summary Returns the day of the month, a number from 1 to 31.
 * @param serialOrString is a number in the date-time code used by Excel or text in time format, such as 16:48:00 or 4:48:00 PM
 */
export function DAY(serialOrString: Scalar): number {
  const date = parseDate(serialOrString);
  return date.getUTCDate();
}

/**
 * @summary Returns the number of days between the two dates.
 * @param endDate start_date and end_date are the two dates between which you want to know the number of days
 * @param startDate start_date and end_date are the two dates between which you want to know the number of days
 */
export function DAYS(
  endDate: number, //date
  startDate: number, //date
): number {
  return Math.trunc(endDate) - Math.trunc(startDate);
}

/**
 * @summary Returns the number of days between two dates based on a 360-day year (twelve 30-day months)
 * @param endDate start_date and end_date are the two dates between which you want to know the number of days
 * @param startDate start_date and end_date are the two dates between which you want to know the number of days
 * @param method is a logical value specifying the calculation method: U.S. (NASD) = FALSE; European = TRUE.
 */
export function DAYS360(
  startDate: number, // date
  endDate: number, // date
  method: boolean=false
): number {
  const start = FormulaContext.fromOADate(startDate);
  const end = FormulaContext.fromOADate(endDate);

  // default is US method
  if (start.getUTCDate() === 31) {
    start.setUTCDate(30);
  }
  if (!method && start.getUTCDate() < 30 && end.getUTCDate() > 30) {
    end.setUTCMonth(end.getUTCMonth() + 1, 1);
  } else {
    // European method
    if (end.getUTCDate() === 31) {
      end.setUTCDate(30);
    }
  }

  const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDiff = end.getUTCMonth() - start.getUTCMonth();
  const dayDiff = end.getUTCDate() - start.getUTCDate();

  return (monthDiff) * 30 + dayDiff + yearDiff * 12 * 30;
}

/**
 * @summary Returns the serial number of the date that is the indicated number of months before or after the start date
 * @param startDate is a serial date number that represents the start date
 * @param months is the number of months before or after start_date
 */
export function EDATE(
  startDate: Date,
  months: number
): number {
  startDate.setUTCMonth(startDate.getUTCMonth() + months);
  return toSerial(startDate);
  // return context.toOADate(startDate);
}

/**
 * @summary Returns the serial number of the last day of the month before or after a specified number of months
 * @param startDate is a serial date number that represents the start date
 * @param months is the number of months before or after the start_date
 */
export function EOMONTH(startDate: Date, months: number): number {
  startDate.setUTCMonth(startDate.getUTCMonth() + months + 1, 0);
  return toSerial(startDate);
  // return context.toOADate(startDate, context);
}

/**
 * @summary Returns the hour as a number from 0 (12:00 A.M.) to 23 (11:00 P.M.).
 * @param serialOrString is a number in the date-time code used by Excel or text in time format, such as 16:48:00 or 4:48:00 PM
 */
export function HOUR(serialOrString: Scalar): number {
  const date = parseDate(serialOrString);
  return date.getUTCHours();
}

/**
 * @summary Returns the ISO week number in the year for a given date
 * @param serialOrString is a number in the date-time code used by Excel or text in time format, such as 16:48:00 or 4:48:00 PM
 */
export function ISOWEEKNUM(serialOrString: Scalar): number {
  const date = parseDate(serialOrString);

  // https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * @summary Returns the minute, a number from 0 to 59.
 * @param serialOrString is a number in the date-time code used by Excel or text in time format, such as 16:48:00 or 4:48:00 PM
 */
export function MINUTE(serialOrString: string): number {
  const date = parseDate(serialOrString);
  return date.getUTCMinutes();
}

/**
 * @summary Returns the month, a number from 1 (January) to 12 (December).
 * @param serialOrString is a number in the date-time code used by Excel
 */
export function MONTH(serialOrString: string): number {
  const date = parseDate(serialOrString);
  return date.getUTCMonth() + 1;
}

/**
 * @summary Returns the number of whole workdays between two dates
 * @param startDate is a serial date number that represents the start date
 * @param endDate is a serial date number that represents the end date
 * @param holidays is an optional set of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays
 */
export function NETWORKDAYS(startDate: Date, endDate: Date, holidays: number[]=null): number {
  // startDate = parseDate(startDate);
  // endDate = parseDate(endDate);
  let sign = 1;
  if (startDate > endDate) {
    sign = -1;
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }
  const holidaysArr = [];
  if (holidays !== null) {
    FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
      holidaysArr.push(parseDate(item));
    });
  }
  let numWorkDays = 0;
  while (startDate <= endDate) {
    // Skips Sunday and Saturday
    if (startDate.getUTCDay() !== 0 && startDate.getUTCDay() !== 6) {
      let found = false;
      for (let i = 0; i < holidaysArr.length; i++) {
        if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
          found = true;
          break;
        }
      }
      if (!found) numWorkDays++;
    }
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  return sign * numWorkDays;
}

/**
 * @name NETWORKDAYS.INTL
 * @summary Returns the number of whole workdays between two dates with custom weekend parameters
 * @param startDate is a serial date number that represents the start date
 * @param endDate is a serial date number that represents the end date
 * @param weekend is a number or string specifying when weekends occur
 * @param holidays is an optional set of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays
 */
export function NETWORKDAYS_INTL(
  startDate: Date,
  endDate: Date,
  weekend: any=1,
  holidays: number[]=null
): number {
  startDate = parseDate(startDate);
  endDate = parseDate(endDate);
  let sign = 1;
  if (startDate > endDate) {
    sign = -1;
    const temp = startDate;
    startDate = endDate;
    endDate = temp;
  }
  // Using 1111111 will always return 0.
  if (weekend === '1111111')
    return 0;

  // using weekend string, i.e, 0000011
  if (typeof weekend === "string" && Number(weekend).toString() !== weekend) {
    if (weekend.length !== 7) throw FormulaError.BuiltIn.Value;
    weekend = weekend.charAt(6) + weekend.slice(0, 6);
    const weekendArr = [];
    for (let i = 0; i < weekend.length; i++) {
      if (weekend.charAt(i) === '1')
        weekendArr.push(i);
    }
    weekend = weekendArr;
  } else {
    // using weekend number
    if (typeof weekend !== "number")
      throw FormulaError.BuiltIn.Value;
    weekend = WEEKEND_TYPES[weekend];
  }

  const holidaysArr = [];
  if (holidays != null) {
    FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
      holidaysArr.push(parseDate(item));
    });
  }
  let numWorkDays = 0;
  while (startDate <= endDate) {
    let skip = false;
    for (let i = 0; i < weekend.length; i++) {
      if (weekend[i] === startDate.getUTCDay()) {
        skip = true;
        break;
      }
    }

    if (!skip) {
      let found = false;
      for (let i = 0; i < holidaysArr.length; i++) {
        if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
          found = true;
          break;
        }
      }
      if (!found) numWorkDays++;
    }
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  return sign * numWorkDays;

}

/**
 * @summary Returns the current date and time formatted as a date and time.
 */
export function NOW(): number {
  const now = new Date();
  // TODO - not using 1904
  const oaDate = toSerial(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
    now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()))
    + (3600 * now.getHours() + 60 * now.getMinutes() + now.getSeconds()) / 86400;

  FormulaContext.markVolatile();
  FormulaContext.formatResults(`Short Date Short Time`);
  return oaDate;
}

/**
 * @summary Returns the second, a number from 0 to 59.
 * @param serialOrString is a number in the date-time code used by Excel or text in time format, such as 16:48:23 or 4:48:47 PM
 */
export function SECOND(serialOrString: Scalar): number {
  const date = parseDate(serialOrString);
  return date.getUTCSeconds();
}

/**
 * @summary Converts hours, minutes, and seconds given as numbers to an Excel serial number, formatted with a time format
 * @param hour is a number from 0 to 23 representing the hour
 * @param minute is a number from 0 to 59 representing the minute
 * @param second is a number from 0 to 59 representing the second
 */
export function TIME(hour: number, minute: number, second: number): number {
  if (hour < 0 || hour > 32767 || minute < 0 || minute > 32767 || second < 0 || second > 32767) return Number.NaN;

  FormulaContext.formatResults(`Medium Time`);
  return (3600 * hour + 60 * minute + second) / 86400;
}

/**
 * @summary Converts a text time to an Excel serial number for a time, a number from 0 (12:00:00 AM) to 0.999988426 (11:59:59 PM). Format the number with a time format after entering the formula
 * @param timeText is a text string that gives a time in any one of the Excel time formats (date information in the string is ignored)
 */
export function TIMEVALUE(timeText: string): number {
  const asDate = parseDate(timeText);
  return (3600 * asDate.getUTCHours() + 60 * asDate.getUTCMinutes() + asDate.getUTCSeconds()) / 86400;
}

/**
 * @summary Returns the current date formatted as a date.
 */
export function TODAY(): number {
  FormulaContext.formatResults(`Short Date`);
  const now = new Date();
  return FormulaContext.toOADate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * @summary Returns a number from 1 to 7 identifying the day of the week of a date.
 * @param serialOrString is a number that represents a date
 * @param returnType is a number: for Sunday=1 through Saturday=7, use 1; for Monday=1 through Sunday=7, use 2; for Monday=0 through Sunday=6, use 3
 */
export function WEEKDAY(serialOrString: Scalar, returnType: number=1): number {
  const asDate = parseDate(serialOrString);

  const day = asDate.getUTCDay();
  const weekTypes = WEEK_TYPES[returnType];
  if (!weekTypes)
    throw FormulaError.BuiltIn.Num;
  return weekTypes[day];
}

/**
 * @summary Returns the week number in the year
 * @param serialOrString is the date-time code used by Excel for date and time calculation
 * @param returnType is a number (1 or 2) that determines the type of the return value
 */
export function WEEKNUM(
  serialOrString: any,
  returnType: number=1
): number {
  const asDate = parseDate(serialOrString);
  if (returnType === 21) {
    return ISOWEEKNUM(serialOrString);
  }
  const weekStart = WEEK_STARTS[returnType];
  const yearStart = new Date(Date.UTC(asDate.getUTCFullYear(), 0, 1));
  const offset = yearStart.getUTCDay() < weekStart ? 1 : 0;
  return Math.ceil((((asDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7) + offset;
}

/**
 * @summary Returns the serial number of the date before or after a specified number of workdays
 * @param startDate is a serial date number that represents the start date
 * @param days is the number of nonweekend and non-holiday days before or after start_date
 * @param holidays is an optional array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays
 */
export function WORKDAY(startDate: Date, days: number, holidays: number[]=null): number {
  return WORKDAY_INTL(startDate, days, 1, holidays);
}

/**
 * @name WORKDAY.INTL
 * @summary Returns the serial number of the date before or after a specified number of workdays with custom weekend parameters
 * @param startDate is a serial date number that represents the start date
 * @param days is the number of nonweekend and non-holiday days before or after start_date
 * @param weekend is a number or string specifying when weekends occur
 * @param holidays is an optional array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays
 */
export function WORKDAY_INTL(
  startDate: Date,
  days: number,
  weekend: any=1,
  holidays: number[]=null
): number {
  startDate = parseDate(startDate);

  // Using 1111111 will always return value error.
  if (weekend === '1111111')
    throw FormulaError.BuiltIn.Value;

  // using weekend string, i.e, 0000011
  if (typeof weekend === "string" && Number(weekend).toString() !== weekend) {
    if (weekend.length !== 7)
      throw FormulaError.BuiltIn.Value;
    weekend = weekend.charAt(6) + weekend.slice(0, 6);
    const weekendArr = [];
    for (let i = 0; i < weekend.length; i++) {
      if (weekend.charAt(i) === '1')
        weekendArr.push(i);
    }
    weekend = weekendArr;
  } else {
    // using weekend number
    if (typeof weekend !== "number")
      throw FormulaError.BuiltIn.Value;
    weekend = WEEKEND_TYPES[weekend];
    if (weekend == null)
      throw FormulaError.BuiltIn.Num;
  }

  const holidaysArr = [];
  if (holidays != null) {
    FormulaHelpers.flattenParams([holidays], Types.NUMBER, false, item => {
      holidaysArr.push(parseDate(item));
    });
  }
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  let cnt = 0;
  while (cnt < days) {
    let skip = false;
    for (let i = 0; i < weekend.length; i++) {
      if (weekend[i] === startDate.getUTCDay()) {
        skip = true;
        break;
      }
    }

    if (!skip) {
      let found = false;
      for (let i = 0; i < holidaysArr.length; i++) {
        if (compareDateIgnoreTime(startDate, holidaysArr[i])) {
          found = true;
          break;
        }
      }
      if (!found) cnt++;
    }
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  return toSerial(startDate) - 1;
}

/**
 * @summary Returns the year of a date, an integer in the range 1900 - 9999.
 * @param serialOrString is a number in the date-time code used by Excel
 */
export function YEAR(serialOrString: Scalar): number {
  const asDate = parseDate(serialOrString);
  return asDate.getUTCFullYear();
}

/**
 * @summary Returns the year fraction representing the number of whole days between start_date and end_date
 * @param startDate is a serial date number that represents the start date
 * @param endDate is a serial date number that represents the end date
 * @param basis is the type of day count basis to use
 */
// Warning: may have bugs
export function YEARFRAC(
  startDate: number,
  endDate: number,
  basis: number=0
): number {
  let start = FormulaContext.fromOADate(startDate);
  let end = FormulaContext.fromOADate(endDate);

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
    const tempDate = startDate;
    startDate = endDate;
    endDate = tempDate;
  }
  basis = Math.trunc(basis);

  if (basis < 0 || basis > 4)
    throw FormulaError.BuiltIn.Value;

  // https://github.com/LesterLyu/formula.js/blob/develop/lib/date-time.js#L508
  let sd = start.getUTCDate();
  const sm = start.getUTCMonth() + 1;
  const sy = start.getUTCFullYear();
  let ed = end.getUTCDate();
  const em = end.getUTCMonth() + 1;
  const ey = end.getUTCFullYear();

  switch (basis) {
    case 0:
      // US (NASD) 30/360
      if (sd === 31 && ed === 31) {
        sd = 30;
        ed = 30;
      } else if (sd === 31) {
        sd = 30;
      } else if (sd === 30 && ed === 31) {
        ed = 30;
      }
      return Math.abs((ed + em * 30 + ey * 360) - (sd + sm * 30 + sy * 360)) / 360;
    case 1:
      // Actual/actual
      if (ey - sy < 2) {
        const yLength = isLeapYear(sy) && sy !== 1900 ? 366 : 365;
        const days = DAYS(endDate, startDate);
        return days / yLength;
      } else {
        const years = (ey - sy) + 1;
        // const days = (new Date(ey + 1, 0, 1) - new Date(sy, 0, 1)) / 1000 / 60 / 60 / 24;
        const dateEnd = new Date(ey + 1, 0, 1);
        const dateStart = new Date(sy, 0, 1);
        const days = (dateEnd.getTime() - dateStart.getTime()) / 1000 / 60 / 60 / 24;
        const average = days / years;
        return DAYS(endDate, startDate) / average;
      }
    case 2:
      // Actual/360
      return Math.abs(DAYS(endDate, startDate) / 360);
    case 3:
      // Actual/365
      return Math.abs(DAYS(endDate, startDate) / 365);
    case 4:
      // European 30/360
      return Math.abs((ed + em * 30 + ey * 360) - (sd + sm * 30 + sy * 360)) / 360;
  }
}
