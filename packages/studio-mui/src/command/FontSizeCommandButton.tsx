import React, {
  useEffect, useMemo, useState, memo, forwardRef, useCallback
} from 'react';

import clsx from 'clsx';

import { Theme, useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { TooltipProps } from '@mui/material';
import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import {
  Command, ICommand, ICommands, useCommand, useCommands, ICommandHook, useCallbackRef, KeyCodes
} from '@sheetxl/utils-react';

import {
  defaultCreatePopupPanel, ExhibitDivider, ExhibitMenuItem, ExhibitTooltip,
  ExhibitPopupIconButton, ExhibitPopupIconButtonProps, ExhibitQuickButtonProps, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { CommandButton, SelectedIcon } from '@sheetxl/utils-mui';

import { IFont, FontUtils } from '@sheetxl/sdk';


export interface FontSizeCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" | "createPopupPanel"> {
  command?: Command<number>;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  /**
   * defaults the the Excel fontSizes
   */
  fontSizes?: number[];

  /**
   * Show quickButtons. Requires commands to be set.
   * @defaultValue false
   */
  showQuickButtons?: boolean;

  commands?: ICommands.IGroup;
}

/**
 * TODO - add divider and increase/decrease as quick buttons??
 */
export const FontSizeCommandButton = memo(
  forwardRef<HTMLElement, FontSizeCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    commandHook: propCommandHook,
    showQuickButtons: _showQuickButtons = !!props.commands,
    commands: propCommands,
    fontSizes = FontUtils.DefaultFontSizes,
    disabled: propDisabled = false,
    parentFloat,
    icon: propIcon,
    label: propLabel,
    sx: propSx,
    ...rest
  } = props;

  // const variant = CommandButtonType.Menuitem;

  const _ = useCommand(command);

  const committedFontSize = () => {
    return command?.state()?.toString() || '11';
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

    command.execute(asNumber, propCommandHook);
  }, [committedFontSize, command, fontSize, propCommandHook]);

  useEffect(() => {
    setFontSize(committedFontSize());
  }, [command?.state()]);

  const commandHookNoBefore = useMemo(() => {
    if (!propCommandHook) return null;
    const retValue = {...propCommandHook};
    delete retValue.beforeExecute;
    return retValue;
  }, [propCommandHook]);

  const commandKeys:string[] = [
    'formatFontSizeIncrease',
    'formatFontSizeDecrease'
  ];
  const commands = useCommands(propCommands, commandKeys);
  const quickFormats = useMemo(() => {
    if (!commands)
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
        onClick={(e) => e.stopPropagation() } // Prevent the quick buttons from closing the menu
      >
        <CommandButton
          command={commands[0]}
          commandHook={commandHookNoBefore}
        />
        <CommandButton
          // {...buttonProps}
          command={commands[1]}
          commandHook={commandHookNoBefore}
        />
      </Box>
    );
  }, [commands]);

  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = '12.3';
    return `${IFont.getSharedMeasurer()(templateString, Math.round(appTheme.typography.fontSize), appTheme.typography.fontFamily).width}px`;
  }, [appTheme]);

  const createInputQuickButton = useCallback((props: ExhibitQuickButtonProps) => {
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
  }, [fontSize, propDisabled, command]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const handleSetFont = (newValue: number) => {
      command?.execute(newValue, propCommandHook);
    }

    const currentFontSize = command?.state();

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
    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, command?.state(), propCommandHook]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      sx={{
        ...propSx
      }}
      tabIndex={-1}
      outlined={true}
      disabled={propDisabled}
      parentFloat={parentFloat}
      createPopupPanel={createPopupPanel}
      createTooltip={({children}: TooltipProps, disabled: boolean) => {
        return (
          <ExhibitTooltip
            label={command?.label()}
            description={command?.description()}
            disabled={disabled || command?.disabled()}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      createQuickButton={createInputQuickButton}
      {...rest}
    />
  )
}));
