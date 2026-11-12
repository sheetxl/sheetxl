import React, { memo, forwardRef, useMemo } from 'react';

import {
  DynamicIcon, useCommandButtonEntry, type CommandButtonEntry, type CommandButtonProps
} from '@sheetxl/utils-react';

import { CommandButton, CommandGroup } from '@sheetxl/utils-mui';

import { useInsertableCellControls } from '@sheetxl/react';

/** The key the ribbon's insert-control entry is registered under. */
export const INSERT_CELL_CONTROL_OPTIONS_KEY = 'insertCellControlOptions';

/**
 * The Insert ribbon's cell control button. With only the built-in checkbox registered it is the
 * plain `insertCheckbox` button, as it always was; once a host registers another control type that
 * draws, it becomes a split button: the checkbox stays the quick action, and the dropdown lists
 * every type, each running `insertCellControl` with the type as its argument, then the
 * `formatCellControl` pane.
 *
 * @remarks
 * Registered as the `insertCellControlOptions` entry's `render`, so its label, icon and tooltip
 * come from the catalog like any other ribbon control, and it follows the content registry live.
 */
export const InsertCellControlCommandButton = memo(forwardRef<HTMLElement, CommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: _groupKey,
    commandKey: _commandKey,
    commandState: _commandState,
    label: propLabel,
    icon: propIcon,
    ...rest
  } = props;

  const insertable = useInsertableCellControls();
  // The built-in checkbox is the quick action, not a member of the list.
  const kinds = useMemo(() => insertable.filter(kind => kind.type !== 'checkbox'), [insertable]);
  const entry = useCommandButtonEntry(INSERT_CELL_CONTROL_OPTIONS_KEY);

  if (kinds.length === 0) {
    return <CommandButton ref={refForwarded} commandKey="insertCheckbox" {...rest} />;
  }

  const members: (CommandButtonEntry | '-')[] = [
    { key: 'insertCheckbox' },
    ...kinds.map((kind): CommandButtonEntry => ({
      key: 'insertCellControl',
      state: kind.type,
      getLabel: () => kind.label,
      getIcon: () => (typeof kind.icon === 'string' ? <DynamicIcon iconKey={kind.icon} /> : kind.icon)
    })),
    '-',
    { key: 'formatCellControl' }
  ];
  return (
    <CommandGroup
      ref={refForwarded}
      members={members}
      quickCommand="insertCheckbox"
      icon={(propIcon ?? entry?.getIcon?.(INSERT_CELL_CONTROL_OPTIONS_KEY) ?? 'CheckboxInsert') as React.ReactNode}
      label={(propLabel ?? entry?.getLabel?.(INSERT_CELL_CONTROL_OPTIONS_KEY)) as React.ReactNode}
      tooltip={entry?.getDescription?.(INSERT_CELL_CONTROL_OPTIONS_KEY)}
      {...rest}
    />
  );
}));

InsertCellControlCommandButton.displayName = 'InsertCellControlCommandButton';
