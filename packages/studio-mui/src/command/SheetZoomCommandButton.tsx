import type React from 'react';
import {
  memo, forwardRef, useCallback
} from 'react';

import { type Theme, type SxProps } from '@mui/material';
import { Box } from '@mui/material';

import { useCommands, useCommandButtonEntry, useTranslator, CommandButtonType } from '@sheetxl/utils-react';

import {
  defaultRenderPopupPanel, CommandPopupButton, CommandButton, InputCommandButton, ExhibitDivider, buttonLabelSx,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

const ZOOM_COMMAND_KEYS: string[] = [
  'sheetZoom200',
  'sheetZoom100',
  'sheetZoom75',
  'sheetZoom50',
  'sheetZoom25',
  'sheetZoomCustom'
];

/**
 * Zoom-level split button, shared by the status bar and the View toolbar. Like the `textRotateOptions`
 * group: the popup lists the preset levels + a custom input, while the quick button always executes
 * `sheetZoom100` yet *displays* the current zoom scale. The percent text is styled as a toolbar label;
 * a denser surface restyles it through the `zoom-percent` class and drops the outline (see `SheetZoomScale`).
 */
export const SheetZoomCommandButton = memo(
  forwardRef<HTMLElement, CommandPopupButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    disabled: propDisabled,
    ...rest
  } = props;

  const t = useTranslator();
  const resolvedCommands = useCommands(ZOOM_COMMAND_KEYS);
  const entry = useCommandButtonEntry('sheetZoomOptions');

  let anyEnabled = false;
  const resolvedCommandsLength = resolvedCommands.length;
  for (let i=0; !anyEnabled && i<resolvedCommandsLength; i++) {
    const command = resolvedCommands[i];
    if (command && !command.disabled()) anyEnabled = true;
  }

  // The custom command carries the live scale as its state (see SheetCommands).
  const currentZoom = Math.round((resolvedCommands[resolvedCommandsLength-1]?.getState() as number) ?? 100);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey,
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoom200'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoom100'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoom75'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoom50'}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoom25'}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        commandKey={'sheetZoomSelection'}
      />
      <ExhibitDivider orientation="horizontal"/>
      <InputCommandButton
        {...commandButtonProps}
        commandKey={'sheetZoomCustom'}
        // Compact in-menu label via the command's `@sheetZoomOptions` groupLabel (catalog-backed).
        groupKey={'sheetZoomOptions'}
        parseInput={(value: string): number => {
          const num = parseFloat(value);
          if (isNaN(num) || !isFinite(num)) { // revert back to original value (blank is an example)
            throw new Error('Invalid number');
          }
          return Math.min(400, Math.max(10, Math.round(num)));
        }}
        inputProps={{
          type: "number",
          maxLength: 3, // Not honored for inputType number so we manage in onchange and keypress
        }}
      />
    </>);
    return defaultRenderPopupPanel({...props, children});
  }, [propDisabled, groupKey]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      disabled={propDisabled || !anyEnabled}
      groupKey={groupKey}
      // Head chrome from the registered `sheetZoomOptions` entry (catalog-backed, language-aware).
      label={entry?.getLabel?.()}
      tooltip={entry?.getDescription?.()}
      renderPopupPanel={renderPopupPanel}
      quickCommand={'sheetZoom100'}
      // The active-level state highlights the menu item, but the quick button looks off selected.
      selected={false}
      // A value picker, outlined like font size and number format.
      outlined={true}
      icon={
        <Box
          className="zoom-percent"
          sx={{
            ...buttonLabelSx,
            display: 'flex',
            justifyContent: 'center',
            whiteSpace: 'pre',
            minWidth: '2.4em', // hold the width steady across 25% – 200% so neighbors don't shift
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            userSelect: 'none'
          } as SxProps<Theme>}
        >
          {t('zoom.percent', { value: currentZoom })}
        </Box>
      }
      {...rest}
    />
  )
}));

SheetZoomCommandButton.displayName = 'SheetZoomCommandButton';
