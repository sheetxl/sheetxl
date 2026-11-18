import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';

import { type IChart, type IColor } from '@sheetxl/sdk';

import { useCommands, useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { type CommandContext } from '@sheetxl/react';

import { ColorSetSwatch } from '../../color';

/** The color sets, by the numbers a chart knows them by: the colorful ones, then those of one color. */
const COLORFUL: readonly number[] = [10, 11, 12, 13];
const MONOCHROMATIC: readonly number[] = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

/** How many colors a set is shown by, in the gallery and on a button: a round of the theme's accents. */
const GALLERY_COLORS = 6;

/** Whether a set is one color in shades: drawn as a ramp, where a colorful set is drawn as chips. */
const isRamp = (scheme: number): boolean => MONOCHROMATIC.includes(scheme);

export interface ChartColorsSwatchProps {
  /** The colors, in order. */
  colors: readonly IColor[];
  /** `chips` for a colorful set, `ramp` for a set of one color. Default `chips`. */
  variant?: 'chips' | 'ramp';
  /** `medium` for a gallery, `icon` for a toolbar button. Default `medium`. */
  size?: 'icon' | 'medium';
}

/**
 * A chart's color set in small ({@link ColorSetSwatch}): a colorful set as chips, a set of one
 * color as a ramp. A chart is drawn on the page's white, so its colors are shown as they are there.
 */
export const ChartColorsSwatch = memo((props: ChartColorsSwatchProps) => {
  const { colors, variant, size } = props;
  return <ColorSetSwatch colors={colors.map(color => color.toCSS())} variant={variant} size={size}/>;
});

ChartColorsSwatch.displayName = 'ChartColorsSwatch';

export interface ChartColorsGalleryProps {
  /** The chart the sets are shown for, in its workbook's theme. */
  chart: IChart;
  /** The set marked as the chart's; `null` for none. Default: the one the chart's series are in. */
  selectedScheme?: number | null;
  disabled?: boolean;
  /** Called with the set pressed, 10 to 26. */
  onSelectScheme: (scheme: number) => void;
}

/**
 * The gallery of color sets, as Excel's Change Colors lists them: the colorful sets, which take the
 * theme's accents in turn, then the sets of one color, dark to light and light to dark. Each is
 * drawn in the chart's own theme, with the set the chart is in marked.
 */
export const ChartColorsGallery = memo((props: ChartColorsGalleryProps) => {
  const { chart, selectedScheme = chart.getColorScheme(), disabled, onSelectScheme } = props;
  const t = useTranslator();
  const rows = (schemes: readonly number[], name: (index: number) => string): React.ReactNode[] => schemes.map((scheme, index) => (
    <ExhibitIconButton
      key={scheme}
      data-chart-colors={scheme}
      aria-label={name(index + 1)}
      propsTooltip={{ description: name(index + 1) }}
      selected={scheme === selectedScheme}
      disabled={disabled}
      icon={<ChartColorsSwatch variant={isRamp(scheme) ? 'ramp' : 'chips'} colors={chart.getColorSchemePreview(scheme, GALLERY_COLORS)}/>}
      onClick={() => { onSelectScheme(scheme); }}
    />
  ));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', padding: '10px 16px' }}>
      <ExhibitMenuHeader>
        {t('chart.colors.colorful')}
      </ExhibitMenuHeader>
      <Box role="listbox" aria-label={t('chart.colors.colorful')} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', marginBottom: '6px' }}>
        {rows(COLORFUL, index => t('chart.colors.colorfulName', { index }))}
      </Box>
      <ExhibitDivider orientation="horizontal"/>
      <ExhibitMenuHeader>
        {t('chart.colors.monochromatic')}
      </ExhibitMenuHeader>
      <Box role="listbox" aria-label={t('chart.colors.monochromatic')} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
        {rows(MONOCHROMATIC, index => t('chart.colors.monochromaticName', { index }))}
      </Box>
    </Box>
  );
});

ChartColorsGallery.displayName = 'ChartColorsGallery';

export interface ChartColorsGalleryButtonProps extends CommandPopupButtonProps {
  /** The chart the sets are shown for; `null` while there is none. */
  chart: IChart | null;
  /** Called with the set pressed in the gallery, 10 to 26. */
  onSelectScheme: (scheme: number) => void;
  /** What the button's tooltip says. */
  tip?: { label?: React.ReactNode, description?: React.ReactNode };
}

/**
 * A button that opens the {@link ChartColorsGallery} and hands back the set pressed. What is done
 * with it is the caller's: the ribbon runs the chart's command, the chart's details write the chart.
 * The button shows six colors of the set the chart is in, or of the first set where its series
 * are in colors of their own.
 */
export const ChartColorsGalleryButton = memo(
  forwardRef<HTMLElement, ChartColorsGalleryButtonProps>((props, refForwarded) => {
  const {
    chart,
    onSelectScheme,
    tip,
    disabled: propDisabled,
    label,
    icon,
    ...rest
  } = props;
  const disabled = propDisabled || !chart;
  const selectedScheme = chart?.getColorScheme() ?? null;

  const handleSelect = useCallbackRef((scheme: number) => {
    onSelectScheme(scheme);
  }, [onSelectScheme]);

  const renderPopupPanel = useCallback(({ closeFloatAll }: ExhibitPopupPanelProps) => {
    if (!chart) return <></>;
    const onSelect = (scheme: number) => {
      closeFloatAll?.();
      handleSelect(scheme);
    };
    return <ChartColorsGallery chart={chart} selectedScheme={selectedScheme} disabled={disabled} onSelectScheme={onSelect}/>;
  }, [chart, selectedScheme, disabled]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip label={tip?.label as any} description={tip?.description as any} disabled={disabled}>
          {children}
        </ExhibitTooltip>
      )}
      label={label}
      disabled={disabled}
      selected={false}
      // The button shows the colors themselves, not a glyph: outlined, as the cell style button is.
      outlined={!icon && !!chart}
      icon={icon ?? (chart ? <ChartColorsSwatch size="icon" variant={isRamp(selectedScheme ?? 10) ? 'ramp' : 'chips'} colors={chart.getColorSchemePreview(selectedScheme ?? 10, GALLERY_COLORS)}/> : undefined)}
      {...rest}
    />
  );
}));

ChartColorsGalleryButton.displayName = 'ChartColorsGalleryButton';

export interface ChartColorsCommandButtonProps extends CommandPopupButtonProps {
}

/** The gallery of color sets on the selected chart's `chartColors` command: the ribbon's Change Colors. */
export const ChartColorsCommandButton = memo(
  forwardRef<HTMLElement, ChartColorsCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: propGroupKey,
    disabled: propDisabled,
    label: _propLabel,
    icon: _propIcon,
    ...rest
  } = props;
  const command = useCommands<number | null, CommandContext.Chart, number>(['chartColors'])[0];
  const chart = command?.getContext()?.chart() ?? null;

  const onSelectScheme = useCallbackRef((scheme: number) => {
    void command?.execute(scheme);
  }, [command]);

  return (
    <ChartColorsGalleryButton
      ref={refForwarded}
      chart={chart}
      onSelectScheme={onSelectScheme}
      tip={{ label: command?.getLabel(propGroupKey), description: command?.getDescription(propGroupKey) }}
      disabled={propDisabled ?? (!command || command.disabled())}
      {...rest}
    />
  );
}));

ChartColorsCommandButton.displayName = 'ChartColorsCommandButton';
