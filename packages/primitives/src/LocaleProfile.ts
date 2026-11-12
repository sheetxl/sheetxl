/** 0=Sun..6=Sat */
export type DayOfWeek = 0|1|2|3|4|5|6;
export type CurrencyDisplay = "symbol" | "code" | "name";
export type CurrencyPosition = "before" | "after";
export type CurrencySpacing = "tight" | "space";

/**
 * Everything regional behavior depends on, resolved for a single locale.
 *
 * @remarks
 * This is the one source of truth for separators, date patterns, currency, and
 * collation. It is derived data -- the identity is the BCP 47 tag, which is what
 * a workbook persists.
 */
export interface LocaleProfile {
  /** The BCP 47 tag this profile was resolved from, e.g. `de-DE`. */
  tag: string;
  numberingSystem: string;

  // Numbers
  decimal: string;
  group: string;
  /** e.g. `[3]`, or `[3,2]` for hi-IN. */
  grouping: number[];
  minusSign: string;
  percentSign: string;
  /** usually `‰` */
  permilleSign: string;

  /** ISO 4217 code for the region, e.g. `EUR`. */
  currencyCode: string;
  /** The rendered symbol for {@link LocaleProfile.currencyCode}, e.g. `€`. */
  currencySymbol: string;
  currencyDisplay: CurrencyDisplay;
  currencyPosition: CurrencyPosition;
  currencySpacing: CurrencySpacing;

  // Dates/times
  date: {
    /** e.g. `gregory` */
    calendar: string;
    /** e.g. `M/d/yy` */
    short: string;
    /** e.g. `MMM d, y` */
    medium: string;
    /** e.g. `MMMM d, y` */
    long: string;
    /** e.g. `h:mm a` or `HH:mm` */
    timeShort: string;
    /** e.g. `h:mm:ss a z` -- note: `z` is a hint only */
    timeLong: string;
    am?: string;
    pm?: string;
    firstDay: DayOfWeek;
    weekend: [DayOfWeek, DayOfWeek];
    monthsWide: string[];
    monthsAbbr: string[];
    weekdaysWide: string[];
    weekdaysAbbr: string[];
    hour12: boolean;
  };

  // UI / CSV-ish
  /** Function/list argument separator, like Excel (`,` or `;`). */
  listSeparator: string;
  csvDelimiter: string;
  rtl: boolean;

  /** Collation defaults for sorting. */
  collator: Intl.CollatorOptions;
}

/**
 * A patch over an `Intl`-derived {@link LocaleProfile} — the regional-override escape
 * hatch. Excel/Windows honor OS regional *customizations* (a custom decimal symbol,
 * a different currency) that browser `Intl` cannot see; a workbook may persist
 * `{ tag, overrides? }` to reproduce them.
 *
 * @remarks
 * Overrides are applied **literally** on top of the derived profile — nothing is
 * re-derived. In particular {@link LocaleProfile.listSeparator} /
 * {@link LocaleProfile.csvDelimiter} are normally derived from `decimal`, so patch
 * them too if you patch `decimal`. The `date` sub-object merges one level deep; the
 * `tag` is the identity and cannot be overridden.
 */
export type LocaleProfileOverrides =
  Partial<Omit<LocaleProfile, 'tag' | 'date'>> & {
    date?: Partial<LocaleProfile['date']>;
  };