import type React from 'react';
import { memo } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

import { CommandButton } from '@sheetxl/utils-mui';

import { FontFamilyCommandButton } from '../command/FontFamilyCommandButton';
import { FontSizeCommandButton } from '../command/FontSizeCommandButton';
import { ColorCommandButton } from '../command/ColorCommandButton';

import {
  type FormatPanelProps, FormatSection, FormatRow, FormatButtonGroup, panelSx
} from './FormatPanelParts';

/**
 * The **Font** tab of the format pane: typeface, size, color and the character effects.
 *
 * @remarks
 * Every control here is the ribbon's own — the same family/size popups and the same toggles, just
 * laid out for a narrow column instead of a strip. Nothing writes the model directly; the commands
 * do, which is why the ribbon and this panel never disagree about what is bold.
 */
export const FontPanel = memo((props: FormatPanelProps) => {
  const {
    selection,
    disabled: propDisabled,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const disabled = propDisabled || selection.disabled;

  return (
    <Box
      className={clsx('sxl-format-font-panel', propClassName)}
      sx={panelSx}
      {...rest}
    >
      <FormatSection label={t('format.fontFamily')}>
        <FontFamilyCommandButton
          commandKey="formatFontFamily"
          disabled={disabled}
          sx={{ width: '100%' }}
        />
      </FormatSection>

      <FormatSection label={t('format.fontSize')}>
        <FormatRow>
          <FontSizeCommandButton
            commandKey="formatFontSize"
            disabled={disabled}
            sx={{ width: 96 }}
          />
          <CommandButton commandKey="formatFontSizeIncrease" disabled={disabled}/>
          <CommandButton commandKey="formatFontSizeDecrease" disabled={disabled}/>
        </FormatRow>
      </FormatSection>

      <FormatSection label={t('format.color')}>
        <FormatRow>
          <ColorCommandButton commandKey="formatFontColor" disabled={disabled}/>
        </FormatRow>
      </FormatSection>

      <FormatSection label={t('format.effects')}>
        <FormatButtonGroup>
          <CommandButton commandKey="formatBoldToggle" disabled={disabled}/>
          <CommandButton commandKey="formatItalicToggle" disabled={disabled}/>
          <CommandButton commandKey="formatUnderlinedToggle" groupKey="underlineOptions" disabled={disabled}/>
          <CommandButton commandKey="formatUnderlinedDoubleToggle" groupKey="underlineOptions" disabled={disabled}/>
          <Box sx={{ width: '8px' }}/>
          <CommandButton commandKey="formatStrikeThroughToggle" disabled={disabled}/>
          <CommandButton commandKey="formatSuperscriptToggle" disabled={disabled}/>
          <CommandButton commandKey="formatSubscriptToggle" disabled={disabled}/>
        </FormatButtonGroup>
      </FormatSection>

      <FormatSection label={t('format.accountingUnderline')}>
        <FormatButtonGroup>
          <CommandButton commandKey="formatUnderlinedAccountingToggle" groupKey="underlineOptions" disabled={disabled}/>
          <CommandButton commandKey="formatUnderlinedAccountingDoubleToggle" groupKey="underlineOptions" disabled={disabled}/>
        </FormatButtonGroup>
      </FormatSection>
    </Box>
  );
});

FontPanel.displayName = 'FontPanel';
