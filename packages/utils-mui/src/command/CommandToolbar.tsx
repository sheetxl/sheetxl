import React, {
  useState, useMemo, memo, forwardRef, useCallback, useReducer
} from 'react';

import { Theme } from '@mui/material/styles';
import  { Box, type BoxProps } from '@mui/material';
import { Toolbar, type ToolbarProps } from '@mui/material';
import { Typography } from '@mui/material';

import {
  ICommands, useCommands, KeyCodes, ICommand, useImperativeElement,
  type CommandButtonOptions, DynamicIcon
} from '@sheetxl/utils-react';

import { useFloatStack, FloatReference } from '../float';

export interface CommandToolbarPopupButtonProps extends CommandButtonOptions {
  parentFloat: FloatReference;

  commands: ICommands.IGroup;
}

export interface CommandToolbarButtonProps {
  commands: ICommands.IGroup;

  propsCommandButton: CommandButtonOptions;

  propsCommandPopup: CommandToolbarPopupButtonProps;
}

export interface CommandToolbarProps extends ToolbarProps {
  commands: ICommands.IGroup;

  propsCommandButton?: CommandButtonOptions;

  parentFloat?: FloatReference;

  renderToolbarPalette?: (props: CommandToolbarButtonProps) => React.ReactNode;

  ref?: React.Ref<HTMLDivElement>;
}

export interface CommandToolbarAttributes {
}

export interface ICommandToolbarElement extends HTMLDivElement, CommandToolbarAttributes {};

export interface LabelIconProps extends BoxProps {
  scope?: string
  command?: ICommand<any, any>;
  label?: React.ReactElement<any> | string;
  icon?: React.ReactElement<any>;
}

const DefaultIcon = <DynamicIcon iconKey="Check"/>;
export const LabelIcon = (props: LabelIconProps) => {
  const {
    command,
    label,
    scope,
    icon: propIcon = DefaultIcon,
    sx: sxProps,
    ...rest
  } = props;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        textTransform: 'none',
        alignItems: 'center',
        fontSize: (theme: Theme) => theme.typography.subtitle2.fontSize,
        // '& span': {
        //   lineHeight: '1',
        //   fontSize: (theme: Theme) => theme.typography.subtitle2.fontSize,
        //   // paddingTop: '3px', // to align with checkIcon a bit better
        //   paddingLeft: '2px',
        //   paddingRight: '2px',
        // },
        // color: (theme: Theme) => theme.palette.text.secondary,
        ...sxProps
      }}
      {...rest}
    >
      {propIcon}
      <Typography
        component="div"
        sx={{
          whiteSpace: 'nowrap',
          lineHeight: '1',
          paddingLeft: (theme: Theme) => theme.spacing(.25),
          paddingRight: (theme: Theme) => theme.spacing(.25),
          fontSize: 'inherit'
        }}
      >
        {command?.label(scope) || label}
      </Typography>
    </Box>
  );
}

export const CommandToolbar = memo(forwardRef<ICommandToolbarElement, CommandToolbarProps>(
  (props: CommandToolbarProps, refForwarded) => {
  const {
    sx: sxProps,
    commands,
    propsCommandButton: propsCommandButtonProps,
    parentFloat,
    renderToolbarPalette,//: propCreateToolbarPalette,
    children,
    ...rest
  } = props;

  // TODO - if children error and say use renderToolbarPalette

  // const renderToolbarPalette = useCallbackRef(propCreateToolbarPalette, [propCreateToolbarPalette]);
  const refLocal = useImperativeElement<ICommandToolbarElement, CommandToolbarAttributes>(refForwarded, () => ({
  }), []);

  const [relatedFocus, setRelatedFocus] = useState<HTMLElement>(null);

  // const refToolbarCommands = useRef<HTMLDivElement>();
  // We add this to the float stack so that closing popups don't try to restore focus to the toolbar
  const {
    reference: floatReferenceToolbar,
  } = useFloatStack({
    label: 'toolbar',
    anchor: refLocal.current,
    parentFloat,
    createPopupPanel: null // we don't want the popup
  });

  const focusRelated = useCallback(() => {
    const closureRelatedFocus = relatedFocus;
    if (closureRelatedFocus) {
      requestAnimationFrame(() => {
        if (refLocal.current?.contains(document.activeElement))
          closureRelatedFocus.focus();
      });
    }
  }, []);

  const localPropsButton = useMemo(() => {
    return {
      dense: true,
      outlined: false,
      // disabled: true
    }
  }, []);

  const localPropsCommandButton:CommandButtonOptions = useMemo(() => {
    const {
      commandHook: propCommandHook,
      ...rest
    } = (propsCommandButtonProps || {});
    return {
      commandHook: {
        beforeExecute: (command: ICommand<any, any>, args: any): Promise<boolean | void> | boolean | void => {
          const delegate = propCommandHook?.beforeExecute?.(command, args);
          if (delegate === false) return false;
          return floatReferenceToolbar.closeAll();
        },
        /**
         * Called when a command has been executed successful
         */
        onExecute(command: ICommand<any, any>, args: any): void {
          propCommandHook?.onExecute?.(command, args);
          focusRelated();
        },
        onError(command: ICommand<any, any>, error: any, args: any): void {
          propCommandHook?.onError?.(command, error, args);
        }
      },
      ...rest
    }
  }, [floatReferenceToolbar, propsCommandButtonProps]);

  const commandButtonProps = useMemo(() => {
    return {
      ...localPropsButton,
      ...localPropsCommandButton
    }
  }, [localPropsButton, localPropsCommandButton]);

  const [_, forceRender] = useReducer((s: number) => s + 1, 0);
  useCommands(commands, [], {
    onChange: () => {
      forceRender();
    }
  });

  const localPropsCommandPopup = useMemo(() => {
    return {
      commands,
      parentFloat: floatReferenceToolbar,
      ...localPropsCommandButton
    }
  }, [_, commandButtonProps, floatReferenceToolbar, propsCommandButtonProps]);

  let columnGap = 0;
  if (!localPropsButton.dense)
    columnGap = columnGap + 2;
  if (localPropsButton.outlined)
    columnGap++;

  let verticalPadding = 2;
  if (!localPropsButton.dense)
    verticalPadding = 4;

  const palette = useMemo(() => {
    return renderToolbarPalette({
      commands,
      propsCommandButton: commandButtonProps,
      propsCommandPopup: {
        commands,
        ...localPropsCommandPopup,
        ...propsCommandButtonProps
      }
    });
  }, [_, commandButtonProps, localPropsCommandPopup, renderToolbarPalette]);

  return (
    <Toolbar
      variant="dense"
      sx={{
        minHeight: 'unset',//42px',
        height: 'unset',
        paddingTop: `${verticalPadding}px`,
        paddingBottom: `${verticalPadding}px`,
        paddingLeft: '6px !important',
        paddingRight: '6px !important',
        flex: '1 1 0%',
        alignItems: 'center',
        userSelect: 'none',
        flexGrow: 1,
        display: 'flex',
        overflow: 'hidden',
        ...sxProps
      }}
      ref={refLocal}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        if (e.relatedTarget && !relatedFocus) {
          // console.log('onfocus', e.relatedTarget);
          setRelatedFocus(e.relatedTarget as HTMLElement);
        }
      }}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (relatedFocus && !((refLocal?.current?.contains(e.relatedTarget)))) {
          // console.log('onblur', e.relatedTarget);
          setRelatedFocus(null);
        }
      }}
      onKeyDown={(e: React.KeyboardEvent<any>) => {
        if (relatedFocus && e.which === KeyCodes.Escape) {
          // console.log('workbook escape', relatedFocus);
          // console.log('toolbar on key restore focus');
          relatedFocus.focus();
        }
      }}
      {...rest}
    >
      <div
        ref={refLocal}
        style={{
          flex: '1 1 100%',
          display: 'flex',
          flexWrap: 'wrap',
          rowGap: `${verticalPadding}px`,
          columnGap: `${columnGap}px`,
          alignItems: 'center',
          maxWidth: `100%`
        }}
      >
        {palette}
      </div>
    </Toolbar>
  );
}));

CommandToolbar.displayName = "CommandToolbar";
