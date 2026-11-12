import type React from 'react';
import { memo } from 'react';

import {
  Box, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
  ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';

import { IConditionalFormat } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { DATA_BAR_PRESETS } from '@sheetxl/react';

import { ColorPopupButton } from '../color';

import { ScaleStopRow } from './ScaleStopRow';
import { RuleSection } from './RuleSection';
import { PresetChip } from './PresetChip';
import { ScaleMiniGrid, dataBarRows, GRID_ACCENT_COLOR } from './ScaleMiniGrid';
import { usePreviewColors } from './previewColor';

const MIN_TYPES: readonly IConditionalFormat.ColorStopType[] = [
  IConditionalFormat.ColorStopType.AutoMin,
  IConditionalFormat.ColorStopType.Min,
  IConditionalFormat.ColorStopType.Num,
  IConditionalFormat.ColorStopType.Percent,
  IConditionalFormat.ColorStopType.Percentile,
  IConditionalFormat.ColorStopType.Formula
];

const MAX_TYPES: readonly IConditionalFormat.ColorStopType[] = [
  IConditionalFormat.ColorStopType.AutoMax,
  IConditionalFormat.ColorStopType.Max,
  IConditionalFormat.ColorStopType.Num,
  IConditionalFormat.ColorStopType.Percent,
  IConditionalFormat.ColorStopType.Percentile,
  IConditionalFormat.ColorStopType.Formula
];

const AUTO = '__auto__';

export interface DataBarRulePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  scale: IConditionalFormat.DataBar;
  onScaleChange: (scale: IConditionalFormat.DataBar) => void;
  readOnly?: boolean;
}

/**
 * The Data Bars tab: Excel's twelve preset bars, then show-bars-only and appearance — fill,
 * border, negative fill, axis and direction — over the min/max bound rows. Every field is one
 * already on {@link IConditionalFormat.DataBar}.
 *
 * @remarks
 * Format on top, config under it — the same two boxes every tab in the editor has, which is why
 * the bounds sit at the bottom rather than where Excel's dialog puts them.
 *
 * @remarks
 * The x14 twin is the wire risk here: the legacy `dataBar` element and its x14 counterpart must
 * stay married through a write, so anything exposed here is verified by the round-trip fixtures,
 * not just against the SDK type.
 */
export const DataBarRulePanel = memo<DataBarRulePanelProps>((props) => {
  const {
    scale,
    onScaleChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const { darkMode, toColor, propsColorPanel } = usePreviewColors();

  const barColor = toColor(scale.color);
  const negativeColor = toColor(scale.negativeFillColor);
  const borderColor = toColor(scale.borderColor);
  const negativeBorderColor = toColor(scale.negativeBorderColor);
  const solidFill = scale.solidFill ?? false;

  const update = (updates: Partial<IConditionalFormat.DataBar>): void => {
    const next: any = { ...scale };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    onScaleChange(next);
  };

  const selectSx = { backgroundColor: 'background.paper' };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      {...rest}
    >
      <RuleSection>
        {/* The switch is a peer of the strip, not a heading over it — a gradient rule gets the
            gradient half of the gallery, the same way the color-scale strip follows its 2/3-color
            toggle, so the chips wrap inside their own box and never push it out of reach. */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {DATA_BAR_PRESETS.filter((preset) => (preset.solidFill ?? false) === solidFill).map((preset, i) => (
              <PresetChip
                key={i}
                sheet
                disabled={readOnly}
                // A bar preset is a look — fill, and the border Excel pairs with a gradient fill —
                // so it sets exactly that (clearing the border on a solid preset). Bounds,
                // negatives, axis, direction and show-value are the user's and survive shopping
                // the gallery.
                onClick={() => update({ color: preset.color, solidFill: preset.solidFill, borderColor: preset.borderColor })}
              >
                <ScaleMiniGrid rows={dataBarRows(preset, toColor(preset.color)?.toCSS('adaptive') ?? GRID_ACCENT_COLOR)} />
              </PresetChip>
            ))}
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={solidFill}
            disabled={readOnly}
            onChange={(_, next) => { if (next !== null) update({ solidFill: next ? true : undefined }); }}
            sx={{ flex: '0 0 auto' }}
          >
            <ToggleButton value={true} sx={{ textTransform: 'none', pt: 0.25, pb: 0.25 }}>
              {t('conditionalFormat.solidFill')}
            </ToggleButton>
            <ToggleButton value={false} sx={{ textTransform: 'none', pt: 0.25, pb: 0.25 }}>
              {t('conditionalFormat.gradientFill')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Excel's spelling — the checkbox is the INVERSE of the wire's `showValue`. */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={scale.showValue === false}
              disabled={readOnly}
              onChange={(e) => update({ showValue: e.target.checked ? false : undefined })}
            />
          }
          label={<Typography variant="body2">{t('conditionalFormat.showBarsOnly')}</Typography>}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: '0 0 62px' }}>
            {t('conditionalFormat.bar')}
          </Typography>
          <ColorPopupButton
            icon="fill.colored"
            tooltip={t('conditionalFormat.barColor')}
            selectedColor={barColor!}
            disabled={readOnly}
            onSelectColor={(color) => update({ color: color ? color.toString() : undefined })}
            darkMode={darkMode}
            propsPanel={{ disableAlpha: true, ...propsColorPanel }}
          />
          {/* Excel outlines a bar in its own color unless the rule names one. */}
          <ColorPopupButton
            icon="stroke.colored"
            tooltip={t('conditionalFormat.barBorderColor')}
            selectedColor={borderColor!}
            disabled={readOnly}
            onSelectColor={(color) => update({ borderColor: color ? color.toString() : undefined })}
            darkMode={darkMode}
            propsPanel={{ disableAlpha: true, ...propsColorPanel }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: '0 0 62px' }}>
            {t('conditionalFormat.negative')}
          </Typography>
          {/* Unset negatives inherit the positive bar (the wire's `sameAsPositive`), so the
              swatches show what a negative bar will actually paint, not a blank. */}
          <ColorPopupButton
            icon="fill.colored"
            tooltip={t('conditionalFormat.negativeColor')}
            selectedColor={(negativeColor ?? barColor)!}
            disabled={readOnly}
            onSelectColor={(color) => update({ negativeFillColor: color ? color.toString() : undefined })}
            darkMode={darkMode}
            propsPanel={{ disableAlpha: true, ...propsColorPanel }}
          />
          <ColorPopupButton
            icon="stroke.colored"
            tooltip={t('conditionalFormat.negativeBorderColor')}
            selectedColor={(negativeBorderColor ?? borderColor)!}
            disabled={readOnly}
            onSelectColor={(color) => update({ negativeBorderColor: color ? color.toString() : undefined })}
            darkMode={darkMode}
            propsPanel={{ disableAlpha: true, ...propsColorPanel }}
          />
          {/* Disabled it states the fact — negatives already mirror the positive bar; enabled,
              clicking makes it the fact again. The same chip the classic tab clears with. */}
          <PresetChip
            title={t('conditionalFormat.sameAsPositive')}
            disabled={readOnly || (!scale.negativeFillColor && !scale.negativeBorderColor)}
            onClick={() => update({ negativeFillColor: undefined, negativeBorderColor: undefined })}
            sx={{ color: 'text.secondary', '&:disabled': { opacity: 0.4 } }}
          >
            <DynamicIcon iconKey="ClearFormats" size={16} />
          </PresetChip>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel>{t('conditionalFormat.axis')}</InputLabel>
            <Select
              label={t('conditionalFormat.axis')}
              value={scale.axisPosition ?? AUTO}
              disabled={readOnly}
              sx={selectSx}
              onChange={(e) => {
                const value = e.target.value;
                update({ axisPosition: value === AUTO ? undefined : value as IConditionalFormat.DataBar['axisPosition'] });
              }}
            >
              <MenuItem value={AUTO}>{t('conditionalFormat.automatic')}</MenuItem>
              <MenuItem value="middle">{t('conditionalFormat.axisMiddle')}</MenuItem>
              <MenuItem value="none">{t('conditionalFormat.axisNone')}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
            <InputLabel>{t('conditionalFormat.direction')}</InputLabel>
            <Select
              label={t('conditionalFormat.direction')}
              value={scale.direction ?? AUTO}
              disabled={readOnly}
              sx={selectSx}
              onChange={(e) => {
                const value = e.target.value;
                update({ direction: value === AUTO ? undefined : value as IConditionalFormat.DataBar['direction'] });
              }}
            >
              <MenuItem value={AUTO}>{t('conditionalFormat.automatic')}</MenuItem>
              <MenuItem value="leftToRight">{t('conditionalFormat.leftToRight')}</MenuItem>
              <MenuItem value="rightToLeft">{t('conditionalFormat.rightToLeft')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </RuleSection>

      <RuleSection variant="config">
        <ScaleStopRow
          label={t('conditionalFormat.stop.minimum')}
          stop={scale.minPoint ?? { type: IConditionalFormat.ColorStopType.Min }}
          allowedTypes={MIN_TYPES}
          readOnly={readOnly}
          onStopChange={(next) => update({ minPoint: next })}
        />
        <ScaleStopRow
          label={t('conditionalFormat.stop.maximum')}
          stop={scale.maxPoint ?? { type: IConditionalFormat.ColorStopType.Max }}
          allowedTypes={MAX_TYPES}
          readOnly={readOnly}
          onStopChange={(next) => update({ maxPoint: next })}
        />
      </RuleSection>
    </Box>
  );
});

DataBarRulePanel.displayName = 'DataBarRulePanel';
