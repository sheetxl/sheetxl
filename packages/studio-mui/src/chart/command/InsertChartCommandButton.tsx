import { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import {
  DynamicIcon, useCommands, useCommandButtonEntry, useCallbackRef, useTranslator
} from '@sheetxl/utils-react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ExhibitIconButtonProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import {
  presetChartTypeDescriptor, PresetChartType, chartIconKey, type ChartTypeDescriptor
} from '@sheetxl/react';

export interface InsertChartCommandButtonProps extends CommandPopupButtonProps {
}

export interface ChartTypeGalleryButtonProps extends CommandPopupButtonProps {
  /** Called with the type pressed in the gallery. */
  onSelectType: (descriptor: ChartTypeDescriptor) => void;
  /** What the button's tooltip says. */
  tip?: { label?: React.ReactNode, description?: React.ReactNode };
}

/** The gallery's sections, two to a row, each a category and its presets in order. */
const GALLERY: readonly { category: string, label: string, presets: readonly PresetChartType[] }[] = [
  { category: 'column', label: messageKey('chart.category.column'), presets: [PresetChartType.Column, PresetChartType.ColumnStacked, PresetChartType.ColumnStackedPercent] },
  { category: 'bar', label: messageKey('chart.category.bar'), presets: [PresetChartType.Bar, PresetChartType.BarStacked, PresetChartType.BarStackedPercent] },
  {
    category: 'line',
    label: messageKey('chart.category.line'),
    presets: [
      PresetChartType.Line, PresetChartType.LineStacked, PresetChartType.LineStackedPercent,
      PresetChartType.LineMarkers, PresetChartType.LineStackedMarkers, PresetChartType.LineStackedPercentMarkers
    ]
  },
  { category: 'area', label: messageKey('chart.category.area'), presets: [PresetChartType.Area, PresetChartType.AreaStacked, PresetChartType.AreaStackedPercent] },
  { category: 'pie', label: messageKey('chart.category.pie'), presets: [PresetChartType.Pie, PresetChartType.PieDoughnut, PresetChartType.PieOfPie, PresetChartType.BarOfPie] },
  {
    category: 'scatter',
    label: messageKey('chart.category.scatter'),
    presets: [
      PresetChartType.ScatterMarkers, PresetChartType.ScatterLinesMarkersSmooth, PresetChartType.ScatterLinesSmooth,
      PresetChartType.ScatterLinesMarkers, PresetChartType.ScatterLines, PresetChartType.Bubble
    ]
  },
  { category: 'statistical', label: messageKey('chart.category.statistical'), presets: [PresetChartType.Histogram, PresetChartType.Pareto, PresetChartType.BoxWhisker] },
  { category: 'hierarchical', label: messageKey('chart.category.hierarchical'), presets: [PresetChartType.Treemap, PresetChartType.Sunburst] },
  { category: 'radar', label: messageKey('chart.category.radar'), presets: [PresetChartType.Radar, PresetChartType.RadarMarkers, PresetChartType.RadarFilled] },
  { category: 'other', label: messageKey('chart.category.other'), presets: [PresetChartType.Waterfall, PresetChartType.Funnel] },
  { category: 'stock', label: messageKey('chart.category.stock'), presets: [PresetChartType.StockHLC, PresetChartType.StockOHLC, PresetChartType.StockVHLC, PresetChartType.StockVOHLC] },
  {
    category: 'surface',
    label: messageKey('chart.category.surface'),
    presets: [PresetChartType.Surface, PresetChartType.SurfaceWireframe, PresetChartType.SurfaceTopView, PresetChartType.SurfaceTopViewWireframe]
  }
];

interface PresetChartIconButtonProps extends ExhibitIconButtonProps {
  presetKey: PresetChartType;
  handleOnInsertChart: (descriptor: ChartTypeDescriptor) => void;
}

const PresetChartIconButton = memo((props: PresetChartIconButtonProps) => {
  const {
    presetKey,
    disabled,
    handleOnInsertChart,
    ...rest
  } = props;
  const t = useTranslator();
  const descriptor = presetChartTypeDescriptor(presetKey);
  if (!descriptor) {
    console.warn('no descriptor type', descriptor);
    return null;
  }

  return (
    <ExhibitIconButton
      key={presetKey}
      propsTooltip={{
        label: t(descriptor.description),
        description: t(descriptor.hint)
      }}
      icon={
        <DynamicIcon iconKey={chartIconKey(descriptor.type)} size="1.875rem"/>
      }
      onClick={() => { handleOnInsertChart(descriptor) }}
      {...rest}
    />
  );
});

/**
 * A button that opens the gallery of chart types and hands back the one pressed. What is done with
 * it is the caller's: the ribbon inserts a chart of it, the chart's details draw the chart as it.
 */
export const ChartTypeGalleryButton = memo(
  forwardRef<HTMLElement, ChartTypeGalleryButtonProps>((props, refForwarded) => {
  const {
    onSelectType,
    tip,
    disabled: propDisabled,
    label,
    icon,
    ...rest
  } = props;
  const t = useTranslator();
  const disabled = propDisabled;

  const handleOnInsertChart = useCallbackRef((preset: ChartTypeDescriptor) => {
    onSelectType(preset);
  }, [onSelectType]);

  const renderPopupPanel = useCallback(({ closeFloatAll }: ExhibitPopupPanelProps) => {
    const buttonProps = {
      disabled,
      handleOnInsertChart: (descriptor: ChartTypeDescriptor) => {
        closeFloatAll?.();
        handleOnInsertChart(descriptor);
      }
    }
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, auto)',
          columnGap: '24px',
          rowGap: '6px',
          padding: '10px 16px'
        }}
      >
        {GALLERY.map(section => (
          <Box key={section.category} data-chart-category={section.category} sx={{ display: 'flex', flexDirection: 'column' }}>
            <ExhibitMenuHeader>
              {t(section.label)}
            </ExhibitMenuHeader>
            <Box sx={{ display: 'flex', gap: '6px' }}>
              {section.presets.map(preset => <PresetChartIconButton key={preset} presetKey={preset} {...buttonProps}/>)}
            </Box>
          </Box>
        ))}
      </Box>
    );
  }, [propDisabled, t]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            label={tip?.label as any}
            description={tip?.description as any}
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      label={label}
      disabled={disabled}
      selected={false}
      icon={icon ?? chartIconKey('columnClustered')}
      {...rest}
    />
  )

}));

ChartTypeGalleryButton.displayName = 'ChartTypeGalleryButton';

/**
 * TODO -
 * Quick button for last chart (like last color)
 * Make tooltips
 */
export const InsertChartCommandButton = memo(
  forwardRef<HTMLElement, InsertChartCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: propGroupKey,
    disabled: propDisabled,
    label: _propLabel,
    icon: _propIcon,
    ...rest
  } = props;
  const t = useTranslator();

  const resolvedCommands = useCommands<ChartTypeDescriptor>(['insertChart']);
  // Tooltip chrome from the registered `insertChartOptions` entry (catalog-backed).
  const entry = useCommandButtonEntry('insertChartOptions');

  const command = resolvedCommands[0];
  const disabled = propDisabled ?? command?.disabled();

  const onSelectType = useCallbackRef((preset: ChartTypeDescriptor) => {
    command?.execute(preset);
  }, [command, propGroupKey]);

  return (
    <ChartTypeGalleryButton
      ref={refForwarded}
      onSelectType={onSelectType}
      tip={{ label: entry?.getLabel?.(), description: entry?.getDescription?.() }}
      // TODO - add a insert chart quick Command
      label={command?.getLabel(propGroupKey) ?? t('chart.insertFallback')}
      disabled={disabled}
      {...rest}
    />
  );
}));