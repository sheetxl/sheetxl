import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';

import { type IChart } from '@sheetxl/sdk';

import { useCommands, useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import {
  chartIconKey, type CommandContext, type ChartTypeDescriptor
} from '@sheetxl/react';

import { ChartTypeGalleryButton } from './InsertChartCommandButton';

/** The preset styles, 1 to 48, as Excel's gallery laid them out: eight to a row. */
const STYLE_COUNT = 48;
const STYLES_PER_ROW = 8;

/** The heights of a swatch's bars, of a plot 14 high. */
const BAR_HEIGHTS: readonly number[] = [7, 12, 9];

export interface ChartStyleSwatchProps {
  preview: IChart.StylePreview;
  /**
   * How large it is drawn: `medium` for a gallery, `icon` for a toolbar button, where it is as
   * tall as the toolbar's other icons (`--icon-size`, which follows the density) so the toolbar
   * keeps its height, as the cell style button's preview is. Default `medium`.
   */
  size?: 'icon' | 'medium';
}

/**
 * A preset chart style in small: three bars in the colors it gives the first three series, on the
 * plot area it draws, with a baseline as heavy as its lines.
 */
export const ChartStyleSwatch = memo((props: ChartStyleSwatchProps) => {
  const { preview, size = 'medium' } = props;
  const colors = preview.seriesColors;
  // A chart is drawn on the page's white whatever the app's own colors are.
  return (
    <svg
      viewBox="0 0 34 24"
      aria-hidden
      focusable={false}
      style={size === 'icon'
        ? { display: 'block', height: 'var(--icon-size, 16px)', width: 'auto', aspectRatio: '34 / 24', marginRight: '4px' }
        : { display: 'block', width: 34, height: 24 }}
    >
      <rect x={0.5} y={0.5} width={33} height={23} rx={2} fill="#FFFFFF" stroke="#D9D9D9"/>
      {preview.plotAreaColor ? <rect x={4} y={4} width={26} height={15} fill={preview.plotAreaColor.toCSS()}/> : null}
      {BAR_HEIGHTS.map((height, index) => (
        <rect key={index} x={6 + index * 8} y={19 - height} width={6} height={height} fill={colors[index % colors.length]?.toCSS() ?? '#808080'}/>
      ))}
      <rect x={4} y={19} width={26} height={Math.max(1, preview.lineWidth / 3)} fill="#7F7F7F"/>
    </svg>
  );
});

ChartStyleSwatch.displayName = 'ChartStyleSwatch';

export interface ChartStyleGalleryProps {
  /** The chart the styles are shown for, in its workbook's theme. */
  chart: IChart;
  /** The style marked as the chart's. Default: the one the chart is in. */
  selectedStyle?: number;
  disabled?: boolean;
  /** Called with the style pressed, 1 to 48. */
  onSelectStyle: (style: number) => void;
}

/**
 * The gallery of preset chart styles: the 48 a chart's file names (`c:style`), eight to a row, each
 * drawn as the chart's own theme draws it, with the chart's own marked.
 *
 * @remarks
 * A column of grays, a column of the theme's colors, and a column for each of its six accents, in
 * six rows that differ by the weight of their lines and the plot area's fill.
 */
export const ChartStyleGallery = memo((props: ChartStyleGalleryProps) => {
  const { chart, selectedStyle = chart.getChartStyle(), disabled, onSelectStyle } = props;
  const t = useTranslator();
  const buttons: React.ReactNode[] = [];
  for (let style=1; style<=STYLE_COUNT; style++) {
    buttons.push(
      <ExhibitIconButton
        key={style}
        data-chart-style={style}
        aria-label={t('chart.style.name', { index: style })}
        propsTooltip={{ description: t('chart.style.name', { index: style }) }}
        selected={style === selectedStyle}
        disabled={disabled}
        icon={<ChartStyleSwatch preview={chart.getChartStylePreview(style)}/>}
        onClick={() => { onSelectStyle(style); }}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', padding: '10px 16px' }}>
      <ExhibitMenuHeader>
        {t('chart.style.title')}
      </ExhibitMenuHeader>
      <Box role="listbox" aria-label={t('chart.style.title')} sx={{ display: 'grid', gridTemplateColumns: `repeat(${STYLES_PER_ROW}, auto)`, gap: '4px' }}>
        {buttons}
      </Box>
    </Box>
  );
});

ChartStyleGallery.displayName = 'ChartStyleGallery';

export interface ChartStyleGalleryButtonProps extends CommandPopupButtonProps {
  /** The chart the styles are shown for, in its workbook's theme; `null` while there is none. */
  chart: IChart | null;
  /** Called with the style pressed in the gallery, 1 to 48. */
  onSelectStyle: (style: number) => void;
  /** What the button's tooltip says. */
  tip?: { label?: React.ReactNode, description?: React.ReactNode };
}

/**
 * A button that opens the {@link ChartStyleGallery} and hands back the style pressed. What is done
 * with it is the caller's: the ribbon runs the chart's command, the chart's details write the chart.
 * The button shows the style the chart is in.
 */
export const ChartStyleGalleryButton = memo(
  forwardRef<HTMLElement, ChartStyleGalleryButtonProps>((props, refForwarded) => {
  const {
    chart,
    onSelectStyle,
    tip,
    disabled: propDisabled,
    label,
    icon,
    ...rest
  } = props;
  const disabled = propDisabled || !chart;
  const selectedStyle = chart?.getChartStyle();

  const handleSelect = useCallbackRef((style: number) => {
    onSelectStyle(style);
  }, [onSelectStyle]);

  const renderPopupPanel = useCallback(({ closeFloatAll }: ExhibitPopupPanelProps) => {
    if (!chart) return <></>;
    const onSelect = (style: number) => {
      closeFloatAll?.();
      handleSelect(style);
    };
    return <ChartStyleGallery chart={chart} selectedStyle={selectedStyle} disabled={disabled} onSelectStyle={onSelect}/>;
  }, [chart, selectedStyle, disabled]);

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
      // The button shows the style itself, not a glyph: outlined, as the cell style button is.
      outlined={!icon && !!chart}
      icon={icon ?? (chart && selectedStyle !== undefined ? <ChartStyleSwatch size="icon" preview={chart.getChartStylePreview(selectedStyle)}/> : 'PresetStyles')}
      {...rest}
    />
  );
}));

ChartStyleGalleryButton.displayName = 'ChartStyleGalleryButton';

export interface ChartStyleCommandButtonProps extends CommandPopupButtonProps {
}

/** The gallery of chart styles on the selected chart's `chartStyle` command: the ribbon's Chart Styles. */
export const ChartStyleCommandButton = memo(
  forwardRef<HTMLElement, ChartStyleCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: propGroupKey,
    disabled: propDisabled,
    label: _propLabel,
    icon: _propIcon,
    ...rest
  } = props;
  const command = useCommands<number, CommandContext.Chart, number>(['chartStyle'])[0];
  const chart = command?.getContext()?.chart() ?? null;

  const onSelectStyle = useCallbackRef((style: number) => {
    void command?.execute(style);
  }, [command]);

  return (
    <ChartStyleGalleryButton
      ref={refForwarded}
      chart={chart}
      onSelectStyle={onSelectStyle}
      tip={{ label: command?.getLabel(propGroupKey), description: command?.getDescription(propGroupKey) }}
      disabled={propDisabled ?? (!command || command.disabled())}
      {...rest}
    />
  );
}));

ChartStyleCommandButton.displayName = 'ChartStyleCommandButton';

export interface ChangeChartTypeCommandButtonProps extends CommandPopupButtonProps {
}

/**
 * The gallery of chart types on the selected chart's `chartChangeType` command: the ribbon's Change
 * Chart Type. It shows the type the chart is drawn as, and a type pressed draws every series as it.
 */
export const ChangeChartTypeCommandButton = memo(
  forwardRef<HTMLElement, ChangeChartTypeCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: propGroupKey,
    disabled: propDisabled,
    label: _propLabel,
    icon: _propIcon,
    ...rest
  } = props;
  const command = useCommands<string, CommandContext.Chart, ChartTypeDescriptor | string>(['chartChangeType'])[0];
  const type = command?.getState();

  const onSelectType = useCallbackRef((descriptor: ChartTypeDescriptor) => {
    void command?.execute(descriptor);
  }, [command]);

  return (
    <ChartTypeGalleryButton
      ref={refForwarded}
      onSelectType={onSelectType}
      tip={{ label: command?.getLabel(propGroupKey), description: command?.getDescription(propGroupKey) }}
      icon={type ? chartIconKey(type) : undefined}
      disabled={propDisabled ?? (!command || command.disabled())}
      {...rest}
    />
  );
}));

ChangeChartTypeCommandButton.displayName = 'ChangeChartTypeCommandButton';
