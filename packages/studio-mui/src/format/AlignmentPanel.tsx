import { memo } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IRange, type ICellRange } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { CommandButton } from '@sheetxl/utils-mui';

import {
  type FormatPanelProps, FormatSection, FormatRow, FormatButtonGroup, FormatNumberField, panelSx
} from './FormatPanelParts';

/** The largest indent Excel accepts. */
const MAX_INDENT = 250;

/** The fit the ribbon's indent commands use: the column grows to the whole content, rows stay. */
const INDENT_AUTO_FIT: ICellRange.AutoFitOptions = {
  axes: IRange.AxisSelection.Column, expandOnly: true, skipCustomSize: true
};

/**
 * The stored rotation as the SIGNED angle the user types.
 *
 * @remarks
 * The model stores a counter-clockwise angle in `0…360` (matching OOXML), but every spreadsheet UI
 * — Excel's included — asks for `-90…90`. `270` is the same tilt as `-90`.
 */
const toSignedDegrees = (rotation: number): number => (rotation > 180 ? rotation - 360 : rotation);

/** The inverse of {@link toSignedDegrees}, clamped to the tilts a cell can actually take. */
const toStoredDegrees = (degrees: number): number => {
  const clamped = Math.max(-90, Math.min(90, Math.round(degrees)));
  return clamped < 0 ? clamped + 360 : clamped;
};

/**
 * The **Alignment** tab of the format pane: where text sits in the cell, how it behaves when it
 * does not fit, and which way it runs.
 *
 * @remarks
 * The toggles are the ribbon's own commands, so they carry the ribbon's icons, tooltips, keyboard
 * shortcuts and protection-disable for free — and pressing one here lights up the matching ribbon
 * button, because both read the same command state. Only the two numeric fields (indent, custom
 * angle) write the model directly: a spinner is a poor fit for a command's fire-once shape.
 */
export const AlignmentPanel = memo((props: FormatPanelProps) => {
  const {
    selection,
    disabled: propDisabled,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const { style, applyStyle } = selection;
  const disabled = propDisabled || selection.disabled;

  const alignment = style.getAlignment();
  const indent = alignment.getIndent();
  const stacked = alignment.getStacked();
  const rotation = stacked ? 0 : alignment.getRotation();

  const handleIndent = useCallbackRef((next: number) => {
    applyStyle({ alignment: { indent: next } }, messageKey('op.setAlignment'), INDENT_AUTO_FIT);
  }, [applyStyle]);

  const handleRotation = useCallbackRef((next: number) => {
    applyStyle({ alignment: { rotation: toStoredDegrees(next) } }, messageKey('op.setAlignment'));
  }, [applyStyle]);

  return (
    <Box
      className={clsx('sxl-format-alignment-panel', propClassName)}
      sx={panelSx}
      {...rest}
    >
      <FormatSection label={t('format.horizontalAlignment')}>
        <FormatRow>
          <FormatButtonGroup>
            <CommandButton commandKey="formatAlignLeftToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignCenterToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignRightToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignJustifyToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignDistributedHorizontalToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignCenterContinuousToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatAlignFillToggle" groupKey="horizontalAlignOptions" disabled={disabled}/>
          </FormatButtonGroup>
        </FormatRow>
      </FormatSection>

      {/* One indent step is the width of one character of the workbook's default font, which is
          the unit the field names. */}
      <FormatSection label={t('format.indent')}>
        <FormatRow>
          <CommandButton commandKey="formatIndentDecrease" groupKey="horizontalAlignOptions" disabled={disabled}/>
          <CommandButton commandKey="formatIndentIncrease" groupKey="horizontalAlignOptions" disabled={disabled}/>
          <FormatNumberField
            label={t('format.indentUnit')}
            disabled={disabled}
            value={indent}
            min={0}
            max={MAX_INDENT}
            width={104}
            onChange={handleIndent}
          />
        </FormatRow>
      </FormatSection>

      <FormatSection label={t('format.verticalAlignment')}>
        <FormatButtonGroup>
          <CommandButton commandKey="formatAlignTopToggle" groupKey="verticalAlignOptions" disabled={disabled}/>
          <CommandButton commandKey="formatAlignMiddleToggle" groupKey="verticalAlignOptions" disabled={disabled}/>
          <CommandButton commandKey="formatAlignBottomToggle" groupKey="verticalAlignOptions" disabled={disabled}/>
          <CommandButton commandKey="formatAlignJustifyVerticalToggle" groupKey="verticalAlignOptions" disabled={disabled}/>
          <CommandButton commandKey="formatAlignDistributedVerticalToggle" groupKey="verticalAlignOptions" disabled={disabled}/>
        </FormatButtonGroup>
      </FormatSection>

      {/* Excel calls this group "Text control" and puts merge in it. The name says nothing (every
          control on this tab controls text), and merge answers a different question than "what
          happens to text that does not fit" — so each gets the label it actually has. */}
      <FormatSection label={t('format.overflow')}>
        <FormatButtonGroup>
          <CommandButton commandKey="formatTextOverflowWrapToggle" groupKey="textOverflowOptions" disabled={disabled}/>
          <CommandButton commandKey="formatTextOverflowShrinkToggle" groupKey="textOverflowOptions" disabled={disabled}/>
          <CommandButton commandKey="formatTextOverflowClipToggle" groupKey="textOverflowOptions" disabled={disabled}/>
          <CommandButton commandKey="formatTextOverflowVisibleToggle" groupKey="textOverflowOptions" disabled={disabled}/>
        </FormatButtonGroup>
      </FormatSection>

      <FormatSection label={t('format.merge')}>
        <FormatButtonGroup>
          <CommandButton commandKey="mergeToggle" groupKey="mergeOptions" disabled={disabled}/>
          <CommandButton commandKey="mergeHorizontal" groupKey="mergeOptions" disabled={disabled}/>
          <CommandButton commandKey="mergeVertical" groupKey="mergeOptions" disabled={disabled}/>
          <CommandButton commandKey="unmerge" groupKey="mergeOptions" disabled={disabled}/>
        </FormatButtonGroup>
      </FormatSection>

      <FormatSection label={t('format.orientation')}>
        <FormatRow>
          <FormatButtonGroup>
            <CommandButton commandKey="formatTextRotate0" groupKey="textRotateOptions" disabled={disabled}/>
            <CommandButton commandKey="formatTextRotate45" groupKey="textRotateOptions" disabled={disabled}/>
            <CommandButton commandKey="formatTextRotate315" groupKey="textRotateOptions" disabled={disabled}/>
            <CommandButton commandKey="formatTextRotate90" groupKey="textRotateOptions" disabled={disabled}/>
            <CommandButton commandKey="formatTextRotateVertical" groupKey="textRotateOptions" disabled={disabled}/>
            <CommandButton commandKey="formatTextRotate270" groupKey="textRotateOptions" disabled={disabled}/>
          </FormatButtonGroup>
          {/* Vertical text has no angle - Excel greys the degrees out while it is on. */}
          <FormatNumberField
            label={t('format.degrees')}
            disabled={disabled || stacked}
            value={toSignedDegrees(rotation)}
            min={-90}
            max={90}
            step={5}
            width={104}
            onChange={handleRotation}
          />
        </FormatRow>
      </FormatSection>
    </Box>
  );
});

AlignmentPanel.displayName = 'AlignmentPanel';
