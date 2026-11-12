/* cspell: disable */
import {
  FormulaError, FormulaContext,
  type AcceptError, type Scalar, type Volatile, type Flatten, type Omittable, type NoLift, type ReportType
} from '@sheetxl/primitives';

/**
 * Returns the number that represents the date in date-time code.
 * @param year is a number from 1900 or 1904 (depending on the workbook's date system) to 9999.
 * @param month is a number from 1 to 12 representing the month of the year.
 * @param day is a number from 1 to 31 representing the day of the month.
 */
export function DATE(
  year: number,
  month: number,
  day: number
): number {
  FormulaContext.formatResults(`Short Date`);
  // Every slot is FLOORED through the 2^-22 shift before any of the three rules below is applied
  // — `DATE(2019.9,1,31)` is 2019-01-31 and `DATE(2019,1,-0.5)` is day −1, not day 0.
  year = _dateField(year);
  month = _dateField(month);
  day = _dateField(day);
  if (year < 0 || year >= 10000) return Number.NaN;
  // If year is between 0 (zero) and 1899 (inclusive), Adds that value to 1900 to calculate the year.
  if (year < 1900) {
    year += 1900;
  }

  // `month` is bounded by magnitude, independently of where the result lands. `month` outside
  // [-32767, 32766] is #NUM! even when the resulting year is inside the calendar —
  // `DATE(1900,95999,1)` lands in 9899 and is still #NUM!, while `DATE(1900,32766,1)` computes.
  if (month < -32767 || month > 32766) return Number.NaN;
  // The year is range-checked again after the month carries into it and BEFORE the day rolls —
  // `DATE(9999,13,-400)` is #NUM! though the day would bring it back inside the calendar.
  if (year + Math.floor((month - 1) / 12) > 9999) return Number.NaN;

  // `day` saturates rather than rolling or erroring, and it saturates to the TOP in BOTH
  // directions — anything outside the signed 16-bit range becomes 32767, including the
  // negative overflow. `DATE(2020,1,d)` is 43830 + d, and the effective day is 32767 for
  // d = 32768, 40000, 65536, 98304, 1000000 AND for d = -32769, -32770, -65536, -1000000,
  // while d = -32768 is honored as itself. `DATE(2020,1,-32769)` is 76597 — the answer for
  // +32767 — and neither a clamp to -32768 nor a 16-bit wraparound gives that.
  //
  // Note the asymmetry with `month`, which ERRORS where this saturates.
  if (day > 32767 || day < -32768) day = 32767;

  // The resulting date must be in range, not just the year argument — month and day roll, so
  // `DATE(9999,13,1)` is 10000-01-01 and #NUM! despite an in-range year. Built from FIELDS: a JS
  // Date cannot hold `DATE(1900,1,0)` (serial 0) or `DATE(1900,2,29)` (Phantom serial 60).
  const serial = FormulaContext.getSerialDate(year, month, day);
  // Both ends are expressed against the SERIAL rather than the year, so they hold for a 1904
  // workbook too - there 1900-01-01 is out of range at the bottom and the ceiling is 1462 lower.
  // `DATE(1900,1,0)` is serial 0 and legal; `DATE(1900,1,-1)` is not, and `DATE(9999,13,1)` rolls
  // past the top of the calendar despite an in-range year argument.
  if (serial === null || serial === undefined || serial < 0) return Number.NaN;
  if (serial > FormulaContext.getSerialDate(9999, 12, 31)) return Number.NaN;

  return serial;
}

/**
 * Converts a date in the form of text to a number that represents the date as a date-time code.
 * @param dateText is text that represents a date in date format, between 1/1/1900 or 1/1/1904 (depending on the workbook's date system) and 12/31/9999.
 */
export function DATEVALUE(dateText: string): number {
  try {
    // SERIAL 0 IS A RESULT, NOT A FAILURE. `parseAsSerialDate` throws when the text is
    // not a date, so a returned 0 means it parsed and the date part is day zero — and
    // that is the answer: `DATEVALUE("13:00")` is 0 (a bare time has no date
    // part), and on a 1904 workbook `DATEVALUE("1/1/1904")` is 0 because serial 0 IS
    // 1904-01-01. A falsy check on the result would turn both into #VALUE!.
    const asSerialDate = FormulaContext.parseAsSerialDate(dateText);
    // strip the time component
    return Math.floor(asSerialDate);
  } catch (error: any) {
    throw FormulaError.BuiltIn.Value; // throw FormulaError.BuiltIn.Value(`Invalid date: ${dateText}`);
  }
}

/**
 * Returns the day of the month, a number from 1 to 31.
 * @param serialNumber is a number in the date-time code or text in time format, such as 16:48:00 or 4:48:00 PM.
 */
export function DAY(serialNumber: number): number {
  return FormulaContext.getDateParts(serialNumber).day;
}

/**
 * Returns the number of days between the two dates.
 * @param endDate startDate and endDate are the two dates between which you want to know the number of days.
 * @param startDate startDate and endDate are the two dates between which you want to know the number of days.
 */
export function DAYS(
  endDate: Scalar, // date
  startDate: Scalar, // date
): number {
  // Read strictly LEFT TO RIGHT, each slot coerced and then range-checked before the next is
  // touched: `DAYS(-1,"x")` is #NUM! and `DAYS("x",-1)` is #VALUE!. That order is why the slots
  // are declared `Scalar` and coerced here — a declaration-level `number` would coerce both
  // before the body could refuse either, and the second slot's #VALUE! would win.
  //
  // Each is also TRUNCATED rather than read through the component readers' half-second shift, so
  // a serial a quarter of a second short of midnight still belongs to its own day.
  const end = _serialDay(_dateArg(endDate));
  return end - _serialDay(_dateArg(startDate));
}

/**
 * A date slot declared `number`: coerced as the engine would, but inside the body so the
 * function owns the order in which its slots are read.
 */
function _dateArg(value: Scalar): number {
  if (value === null) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return _anyDate(value);
}

/**
 * A date slot that is COUNTED rather than decomposed: truncated to its day and range-checked.
 *
 * @remarks
 * The truncation is the whole point. `FormulaContext.getDateParts` reads the serial→fields
 * conversion, which adds half a second before splitting; the counting functions do not do that.
 * `DAYS(43496 + (86400−0.25)/86400, 43496)` is 0 where `DAY` of the same serial is the next day.
 */
function _serialDay(serial: number): number {
  // Expressed against the workbook's own top serial so it holds under the 1904 system too, where
  // 9999-12-31 is 1462 lower.
  if (!(serial >= 0) || Math.floor(serial) > FormulaContext.getSerialDate(9999, 12, 31)) {
    throw FormulaError.BuiltIn.Num;
  }
  return Math.floor(serial);
}

/**
 * Reads a date argument declared `any` rather than `number`.
 *
 * @remarks
 * The declared type is what decides whether a BOOLEAN reaches the body. `MONTH`/`WEEKDAY`/`DAY`/
 * `ISOWEEKNUM` (and `DAYS360`) are declared over `number`, so `TRUE` is coerced to 1 before they
 * run; `EDATE`/`EOMONTH`/`YEARFRAC` are declared over `any`, so the value arrives raw and the
 * body refuses it. The split is Excel's and is kept for compatibility. Declaring one of the `any` slots `number` here would let
 * the marshaller coerce the boolean away before the body could object.
 *
 * Text is still accepted, in the two steps {@link WEEKNUM} uses: numeric text is a SERIAL
 * (`EOMONTH("36556",0)` = 36556) and only non-numeric text goes to the date parser.
 * `parseAsSerialDate` supplies the refusal — it throws `#VALUE!` for a boolean whether it came in
 * as a literal or a cell, and rethrows an incoming error with its own identity.
 */
function _anyDate(value: Scalar): number {
  if (value === null) return 0;
  if (typeof value === 'string') {
    try {
      return FormulaContext.parseAsNumber(value);
    } catch {
      return FormulaContext.parseAsSerialDate(value);
    }
  }
  return FormulaContext.parseAsSerialDate(value as any);
}

/**
 * Reads a plain numeric argument declared `any` — the `months`/`basis` slots.
 *
 * @remarks
 * Same rule as {@link _anyDate}: `EOMONTH(36556,TRUE)` and `YEARFRAC(1,367,TRUE)` are
 * `#VALUE!` while `EOMONTH(36556,"1")` is 36585. `parseAsNumber`
 * already answers all four cases (number through, text parsed, boolean refused, error identity).
 */
function _anyNumber(value: Scalar): number {
  if (value === null) return 0;
  return FormulaContext.parseAsNumber(value);
}

/**
 * A REQUIRED slot declared `any`: an argument supplied EMPTY is a MISSING argument, not a zero.
 *
 * @remarks
 * The three positions differ: `EDATE(,1)` is #N/A, `EDATE(A1,1)` over a blank cell is serial 0 plus
 * one month, and `EDATE(36556,)` is #N/A too — both slots are required in the same way.
 * `Omittable<Scalar>` is what lets the body see the difference at all. `YEARFRAC` carries the same
 * shape.
 */
function _anyRequired<T>(value: Omittable<Scalar>, read: (v: Scalar) => T): T {
  if (value === undefined) throw FormulaError.BuiltIn.NA;
  return read(value as Scalar);
}

/**
 * Returns the serial number of the date that is the indicated number of months before or after the start date.
 * @param startDate is a serial date number that represents the start date.
 * @param months is the number of months before or after startDate.
 * @remarks
 * The ATP refusal: `EDATE(A1:A3,1)` is `#VALUE!` — a multi-cell reference does not broadcast at
 * an `any` slot — while an ARRAY constant still lifts. Shared with `EOMONTH` and `WEEKNUM`; the
 * native `DAY`/`WEEKDAY`/`DAYS` of the same category all spill.
 */
export function EDATE(
  startDate: NoLift<Omittable<Scalar>>,
  months: NoLift<Omittable<Scalar>>
): number {
  // Truncated, not shifted: the offset functions read the serial's own day where the component
  // readers round to the nearest second (`_serialDay`).
  const start = _serialDay(_anyRequired(startDate, _anyDate));
  const { year, month, day } = FormulaContext.getDateParts(start);
  const { year: y, month: m } = _shiftMonth(year, month, _monthOffset(months));
  // clamp day to the target month.
  return _serialResult(y, m, FormulaContext.getSerialDate(y, m, Math.min(day, _daysInMonth(y, m))));
}

/**
 * Returns the serial number of the last day of the month before or after a specified number of months.
 * @param startDate is a serial date number that represents the start date.
 * @param months is the number of months before or after the startDate.
 */
export function EOMONTH(
  startDate: NoLift<Omittable<Scalar>>,
  months: NoLift<Omittable<Scalar>>
): number {
  const start = _serialDay(_anyRequired(startDate, _anyDate));
  const { year, month } = FormulaContext.getDateParts(start);
  const { year: y, month: m } = _shiftMonth(year, month, _monthOffset(months));
  return _serialResult(y, m, FormulaContext.getSerialDate(y, m, _daysInMonth(y, m)));
}

/**
 * A shifted date that has to land back INSIDE the calendar — judged on the target MONTH.
 *
 * @remarks
 * The offset functions validate where the shift LANDS, not just where it started:
 * `EDATE(DATE(1900,1,1),-1)` and `EOMONTH(DATE(9999,12,31),1)` are both #NUM!. The bound is the
 * MONTH's, not the serial's, and the two differ at exactly one place — `EOMONTH(0,-1)` is
 * December 1899, whose last day IS serial 0, and is refused, while `EDATE(0,0)` answers 0.
 */
function _serialResult(year: number, month: number, serial: number): number {
  if (FormulaContext.getSerialDate(year, month, 1) < 0) throw FormulaError.BuiltIn.Num;
  if (serial > FormulaContext.getSerialDate(9999, 12, 31)) throw FormulaError.BuiltIn.Num;
  return serial;
}

/**
 * The `months` offset: required, `any`-declared, and TRUNCATED TOWARD ZERO.
 *
 * @remarks
 * Not floored — `EOMONTH(DATE(2019,1,31),-0.9)` stays in January where `DATE`'s own slots would
 * have gone back a month (`_dateField`).
 */
function _monthOffset(months: Omittable<Scalar>): number {
  return Math.trunc(_anyRequired(months, _anyNumber));
}

const _DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Length of a calendar month — the real Gregorian leap rule, so February 1900 is 28.
 * Phantom 1900-02-29 is a serial that exists, not a day the month is long enough
 * to contain, and `EDATE`/`EOMONTH` measure the latter.
 */
function _daysInMonth(year: number, month: number): number {
  if (month !== 2) return _DAYS_IN_MONTH[month - 1];
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
}

/** Resolves `month + offset` into a calendar year/month, carrying in both directions. */
function _shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const target = month + offset - 1;
  return { year: year + Math.floor(target / 12), month: ((target % 12) + 12) % 12 + 1 };
}

/**
 * Returns the hour as a number from 0 (12:00 A.M.) to 23 (11:00 P.M.).
 * @param serialNumber is a number in the date-time code or text in time format, such as 16:48:00 or 4:48:00 PM.
 */
export function HOUR(
  serialNumber: number // date
): number {
  return FormulaContext.getDateParts(serialNumber).hour;
}

/**
 * Returns the ISO week number in the year for a given date.
 * @param date is a number in the date-time code or text in time format, such as 16:48:00 or 4:48:00 PM.
 */
export function ISOWEEKNUM(
  date: number // date
): number {
  // ISO 8601: a week belongs to whichever year contains its THURSDAY, and week 1 is the week
  // holding the first Thursday of that year. Pure serial arithmetic, so it stays correct across
  // Phantom 1900-02-29 and under either date system.
  // The week functions TRUNCATE where their component-reader siblings shift by half a second, and
  // they answer at the top of the calendar where WEEKDAY on the same serial is #NUM! — so the
  // serial is floored here and the bound is the floored day's, not the rounded one's.
  const serial = _serialDay(date);
  const { year, dow } = FormulaContext.getDateParts(serial);
  const thursday = serial + 4 - dow; // dow: 1 = Mon ... 7 = Sun
  // The Thursday can fall in the neighboring year - and, near the epoch, below serial 0, which
  // is why the year is resolved by comparing serials rather than by reading the Thursday's parts.
  let isoYear = year;
  if (thursday < FormulaContext.getSerialDate(isoYear, 1, 1)) isoYear -= 1;
  else if (thursday >= FormulaContext.getSerialDate(isoYear + 1, 1, 1)) isoYear += 1;
  return Math.floor((thursday - FormulaContext.getSerialDate(isoYear, 1, 1)) / 7) + 1;
}

/**
 * Returns the minute, a number from 0 to 59.
 * @param serialNumber is a number in the date-time code or text in time format, such as 16:48:00 or 4:48:00 PM.
 */
export function MINUTE(
  serialNumber: number // date
): number {
  return FormulaContext.getDateParts(serialNumber).minute;
}

/**
 * Returns the month, a number from 1 (January) to 12 (December).
 * @param serialNumber is a number in the date-time code or text in date format.
 */
export function MONTH(
  serialNumber: number // date
): number {
  return FormulaContext.getDateParts(serialNumber).month;
}

/**
 * Returns the number of whole workdays between two dates.
 * @param startDate is a serial date number that represents the start date.
 * @param endDate is a serial date number that represents the end date.
 * @param holidays is an optional set of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 */
export function NETWORKDAYS(
  startDate: NoLift<Omittable<AcceptError<Scalar>>>, // date
  endDate: NoLift<Omittable<AcceptError<Scalar>>>, // date
  holidays?: Omittable<Flatten<AcceptError<Scalar>>>
): number {
  return NETWORKDAYS_INTL(startDate, endDate, 1, holidays);
}

/**
 * The `weekend` slot of the WORKDAY/NETWORKDAYS `.INTL` pair: a code or a seven-character mask.
 *
 * @remarks
 * Read FIRST, before either date — `NETWORKDAYS.INTL(NA(),44945,"x")` is #VALUE! and
 * `NETWORKDAYS.INTL("x",44945,-1)` is #NUM!, so this slot's fault beats the dates'.
 *
 * A STRING is always a mask candidate, even a numeric-looking one: `"1000000"` selects Monday as
 * the weekend rather than being read as a million, and `"1"` is #VALUE! rather than code 1. The
 * mask is Monday-first, exactly seven characters, and every character must be 0 or 1 — `"0000012"`
 * and `"abcdefg"` are #VALUE!. A BOOLEAN coerces (TRUE is code 1, FALSE is 0 and so #NUM!) though
 * numeric text does not, a blank CELL is the number 0 (#NUM!) while an OMITTED slot is code 1, and
 * a number TRUNCATES (`1.5` is code 1, `17.9` is 17).
 *
 * An ERROR here is the one place the twins DISAGREE, so neither reads it: WORKDAY.INTL answers
 * #NUM! and NETWORKDAYS.INTL #VALUE!, and each body says so itself.
 */
function _weekendDays(weekend: Scalar): number[] {
  // A blank cell is the NUMBER 0 here, not "no weekend given" — an invalid code, so this lands on
  // #NUM! below rather than the #VALUE! a non-numeric would give.
  let value: Scalar = weekend === null ? 0 : weekend;
  if (typeof value === 'string') {
    if (value.length !== 7 || /[^01]/.test(value)) throw FormulaError.BuiltIn.Value;
    const sundayFirst = value.charAt(6) + value.slice(0, 6);
    const days: number[] = [];
    for (let i = 0; i < sundayFirst.length; i++) if (sundayFirst.charAt(i) === '1') days.push(i);
    return days;
  }
  if (typeof value === 'boolean') value = value ? 1 : 0;
  if (typeof value !== 'number') throw FormulaError.BuiltIn.Value;
  const days = _WEEKENDS[Math.trunc(value)];
  if (days == null) throw FormulaError.BuiltIn.Num;
  return days;
}

/**
 * The days a weekend falls on, for NETWORKDAYS.INTL and WORKDAY.INTL.
 *
 * @remarks
 * Documents the codes only: the slot is `Weekend | Scalar`, because a seven-character mask
 * (`"0000011"`, Monday first) is just as legal and the body reads either itself. No gate.
 */
enum Weekend {
  /**
   * The weekend is Saturday and Sunday.
   * @name Saturday, Sunday
   */
  SaturdaySunday = 1,
  /**
   * The weekend is Sunday and Monday.
   * @name Sunday, Monday
   */
  SundayMonday = 2,
  /**
   * The weekend is Monday and Tuesday.
   * @name Monday, Tuesday
   */
  MondayTuesday = 3,
  /**
   * The weekend is Tuesday and Wednesday.
   * @name Tuesday, Wednesday
   */
  TuesdayWednesday = 4,
  /**
   * The weekend is Wednesday and Thursday.
   * @name Wednesday, Thursday
   */
  WednesdayThursday = 5,
  /**
   * The weekend is Thursday and Friday.
   * @name Thursday, Friday
   */
  ThursdayFriday = 6,
  /**
   * The weekend is Friday and Saturday.
   * @name Friday, Saturday
   */
  FridaySaturday = 7,
  /**
   * The weekend is Sunday alone.
   * @name Sunday only
   */
  SundayOnly = 11,
  /**
   * The weekend is Monday alone.
   * @name Monday only
   */
  MondayOnly = 12,
  /**
   * The weekend is Tuesday alone.
   * @name Tuesday only
   */
  TuesdayOnly = 13,
  /**
   * The weekend is Wednesday alone.
   * @name Wednesday only
   */
  WednesdayOnly = 14,
  /**
   * The weekend is Thursday alone.
   * @name Thursday only
   */
  ThursdayOnly = 15,
  /**
   * The weekend is Friday alone.
   * @name Friday only
   */
  FridayOnly = 16,
  /**
   * The weekend is Saturday alone.
   * @name Saturday only
   */
  SaturdayOnly = 17,
}

/**
 * Returns the number of whole workdays between two dates with custom weekend parameters.
 * @name NETWORKDAYS.INTL
 * @param startDate is a serial date number that represents the start date.
 * @param endDate is a serial date number that represents the end date.
 * @param weekend is a number or string specifying when weekends occur.
 * @param holidays is an optional set of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 */
export function NETWORKDAYS_INTL(
  startDate: NoLift<Omittable<AcceptError<Scalar>>>, // date
  endDate: NoLift<Omittable<AcceptError<Scalar>>>, // date
  weekend: Omittable<AcceptError<Weekend | Scalar>>=Weekend.SaturdaySunday,
  holidays?: Omittable<Flatten<AcceptError<Scalar>>>
): number {
  // The WEEKEND is read first — before either date, and before an error in one of them:
  // `NETWORKDAYS.INTL(NA(),end,"x")` is #VALUE! and `NETWORKDAYS.INTL("x",end,-1)` is #NUM!.
  // That is why the date slots carry `AcceptError`: without it the engine would propagate the
  // #N/A before this body ever ran. WORKDAY.INTL reads the OPPOSITE way round — same family, same
  // slots, opposite order.
  //
  // An ERROR at the weekend slot is #VALUE! here and #NUM! in WORKDAY.INTL; falling into
  // `_weekendDays` gives the #VALUE! this one wants.
  const weekendDays = _weekendDays(weekend as Scalar);
  // Then the dates, left to right and range-checked as each is read. The slots are declared `any`,
  // so a BOOLEAN is #VALUE! where `DAYS` coerces one, an OMITTED slot is #N/A where a blank CELL
  // is serial 0, and both ends must be inside the calendar — `NETWORKDAYS(44940,2958466)` is
  // #NUM! rather than a count off the end.
  let start = _serialDay(_anyRequired(startDate as Omittable<Scalar>, _anyDate));
  let end = _serialDay(_anyRequired(endDate as Omittable<Scalar>, _anyDate));
  let sign = 1;
  if (start > end) {
    sign = -1;
    const temp = start;
    start = end;
    end = temp;
  }
  // An all-weekend mask needs no special case: every day of the span is skipped and the count is 0.
  const holidaySerials = toHolidaySerials(holidays);
  const anchor = dayOfWeekAnchor();

  let numWorkDays = 0;
  for (let serial = start; serial <= end; serial++) {
    if (weekendDays.includes(dayOfWeek(serial, anchor))) continue;
    if (holidaySerials.has(serial)) continue;
    numWorkDays++;
  }
  return sign * numWorkDays;
}

/**
 * Returns the current date and time formatted as a date and time.
 */
export function NOW(): Volatile<number> {
  FormulaContext.formatResults(`Short DateTime`);
  return FormulaContext.getNow();
}

/**
 * Returns the second, a number from 0 to 59.
 * @param serialNumber is a number in the date-time code or text in time format, such as 16:48:23 or 4:48:47 PM.
 */
export function SECOND(
  serialNumber: number // date
): number {
  return FormulaContext.getDateParts(serialNumber).second;
}

/**
 * Converts hours, minutes, and seconds given as numbers to a date code, formatted with a time format.
 * @param hour is a number from 0 to 23 representing the hour.
 * @param minute is a number from 0 to 59 representing the minute.
 * @param second is a number from 0 to 59 representing the second.
 */
export function TIME(
  hour: number,
  minute: number,
  second: number
): number {
  FormulaContext.formatResults(`Medium Time`);
  // Floored through the same 2^-22 shift DATE uses (`_dateField`): `TIME(1.9,1.9,1.9)` is
  // 1:01:01 and `TIME(0.5,0,0)` is midnight.
  hour = _dateField(hour);
  minute = _dateField(minute);
  second = _dateField(second);
  // Each slot must fit a SIGNED 16-bit integer — `TIME(32767,-32768,0)` computes and
  // `TIME(32767,-40000,0)` is #NUM! — so the bound is not [0, 32767] and a negative slot is not
  // refused on its own. What is refused is a negative TOTAL: `TIME(-1,60,0)` is midnight,
  // `TIME(-1,59,0)` is #NUM!.
  if (hour < -32768 || hour > 32767 || minute < -32768 || minute > 32767 ||
      second < -32768 || second > 32767) return Number.NaN;
  const seconds = 3600 * hour + 60 * minute + second;
  if (seconds < 0) return Number.NaN;

  // TIME is a time OF DAY, so a total of a day or more wraps rather than carrying into days:
  // TIME(25,0,0) is 1:00 AM (0.0417), not 1.0417.
  const asDays = seconds / 86400;
  return asDays - Math.floor(asDays);
}

/**
 * Converts a text time to a date code for a time, a number from 0 (12:00:00 AM) to 0.999988426 (11:59:59 PM). Format the number with a time format after entering the formula.
 * @param timeText is a text string that gives a time in any one of the time formats (date information in the string is ignored).
 */
export function TIMEVALUE(timeText: string): number {
  // The date part is ignored, so this is just the serial's fraction — taken from the serial
  // rather than from a JS Date, which cannot represent a bare time under the 1904 system.
  const serial = FormulaContext.parseAsSerialDate(timeText);
  return serial - Math.floor(serial);
}

/**
 * Returns the current date formatted as a date.
 */
export function TODAY(): Volatile<number> {
  FormulaContext.formatResults(`Short Date`);
  return Math.floor(FormulaContext.getNow());
}

/**
 * How WEEKDAY numbers the days of the week.
 *
 * @remarks
 * Declared `ReportType`, as every numeric built-in enum is: the argument is TRUNCATED (`2.9`
 * is 2) and is #NUM! outside the set, which an enum's gate does not do, so the body keeps
 * the verdict. Members that mean the same thing share a label (2 and 11, 1 and 17), and so share
 * one descriptor entry.
 */
enum WeekdayType {
  /**
   * Sunday is 1 and Saturday is 7.
   * @name Sunday (1) through Saturday (7)
   */
  SundayFirst = 1,
  /**
   * Monday is 1 and Sunday is 7.
   * @name Monday (1) through Sunday (7)
   */
  MondayFirst = 2,
  /**
   * Monday is 0 and Sunday is 6.
   * @name Monday (0) through Sunday (6)
   */
  MondayZero = 3,
  /**
   * Monday is 1 and Sunday is 7.
   * @name Monday (1) through Sunday (7)
   */
  MondayOne = 11,
  /**
   * Tuesday is 1 and Monday is 7.
   * @name Tuesday (1) through Monday (7)
   */
  TuesdayOne = 12,
  /**
   * Wednesday is 1 and Tuesday is 7.
   * @name Wednesday (1) through Tuesday (7)
   */
  WednesdayOne = 13,
  /**
   * Thursday is 1 and Wednesday is 7.
   * @name Thursday (1) through Wednesday (7)
   */
  ThursdayOne = 14,
  /**
   * Friday is 1 and Thursday is 7.
   * @name Friday (1) through Thursday (7)
   */
  FridayOne = 15,
  /**
   * Saturday is 1 and Friday is 7.
   * @name Saturday (1) through Friday (7)
   */
  SaturdayOne = 16,
  /**
   * Sunday is 1 and Saturday is 7.
   * @name Sunday (1) through Saturday (7)
   */
  SundayOne = 17,
}

/**
 * Returns a number from 1 to 7 identifying the day of the week of a date.
 * @param serialNumber is a number that represents a date.
 * @param returnType is a number: for Sunday=1 through Saturday=7, use 1; for Monday=1 through Sunday=7, use 2; for Monday=0 through Sunday=6, use 3.
 */
export function WEEKDAY(
  serialNumber: number, // date
  returnType: ReportType<WeekdayType>=WeekdayType.SundayFirst
): number {
  // A fractional return_type TRUNCATES — `WEEKDAY(d,2.9)` selects table 2 — and only then is the
  // result validated. The sign is judged after the truncation too, so −0.5 is 0 and #NUM!.
  const weekTypes = _WEEKDAYS[_returnTypeIndex(returnType)];
  if (!weekTypes)
    throw FormulaError.BuiltIn.Num;
  // `dow` is 1=Mon..7=Sun and comes from the SERIAL — weekday is `serial mod 7`
  // throughout, so below serial 61 it is NOT the real calendar's weekday. _WEEKDAYS is
  // indexed 0=Sun.
  const dow = FormulaContext.getDateParts(serialNumber).dow;
  return weekTypes[dow % 7];
}

/**
 * The day a week begins on, for WEEKNUM.
 *
 * @remarks
 * Documents the values only: the slot is `WeekNumType | Scalar`, because the body reads the raw
 * argument itself (ATP coercion) — truncating, and answering #NUM! outside the set. No gate.
 * Members that mean the same thing share a label (2 and 11, 1 and 17).
 */
enum WeekNumType {
  /**
   * Weeks begin on Sunday; week 1 is the week containing January 1.
   * @name Week begins on Sunday
   */
  Sunday = 1,
  /**
   * Weeks begin on Monday; week 1 is the week containing January 1.
   * @name Week begins on Monday
   */
  Monday = 2,
  /**
   * Weeks begin on Monday; week 1 is the week containing January 1.
   * @name Week begins on Monday
   */
  MondayStart = 11,
  /**
   * Weeks begin on Tuesday; week 1 is the week containing January 1.
   * @name Week begins on Tuesday
   */
  TuesdayStart = 12,
  /**
   * Weeks begin on Wednesday; week 1 is the week containing January 1.
   * @name Week begins on Wednesday
   */
  WednesdayStart = 13,
  /**
   * Weeks begin on Thursday; week 1 is the week containing January 1.
   * @name Week begins on Thursday
   */
  ThursdayStart = 14,
  /**
   * Weeks begin on Friday; week 1 is the week containing January 1.
   * @name Week begins on Friday
   */
  FridayStart = 15,
  /**
   * Weeks begin on Saturday; week 1 is the week containing January 1.
   * @name Week begins on Saturday
   */
  SaturdayStart = 16,
  /**
   * Weeks begin on Sunday; week 1 is the week containing January 1.
   * @name Week begins on Sunday
   */
  SundayStart = 17,
  /**
   * Weeks begin on Monday; week 1 is the week containing the first Thursday of the year.
   * @name Week begins on Monday (ISO 8601)
   */
  Iso = 21,
}

/**
 * Returns the week number in the year.
 * @param serialNumber is the date-time code used for date and time calculation.
 * @param returnType is a number (1 or 2) that determines the type of the return value.
 * @remarks
 * The ATP refusal is WEEKNUM's alone in this category: `WEEKNUM(A1:A3,1)` is `#VALUE!` while
 * `ISOWEEKNUM(A1:A3)`, `WEEKDAY(A1:A3,1)` and `DAYS(A1:A3,x)` all spill, and an ARRAY constant
 * still lifts here (`WEEKNUM({43496;43497},1)` spills two).
 */
export function WEEKNUM(
  serialNumber: NoLift<Omittable<Scalar>>,
  returnType: NoLift<Omittable<WeekNumType | Scalar>> = WeekNumType.Sunday
): number {
  if (serialNumber === undefined) throw FormulaError.BuiltIn.NA;
  let serial: number;
  if (serialNumber === null) {
    serial = 0;
  } else if (typeof serialNumber === 'string') {
    try {
      serial = FormulaContext.parseAsNumber(serialNumber);
    } catch {
      serial = FormulaContext.parseAsSerialDate(serialNumber);
    }
  } else {
    serial = FormulaContext.parseAsSerialDate(serialNumber);
  }
  // TRUNCATED like ISOWEEKNUM, not shifted like WEEKDAY: `WEEKNUM(44940 + (86400-0.25)/86400)` is
  // still the Saturday's week where WEEKDAY on the same serial answers for the Sunday.
  serial = _serialDay(serial);
  const rt: number = returnType === null ? 0 : _returnTypeIndex(FormulaContext.parseAsNumber(returnType));
  if (rt === 21) {
    return ISOWEEKNUM(serial);
  }
  // A return_type outside [0, 21] has no stable answer in Excel, while every value inside [0, 21]
  // does. Truncate-then-validate is the uniform rule we answer with instead.
  const weekStart = _WEEKSTARTS[rt];
  if (weekStart === undefined) // invalid returnType — #NUM!
    throw FormulaError.BuiltIn.Num;
  // Week 1 is the one containing Jan 1, however short. `lead` is how many days of that week
  // fall in the previous year, so adding it lines the year up on a week boundary and the
  // division does the rest.
  const jan1 = FormulaContext.getSerialDate(FormulaContext.getDateParts(serial).year, 1, 1);
  const jan1Sun0 = FormulaContext.getDateParts(jan1).dow % 7; // 0 = Sun, matching _WEEKSTARTS
  const lead = (jan1Sun0 - weekStart + 7) % 7;
  const dayOfYear = Math.floor(serial) - jan1 + 1;
  return Math.floor((dayOfYear + lead - 1) / 7) + 1;
}

/**
 * Returns the serial number of the date before or after a specified number of workdays.
 * @param startDate is a serial date number that represents the start date.
 * @param days is the number of nonweekend and non-holiday days before or after startDate.
 * @param holidays is an optional array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 */
export function WORKDAY(
  startDate: NoLift<Omittable<Scalar>>, // date
  days: NoLift<Omittable<Scalar>>,
  holidays?: Omittable<Flatten<Scalar>>
): number {
  return WORKDAY_INTL(startDate, days, 1, holidays);
}

/**
 * Returns the serial number of the date before or after a specified number of workdays with custom weekend parameters.
 * @name WORKDAY.INTL
 * @param startDate is a serial date number that represents the start date.
 * @param days is the number of nonweekend and non-holiday days before or after startDate.
 * @param weekend is a number or string specifying when weekends occur.
 * @param holidays is an optional array of one or more serial date numbers to exclude from the working calendar, such as state and federal holidays and floating holidays.
 */
export function WORKDAY_INTL(
  startDate: NoLift<Omittable<Scalar>>, // date
  days: NoLift<Omittable<Scalar>>,
  weekend: NoLift<Omittable<AcceptError<Weekend | Scalar>>>=Weekend.SaturdaySunday,
  holidays?: Omittable<Flatten<Scalar>>
): number {
  // Read LEFT TO RIGHT — the opposite of NETWORKDAYS.INTL, which reads its weekend before either
  // date. `WORKDAY.INTL(NA(),10,"x")` is #N/A and `WORKDAY.INTL(-1,10,"x")` is #NUM!, so the
  // start's fault beats the weekend's; `WORKDAY.INTL("x",10,-1)` is #VALUE! for the same reason.
  // The date slots therefore do NOT carry `AcceptError`: the engine propagating their error first
  // is exactly the order wanted here.
  const start = _serialDay(_anyRequired(startDate, _anyDate));
  // `days` is FLOORED — not truncated and not shifted. `WORKDAY(x,-1E-9)` walks a day BACK where
  // `WORKDAY(x,1E-9)` stands still, which makes this the file's third integerization
  // (`_dateField` floors after a 2^-22 shift, `_monthOffset` truncates toward zero).
  const walk = Math.floor(_anyRequired(days, _anyNumber));
  // No walk, no calendar: the weekend and holidays are not read at all, so
  // `WORKDAY(45000,0,"test")` is the start date rather than the holidays' #VALUE!.
  if (walk === 0) return start;
  // An ERROR at the weekend slot is #NUM! here and #VALUE! in NETWORKDAYS.INTL — the twins
  // disagree, so each says so itself.
  if (FormulaError.isError(weekend)) throw FormulaError.BuiltIn.Num;
  const weekendDays = _weekendDays(weekend as Scalar);
  // An all-weekend mask has no next working day to reach, so it is #VALUE!.
  if (weekendDays.length === 7) throw FormulaError.BuiltIn.Value;

  const holidaySerials = toHolidaySerials(holidays);

  // Walks whole days from the start serial, counting only working ones; a negative `days` walks
  // backwards.
  // The walk stops at the calendar's edge rather than running past it: `WORKDAY(x,-100000)` and
  // `WORKDAY(x,1E10)` are both #NUM!, and the guard is what keeps an unbounded `days` from
  // becoming an unbounded loop.
  const anchor = dayOfWeekAnchor();
  const top = FormulaContext.getSerialDate(9999, 12, 31);
  const step = walk < 0 ? -1 : 1;
  let remaining = Math.abs(walk);
  let serial = start;
  while (remaining > 0) {
    serial += step;
    if (serial < 0 || serial > top) throw FormulaError.BuiltIn.Num;
    if (weekendDays.includes(dayOfWeek(serial, anchor))) continue;
    if (holidaySerials.has(serial)) continue;
    remaining--;
  }
  return serial;
}

/**
 * Returns the year of a date, an integer in the range 1900 - 9999.
 * @param serialNumber is a number in the date-time code used for date and time calculation.
 */
export function YEAR(
  serialNumber: number // date
): number {
  return FormulaContext.getDateParts(serialNumber).year;
}

// helpers

/**
 * The weekday a week STARTS on for each WEEKNUM returnType, 0 = Sunday.
 * 1/omitted = Sunday, 2 = Monday, 11..17 = Monday..Sunday, 21 = ISO (handled separately).
 */
const _WEEKSTARTS = [
  undefined,
  0, 1,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  1, 2, 3, 4, 5, 6, 0
];
const _WEEKDAYS = [
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
const _WEEKENDS = [
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

/**
 * Day of week for a serial, 0 = Sunday - the index `_WEEKDAYS`/`WEEKENDS` use.
 *
 * Weekday is `serial mod 7` throughout, including across the phantom `1900-02-29`,
 * so it is NOT the real calendar's weekday below serial 61. Same rule the number formatter
 * applies for `ddd`/`dddd`.
 *
 * The phase depends on the DATE SYSTEM - 1904 shifts every serial by 1462 days, and
 * 1462 % 7 is 6, so serial 0 is a Saturday in 1900 and a Friday in 1904. Anchoring on
 * serial 0 through the context picks up whichever system the workbook uses.
 */
function dayOfWeek(serial: number, anchor: number): number {
  return (anchor + Math.floor(serial)) % 7;
}

/** The 0 = Sunday index of serial 0 in the workbook's date system. Read once per call. */
function dayOfWeekAnchor(): number {
  return FormulaContext.getDateParts(0).dow % 7;
}

/** Holiday arguments as a set of whole-day serials; anything unparseable is ignored. */
function toHolidaySerials(holidays: Scalar[] | undefined): Set<number> {
  // The NETWORKDAYS pair reads this LAST, after the weekend and both dates, and declares the slot
  // `AcceptError` so an error among the holidays cannot pre-empt them: `NETWORKDAYS(NA(),date,1/0)`
  // is #N/A. The WORKDAY pair leaves it to the ENGINE, because there the holidays' error beats the
  // weekend's — `WORKDAY.INTL("2024-01-01",5,NA(),1/0)` is #DIV/0! where dropping the holidays
  // makes it #NUM!. Two orders, one helper. A member error keeps its own identity either way,
  // from `_anyDate` below.
  const serials = new Set<number>();
  for (let i = 0; i < (holidays?.length ?? 0); i++) {
    const member = holidays![i]!;
    // A BLANK member contributes nothing — it is the one kind that is skipped rather than read.
    if (member === null || member === undefined) continue;
    // Everything else is READ, and each is range-checked: numeric text and date text parse, a
    // boolean or non-numeric text is #VALUE! for the whole call, an error keeps its own identity,
    // and a serial outside the calendar is #NUM!. The same in all four functions.
    serials.add(_serialDay(_anyDate(member)));
  }
  return serials;
}


/**
 * Excel's integerization of a DATE/TIME FIELD slot: floor, after a shift of 2^-22.
 *
 * @remarks
 * `DATE` and `TIME` do not truncate their slots — they FLOOR them (`DATE(2019,1,-0.5)` is day −1,
 * not day 0) after adding an absolute constant, so a value a whisker below an integer counts as
 * that integer: `DATE(2019,1,1024-2E-7)` is day 1024 and `1024-2.4E-7` is day 1023, and the same
 * boundary holds at 1, at 2 and at 32766 — an absolute shift, not a relative one. It is the same
 * constant the TEXT functions apply to their counts, and `DATE`/`TIME` share it across all six of
 * their slots.
 *
 * Two edges the constant alone does not reproduce, neither of them reachable from a workbook:
 * Excel's true boundary sits a hair ABOVE 2^-22 — inside [2.38535E-7, 2.3854E-7) against
 * 2.3841858E-7, a band 1.1E-11 wide below each integer — and immediately below ZERO it is exactly
 * HALF that (a slot of −1.1926E-7 is 0 and −1.1927E-7 is −1).
 */
function _dateField(value: number): number {
  return Math.floor(value + _FIELD_SHIFT);
}

/** See {@link _dateField}. */
const _FIELD_SHIFT = 1 / 4194304; // 2^-22

/**
 * WEEKDAY's and WEEKNUM's `return_type`, made whole: truncated, except that a value within the
 * {@link _dateField} shift below an integer is that integer (`1.9999999` is 2, `2.9` is 2).
 */
function _returnTypeIndex(value: number): number {
  return value >= 0 ? Math.floor(value + _FIELD_SHIFT) : Math.trunc(value);
}
