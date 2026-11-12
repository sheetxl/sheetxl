import { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';

import {
  useCommands, useCommandButtonEntry, useCallbackRef, useTranslator
} from '@sheetxl/utils-react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ExhibitIconButtonProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import {
  presetChartTypeDescriptor, PresetChartType, ThemedChartIcon, type ChartTypeDescriptor
} from '@sheetxl/react';

export interface InsertChartCommandButtonProps extends CommandPopupButtonProps {
}

interface PresetChartIconButtonProps extends ExhibitIconButtonProps {
  presetKey: PresetChartType;
  handleOnInsertChart: (descriptor: ChartTypeDescriptor) => void;
  size?: 'small' | 'medium' | 'large';
}

const PresetChartIconButton = memo((props: PresetChartIconButtonProps) => {
  const {
    presetKey,
    disabled,
    handleOnInsertChart,
    size = 'large',
    ...rest
  } = props;
  const t = useTranslator();
  const descriptor = presetChartTypeDescriptor(presetKey);
  if (!descriptor) {
    console.warn('no descriptor type', descriptor);
    return null;
  }

  const ChartIcon = descriptor.Icon;
  return (
    <ExhibitIconButton
      key={presetKey}
      propsTooltip={{
        description: t(descriptor.description)
      }}
      icon={
        <ThemedChartIcon
          size={size}
        >
          <ChartIcon/>
        </ThemedChartIcon>
      }
      onClick={() => { handleOnInsertChart(descriptor) }}
      {...rest}
    />
  );
});

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
    label: propLabel,
    icon: propIcon,
    ...rest
  } = props;
  const t = useTranslator();

  const resolvedCommands = useCommands<ChartTypeDescriptor>(['insertChart']);
  const entry = useCommandButtonEntry('insertChartOptions');

  const command = resolvedCommands[0];
  const disabled = propDisabled ?? command?.disabled();

  const handleOnInsertChart = useCallbackRef((preset: ChartTypeDescriptor) => {
    command?.execute(preset);
  }, [command, propGroupKey]);

  const renderPopupPanel = useCallback((_props: ExhibitPopupPanelProps) => {
    const buttonProps = {
      disabled,
      handleOnInsertChart
    }
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '4px', // TODO - size of rounded border from theme
          paddingBottom: '4px', // TODO - size of rounded border from theme
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            padding: '6px 16px'
          }}
        >
          <ExhibitMenuHeader>
            {t('chart.category.column')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Column} {...buttonProps} />
            <PresetChartIconButton presetKey={PresetChartType.ColumnStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.ColumnStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            {t('chart.category.line')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Line} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.LineStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.LineStackedPercent} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.LineMarkers} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.LineStackedMarkers} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.LineStackedPercentMarkers} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            {t('chart.category.pie')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Pie} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.PieDoughnut} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            {t('chart.category.bar')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Bar} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.BarStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.BarStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            {t('chart.category.area')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Area} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.AreaStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.AreaStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            {t('chart.category.scatter')}
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.ScatterMarkers} {...buttonProps}/>
            {/* <PresetChartIconButton presetKey={PresetChartType.ScatterLinesMarkersSmooth} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.ScatterLinesSmooth}/> {...buttonProps}*/}
            <PresetChartIconButton presetKey={PresetChartType.ScatterLinesMarkers} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.ScatterLines} {...buttonProps}/>
          </Box>
        </Box>
      </Box>
    );
  }, [propDisabled, t]);

  const ChartIcon = presetChartTypeDescriptor(PresetChartType.Column).Icon;
  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            // Tooltip chrome from the registered `insertChartOptions` entry (catalog-backed).
            label={entry?.getLabel?.()}
            description={entry?.getDescription?.()}
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      // TODO - add a insert chart quick Command
      label={command?.getLabel(propGroupKey) ?? t('chart.insertFallback')}
      disabled={disabled}
      selected={false}
      icon={
        <ThemedChartIcon
          // size={'small'}
        >
          <ChartIcon/>
        </ThemedChartIcon>
      }
      {...rest}
    />
  )

}));