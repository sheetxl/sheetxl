import type React from 'react';
import { memo, forwardRef } from 'react';

import { type Theme, type SxProps } from '@mui/material';
import { Box } from '@mui/material';

import { CommandButton } from '@sheetxl/utils-mui';

import { AccountingStyleCommandButton } from './AccountingStyleCommandButton';

/**
 * The registry key the number-format popup is registered under — and the scope its members' labels
 * resolve against: `formatCells` reads as "More Number Formats…" there, "Format Cells" elsewhere,
 * and the quick buttons below resolve their compact labels against it.
 */
export const NUMBER_FORMAT_GROUP_KEY = 'numberFormatOptions';

export interface NumberFormatQuickButtonsProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The render surface, for scoped command chrome (the compact labels).
   * @defaultValue {@link NUMBER_FORMAT_GROUP_KEY}
   */
  groupKey?: string;
  /** Force every button off, on top of each command's own state. */
  disabled?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
}

/**
 * The five one-click number formats — accounting, percent, comma, and the two decimal nudges.
 *
 * @remarks
 * Shared by the toolbar's number-format popup and the format pane's Number tab, which are the same
 * five commands either way. They act on the current selection through their commands rather than
 * through a host's own value channel, so a host that edits something *other* than the selection
 * (a dialog with its own target) should leave them out.
 */
export const NumberFormatQuickButtons = memo(forwardRef<HTMLDivElement, NumberFormatQuickButtonsProps>((
  props: NumberFormatQuickButtonsProps,
  refForwarded
) => {
  const {
    groupKey = NUMBER_FORMAT_GROUP_KEY,
    disabled,
    sx: propSx,
    ...rest
  } = props;

  return (
    <Box
      ref={refForwarded}
      className="quick-buttons"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...propSx
      }}
      {...rest}
    >
      <AccountingStyleCommandButton
        groupKey={groupKey}
        disabled={disabled}
      />
      <CommandButton
        commandKey={'formatNumberFormatPercentStyle'}
        groupKey={groupKey}
        disabled={disabled}
      />
      <CommandButton
        commandKey={'formatNumberFormatCommaStyle'}
        groupKey={groupKey}
        disabled={disabled}
      />
      <CommandButton
        commandKey={'formatNumberFormatIncreaseDecimal'}
        groupKey={groupKey}
        disabled={disabled}
      />
      <CommandButton
        commandKey={'formatNumberFormatDecreaseDecimal'}
        groupKey={groupKey}
        disabled={disabled}
      />
    </Box>
  );
}));
NumberFormatQuickButtons.displayName = 'NumberFormatQuickButtons';
