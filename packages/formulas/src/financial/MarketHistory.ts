/* cspell: disable */
import {
  FormulaContext, FormulaError,
  type IFormulaContext, type Scalar, type Flatten, type Omittable
} from '@sheetxl/primitives';

/*
 * Serial dates by hand: an executor runs after the pass, outside any cell, so it reads nothing
 * from the context. Both services speak ISO dates; the sheet speaks serials.
 */
const DAY_MS = 86400000;
/** The serial of 1970-01-01. */
const EPOCH_SERIAL = 25569;

const toSerial = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS) + EPOCH_SERIAL;
const toIso = (serial: number): string => new Date((Math.floor(serial) - EPOCH_SERIAL) * DAY_MS).toISOString().slice(0, 10);

/** What one history call asks for: the request, and how its rows are laid out. */
interface HistoryPayload {
  url: string;
  /** `0` none, `1` a header row, `2` the instrument above the header row. */
  headers: number;
  /** The columns, by property number (see {@link STOCKHISTORY}), as `"0,1"`. */
  properties: string;
  /** The first serial wanted, inclusive. */
  start: number;
  /** The last serial wanted, inclusive. */
  end: number;
  /** What `headers: 2` shows above the header row. */
  instrument: string;
}

/** One day of history, by property name. */
type Bar = Record<string, Scalar>;

const PROPERTY_NAMES = ['Date', 'Close', 'Open', 'High', 'Low', 'Volume'] as const;

/** Rows for the sheet from dated bars: the header rows asked for, then one row per bar, ascending. */
function toRows(payload: HistoryPayload, bars: Map<string, Bar>): Scalar[][] {
  const properties = payload.properties.split(',').map((p) => PROPERTY_NAMES[Number(p)]);
  const rows: Scalar[][] = [];
  if (payload.headers === 2) rows.push(properties.map((_p, i) => (i === 0 ? payload.instrument : null)));
  if (payload.headers >= 1) rows.push([...properties]);
  const dates = Array.from(bars.keys()).sort();
  for (const date of dates) {
    const serial = toSerial(date);
    if (serial < payload.start || serial > payload.end) continue;
    const bar = bars.get(date)!;
    rows.push(properties.map((p) => (p === 'Date' ? serial : bar[p] ?? null)));
  }
  if (rows.length === 0) throw FormulaError.BuiltIn.NA;
  return rows;
}

/** Reads the properties argument: the numbers chosen, in order; `Date, Close` when none. */
function readProperties(properties: readonly Scalar[] | undefined): string {
  const picked: number[] = [];
  for (const value of properties ?? []) {
    if (value === null || value === undefined) continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n >= PROPERTY_NAMES.length) throw FormulaError.BuiltIn.Value;
    picked.push(n);
  }
  return picked.length > 0 ? picked.join(',') : '0,1';
}

/** The window: `end` defaults to `start`. */
function readWindow(startDate: number, endDate: number | undefined): { start: number, end: number } {
  const start = Math.floor(startDate);
  const end = endDate === undefined ? start : Math.floor(endDate);
  if (start < 1 || end < start) throw FormulaError.BuiltIn.Value;
  return { start, end };
}

/**
 * One request per distinct URL, however many cells asked, through the workbook's fetch (which keeps
 * the answer); a call the sheet no longer wants aborts its request. The service's JSON is read by
 * `parse` into dated bars.
 */
function runHistory(
  calls: readonly IFormulaContext.DeferredCall<Scalar[][]>[],
  ctx: IFormulaContext.IDeferContext,
  parse: (json: any) => Map<string, Bar>
): void {
  const byUrl = new Map<string, IFormulaContext.DeferredCall<Scalar[][]>[]>();
  for (const call of calls) {
    const url = (call.payload as HistoryPayload).url;
    const group = byUrl.get(url);
    group ? group.push(call) : byUrl.set(url, [call]);
  }
  for (const [url, group] of byUrl) {
    const controller = new AbortController();
    let wanted = group.length;
    for (const call of group) {
      call.onCancel((): void => { if (--wanted === 0) controller.abort(); });
    }
    fetchJson(ctx, url, controller.signal).then(
      (json: unknown): void => {
        let bars: Map<string, Bar>;
        try {
          bars = parse(json);
        } catch (error) {
          for (const call of group) call.reject(error);
          return;
        }
        for (const call of group) {
          try {
            call.resolve(toRows(call.payload as HistoryPayload, bars));
          } catch (error) {
            call.reject(error);
          }
        }
      },
      (error: unknown): void => { for (const call of group) call.reject(error); }
    );
  }
}

async function fetchJson(ctx: IFormulaContext.IDeferContext, url: string, signal: AbortSignal): Promise<unknown> {
  const response = await ctx.fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (response.status === 404) throw FormulaError.BuiltIn.NA;
  if (!response.ok) throw new FormulaError.Value(`HTTP ${response.status}`);
  return response.json();
}

// ─── STOCKHISTORY — Alpha Vantage ────────────────────────────────────────────────────────────

const ALPHA_VANTAGE = 'https://www.alphavantage.co/query';

/** The series function and the key its JSON answers under, by interval (`0` daily, `1` weekly, `2` monthly). */
const SERIES = [
  { fn: 'TIME_SERIES_DAILY', key: 'Time Series (Daily)' },
  { fn: 'TIME_SERIES_WEEKLY', key: 'Weekly Time Series' },
  { fn: 'TIME_SERIES_MONTHLY', key: 'Monthly Time Series' }
] as const;

/** The service's field names, by property name. */
const ALPHA_FIELDS: Record<string, string> = {
  Open: '1. open', High: '2. high', Low: '3. low', Close: '4. close', Volume: '5. volume'
};

/**
 * The API key: `ALPHAVANTAGE_API_KEY` on the global object (a page) or in the environment (Node),
 * else the service's `demo` key, which answers for `IBM` only.
 */
function alphaKey(): string {
  const global = (globalThis as any).ALPHAVANTAGE_API_KEY;
  if (typeof global === 'string' && global) return global;
  const env = (globalThis as any).process?.env?.ALPHAVANTAGE_API_KEY;
  return typeof env === 'string' && env ? env : 'demo';
}

function runStockHistory(
  calls: readonly IFormulaContext.DeferredCall<Scalar[][]>[],
  ctx: IFormulaContext.IDeferContext
): void {
  runHistory(calls, ctx, (json: any): Map<string, Bar> => {
    if (!json || typeof json !== 'object') throw FormulaError.BuiltIn.Value;
    // An unknown symbol is an `Error Message`; a spent budget or the demo key is an `Information` or `Note`.
    if (json['Error Message']) throw FormulaError.BuiltIn.NA;
    const notice = json.Information ?? json.Note;
    if (notice) throw new FormulaError.Value(String(notice));
    const series = SERIES.map((s) => json[s.key]).find((s) => s && typeof s === 'object');
    if (!series) throw FormulaError.BuiltIn.NA;
    const bars = new Map<string, Bar>();
    for (const date of Object.keys(series)) {
      const raw = series[date];
      const bar: Bar = {};
      for (const name of Object.keys(ALPHA_FIELDS)) {
        const value = raw[ALPHA_FIELDS[name]];
        bar[name] = value === undefined ? null : Number(value);
      }
      bars.set(date, bar);
    }
    return bars;
  });
}

/**
 * Returns an array of historical quote data for a symbol and date range you specify.
 * @param stock the ticker symbol of the financial instrument (`"IBM"`).
 * @param startDate the first date to return data from.
 * @param endDate the last date to return data from. Default is the start date.
 * @param interval the granularity of the data: `0` daily, `1` weekly, `2` monthly. Default is `0`.
 * @param headers whether to add column headers: `0` none, `1` a header row, `2` the instrument identifier and a header row. Default is `1`.
 * @param properties the columns to return, each a number: `0` Date, `1` Close, `2` Open, `3` High, `4` Low, `5` Volume. Default is Date and Close.
 *
 * @remarks
 * * The cell shows `#BUSY!` until the quotes arrive, then spills one row per bar, ascending.
 * * Quotes come from [Alpha Vantage](https://www.alphavantage.co), which needs an API key:
 *   `ALPHAVANTAGE_API_KEY` on the global object or in the environment. Without one the service's
 *   `demo` key is used, which answers for `IBM` only. A free key allows 25 requests a day.
 * * An unknown symbol is `#N/A`. A spent request budget is `#VALUE!` carrying the service's notice.
 * * A recalculation does not ask again; the quotes are kept with the cell. Reopening the file does.
 * * Excel accepts a Stock data type for `stock`; here it is the ticker text.
 */
export function STOCKHISTORY(
  stock: string,
  startDate: number,
  endDate?: Omittable<number>,
  interval: Omittable<number> = 0,
  headers: Omittable<number> = 1,
  properties?: Flatten<Scalar>
): Scalar[][] {
  const { start, end } = readWindow(startDate, endDate);
  const ticker = stock.trim().toUpperCase();
  if (!ticker) throw FormulaError.BuiltIn.Value;
  const series = SERIES[Math.trunc(interval)];
  if (!series) throw FormulaError.BuiltIn.Value;
  const payload: HistoryPayload = {
    url: `${ALPHA_VANTAGE}?function=${series.fn}&symbol=${encodeURIComponent(ticker)}&outputsize=full&apikey=${encodeURIComponent(alphaKey())}`,
    headers: Math.trunc(headers),
    properties: readProperties(properties as readonly Scalar[] | undefined),
    start,
    end,
    instrument: ticker
  };
  FormulaContext.defer(runStockHistory, payload);
  return [[FormulaError.BuiltIn.Busy as unknown as Scalar]];
}

// ─── FXHISTORY — Frankfurter (ECB reference rates) ───────────────────────────────────────────

const FRANKFURTER = 'https://api.frankfurter.dev/v1';

function runFxHistory(
  calls: readonly IFormulaContext.DeferredCall<Scalar[][]>[],
  ctx: IFormulaContext.IDeferContext
): void {
  runHistory(calls, ctx, (json: any): Map<string, Bar> => {
    const rates = json?.rates;
    if (!rates || typeof rates !== 'object') throw FormulaError.BuiltIn.NA;
    const bars = new Map<string, Bar>();
    for (const date of Object.keys(rates)) {
      const quote = rates[date];
      const to = Object.keys(quote)[0];
      bars.set(date, { Close: quote[to] });
    }
    return bars;
  });
}

/**
 * Returns the daily exchange rate of one currency in another over a period, from the European
 * Central Bank's reference rates.
 * @param from the currency to convert from, as an ISO code (`"USD"`).
 * @param to the currency to convert to, as an ISO code (`"EUR"`).
 * @param startDate the first date of the period.
 * @param endDate the last date of the period. Default is the start date.
 * @param headers whether to add column headers: `0` none, `1` a header row, `2` the pair and a header row. Default is `1`.
 *
 * @remarks
 * * Spills one row per business day in the period, with the date and the rate. The cell shows
 *   `#BUSY!` until the rates arrive.
 * * Rates are the ECB's daily reference rates (about 16:00 CET), published on TARGET business
 *   days; weekends and holidays have no row.
 * * Both currencies must be among the roughly thirty the ECB publishes; another is `#N/A`.
 * * A recalculation does not ask again; the rates are kept with the cell. Reopening the file does.
 * * Data by [Frankfurter](https://frankfurter.dev), a free service with no key. Please do not abuse it.
 */
export function FXHISTORY(
  from: string,
  to: string,
  startDate: number,
  endDate?: Omittable<number>,
  headers: Omittable<number> = 1
): Scalar[][] {
  const { start, end } = readWindow(startDate, endDate);
  const base = from.trim().toUpperCase();
  const quote = to.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) throw FormulaError.BuiltIn.Value;
  const payload: HistoryPayload = {
    url: `${FRANKFURTER}/${toIso(start)}..${toIso(end)}?from=${base}&to=${quote}`,
    headers: Math.trunc(headers),
    properties: '0,1',
    start,
    end,
    instrument: `${base}/${quote}`
  };
  FormulaContext.defer(runFxHistory, payload);
  return [[FormulaError.BuiltIn.Busy as unknown as Scalar]];
}
