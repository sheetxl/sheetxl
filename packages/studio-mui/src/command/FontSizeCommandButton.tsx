import type React from 'react';
import {
  useEffect, useMemo, useState, memo, forwardRef, useCallback
} from 'react';

import clsx from 'clsx';

import { useTheme, type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import {
  useCommands, useCallbackRef, useTextSelectionDrag, KeyCodes, measureUIText
} from '@sheetxl/utils-react';

import {
  defaultRenderPopupPanel, ExhibitDivider, ExhibitMenuItem, ExhibitTooltip, ExhibitPopupIconButton,
  type ExhibitPopupIconButtonProps, type ExhibitQuickButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { CommandButton, SelectedIcon } from '@sheetxl/utils-mui';

import { FontUtils } from '@sheetxl/sdk';


export interface FontSizeCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" | "renderPopupPanel"> {
  commandKey?: string;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);
  /**
   * defaults the the Excel fontSizes
   */
  fontSizes?: number[];

  /**
   * Show quickButtons. Requires commands to be set.
   * @defaultValue false
   */
  showQuickButtons?: boolean;
}

/**
 * TODO - add divider and increase/decrease as quick buttons??
 */
export const FontSizeCommandButton = memo(
  forwardRef<HTMLElement, FontSizeCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    showQuickButtons: _showQuickButtons,
    fontSizes = FontUtils.DefaultFontSizes,
    disabled: propDisabled,
    icon: propIcon,
    label: propLabel,
    sx: propSx,
    ...rest
  } = props;

  // const variant = CommandButtonType.Menuitem;

  const [command] = useCommands([commandKey ?? '']);

  const committedFontSize = () => {
    return command?.getState()?.toString() || '11';
  }

  const [fontSize, setFontSize] = useState<string>(committedFontSize);

  const commitNewFont = useCallbackRef(() => {
    const asNumber = parseFloat(fontSize);
    if (isNaN(asNumber)) { // revert back to original value (blank is an example)
      setFontSize(committedFontSize());
      return;
    }
    // If the same don't commit
    if (parseFloat(committedFontSize()) === asNumber)
      return;

    command?.execute(asNumber);
  }, [committedFontSize, command, fontSize]);

  useEffect(() => {
    setFontSize(committedFontSize());
  }, [command?.getState()]);

  const commandKeys:string[] = [
    'formatFontSizeIncrease',
    'formatFontSizeDecrease'
  ];

  const quickFormats = useMemo(() => {
    if (!commandKeys)
      return null;
    return (
      <Box
        className={clsx('quick-buttons', {
        // ['Mui-selected']: isOpen,
        // ['Mui-hovered']: isHovered',
        })}
        sx={{
          display:'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <CommandButton
          commandKey={commandKeys[0]}
        />
        <CommandButton
          // {...buttonProps}
          commandKey={commandKeys[1]}
        />
      </Box>
    );
  }, [commandKeys]);

  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = '12.3';
    return `${measureUIText(templateString, { size: Math.round(appTheme.typography.fontSize), family: appTheme.typography.fontFamily ?? '' })}px`;
  }, [appTheme]);

  const isDisabled = propDisabled ?? (!command || command.disabled());

  const textDrag = useTextSelectionDrag();

  const renderInputQuickButton = useCallback((props: ExhibitQuickButtonProps) => {
    const {
      onMouseDown,
      onMouseUp,
      ...rest
    } = props;
    // TODO - allow for this to not have to be wrapped in an icon button. (we look borders at the moment)
    return (
      <IconButton
        component="div"
        {...rest}
        disableRipple={true}
      >
        <Input
          inputMode={'numeric'}
          disabled={propDisabled || !command || command.disabled()}
          inputProps={{
            name: "font-input",
            autoComplete: "off",
            // The toolbar around the field is `user-select: none`, which a browser reads as a veto on a
            // drag-select the moment the pointer leaves the field. Suspended for the length of the press.
            onPointerDown: textDrag.onPointerDown,
            onDragStart: textDrag.onDragStart,
            tabIndex: 0,
            type: "number",
            maxLength: 4, // Not honored for inputType number so we manage in onchange and keypress
            max: 409,
            min: 2
          }}
          sx={{
            "&::before": {
              borderBottom: "1px solid transparent" // default
            },
            "&:hover:not(.Mui-disabled):not(.Mui-focused):not(.Mui-error):before": { // hover
              borderBottom: (theme: Theme) => `1px solid ${(theme.palette.text as any).icon ?? theme.palette.action.active}`
            },
            "&:hover:not(.Mui-disabled):not(.Mui-error):before": { // focused
              borderBottom: (theme: Theme) => `1px solid ${theme.palette.error.main}`
            },
            "::after": { // not sure
              borderBottom: (theme: Theme) => `1px solid ${theme.palette.primary.main}`
            },
            paddingTop: '0px',
            paddingBottom: '0px',
            paddingLeft: '0px',
            paddingRight: '0px',
            fontSize: (theme: Theme) => {
              return `${Math.round(theme.typography.fontSize)}px`;
            },
            width: defaultWidth,
            color: (theme: Theme) => theme.palette.text.secondary,
            'input': {
              padding: '0 0',
              textAlign: 'center',
              height: '1rem',
              'MozAppearance': 'textfield',
              "&:hover:not(.Mui-disabled):not(.Mui-error)": { // hover
                color: (theme: Theme) => theme.palette.text.primary,
              },
              "&:focus:not(.Mui-disabled):not(.Mui-error)": { // focused
                color: (theme: Theme) => theme.palette.text.primary,
              }
            },
            'input::-webkit-inner-spin-button': {
              'WebkitAppearance': 'none',
              margin: '0'
            }
          }}

          value={fontSize}
          onFocus={(e:React.FocusEvent<HTMLInputElement>) => {
            // setTimeout(() => {
              e.target?.select();
            // }, 0);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if ((e.which === KeyCodes.Enter)) {
              if (committedFontSize() !== fontSize) {
                e.stopPropagation();
                e.preventDefault();
                commitNewFont();
              }
            } else if ((e.which === KeyCodes.Escape)) {
              if (committedFontSize() !== fontSize) {
                setFontSize(committedFontSize());
                setTimeout(() => {
                  (e.target as any)?.select();
                }, 0);
                e.stopPropagation();
                e.preventDefault();
              }
            } else if (e.key.match('[-]')) { // disallow negatives
              e.stopPropagation();
              e.preventDefault();
              return;
            } else if (e.key.match('[0-9.]') && (fontSize + e.key).length > 4) {
              e.stopPropagation();
              e.preventDefault();
              return;
            } else if ((e.which === KeyCodes.Space)) {
              // e.stopPropagation();
              e.preventDefault();
              return;
            }
          }}
          onBlur={() => {
            commitNewFont();
          }}
          onChange={(e) => {
            if (e.target.value.length > 4) {
              e.stopPropagation();
              e.preventDefault();
              return;
            }
            setFontSize(e.target.value);
          }}
        />
      </IconButton>
      );
  }, [fontSize, isDisabled, command, textDrag]);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const handleSetFont = (newValue: number) => {
      command?.execute(newValue);
    }

    const currentFontSize = command?.getState();

    const menus = [];
    for (let i=0; i<fontSizes.length; i++) {
      const selected = fontSizes[i] === currentFontSize;
      menus.push(
        <ExhibitMenuItem
          key={'fontSize-' + i}
          selected={selected}
          icon={selected ? <SelectedIcon/> : undefined}
          disabled={propDisabled || !command || command.disabled()}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onMouseUp={(e) => { if (e.button !== 0) return; handleSetFont(fontSizes[i]) }}
          onKeyDown={(e: React.KeyboardEvent) => {
            // button prevents space so we don't check it
            // if (e.isDefaultPrevented()) return;
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
              handleSetFont(fontSizes[i]);
            }
          }}
          sx={{
            paddingTop: '4px',
            paddingBottom: '4px'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flex: '1 1 100%',
              justifyContent: 'end'
            }}
          >
            {fontSizes[i]}
          </Box>
        </ExhibitMenuItem>
      );
    }

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
          {menus}
        </Box>
      </Box>
    );
    return defaultRenderPopupPanel({...props, children});
  }, [isDisabled, command]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      sx={{
        ...propSx
      }}
      tabIndex={-1}
      outlined={true}
      disabled={isDisabled}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            label={command?.getLabel()}
            description={command?.getDescription()}
            disabled={disabled || command?.disabled()}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      renderQuickButton={renderInputQuickButton}
      {...rest}
    />
  )
}));
