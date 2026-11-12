import type React from 'react';
import { memo, useMemo } from 'react';

import { Box, ToggleButton } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import {
  Color, IFont, IFill, type IBorders, type IColor, type ICellStyle, type IWorkbook
} from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { STYLE_PRESETS } from '@sheetxl/react';

import { BorderPopupButton } from '../border';
import { AutoColorPosition, ColorPopupButton } from '../color';

import { PresetChip } from './PresetChip';
import { RuleSection } from './RuleSection';
import { toPreviewColor, usePreviewColors } from './previewColor';

const BOLD_WEIGHT = 700;

/** What the fill picker's *No Fill* swatch paints — the same one the Home toolbar offers. */
const NO_FILL = new Color('transparent');

/** Tooltip catalog keys, by {@link StylePreset.key}. */
const PRESET_MESSAGE_KEYS: Record<string, string> = {
  lightRedFillDarkRedText: messageKey('conditionalFormat.preset.lightRedFillDarkRedText'),
  yellowFillDarkYellowText: messageKey('conditionalFormat.preset.yellowFillDarkYellowText'),
  greenFillDarkGreenText: messageKey('conditionalFormat.preset.greenFillDarkGreenText'),
  lightRedFill: messageKey('conditionalFormat.preset.lightRedFill'),
  redText: messageKey('conditionalFormat.preset.redText'),
  redBorder: messageKey('conditionalFormat.preset.redBorder')
};

export interface ConditionalFormatStylePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The rule's dxf. A differential format — only the properties the user touched are present.
   *
   * @remarks
   * Named `format` (not `style`) because this interface extends the DOM attributes, where `style`
   * is already the CSS prop.
   */
  format: ICellStyle.Properties | null;
  /**
   * Called with the replacement dxf; `null` clears every override.
   */
  onFormatChange: (format: ICellStyle.Properties | null) => void;
  readOnly?: boolean;
}

const fillColorOf = (fill: ICellStyle.Properties['fill']): IColor.Serializable | null => {
  if (!fill) return null;
  if (typeof fill === 'string') return fill;
  if ((fill as IFill.Properties).type === IFill.Type.None) return null;
  return (fill as IFill.SolidProperties).color
    ?? (fill as IFill.PatternProperties).foreground
    ?? null;
};

const toColor = (
  serializable: IColor.Serializable | null | undefined,
  workbook: IWorkbook | null
): IColor | null => {
  if (serializable === 'auto') return null;
  return toPreviewColor(serializable, workbook);
};

/**
 * The format section of a rule: Excel's six canned presets — so a rule authored here and one
 * authored in Excel start from the same palette — plus a seventh that clears, over a mini toolbar
 * of B/I/U/S toggles, border, and fill and font color (the Home toolbar's order).
 *
 * Clearing is a chip rather than a toolbar button because "no format" is one of the choices on
 * offer, not a separate verb — and as a toolbar `✕` it read as *close*.
 *
 * @remarks
 * Reads and writes {@link ICellStyle.Properties} directly. Border is in the model but not in this
 * toolbar (beyond the red-border preset); a full border editor belongs to the format dialog.
 *
 * There is no `AaBbCc` swatch here: the panel header and every rule card already paint the rule,
 * so a third preview of the same dxf is noise.
 */
export const ConditionalFormatStylePicker = memo<ConditionalFormatStylePickerProps>((props) => {
  const {
    format: ruleStyle,
    onFormatChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const { workbook, schemeLookup, themeKey, darkMode, propsColorPanel } = usePreviewColors();

  const font = ruleStyle?.font ?? null;
  const isBold = (font?.weight ?? 400) >= 600;
  const isItalic = font?.style === IFont.Style.Italic;
  const isUnderline = !!font?.underline && font.underline !== IFont.UnderlineStyle.None;
  const isStrike = !!font?.strike && font.strike !== IFont.StrikeStyle.None;

  /* A dxf only carries what the user set — an unset toggle DELETES the key rather than writing
     the default, so "not bold" stays "no opinion on weight" on the wire. */
  const updateFont = (updates: Partial<ICellStyle.Properties['font'] & { color: any }>): void => {
    const nextFont: any = { ...font };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete nextFont[key];
      else nextFont[key] = value;
    }
    const next: ICellStyle.Properties = { ...ruleStyle };
    if (Object.keys(nextFont).length === 0) delete next.font;
    else next.font = nextFont;
    onFormatChange(Object.keys(next).length === 0 ? null : next);
  };

  const updateFill = (color: IColor | null): void => {
    const next: ICellStyle.Properties = { ...ruleStyle };
    if (!color) delete next.fill;
    else next.fill = { type: IFill.Type.Solid, color: color.toString() };
    onFormatChange(Object.keys(next).length === 0 ? null : next);
  };

  const updateBorder = (border: Partial<IBorders.Properties> | null): void => {
    const next: ICellStyle.Properties = { ...ruleStyle };
    if (!border || Object.keys(border).length === 0) delete next.borders;
    else next.borders = border;
    onFormatChange(Object.keys(next).length === 0 ? null : next);
  };

  const autoFontColor = useMemo(
    () => workbook?.getStyles().getNormal().getFont().getColor(),
    [workbook, themeKey]
  );
  const fontColor = useMemo(() => toColor(font?.color, workbook), [font?.color, workbook, themeKey]);
  const fillColor = useMemo(() => toColor(fillColorOf(ruleStyle?.fill), workbook), [ruleStyle?.fill, workbook, themeKey]);

  const toggleSx = {
    padding: '4px',
    border: 'none',
    borderRadius: 1
  };

  return (
    <RuleSection {...rest}>
      {/* Excel's canned presets, and the one that clears — the clear chip is a peer of the strip,
          so the presets wrap inside their own box and never push it out of reach. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {STYLE_PRESETS.map((preset, i) => {
            const presetFill = toColor(fillColorOf(preset.style.fill), workbook);
            const presetFont = toColor(preset.style.font?.color, workbook);
            const borderStroke = preset.style.borders
              ? toColor((Object.values(preset.style.borders)[0] as any)?.color, workbook)
              : null;
            return (
              <PresetChip
                key={i}
                // A preset paints a CELL: `sheet` puts the chip on the grid's surface — the same
                // one the pickers below open on, not the panel's paper — so a facet the preset
                // leaves alone falls through to what the sheet already draws.
                sheet
                title={t(PRESET_MESSAGE_KEYS[preset.key] ?? preset.key)}
                disabled={readOnly}
                onClick={() => onFormatChange(structuredClone(preset.style))}
                sx={{
                  backgroundColor: presetFill?.toCSS('adaptive') ?? undefined,
                  color: presetFont?.toCSS('adaptive') ?? undefined,
                  outline: borderStroke ? `1px solid ${borderStroke.toCSS('adaptive')}` : undefined,
                  outlineOffset: '-3px'
                }}
              >
                Aa
              </PresetChip>
            );
          })}
        </Box>
        <PresetChip
          title={t('conditionalFormat.clearStyle')}
          disabled={readOnly || !ruleStyle}
          onClick={() => onFormatChange(null)}
          sx={{ color: 'text.secondary', '&:disabled': { opacity: 0.4 } }}
        >
          <DynamicIcon iconKey="ClearFormats" size={16} />
        </PresetChip>
      </Box>
      {/* The mini toolbar. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <ToggleButton
          value="bold" size="small" sx={toggleSx}
          selected={isBold}
          disabled={readOnly}
          onChange={() => updateFont({ weight: isBold ? undefined : BOLD_WEIGHT })}
        >
          <DynamicIcon iconKey="TextBold" />
        </ToggleButton>
        <ToggleButton
          value="italic" size="small" sx={toggleSx}
          selected={isItalic}
          disabled={readOnly}
          onChange={() => updateFont({ style: isItalic ? undefined : IFont.Style.Italic })}
        >
          <DynamicIcon iconKey="TextItalic" />
        </ToggleButton>
        <ToggleButton
          value="underline" size="small" sx={toggleSx}
          selected={isUnderline}
          disabled={readOnly}
          onChange={() => updateFont({ underline: isUnderline ? undefined : IFont.UnderlineStyle.Single })}
        >
          <DynamicIcon iconKey="TextUnderline" />
        </ToggleButton>
        <ToggleButton
          value="strike" size="small" sx={toggleSx}
          selected={isStrike}
          disabled={readOnly}
          onChange={() => updateFont({ strike: isStrike ? undefined : IFont.StrikeStyle.Single })}
        >
          <DynamicIcon iconKey="TextStrike" />
        </ToggleButton>
        {workbook && (
          <BorderPopupButton
            tooltip={t('conditionalFormat.border')}
            selectedBorder={ruleStyle?.borders as Partial<IBorders.Properties>}
            createBorder={(border: Partial<IBorders.Properties>) =>
              workbook.getStyles().getNormal().createStyle({ borders: border }).getBorders()}
            schemeLookup={schemeLookup!}
            autoColor={autoFontColor!}
            darkMode={darkMode}
            disabled={readOnly}
            onSelectBorder={(border) => updateBorder(border)}
          />
        )}
        {/* Fill before font color — the Home toolbar's order (border, fill, font). Both offer the
            same *No Fill* / *Automatic* swatch the toolbar does; here it means the rule states no
            opinion on that facet, which is what a `null` selection already writes. */}
        <ColorPopupButton
          icon="fill.colored"
          tooltip={t('conditionalFormat.fillColor')}
          selectedColor={fillColor!}
          disabled={readOnly}
          onSelectColor={(color) => updateFill(color)}
          darkMode={darkMode}
          propsPanel={{
            disableAlpha: true,
            autoColor: NO_FILL,
            autoColorLabelKey: messageKey('color.noFill'),
            autoColorPosition: AutoColorPosition.End,
            ...propsColorPanel
          }}
        />
        <ColorPopupButton
          icon="text.colored"
          tooltip={t('conditionalFormat.fontColor')}
          selectedColor={fontColor!}
          disabled={readOnly}
          onSelectColor={(color) => updateFont({ color: color ? color.toString() : undefined })}
          darkMode={darkMode}
          propsPanel={{
            disableAlpha: true,
            // The automatic color is whatever an untouched cell draws its text in — Normal's.
            autoColor: autoFontColor,
            ...propsColorPanel
          }}
        />
      </Box>
    </RuleSection>
  );
});

ConditionalFormatStylePicker.displayName = 'ConditionalFormatStylePicker';
