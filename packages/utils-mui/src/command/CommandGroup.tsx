import type React from 'react';
import { memo, forwardRef, useMemo, useCallback, cloneElement } from 'react';

import {
  CommandButtonType, useCommands, useCommandButtonRegistry,
  type ICommandButtonRegistry, type CommandButtonEntry, type CommandButtonProps
} from '@sheetxl/utils-react';

import { defaultRenderPopupPanel, type ExhibitPopupPanelProps } from '../float';
import { ExhibitDivider } from '../components';

import { CommandButton } from './CommandButton';
import { CommandPopupButton, type CommandPopupButtonProps } from './CommandPopupButton';

/**
 * Per-surface knobs for {@link renderMembers}. A surface (popup or toolbar) walks the same member
 * list; these decide the leaf `variant`, divider orientation, and which props reach leaf buttons
 * (`propsCommandButton`) vs nested groups (`propsCommandPopup`).
 */
export interface RenderMembersOptions {
  /** Button variant applied to leaf buttons and nested groups (e.g. `Menuitem` for popups). */
  variant?: CommandButtonType;
  /** Orientation for `'-'`/`null` divider members. @defaultValue `'vertical'` */
  dividerOrientation?: 'horizontal' | 'vertical';
  /** Resolution scope (the registered group key) for member label/icon getters + command scope. */
  groupKey?: string;
  /** Default command state for members that do not carry their own `state`. */
  commandState?: any;
  /** Props applied to leaf command buttons ({@link CommandButton}). */
  propsCommandButton?: Partial<CommandButtonProps> & React.Attributes;
  /** Props applied to nested groups ({@link CommandGroup}). */
  propsCommandPopup?: Partial<CommandButtonProps> & React.Attributes;
  /**
   * Registry used to resolve **bare-string** members registry-first (a registered item vs a plain
   * command). Omit and bare strings are always treated as commands.
   */
  registry?: ICommandButtonRegistry;
}

/**
 * Walks a member list ({@link CommandButtonEntry.members}) into React nodes - the shared surface
 * primitive. Both the popup surface ({@link CommandGroup}) and the toolbar surface (`CommandToolbar`)
 * render through this; they differ only in {@link RenderMembersOptions}.
 *
 * @remarks
 * Each member is a **key** (resolved registry-first - a registered entry, else a plain command), a
 * **divider** (`'-'` / `null`, leading / trailing / adjacent ones collapse), or an **inline entry**.
 * An entry with its own `render` drives the control; else `members` ⇒ a nested `CommandGroup`, otherwise
 * a `CommandButton`.
 */
export function renderMembers(
  members: (string | '-' | null | CommandButtonEntry)[] | null | undefined,
  opts: RenderMembersOptions = {}
): React.ReactNode[] {
  const {
    variant,
    dividerOrientation = 'vertical',
    groupKey,
    commandState,
    propsCommandButton,
    propsCommandPopup,
    registry
  } = opts;

  const leafShared: Partial<CommandButtonProps> = { ...propsCommandButton };
  if (variant !== undefined) leafShared.variant = variant;
  const groupShared: Partial<CommandButtonProps> = { ...propsCommandPopup };
  if (variant !== undefined) groupShared.variant = variant;

  // Build each member's element (no react key yet); dividers are deferred so we can trim edges / runs.
  // A leaf command button. `overrides` (a member's own presentation / decorating leaf `render`).
  const renderLeaf = (commandKey: string, state?: any, overrides?: CommandButtonEntry): React.ReactElement | null => {
    const childProps: CommandButtonProps & React.Attributes = {
      ...leafShared,
      groupKey,
      commandKey,
      commandState: state !== undefined ? state : commandState,
      label: overrides?.getLabel?.(groupKey) as React.ReactNode,
      icon: overrides?.getIcon?.(groupKey) as React.ReactNode,
      showLabel: overrides?.showLabel
    };
    return (overrides?.render ? overrides.render(childProps, groupKey) : <CommandButton {...childProps}/>) ?? null;
  };

  // Render a *registered* entry resolved from a member key. `key` is its own registration key (a panel
  // resolves its members by it); `overrides` are the referencing member's presentation, if any.
  const renderEntry = (entry: CommandButtonEntry, key: string, overrides?: CommandButtonEntry): React.ReactElement | null => {
    if (Array.isArray(entry.members)) {
      // A panel. A custom head (escape hatch, e.g. a toggle group) fully drives it; else the generic
      // CommandGroup by key. Contents render lazily (on popup open), so self / cyclic refs are fine.
      if (entry.render) return entry.render({ ...groupShared } as CommandButtonProps, key) ?? null;
      return (
        <CommandGroup {...groupShared}
          groupKey={key}
          icon={overrides?.getIcon?.(key) as React.ReactNode}
          label={(overrides?.getLabel?.(key) ?? (groupKey ? entry.getLabel?.(groupKey) : undefined)) as React.ReactNode}
          showLabel={overrides?.showLabel}
        />
      );
    }
    // A registered custom control (e.g. a task-pane button): popup props, parent scope.
    if (entry.render) return entry.render({ ...groupShared } as CommandButtonProps, groupKey) ?? null;
    // A registered leaf that runs a command (rare): render as a leaf. The referencing member's inline
    // overrides win over the entry's own presentation (so `{ key, showLabel }` etc. take effect).
    const merged = overrides ? { ...entry, ...overrides } : entry;
    return renderLeaf(entry.defaultKey ?? key, merged.state, merged);
  };

  // A *keyless* inline entry - a nested panel over inline `members`, or a custom control.
  const renderInline = (entry: CommandButtonEntry): React.ReactElement | null => {
    if (Array.isArray(entry.members)) {
      if (entry.render) return entry.render({ ...groupShared } as CommandButtonProps, undefined) ?? null;
      return (
        <CommandGroup {...groupShared}
          members={entry.members}
          icon={entry.getIcon?.() as React.ReactNode}
          label={entry.getLabel?.() as React.ReactNode}
          tooltip={entry.getDescription?.()}
        />
      );
    }
    return (entry.render ? entry.render({ ...groupShared } as CommandButtonProps, groupKey) : null) ?? null;
  };

  const renderMember = (m: string | CommandButtonEntry): React.ReactElement | null => {
    // One reference: a `key` (bare string, or an object's `key`), resolved registry-first; a keyless
    // object is an inline definition.
    const refKey = typeof m === 'string' ? m : m.key;
    const overrides = typeof m === 'string' ? undefined : m;
    if (!refKey) return renderInline(m as CommandButtonEntry);
    const entry = registry?.get(refKey) ?? null;
    return entry ? renderEntry(entry, refKey, overrides) : renderLeaf(refKey, overrides?.state, overrides);
  };

  const children: React.ReactNode[] = [];
  let keySeq = 0;
  let pendingDivider = false;  // a divider seen but not yet emitted (drops if nothing real follows)
  let emittedReal = false;
  const list = members ?? [];
  for (let i=0; i<list.length; i++) {
    const m = list[i];
    if (!m || m === '-') {
      if (emittedReal) pendingDivider = true; // ignore leading dividers
      continue;
    }
    const el = renderMember(m);
    if (!el) continue; // self-hidden (button/member render returned null) - keep any pending divider
    if (pendingDivider) {
      children.push(<ExhibitDivider key={`member-${keySeq++}`} orientation={dividerOrientation}/>);
      pendingDivider = false;
    }
    children.push(cloneElement(el, { key: `member-${keySeq++}` }));
    emittedReal = true;
  }
  return children;
}

export interface CommandGroupProps extends Omit<CommandPopupButtonProps, 'renderPopupPanel'> {
  /**
   * Key of a {@link CommandButtonEntry} registered in the {@link ICommandButtonRegistry}. Also
   * the resolution scope for the panel's members (`command.getLabel(groupKey)`).
   *
   * @remarks Provide either `groupKey` (registered) or `members` (inline), not both.
   */
  groupKey?: string;

  /**
   * An inline, anonymous member list - the un-registered alternative to `groupKey` (replaces
   * `SimpleCommandPopupButton`'s `popupCommandKeys`).
   */
  members?: (string | '-' | null | CommandButtonEntry)[];

  /**
   * Registry to resolve the group / renderers from.
   *
   * @defaultValue the registry from {@link useCommandButtonRegistry} (context or shared singleton).
   */
  registry?: ICommandButtonRegistry;
}

/**
 * Renders a command group - a list of members (commands, dividers, nested groups) - as a popup /
 * split button / menu. Members come from a registered group (`groupKey`) or inline (`members`).
 *
 * @remarks
 * The popup panel is built by recursion: a nested member (`{ group }` or an inline `{ members }`)
 * renders through `CommandGroup` again. Menu-item labels/state resolve against the group key. The
 * quick button is disabled when every member is disabled. On execute the panel closes its own float
 * automatically (via `useCommands`/`useFloat`) — no per-button wiring.
 */
export const CommandGroup = memo(
  forwardRef<HTMLElement, CommandGroupProps>((props, refForwarded) => {
  const {
    groupKey,
    members: propMembers,
    registry: propRegistry,
    quickCommand: propQuickCommand,
    icon: propIcon,
    label: propLabel,
    showLabel: propShowLabel,
    tooltip: propTooltip,
    commandState: propCommandState,
    disabled: propDisabled,
    ...rest
  } = props;

  const contextRegistry = useCommandButtonRegistry();
  const registry = propRegistry ?? contextRegistry;

  // Resolve member list + presentation from the inline prop or the registered group.
  const item = (!propMembers && groupKey) ? registry.get(groupKey) : null;
  const group = !!item && Array.isArray(item.members) ? item : null;
  // Members = inline prop, else the group resolved (explicit members woven with injected items).
  const members = useMemo(
    () => propMembers ?? (groupKey ? registry.resolveMembers(groupKey) : null) ?? null,
    [propMembers, groupKey, registry]
  );

  const resolutionKey = groupKey; // registered group key doubles as the member resolution scope
  const quickCommand = propQuickCommand ?? group?.defaultKey;
  const icon = (propIcon ?? group?.getIcon?.(resolutionKey)) as React.ReactNode;
  const label = (propLabel ?? group?.getLabel?.(resolutionKey)) as React.ReactNode;
  const showLabel = propShowLabel ?? group?.showLabel;
  const tooltip = propTooltip ?? group?.getDescription?.(resolutionKey);

  // The command keys under this group, for gating the quick button: a nested group counts by what it
  // holds, so a group of only submenus is not disabled. `seen` because refs may be cyclic.
  const memberCommandKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    const walk = (list: (string | '-' | null | CommandButtonEntry)[]): void => {
      for (let i=0; i<list.length; i++) {
        const m = list[i];
        if (!m || m === '-') continue;
        const key = typeof m === 'string' ? m : m.key;
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        const nested = Array.isArray(registry.get(key)?.members) ? registry.resolveMembers(key) : null;
        if (nested) walk(nested);
        else keys.push(key);
      }
    };
    walk(members ?? []);
    return keys;
  }, [members, registry]);

  const resolved = useCommands(quickCommand ? [quickCommand, ...memberCommandKeys] : memberCommandKeys);
  const allDisabled = useMemo(() => {
    for (let i=0; i<resolved.length; i++) {
      const command = resolved[i];
      if (command && !command.disabled()) return false;
    }
    return true;
  }, [resolved]);

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    // Close-on-execute is no longer wired here: members render inside this popup's float (provided via
    // context), and `useCommands` closes the enclosing float on execute automatically (`useFloat`).
    // The popup surface shares the same member-walk as the toolbar surface; it differs only in the
    // per-surface options below (Menuitem variant, horizontal dividers).
    const shared: Partial<CommandButtonProps> = {};
    if (propDisabled !== undefined) shared.disabled = propDisabled;

    const children = renderMembers(members, {
      variant: CommandButtonType.Menuitem,
      dividerOrientation: 'horizontal',
      groupKey: resolutionKey,
      commandState: propCommandState,
      propsCommandButton: shared,
      propsCommandPopup: shared,
      registry
    });
    return defaultRenderPopupPanel({ ...panelProps, children });
  }, [members, registry, resolutionKey, propCommandState, propDisabled]);

  if (!members) {
    if (__DEV__ && groupKey) {
      console.warn(`Command group '${groupKey}' is not registered.`);
    }
    return null;
  }

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={quickCommand}
      icon={icon}
      label={label}
      showLabel={showLabel}
      tooltip={tooltip}
      commandState={propCommandState}
      disabled={propDisabled ?? allDisabled}
      renderPopupPanel={renderPopupPanel}
      {...rest}
    />
  );
}));

CommandGroup.displayName = "CommandGroup";
