import { type IKeyStroke } from '../types';

import { type ICommand } from './ICommand';

import { type CommandCallback } from './createResolvedCommand';

/**
 * A **contributed, partial** command definition — the *authoring* side of the command
 * system. Scopes/providers contribute these; the registry **reduces** all contributions
 * for a given `key` (along the active scope chain) per-property into a derived, read-only
 * {@link ResolvedCommand}. Authors never build or mutate a resolved instance directly
 * (no more `instance.updateCallback(...)`); they contribute/merge definitions via the
 * provider.
 *
 * Every field except `key` is optional and merged **per-property** (see
 * {@link MERGE_STRATEGY}). Canonical example — `copy`:
 * - a root scope contributes `{ key, icon, label }` (stable chrome),
 * - the focused component contributes `{ callback }` (what's actually copied),
 * - an intermediate scope contributes `{ disabledReason: 'Sheet is protected' }`.
 *
 * Reuses the shared sub-types from {@link ICommand} (`DynamicValue`, `Callback`,
 * `DynamicContext`, `ITarget`) so the resolved read surface stays byte-compatible with the
 * existing `command/` package during the port. See `design/COMMAND-DESIGN.md`.
 */
export interface ICommandDefinition<STATE = any, CONTEXT = any, ARGS = void> {
  /** Immutable identity. Every contribution for the same command shares this key. */
  key: string;

  /**
   * The action (delegates to the SDK / an ephemeral UI store). Strategy: `override`.
   * Takes the per-invocation input `ARGS` — **distinct from `state`** (the value the command
   * reflects). See {@link CommandCallback} and design/COMMAND-DESIGN.md "arg vs state".
   */
  callback?: CommandCallback<STATE, CONTEXT, ARGS>;

  /**
   * Reasons the command is unavailable. **Array-valued ⇒ accumulates** (concat,
   * most-specific first): every contributing scope may add reasons, and the command is
   * disabled if ANY reason is present (resolved `disabled()` derives from this for
   * read-compat). Dynamic reasons are expressed by **re-contributing** (the contributor
   * re-runs when its inputs change) rather than storing a function — that's the definitions
   * model. Note: a child scope cannot yet *clear* a parent's reason (a "fancier type"
   * later — see design/COMMAND-DESIGN.md).
   */
  disabledReasons?: string[];

  /** Hidden from surfaces entirely (e.g. macro recording). Scalar ⇒ overrides. */
  hidden?: ICommand.DynamicValue<boolean, CONTEXT>;

  label?: ICommand.DynamicValue<string, CONTEXT>;
  /** Per-surface label overrides (e.g. "Rename Sheet" → "Rename" in a context menu). */
  groupLabels?: Record<string, ICommand.DynamicValue<string, CONTEXT>>;
  /**
   * **Message parameters** for ICU-subset `label`/`groupLabels`/`description` messages
   * (`formatMessage` — `{count, plural, …}` / `{mode, select, …}`). The catalog authors the
   * localized MESSAGE (with the parameter *defaults* — `ChromeRecord.params`); a dynamic
   * contributor keeps the live values current (e.g. the sheet's selection reducer contributes
   * `{ count, mode }` for the insert/delete/hide labels). Strategy: `override` — contribute the
   * COMPLETE parameter set for the command's messages, not a delta.
   */
  params?: Record<string, unknown>;
  description?: ICommand.DynamicValue<string, CONTEXT>;
  /**
   * Per-surface description overrides keyed by groupKey — the `description` twin of
   * {@link groupLabels} (a compact tooltip in a dense menu vs. the full ribbon text). Falls back to
   * {@link description} when the surface has no entry.
   */
  groupDescriptions?: Record<string, ICommand.DynamicValue<string, CONTEXT>>;
  icon?: ICommand.DynamicValue<React.ReactElement | string, CONTEXT>;
  /**
   * Per-surface icon overrides keyed by groupKey — the `icon` twin of {@link groupLabels} (e.g. a
   * glyph in a toolbar, a check mark in a menu). Falls back to {@link icon}.
   */
  groupIcons?: Record<string, ICommand.DynamicValue<React.ReactElement | string, CONTEXT>>;
  /**
   * Accumulated metadata (like `disabledReasons`): scopes' tags concatenate. Cross-cutting
   * rules keyed on a tag (e.g. "`mutator` commands disable when the sheet is protected") are
   * **contributor** logic, not a registry feature — see design/COMMAND-DESIGN.md.
   */
  tags?: string[];
  shortcut?: ICommand.DynamicValue<IKeyStroke | IKeyStroke[] | null, CONTEXT>;

  /** Model state. Strategy: `override`. */
  state?: STATE;
  /** View-specific context. Strategy: `override`. */
  context?: ICommand.DynamicContext<CONTEXT>;
  /** Focus/contains target (commands refocus this after execute). Strategy: `override`. */
  target?: ICommand.ITarget | (() => ICommand.ITarget);
}
