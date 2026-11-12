/**
 * Well-known command tag hints honored by the command surfaces.
 *
 * Tags are free-form strings on a command definition (e.g. `'mutator'` drives format-protection
 * disabling). These constants name the ones the shared UI layer reacts to, so definitions and the
 * consumers that read them agree without stringly-typed drift.
 */

/**
 * A command that applies **in place** and must NOT dismiss its enclosing popup on execute — font-size
 * increase/decrease, indent increase/decrease, decimal places, the number-format quick styles. These
 * are the "quick button" rows a popup leads with, and they exist to be pressed repeatedly.
 *
 * The auto-dismiss observer in `useCommands` reads this off the RESOLVED command, so it holds for
 * **every** observer of the key. A per-surface opt-out cannot: an execute notifies every mounted
 * observer of that key, so a co-observer with no hook (the same command on the toolbar, whose
 * enclosing float is the popup's ancestor) would still close the popup out from under the quick button.
 */
export const QUICK_ACTION_TAG = 'quickAction';
