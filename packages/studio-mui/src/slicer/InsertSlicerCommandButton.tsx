import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { useCommands, useFloatStack, KeyCodes } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import {
  CommandPopupButton, SelectedIcon, defaultRenderPopupPanel, ExhibitMenuItem, ExhibitTooltip,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

export interface InsertSlicerCommandButtonProps extends Omit<CommandPopupButtonProps, 'quickCommand'> {
  /** The command that inserts, taking {@link CommandContext.InsertSlicerOptions}. */
  commandKey: string;
}

/**
 * Insert Slicer for a table or a pivot table. Pressed, it inserts a slicer on the field the active
 * cell is in; its menu lists every field. With the active cell in no field, as on a pivot table's
 * values, a press opens the menu.
 */
export const InsertSlicerCommandButton = memo(
  forwardRef<HTMLElement, InsertSlicerCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const command = useCommands<void, CommandContext.InsertSlicer, CommandContext.InsertSlicerOptions | undefined>([commandKey])[0];
  const context: CommandContext.InsertSlicer | undefined = command?.getContext();
  const anchor = context?.anchor() ?? null;
  const isDisabled = propDisabled ?? (!command || command.disabled());

  const { reference } = useFloatStack();

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const choose = (field: string): void => {
      reference?.closeAll();
      void command?.execute({ field });
    };
    const items = (context?.fields() ?? []).map((field) => {
      const selected = field === anchor;
      return (
        <ExhibitMenuItem
          key={field}
          selected={selected}
          disabled={isDisabled}
          icon={selected ? <SelectedIcon/> : undefined}
          sx={{ display: 'flex', paddingTop: '4px', paddingBottom: '4px', flex: 'none' }}
          onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0) return; choose(field); }}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) choose(field);
          }}
        >
          <Typography
            component="div"
            sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {field}
          </Typography>
        </ExhibitMenuItem>
      );
    });
    return defaultRenderPopupPanel({
      ...panelProps,
      children: <Box sx={{ overflow: 'auto', flex: '1 1 100%' }}>{items}</Box>
    });
  }, [command, context, anchor, isDisabled, reference]);

  return (
    <CommandPopupButton
      ref={refForwarded as React.Ref<HTMLDivElement>}
      onQuickClick={anchor ? () => command?.execute() : undefined}
      renderPopupPanel={renderPopupPanel}
      label={command?.getLabel(groupKey)}
      groupKey={groupKey}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel()}
          description={command?.getDescription()}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      disabled={isDisabled}
      icon={command?.getIcon()}
      {...rest}
    />
  );
}));

InsertSlicerCommandButton.displayName = 'InsertSlicerCommandButton';
