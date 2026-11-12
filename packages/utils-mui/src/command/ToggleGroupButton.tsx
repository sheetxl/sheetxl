import type React from 'react';
import { memo, forwardRef, useMemo } from 'react';

import {
  useCommands, useCommandButtonRegistry,
  type CommandButtonEntry
} from '@sheetxl/utils-react';

import { CommandGroup, type CommandGroupProps } from './CommandGroup';

/**
 * How the currently-active toggle is projected onto a {@link ToggleGroupButton}'s head.
 * - `'quick'` - the active toggle becomes the split button's quick command (click re-applies it).
 * - `'icon'`  - the active toggle's icon becomes the button icon; the head only opens the popup.
 */
export type ToggleProjection = 'quick' | 'icon';

export interface ToggleGroupButtonProps extends CommandGroupProps {
  /**
   * How the active toggle projects onto the button head.
   * @defaultValue `'quick'`
   */
  projectAs?: ToggleProjection;

  /**
   * Fallback icon for `'icon'` projection when no member toggle is active.
   */
  defaultIcon?: React.ReactNode;
}

/**
 * A {@link CommandGroup} over a set of mutually-exclusive **toggle** commands whose head reflects
 * whichever toggle is currently active (e.g. the underline and text-overflow button groups): the
 * toggle members come from a registered group (`groupKey`) or an inline `members` list, and
 * `projectAs` picks how the active toggle surfaces on the head.
 *
 * @remarks
 * All popup / disabled behavior is inherited from `CommandGroup` (the popup panel, `allDisabled`
 * gating, float close). This component only computes the active toggle and hands `CommandGroup` the
 * projected `quickCommand` / `icon`. It renders `<CommandGroup>` *directly* (not via the group's
 * `render` escape hatch), so wiring this component as a group's `render` does not recurse.
 */
export const ToggleGroupButton = memo(
  forwardRef<HTMLElement, ToggleGroupButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    members: propMembers,
    registry: propRegistry,
    projectAs = 'quick',
    defaultIcon,
    ...rest
  } = props;

  const contextRegistry = useCommandButtonRegistry();
  const registry = propRegistry ?? contextRegistry;

  // Members = inline prop, else the registered group resolved (explicit ∪ injected).
  const members = useMemo(
    () => propMembers ?? (groupKey ? registry.resolveMembers(groupKey) : null) ?? null,
    [propMembers, groupKey, registry]
  );

  // The direct command keys (the toggles); nested panels / dividers are skipped.
  const commandKeys = useMemo(() => {
    const keys: string[] = [];
    const list: (string | '-' | null | CommandButtonEntry)[] = members ?? [];
    for (let i=0; i<list.length; i++) {
      const m = list[i];
      if (!m || m === '-') continue;
      if (typeof m === 'string') keys.push(m);
      else if (m.key) keys.push(m.key);
    }
    return keys;
  }, [members]);

  const resolved = useCommands(commandKeys);

  // First enabled toggle whose state is set wins.
  let activeKey: string | null = null;
  let activeIcon: React.ReactNode = null;
  for (let i=0; !activeKey && i<resolved.length; i++) {
    const command = resolved[i];
    if (!command || command.disabled()) continue;
    if (command.getState()) {
      activeKey = commandKeys[i];
      activeIcon = command.getIcon() as React.ReactNode;
    }
  }

  // `'icon'` projects onto the icon and drops the quick command (head just opens the popup);
  // `'quick'` projects onto the quick command (defaulting to the first toggle).
  const projected = projectAs === 'icon'
    ? { icon: (activeIcon ?? defaultIcon) as React.ReactNode, quickCommand: undefined }
    : { quickCommand: activeKey ?? commandKeys[0], icon: undefined };

  return (
    <CommandGroup
      ref={refForwarded}
      groupKey={groupKey}
      members={propMembers}
      registry={registry}
      {...rest}
      {...projected}
    />
  );
}));

ToggleGroupButton.displayName = "ToggleGroupButton";
