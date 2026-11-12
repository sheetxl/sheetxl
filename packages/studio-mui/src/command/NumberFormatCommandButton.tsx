import type React from 'react';
import { useMemo, memo, forwardRef, useCallback } from 'react';

import { useTheme, type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { NumberFormat, type ICell } from '@sheetxl/sdk';

import { useCommands, useTranslator, KeyCodes, measureUIText } from '@sheetxl/utils-react';

import {
  defaultRenderPopupPanel,
  ExhibitDivider, ExhibitMenuItem, ExhibitTooltip, CommandPopupButton,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { SelectedIcon } from '@sheetxl/utils-mui';

// The row body this popup shares with the format pane's category dropdown. A value import is safe
// here: the module is a leaf (MUI + sdk only), unlike the pane itself.
import { NumberFormatOption, numberFormatTypeLabel } from '../format/NumberFormatOption';
// Type only: the format pane imports back into this folder (its Font/Fill panels use the color and
// font buttons), so a value import here would close a module cycle for one string.
import { type FormatTab } from '../format/FormatTaskPane';

import { NumberFormatQuickButtons, NUMBER_FORMAT_GROUP_KEY } from './NumberFormatQuickButtons';


const NumberFormatMenuItem = memo((props: any) => { // TODO - type
  const {
    selected,
    disabled,
    formattedValue,
    handleSetFormat,
    format,
    label: propLabel,
    sx: propSx,
    ...rest
  } = props;
  const t = useTranslator();
  return (
    <ExhibitMenuItem
      sx={{
        maxWidth: '360px', // TODO - make this the width of text for long date plus a bit
        display: 'flex',
        '*': {
          lineHeight: '1.4'
        },
        ...propSx
      }}
      disabled={disabled}
      selected={selected}
      // propsTooltip={{ // causes flicker at the moment
      //   description: (<><div>Set format to:</div><div style={{}}>{format.formatCode}</div></>),
      //   maxWidth: 1000
      // }}
      // Unselected rows keep SelectedIcon's (transparent) border so every label starts in one column.
      icon={<SelectedIcon selected={!!selected}>{selected ? undefined : null}</SelectedIcon>}
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
      <NumberFormatOption
        label={propLabel ?? numberFormatTypeLabel(t, format.formatType)}
        sample={formattedValue}
      />
    </ExhibitMenuItem>
  )
});
NumberFormatMenuItem.displayName = 'NumberFormatMenuItem';

export interface NumberFormatCommandButtonProps extends CommandPopupButtonProps {
}

export const NumberFormatCommandButton = memo(
  forwardRef<HTMLElement, NumberFormatCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey,
    sx: propSx,
    disabled: propDisabled,
    ...rest
  } = props;

  const commandKeys:string[] = [
    'formatNumberFormat',
    'formatCells'
  ];
  const resolvedCommands = useCommands<string, ICell>(commandKeys);
  const command = resolvedCommands[0];
  const commandNumberDialog = resolvedCommands[1];
  const state = command?.getState();
  const currentFormatType = state ? NumberFormat.Styles.lookupStyle(state).formatType : undefined;

  const t = useTranslator();
  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    // Size to the localized 'General' label. `t` is in the deps because until the
    // language pack loads it returns the (much longer) raw KEY, so the measurement
    // MUST recompute once the real string arrives — otherwise the button freezes
    // at the key's width.
    const templateString = numberFormatTypeLabel(t, NumberFormat.Type.General);
    const width = measureUIText(templateString ?? '', { size: Math.round(appTheme.typography.fontSize), family: appTheme.typography.fontFamily ?? '' });
    return `${width * 2}px`;
  }, [appTheme, t]);


  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const handleSetFormat = (newValue: string) => {
      // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
      command?.execute(newValue);
    }

    const currentCell:ICell | undefined = command?.getContext();

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
        formattedValue = t('numberFormat.noSpecificFormat');
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
        // The command's own label, scoped to this popup ("More Number Formats…"). It is the same
        // Format Cells command the menus and Ctrl+1 run, so the wording lives in the language pack
        // rather than being rebuilt here from the Custom category name.
        label={commandNumberDialog?.getLabel(NUMBER_FORMAT_GROUP_KEY)}
        formattedValue={isCustom && currentCell ? currentCell.getNumberFormat().displayText : ''}
        handleSetFormat={() => {
          // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
          commandNumberDialog?.execute('number' satisfies FormatTab);
        }}
        format={customFormatStyle}
        sx={{
          flex: '0',
          width: '100%'
        }}
      />
    );
    const quickFormats = (
      <NumberFormatQuickButtons
        groupKey={groupKey}
      />
    );
    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
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

    return defaultRenderPopupPanel({ ...props, children});
  }, [command?.getContext(), state, propDisabled, groupKey, t]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      sx={propSx}
      outlined={true}
      disabled={propDisabled ?? (!command || command.disabled())}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            label={command?.getLabel()}
            description={command?.getDescription()}
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
            lineHeight: 1.2,
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
            {currentFormatType ? numberFormatTypeLabel(t, currentFormatType) : ''}
          </Box>
        </Box>
      } // <NumbersIcon/>
      {...rest}
    />
  )
}));
NumberFormatCommandButton.displayName = 'NumberFormatCommandButton';
