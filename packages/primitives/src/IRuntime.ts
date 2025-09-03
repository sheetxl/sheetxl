/**
 * Provides details about the system level runtime environment.
 */
export interface IRuntime {
  /**
   * Returns true if the date calculation is using the 1904 date system.
   */
  isDate1904(): boolean;

  /**
   * Returns the currency symbol for currency values.
   */
  getCurrencySymbol(): string;

  /**
   * Returns the decimal separator for number values.
   */
  getNumberDecimalSeparator(): string;

  /**
   * Returns the group separator for number values.
   */
  getNumberGroupSeparator(): string;

  /**
   * The location of the runtime, e.g. "browser", "node", etc.
   */
  getLocation(): string;

  /**
   * Returns a description of the runtime environment.
   */
  getDescription(): string;

  /**
   * The version of the runtime, e.g. "1.0.0".
   */
  getVersion(): string;

  /**
   * Returns the OS string of the runtime.
   */
  getOS(): string;

  // /**
  //  * The name of the runtime, e.g. "Excel Formula Engine", "Calc Engine", etc.
  //  */
  // hostType: string;

  /**
   * Returns the current user or `null` if no user information is provided.
   */
  getUser(): string | null;
}
