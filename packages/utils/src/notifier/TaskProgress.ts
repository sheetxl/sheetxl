/**
 * Interface for tracking long running tasks.
 */
export interface TaskProgress {
  /**
   * When a import is started this will be called.
   *
   * @param name Optional name of the task.
   * @param total If total is provided this is the total amount of work to be done.
   *
   * @returns If a promise is returned, it will be awaited before proceeding.
   */
  onStart?(name: string, total?: number): Promise<void> | void;
  /**
   * May be called periodically to update the progress.
   *
   * @param amount The amount of progress made.
   */
  onProgress?(amount: number): void;
  /**
   * May be called if a warning has occurred.
   *
   * @param message The warning message.
   * @param context Optional context for the warning.
   */
  onWarning?(message?: string, context?: string): void;
  /**
   * Called when the task is complete.
   *
   * @param total The total amount of progress made. If not provided, it will be assumed to be the same as the last amount.
   */
  onComplete?(total?: number): void;
}
