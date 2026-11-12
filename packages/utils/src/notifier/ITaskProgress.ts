/**
 * Interface for tracking long running tasks.
 */
export interface ITaskProgress<TStart = string, TWarning = any> {
  /**
   * Called once the task has actually begun — **after** any interactive source/destination
   * acquisition (open/save pickers, permission prompts, network handshakes) has resolved.
   *
   * @param details Details about the task (resolved format, name, size, …).
   * @param total If known, the total amount of work to be done, in the same units later reported
   *   to {@link onProgress} (for reads this is typically the source size in bytes). When provided,
   *   a consumer can render a determinate progress bar / percentage; when omitted it should fall
   *   back to an indeterminate (spinner) state.
   *
   * @returns If a promise is returned, it will be awaited before proceeding.
   *
   * @remarks
   * This is deliberately distinct from "the user requested the operation": a spinner started on
   * the request would sit on top of the picker/permission dialog and look hung. `onStart` is the
   * signal that real work is underway and determinate UI can be shown.
   */
  onStart?(details: TStart, total?: number): Promise<void> | void;
  /**
   * May be called periodically to update the progress.
   *
   * @param completed The cumulative amount of work done so far (monotonically increasing).
   * @param total If known, the total amount of work, in the same units as `completed`. Matches the
   *   `total` reported to {@link onStart} when one was provided; may be omitted when unknown.
   */
  onProgress?(completed: number, total?: number): void;
  /**
   * May be called if a warning has occurred.
   *
   * @param message The warning message.
   * @param details Optional details for the warning.
   */
  onWarning?(message?: string, details?: TWarning): void;
  /**
   * May be called if an error has occurred.
   *
   * @param error The error that occurred.
   */
  onError?(error: Error): Promise<void> | void;
  /**
   * Called when the task is complete.
   *
   * @remarks
   * This is called when the task is complete, regardless of whether it completed successfully or encountered an error.
   *
   * @param details The details of the task, or null if the task encountered an error.
   */
  onComplete?(details: TStart | null): Promise<void> | void;
}
