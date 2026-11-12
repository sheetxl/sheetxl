import type React from 'react';
import { memo } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';

import { IFill, type IColor } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { GradientStopsBar, type GradientStopValue } from './GradientStopsBar';

export interface GradientValue {
  gradientType: IFill.GradientType;
  /**
   * Degrees, `0…359`, as CSS measures them: 0 runs upward, 90 to the right, clockwise. Only
   * meaningful for a linear gradient.
   */
  angle: number;
  stops: GradientStopValue[];
}

export interface GradientEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: GradientValue;
  onChange: (value: GradientValue) => void;
  /** The fewest stops the editor will leave. See {@link GradientStopsBarProps.minStops}. */
  minStops?: number;
  /** The most stops the editor will author. See {@link GradientStopsBarProps.maxStops}. */
  maxStops?: number;
  /** Theme color resolution for the stop pickers. */
  schemeLookup?: IColor.SchemeLookup;
  recentColors?: readonly IColor[] | (() => readonly IColor[]);
  darkMode?: boolean;
  disabled?: boolean;
}

/**
 * The gradient editor behind the Fill tab's Gradient mode: the style and angle, and the stops on
 * a ramp (see {@link GradientStopsBar}).
 *
 * @remarks
 * Excel's Fill Effects offers exactly two colors, six shading styles and three variants of each —
 * a fixed menu because its dialog is all it offers; the file it writes takes any number of stops,
 * and Excel draws them all. This authors the model directly instead: any number of stops at any
 * offset, linear at any angle or radial. A shape's Format pane in Excel has the same ramp.
 */
export const GradientEditor = memo((props: GradientEditorProps) => {
  const {
    value,
    onChange,
    minStops,
    maxStops,
    schemeLookup,
    recentColors,
    darkMode = false,
    disabled = false,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();

  const patch = useCallbackRef((delta: Partial<GradientValue>) => {
    onChange({ ...value, ...delta });
  }, [value, onChange]);

  const isLinear = value.gradientType === IFill.GradientType.Linear;

  return (
    <Box
      className={clsx('sxl-gradient-editor', propClassName)}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}
      {...rest}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 132, flex: '1 1 132px' }}>
          <InputLabel shrink>{t('fill.gradientStyle')}</InputLabel>
          <Select
            label={t('fill.gradientStyle')}
            notched
            disabled={disabled}
            value={value.gradientType}
            onChange={(e) => patch({ gradientType: e.target.value as IFill.GradientType })}
          >
            <MenuItem value={IFill.GradientType.Linear}>{t('fill.gradientLinear')}</MenuItem>
            <MenuItem value={IFill.GradientType.Path}>{t('fill.gradientRadial')}</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label={t('fill.gradientAngle')}
          type="number"
          size="small"
          disabled={disabled || !isLinear}
          value={value.angle}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10) || 0;
            patch({ angle: ((next % 360) + 360) % 360 });
          }}
          slotProps={{ htmlInput: { min: 0, max: 359, step: 15 }, inputLabel: { shrink: true } }}
          sx={{ width: 104 }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
          {t('fill.gradientStops')}
        </Typography>
        <GradientStopsBar
          stops={value.stops}
          onChange={(stops: GradientStopValue[]) => patch({ stops })}
          minStops={minStops}
          maxStops={maxStops}
          schemeLookup={schemeLookup}
          recentColors={recentColors}
          darkMode={darkMode}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
});

GradientEditor.displayName = 'GradientEditor';

/** Read the editor's shape out of a model gradient. */
export const toGradientValue = (fill: IFill.IGradient): GradientValue => {
  const stops = fill.getStops();
  return {
    gradientType: fill.getGradientType(),
    angle: fill.getAngle() ?? 0,
    // Fewer than two stops is not a gradient the editor can show a ramp for; fall back rather than
    // render a degenerate one-color control the user cannot fix.
    stops: stops.length >= 2
      ? stops.map((stop) => ({ offset: stop.getOffset(), color: stop.getColor().toString() }))
      : [...DEFAULT_GRADIENT.stops]
  };
};

/** What "switch this to a gradient" starts from — white to the first accent, left to right. */
export const DEFAULT_GRADIENT: GradientValue = Object.freeze({
  gradientType: IFill.GradientType.Linear,
  angle: 90,
  stops: [
    { offset: 0, color: 'ffffff' },
    { offset: 1, color: '4472c4' }
  ]
}) as GradientValue;
