import { formatMessage, DefaultLanguagePackService } from '@sheetxl/utils';

import { type IKeyStroke } from '../types';

import { type ICommand } from './ICommand';

import { type ReducedDefinition } from './reduceDefinitions';

/**
 * The action a command runs. **`ARGS` is the per-invocation input** (`execute(args)`) —
 * deliberately a *separate* type from `STATE` (the current model value the command
 * *reflects*, read via `getState()`). They flow in opposite directions — `STATE` is output
 * (command → UI, for display/enablement), `args` is input (UI → command) — and only
 * coincidentally share a type (a font picker is `STATE = string` *and* `ARGS = string`). A
 * toggle is `STATE = boolean, ARGS = void` (it just toggles). See design/COMMAND-DESIGN.md
 * "arg vs state".
 */
export interface CommandCallback<STATE = any, CONTEXT = any, ARGS = void> {
  // `Promise<void | boolean>` (one Promise of the union), NOT `Promise<void> | Promise<boolean>`
  // — so an `async` middleware that does `return next(args, command)` type-checks; the split
  // union can't be satisfied by an `async` function.
  (args?: ARGS, command?: ResolvedCommand<STATE, CONTEXT, ARGS>): void | boolean | Promise<void | boolean>;
}

/**
 * Dispatch **middleware** registered on a scope via `CommandScope.use`. Onion-style: it
 * receives the `next` callback and returns a wrapping callback, so the contributor's inner
 * callback stays *pure* while cross-cutting infra (transaction batching / busy / edit-mode)
 * lives in the wrapper. **Bound to the scope that authors the
 * callback — not inherited** down the tree (see design/COMMAND-DESIGN.md "Dispatch middleware").
 * First-registered is outermost. `next` (and `command`) carry through so a layer can read
 * `command.getLabel()` etc.
 */
export type CommandMiddleware<STATE = any, CONTEXT = any, ARGS = void> =
  (next: CommandCallback<STATE, CONTEXT, ARGS>) => CommandCallback<STATE, CONTEXT, ARGS>;

/**
 * The **read** surface of a resolved command — the *derived*, immutable view that
 * `CommandButton`/toolbars/menus consume. Deliberately the read subset of the retired
 * mutable `ICommand` interface (same `getLabel`/`getIcon`/`getShortcut`/`disabled`/`execute`
 * signatures) so consumers didn't change during the port — the **one-sided-change**
 * invariant (see design/COMMAND-DESIGN.md). The *authoring* side (mutation, listeners) is
 * gone: you contribute {@link ICommandDefinition}s and re-derive, you don't mutate.
 *
 * Adds `disabledReasons()`; `disabled()` is derived from it (+ "no callback") for compat.
 * Carries `contributedBy` for cascade introspection. `ARGS` (the `execute` payload) is split
 * from `STATE` (the value the command reflects) — see {@link CommandCallback}.
 */
export interface ResolvedCommand<STATE = any, CONTEXT = any, ARGS = void> {
  getKey(): string;
  /**
   * @param groupKey Where the command is being rendered (the parent panel/group key, e.g.
   * `'contextMenu'`, `'cellStyle'`) — selects the matching `groupLabels` variant. Omit for
   * the full label. This is the ONLY per-call flavor: dynamic (function) values evaluate
   * against the definition's own `context` (where the model data lives), never a caller's.
   */
  getLabel(groupKey?: string): string;
  /** `groupKey` selects a pack's `desc@<groupKey>` variant, if any (no inline scoped field yet). */
  getDescription(groupKey?: string): string;
  getTags(): string[];
  /** `groupKey` is accepted for signature symmetry — reserved for scoped icons. */
  getIcon(groupKey?: string): React.ReactElement | string;
  getShortcut(): IKeyStroke | readonly IKeyStroke[] | null;
  /** The current model value the command reflects (output, for display/enablement). */
  getState(): STATE;
  getContext(): CONTEXT;
  getTarget(): ICommand.ITarget;
  /** Reasons the command is unavailable (empty when available). */
  disabledReasons(): string[];
  /** Derived: disabled if any reason is present OR there is no callback. */
  disabled(): boolean;
  /**
   * **Dispatch** the command: fire the per-key {@link ExecuteHook}s (the registry injects a
   * live accessor at creation) then run the callback. disabled / no-callback /
   * `beforeExecute`-returns-false ⇒ `false`. This is what buttons and keystrokes call
   * directly — it's the ripple/close path, no separate registry call needed. `args` is the
   * per-invocation input (`ARGS`), distinct from `getState()`.
   */
  execute(args?: ARGS): Promise<boolean>;
  /** Cascade introspection: property name → contribution index that supplied it. */
  readonly contributedBy: Readonly<Record<string, number>>;
}

/**
 * Observe/intercept command execution. Registered on the registry **per command key** —
 * because resolved commands are re-derived, the stable anchor is the registry, not the
 * instance. Executions route through the registry, so this fires for keystrokes, clicks,
 * and programmatic calls alike (the ripple/close + middleware path). `beforeExecute`
 * returning `false` cancels. `args` is the invocation input (`ARGS`).
 */
export interface ExecuteHook<STATE = any, CONTEXT = any, ARGS = void> {
  beforeExecute?(command: ResolvedCommand<STATE, CONTEXT, ARGS>, args?: ARGS): boolean | void | Promise<boolean | void>;
  onExecute?(command: ResolvedCommand<STATE, CONTEXT, ARGS>, args?: ARGS): void;
  onError?(command: ResolvedCommand<STATE, CONTEXT, ARGS>, error: unknown, args?: ARGS): void;
}

function resolveDynamic<T, CONTEXT>(
  value: ICommand.DynamicValue<T, CONTEXT> | undefined,
  context: ICommand.DynamicContext<CONTEXT> | undefined
): T | undefined {
  if (typeof value === 'function') {
    const ctx = (typeof context === 'function') ? (context as () => CONTEXT)() : context;
    return (value as (c?: CONTEXT) => T)(ctx);
  }
  return value as T | undefined;
}

/**
 * Build the read-only {@link ResolvedCommand} from a {@link ReducedDefinition}. Pure: the
 * same reduction always yields the same command. Re-derivation (not mutation) is how the
 * command "changes" — the registry re-reduces and re-creates when contributions or the
 * active scope change.
 */
export function createResolvedCommand<STATE = any, CONTEXT = any, ARGS = void>(
  reduced: ReducedDefinition<STATE, CONTEXT, ARGS>,
  // Loosely typed: one registry map holds observers for differently-parameterized commands.
  getExecuteHooks?: () => Iterable<ExecuteHook<any, any, any>> | undefined
): ResolvedCommand<STATE, CONTEXT, ARGS> {
  const { key, props, contributedBy } = reduced;
  const callback = props.callback;

  const getContext = (): CONTEXT =>
    (typeof props.context === 'function' ? (props.context as () => CONTEXT)() : props.context) as CONTEXT;
  const getTarget = (): ICommand.ITarget =>
    (typeof props.target === 'function' ? (props.target as () => ICommand.ITarget)() : props.target) as ICommand.ITarget;

  const disabledReasons = (): string[] => props.disabledReasons ?? [];
  const disabled = (): boolean => disabledReasons().length > 0 || !callback;

  const resolved: ResolvedCommand<STATE, CONTEXT, ARGS> = {
    contributedBy,
    getKey: () => key,
    getContext,
    getTarget,
    getState: () => props.state as STATE,
    getLabel: (groupKey?) => {
      // Command chrome is localized upstream: the CommandCatalogService seeds the ACTIVE locale's pack
      // into the registry (re-seeding on language change), so `props.label`/`props.groupLabels` are
      // already the localized values — no translator overlay here. The scoped (per-surface) label wins
      // over the plain label; a dynamic (function) value embeds live model data (`getName()`).
      const scoped = groupKey !== undefined ? props.groupLabels?.[groupKey] : undefined;
      const raw = resolveDynamic(scoped ?? props.label, props.context) as string;
      // Parameterized (ICU-subset) messages: when the definition carries `params` the catalog label
      // is a message ({count, plural, …}); plural rules follow the active language (the registry
      // invalidates on language change, so a resolve is never carried across a switch).
      return props.params && raw !== undefined
        ? formatMessage(raw, props.params, DefaultLanguagePackService.getActive()) : raw;
    },
    getDescription: (groupKey?) => {
      // Same cascade as getLabel: the per-surface variant wins, else the plain description.
      const scoped = groupKey !== undefined ? props.groupDescriptions?.[groupKey] : undefined;
      const raw = resolveDynamic(scoped ?? props.description, props.context) as string;
      return props.params && raw !== undefined
        ? formatMessage(raw, props.params, DefaultLanguagePackService.getActive()) : raw;
    },
    getTags: () => resolveDynamic(props.tags, props.context) as string[],
    getIcon: (groupKey?) => {
      const scoped = groupKey !== undefined ? props.groupIcons?.[groupKey] : undefined;
      return resolveDynamic(scoped ?? props.icon, props.context) as React.ReactElement | string;
    },
    getShortcut: () => resolveDynamic(props.shortcut, props.context) as IKeyStroke | readonly IKeyStroke[] | null,
    disabledReasons,
    disabled,
    execute: async (args?: ARGS) => {
      // Dispatch: fire per-key hooks (live accessor from the registry) around the callback.
      const hooks = getExecuteHooks?.();
      if (hooks) {
        for (const hook of hooks) {
          const proceed = await hook.beforeExecute?.(resolved, args);
          if (proceed === false) return false;
        }
      }
      if (disabled() || !callback) return false;
      try {
        const result = await Promise.resolve(callback(args, resolved));
        const ok = result !== false;
        if (ok && hooks) {
          for (const hook of hooks) hook.onExecute?.(resolved, args);
        }
        return ok;
      } catch (error) {
        if (hooks) {
          for (const hook of hooks) hook.onError?.(resolved, error, args);
        }
        throw error;
      }
    }
  };
  return resolved;
}
