import React, { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';
import { TooltipProps } from '@mui/material';

import {
  Command, ICommands, useCommands, useCallbackRef, ICommandHook
} from '@sheetxl/utils-react';

import {
  ThemedIcon, CommandPopupButtonProps, ExhibitPopupPanelProps, ExhibitMenuHeader,
  ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitIconButtonProps,
  ExhibitDivider
} from '@sheetxl/utils-mui';

import {
  ChartTypeDescriptor, PresetChartType, presetChartTypeDescriptor
} from '../PresetChartTypeDescriptors';

export interface InsertChartCommandButtonProps extends CommandPopupButtonProps {
  commands: ICommands.IGroup;

  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
   commandHook?: ICommandHook<any, any>;
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
        description: descriptor.description
      }}
      icon={
        <ThemedIcon
          size={size}
        >
          <ChartIcon
            style={{
              width: '100%',
              height: '100%'
            }}
            />
        </ThemedIcon>
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
    commands: propCommands,
    scope: propScope,
    commandHook,
    disabled: propDisabled = false,
    label: propLabel,
    icon: propIcon,
    ...rest
  } = props;

  const resolvedCommands = useCommands<ChartTypeDescriptor>(propCommands, [
    'insertChart'
  ]);

  const command = resolvedCommands[0] as Command<ChartTypeDescriptor>;
  const disabled = propDisabled || command?.disabled();

  const handleOnInsertChart = useCallbackRef((preset: ChartTypeDescriptor) => {
    command?.execute(preset, commandHook);
  }, [command, commandHook, propScope]);

  const createPopupPanel = useCallback((_props: ExhibitPopupPanelProps, _commands: ICommands.IGroup) => {
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
            Column
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Column} {...buttonProps} />
            <PresetChartIconButton presetKey={PresetChartType.ColumnStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.ColumnStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            Line
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
            Pie
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Pie} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.PieDoughnut} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            Bar
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Bar} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.BarStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.BarStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            Area
          </ExhibitMenuHeader>
          <Box sx={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <PresetChartIconButton presetKey={PresetChartType.Area} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.AreaStacked} {...buttonProps}/>
            <PresetChartIconButton presetKey={PresetChartType.AreaStackedPercent} {...buttonProps}/>
          </Box>
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader>
            Scatter
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
  }, [propDisabled]);

  const ChartIcon = presetChartTypeDescriptor(PresetChartType.Column).Icon;
  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      createPopupPanel={createPopupPanel}
      createTooltip={({children}: TooltipProps, disabled: boolean) => {
        return (
          <ExhibitTooltip
            label="Insert Chart"
            description="Insert a chart to visually explore the selected data."
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      // TODO - add a insert chart quick Command
      label={command?.label(propScope) ?? `Insert Chart...`}
      disabled={disabled}
      selected={false}
      icon={
        <ThemedIcon
          // size={'small'}
        >
          <ChartIcon/>
        </ThemedIcon>
      }
      {...rest}
    />
  )

}));