import type React from 'react';
import { memo } from 'react';

import {
  Box, ToggleButton, ToggleButtonGroup
} from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IConditionalFormat } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { COLOR_SCALE_PRESETS } from '@sheetxl/react';

import { ScaleStopRow } from './ScaleStopRow';
import { RuleSection } from './RuleSection';
import { PresetChip } from './PresetChip';
import { ScaleMiniGrid, colorScaleRows, GRID_CELL_BACKGROUND } from './ScaleMiniGrid';
import { usePreviewColors } from './previewColor';

const STOP_TYPES: readonly IConditionalFormat.ColorStopType[] = [
  IConditionalFormat.ColorStopType.Min,
  IConditionalFormat.ColorStopType.Max,
  IConditionalFormat.ColorStopType.Num,
  IConditionalFormat.ColorStopType.Percent,
  IConditionalFormat.ColorStopType.Percentile,
  IConditionalFormat.ColorStopType.Formula
];

const stopLabelKeys = (count: number): string[] => {
  if (count === 2) {
    return [messageKey('conditionalFormat.stop.minimum'), messageKey('conditionalFormat.stop.maximum')];
  }
  return [
    messageKey('conditionalFormat.stop.minimum'),
    messageKey('conditionalFormat.stop.midpoint'),
    messageKey('conditionalFormat.stop.maximum')
  ];
};

export interface ColorScaleRulePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  scale: IConditionalFormat.ColorScale;
  onScaleChange: (scale: IConditionalFormat.ColorScale) => void;
  readOnly?: boolean;
}

/**
 * The Color Scale tab: Excel's twelve preset scales beside a 2/3-stop switch, over the per-stop
 * `{ type, value, color }` rows.
 *
 * @remarks
 * Format on top, config under it — the same two boxes every tab in the editor has. Neither box is
 * captioned: the tab is already named, the preview already paints it, and the chips already say
 * what a gallery of color scales is.
 */
export const ColorScaleRulePanel = memo<ColorScaleRulePanelProps>((props) => {
  const {
    scale,
    onScaleChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const { workbook, toColor } = usePreviewColors();

  const stops = scale.stops ?? [];
  const labels = stopLabelKeys(stops.length);

  const setStopCount = (count: number): void => {
    if (count === stops.length || (count !== 2 && count !== 3)) return;
    const next = stops.slice();
    if (count === 3) {
      // Excel's default midpoint: the 50th percentile, in the mixed color of the two ends.
      let color = '#FFEB84';
      const a = toColor(stops[0]?.color ?? color)?.toRGBA();
      const b = toColor(stops[stops.length - 1]?.color ?? color)?.toRGBA();
      if (a && b) {
        const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0').toUpperCase();
        color = `#${hex((a.red + b.red) / 2)}${hex((a.green + b.green) / 2)}${hex((a.blue + b.blue) / 2)}`;
      }
      next.splice(1, 0, {
        type: IConditionalFormat.ColorStopType.Percentile,
        value: 50,
        color
      });
    } else {
      next.splice(1, next.length - 2);
    }
    onScaleChange({ ...scale, stops: next });
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      {...rest}
    >
      <RuleSection>
        {/* The switch is a peer of the strip, not a heading over it — it says which gallery this
            is, so the chips wrap inside their own box and never push it out of reach. */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {COLOR_SCALE_PRESETS.filter((preset) => preset.stops.length === (stops.length === 2 ? 2 : 3)).map((preset, i) => (
              <PresetChip
                key={i}
                sheet
                disabled={readOnly}
                onClick={() => onScaleChange(structuredClone(preset) as IConditionalFormat.ColorScale)}
              >
                <ScaleMiniGrid rows={colorScaleRows(preset.stops ?? [], GRID_CELL_BACKGROUND, workbook)} />
              </PresetChip>
            ))}
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={stops.length === 2 ? 2 : 3}
            disabled={readOnly}
            onChange={(_, count) => { if (count) setStopCount(count); }}
            sx={{ flex: '0 0 auto' }}
          >
            <ToggleButton value={2} sx={{ textTransform: 'none', pt: 0.25, pb: 0.25 }}>
              {t('conditionalFormat.twoColor')}
            </ToggleButton>
            <ToggleButton value={3} sx={{ textTransform: 'none', pt: 0.25, pb: 0.25 }}>
              {t('conditionalFormat.threeColor')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </RuleSection>

      <RuleSection variant="config">
        {stops.map((stop, i) => (
          <ScaleStopRow
            key={i}
            label={t(labels[Math.min(i, labels.length - 1)])}
            stop={stop}
            allowedTypes={STOP_TYPES}
            showColor
            readOnly={readOnly}
            onStopChange={(next) => {
              const nextStops = stops.slice();
              nextStops[i] = next as IConditionalFormat.ColorScaleStop;
              onScaleChange({ ...scale, stops: nextStops });
            }}
          />
        ))}
      </RuleSection>
    </Box>
  );
});

ColorScaleRulePanel.displayName = 'ColorScaleRulePanel';
