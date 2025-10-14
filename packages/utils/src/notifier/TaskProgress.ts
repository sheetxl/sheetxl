/**
 * Interface for tracking long running tasks.
 */
export interface TaskProgress<TStart = string, TWarning = any> {
  /**
   * When a import is started this will be called.
   *
   * @param details Optional details about the task.
   * @param total If total is provided this is the total amount of work to be done.
   *
   * @returns If a promise is returned, it will be awaited before proceeding.
   */
  onStart?(details: TStart, total?: number): Promise<void> | void;
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
   * @param details Optional details for the warning.
   */
  onWarning?(message?: string, details?: TWarning): void;
  /**
   * Called when the task is complete.
   */
  onComplete?(): void;
}
