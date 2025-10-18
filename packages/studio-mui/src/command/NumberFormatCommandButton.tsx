import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { alpha } from '@mui/system';
import { Theme, useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';
import { TooltipProps } from '@mui/material';

import { ICell, NumberFormat, IFont } from '@sheetxl/sdk';

import { useCommands, KeyCodes, ICommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButtonProps, defaultCreatePopupPanel, ExhibitPopupPanelProps,
  ExhibitDivider, ExhibitMenuItem, ExhibitTooltip, CommandPopupButton
} from '@sheetxl/utils-mui';

import { SelectedIcon } from '@sheetxl/utils-mui';



const NumberFormatMenuItem = memo((props: any) => { // TODO - type
  const {
    selected,
    disabled,
    formattedValue,
    handleSetFormat,
    format,
    sx: propSx,
    ...rest
  } = props;
  return (
    <ExhibitMenuItem
      sx={{
        maxWidth: '360px', // TODO - make this the width of text for long date plus a bit
        display: 'flex',
        '*': {
          lineHeight: '1.2'
        },
        ...propSx
      }}
      disabled={disabled}
      selected={selected}
      // propsTooltip={{ // causes flicker at the moment
      //   description: (<><div>Set format to:</div><div style={{}}>{format.formatCode}</div></>),
      //   maxWidth: 1000
      // }}
      icon={selected ? <SelectedIcon/> : undefined}
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
      onMouseUp={(e) => { if (e.button !== 0) return; handleSetFormat(format.numberFormat) }}
      onKeyDown={(e: React.KeyboardEvent) => {
        // button prevents space so we don't check it
        // if (e.isDefaultPrevented()) return;
        if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
          handleSetFormat(format.numberFormat);
        }
      }}
      {...rest}
    >
      <Box
        sx={{
        // bold and larger
          display: 'flex',
          flex: '1 1 100%',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Typography
          component="div"
        >
          {format.formatType}{format.formatType === NumberFormat.Type.Custom ? '\u2026' : ''}
        </Typography>
        <Typography
          variant="caption"
          component="div"
          sx={{
            // whiteSpace: 'pre-wrap', {/* uncomment if we want to preserve height */}
            color: (theme: Theme) => {
              return alpha(theme.palette.text.primary, .6)
            },
            paddingTop: formattedValue && formattedValue.length > 0 ? '1px' : undefined,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {formattedValue && formattedValue.length > 0 ? formattedValue : ' '}
        </Typography>
      </Box>
    </ExhibitMenuItem>
  )
});

export interface NumberFormatCommandButtonProps extends CommandPopupButtonProps {
}

export const NumberFormatCommandButton = memo(
  forwardRef<HTMLElement, NumberFormatCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    sx: propSx,
    disabled: propDisabled = false,
    parentFloat,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatNumberFormat'
  ];
  const resolvedCommands = useCommands<string, () => ICell>(propCommands, commandKeys);
  const command = resolvedCommands[0];
  const currentFormatType = command?.state() ? NumberFormat.Styles.lookupStyle(command?.state()).formatType : NumberFormat.Type.General;

  const commandHookNoBefore = useMemo(() => {
    if (!propCommandHook) return null;
    const retValue = {...propCommandHook};
    delete retValue.beforeExecute;
    return retValue;
  }, [propCommandHook]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const handleSetFormat = (newValue: string) => {
      // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
      propCommandHook?.beforeExecute?.(command, command?.state());
      command.execute(newValue, propCommandHook);
      propCommandHook?.onExecute?.(command, command?.state());
    }

    const currentCell:ICell = command?.context()();

    const formats = NumberFormat.Styles.lookupPrimary();
    const formatOptions = [];
    for (let i=0; i<formats.length; i++) {
      let formattedValue = '';
      if (currentCell && !currentCell.isEmpty()) {
        try {
          const parsed = currentCell.getNumberFormat(formats[i].numberFormat);
          formattedValue = parsed.displayText;
        } catch (error: any) {
          console.warn(error);
        };
      }
      if (formattedValue === '' && formats[i].formatType === NumberFormat.Type.General)
        formattedValue = 'No specific format';
      const selected = formats[i].formatType === currentFormatType;
      formatOptions.push(
        <NumberFormatMenuItem
          key={formats[i].formatType}
          selected={selected}
          disabled={propDisabled || !command || command.disabled()}
          formattedValue={formattedValue}
          handleSetFormat={handleSetFormat}
          format={formats[i]}
        />
      )
    }
    const customFormatStyle:NumberFormat.Style = {
      numberFormat: '',
      formatType: NumberFormat.Type.Custom,
    }

    const isCustom = currentFormatType === NumberFormat.Type.Custom;
    const customOption = (
      <NumberFormatMenuItem
        key={NumberFormat.Type.Custom}
        selected={isCustom}
        disabled={propDisabled || !command || command.disabled()}
        formattedValue={isCustom ? currentCell.getNumberFormat().displayText : ''}
        handleSetFormat={() => {
          // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
          propCommandHook?.beforeExecute?.(command, command?.state());
          commands.getCommand('formatNumberDialog')?.execute(command?.state());
          propCommandHook?.onExecute?.(command, command?.state());
        }}
        format={customFormatStyle}
        sx={{
          flex: '0',
          width: '100%'
        }}
      />
    );
    const quickFormats = (
      <Box
        className="quick-buttons"
        sx={{
          display:'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={(e) => e.stopPropagation() } // Prevent the quick buttons from closing the menu
      >
        <CommandButton
          // {...buttonProps}
          command={commands.getCommand('formatNumberFormatAccountingStyle')}
          commandHook={commandHookNoBefore}
          scope={scope}
        />
        <CommandButton
          // {...buttonProps}
          command={commands.getCommand('formatNumberFormatPercentStyle')}
          commandHook={commandHookNoBefore}
          scope={scope}
        />
        <CommandButton
          // {...buttonProps}
          command={commands.getCommand('formatNumberFormatCommaStyle')}
          commandHook={commandHookNoBefore}
          scope={scope}
        />
        <CommandButton
          // {...buttonProps}
          command={commands.getCommand('formatNumberFormatIncreaseDecimal')}
          commandHook={commandHookNoBefore}
          scope={scope}
        />
        <CommandButton
          // {...buttonProps}
          command={commands.getCommand('formatNumberFormatDecreaseDecimal')}
          commandHook={commandHookNoBefore}
          scope={scope}
        />
      </Box>
    );
    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
        {...rest}
      >
        {quickFormats}
        <ExhibitDivider orientation="horizontal"/>
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {formatOptions}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
        {customOption}
      </Box>
    );

    return defaultCreatePopupPanel({ ...props, children});
  }, [command?.context(), command?.state(), propCommandHook, scope]);


  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = NumberFormat.Type.MediumTime;
    return `${IFont.getSharedMeasurer()(templateString, Math.round(appTheme.typography.fontSize), appTheme.typography.fontFamily).width}px`;
  }, [appTheme]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      sx={propSx}
      outlined={true}
      disabled={propDisabled}
      parentFloat={parentFloat}
      createPopupPanel={createPopupPanel}
      createTooltip={({children}: TooltipProps, disabled: boolean) => {
        return (
          <ExhibitTooltip
            label={command?.label()}
            description={command?.description()}
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      icon={
        <Box
          sx={{
            display: 'flex',
            paddingLeft: '4px',
            paddingRight: '4px',
            fontSize: (theme: Theme) => {
              return `${Math.round(theme.typography.fontSize)}px`;
            },
            color: (theme: Theme) => theme.palette.text.secondary,
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            width: defaultWidth
          }}
        >
          <Box
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'pre'
            }}
          >
            {currentFormatType}
          </Box>
        </Box>
      } // <NumbersIcon/>
      {...rest}
    />
  )
}));
