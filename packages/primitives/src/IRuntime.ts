import { type LocaleProfile } from './LocaleProfile';

/**
 * Describes the host environment the calculation engine is running in.
 *
 * Accessible via `FormulaContext.getRuntime()`, this is primarily used by
 * built-in functions that need to adapt to locale, date system, or platform
 * (e.g. `INFO`, `TEXT`, date parsing). Most formula authors will not need it
 * directly.
 */
export interface IRuntime {
  /**
   * Returns a description of the runtime environment.
   */
  getDescription(): string;

  /**
   * The version of the runtime, e.g. "1.0.0".
   */
  getVersion(): string;

  /**
   * Returns the locale of the runtime, e.g. "en-US".
   *
   * @remarks
   * This is the single authority for regional behavior (number/date formatting
   * and parsing, separators, collation). For a workbook-owned runtime this
   * resolves to the workbook's persisted locale.
   */
  getLocale(): string;

  /**
   * Returns true if the date calculation is using the 1904 date system.
   */
  isDate1904(): boolean;

  /**
   * If the primary address scheme is R1C1, returns true. Otherwise, returns false.
   */
  isR1C1(): boolean;

  /**
   * Returns the compatibility version formulas are calculated under: `1` or `2`.
   *
   * @remarks
   * Version 2 counts a character outside the Basic Multilingual Plane (an emoji, a CJK Extension
   * B ideograph) as one character, so `LEN(UNICHAR(128514))` is 1. Version 1 counts its two UTF-16
   * units, so the same `LEN` is 2 and `MID` can cut the character in half. `LEN`, `MID`, `FIND`,
   * `SEARCH` and `REPLACE` follow it; `LEFT` and `RIGHT` count characters under both.
   *
   * A new workbook is version 2. A workbook read from a file is whatever the file says.
   */
  getCompatibilityVersion(): number;

  /**
   * Returns the resolved regional behavior for {@link IRuntime.getLocale}.
   *
   * @remarks
   * Separators, currency, date patterns, and collation all come from here --
   * this is the single source of truth, so never derive them independently.
   *
   * Takes no argument by design: it answers "what is *this* runtime's locale".
   * To build a profile for some other tag, use `getLocaleProfile(tag)` from
   * `@sheetxl/sdk`.
   */
  getLocaleProfile(): LocaleProfile;

  /**
   * The location of the runtime, e.g. "browser", "node", etc.
   */
  getLocation(): string;

  /**
   * Returns the OS string of the runtime.
   */
  getOS(): string;

  /**
   * Returns the clock this runtime reads, as epoch milliseconds.
   *
   * @remarks
   * A workbook's own runtime answers the current commit's timestamp, so every cell of a
   * calculation pass agrees and collaborators on that commit agree with each other. A runtime
   * built by a host answers whatever that host supplied — a pinned clock makes `NOW` and `TODAY`
   * reproducible, and an unpinned one is the wall clock, which advances between reads.
   */
  getNow: () => number;

  /**
   * Returns a random number in `[0, 1)` — one per calculation pass, as {@link getNow} is one
   * clock reading per pass.
   *
   * @remarks
   * This is not a cell's value. Each cell's draw is derived from this one, its position and which
   * draw it is within that cell, so cells that do not depend on each other — which the engine is
   * free to evaluate in any order — get the values their positions earn rather than the values
   * their turn earned.
   *
   * Pinning it therefore pins `RAND`, `RANDBETWEEN` and `RANDARRAY`, exactly as pinning
   * {@link getNow} pins `NOW` and `TODAY`. Left alone it is `Math.random`, drawn afresh each pass,
   * so volatiles move on every recalculation.
   *
   * Values reproduce within one release, not across releases.
   */
  getRandom: () => number;

  /**
   * Returns the current user or `null` if no user information is provided.
   */
  getUser(): string | null;
}
