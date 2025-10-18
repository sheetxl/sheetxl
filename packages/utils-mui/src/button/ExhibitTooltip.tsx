import React, { useState, useEffect, memo, forwardRef } from 'react';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';
import { type TooltipProps } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';

import { IKeyStroke, KeyModifiers, ReactUtils } from '@sheetxl/utils-react';

import { ChipStrip, SimpleTooltip } from '../components';

export interface ExhibitTooltipProps extends Omit<TooltipProps, "title"> {
  title?: string | React.ReactNode;

  /** Prevent tooltip from show */
  disabled?: boolean;
  /* indicate the the tooltip is for a disabled component. */

  label?: NonNullable<React.ReactNode>;
  description?: NonNullable<React.ReactNode>;
  /**
   * If true returns a very simple text tooltip.
   * @remarks
   * All Exhibit tooltip props are ignored.
   */
  simple?: boolean;

  maxWidth?: number;

  shortcut?: IKeyStroke;
  useModifierSymbols?: boolean;

  componentDisabled?: boolean;

  chips?: string | string[] | React.ReactNode | React.ReactNode[];
}

const ModifierKeyIcon = memo((props: any) => {
  const {
    modifier,
    sx: propSx,
    ...rest
  } = props;

  return (
    <Box
      sx={{
        marginLeft: '1px',
        marginRight: '1px',
        borderRadius: '4px',
        borderStyle: 'solid',
        borderTopWidth: '1px',
        borderLeftWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '2px',
        borderTopColor: (theme: Theme) => {
          return alpha(theme.palette.background.paper, theme.palette.action.disabledOpacity);
        },
        borderLeftColor: (theme: Theme) => {
          return alpha(theme.palette.background.paper, theme.palette.action.disabledOpacity);
        },
        borderRightColor: (theme: Theme) => {
          return alpha(theme.palette.background.paper, theme.palette.action.disabledOpacity);
        },
        borderBottomColor: (theme: Theme) => {
          return alpha(theme.palette.background.paper, 1 - theme.palette.action.disabledOpacity);
        },
        backgroundColor: (theme: Theme) => {
          return alpha(theme.palette.action.hover, theme.palette.action.disabledOpacity);
        },
        // minWidth: '2em',
        paddingLeft: '4px',
        paddingRight: '4px',
        minHeight: '1.6em',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'content-box',
        overflow: 'hidden',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          '& *': {
            fontWeight: '500',
          }
        }}
      >
        {modifier}
      </Box>
    </Box>
  );
});

const CTRL_KEY_DESCRIPTION = (CommonUtils.getOS() === CommonUtils.OSType.MacOS || CommonUtils.getOS() === CommonUtils.OSType.IOS) ? `Cmd` : `Ctrl`;

export const toShortcutElements = (keyStroke: IKeyStroke | IKeyStroke[], modifierSymbol: boolean=false, key: string=null): React.ReactElement => {
  if (Array.isArray(keyStroke)) {
    let elements = [];
    let asArray = keyStroke;
    for (let i=0; i<asArray.length; i++) {
      elements.push(toShortcutElements(asArray[i], modifierSymbol, key ?? '' + i));
      // if (i < asArray.length - 1)
      //   elements.push(<div style={{marginRight: '8px'}}>,</div>);
    }
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column'
        }}
        key={key}
      >
        {elements}
      </Box>
    );
  }

  if (!keyStroke?.key) return null;
  const modifiersAsMap = {};
  for (let i=0;keyStroke.modifiers && i<keyStroke.modifiers.length; i++)
    modifiersAsMap[keyStroke.modifiers[i]] = true;

  const elements = [];

  // Always the same order.
  // TODO - use symbol svg icons. the text doesn't layout nicely/controlled
  if (modifiersAsMap?.[KeyModifiers.Ctrl]) {
    elements.push(<ModifierKeyIcon key="ctrl" modifier={modifierSymbol ? '^' : <div style={{paddingRight: '1px' }}>{CTRL_KEY_DESCRIPTION}</div>}/>);
    elements.push('+');
  }
  if (modifiersAsMap?.[KeyModifiers.Alt]) {
    elements.push(<ModifierKeyIcon key="alt" modifier={modifierSymbol ? '⌥' : 'Alt'}/>);
    elements.push('+');
  }
  if (modifiersAsMap?.[KeyModifiers.Shift]) {
    elements.push(<ModifierKeyIcon key="shift" modifier={modifierSymbol ? '⇧' : <div style={{paddingRight: '1px' }}>Shift</div>}/>);
    elements.push('+');
  }
  if (modifiersAsMap?.[KeyModifiers.Meta]) {
    elements.push(<ModifierKeyIcon key="meta" modifier={modifierSymbol ? <div style={{paddingTop: '1px' }}>⌘</div> : 'Meta'}/>);
    elements.push('+');
  }
  elements.push(<ModifierKeyIcon key="character" modifier={ReactUtils.toPrettyKeyCode(keyStroke.key)}/>);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center'
      }}
      key={key}
    >
      {elements}
    </Box>
  )
}

export const ExhibitTooltip: React.FC<ExhibitTooltipProps & { ref?: any }> = memo(
  forwardRef<React.ReactElement<any, any>, ExhibitTooltipProps>((props, refForwarded) => {
  const {
    disabled = false,
    label: propLabel,
    shortcut,
    chips,
    description,
    maxWidth = 280,
    useModifierSymbols = false,
    children,
    simple,
    componentDisabled: _componentDisabled = false,
    sx: sxProp,
    ...rest
  } = props;

  let shortCutLabel = null;
  if (shortcut) {
    shortCutLabel = toShortcutElements(shortcut, useModifierSymbols);
    // shortCutLabel = (
    //   <Typography variant="subtitle1" sx={{marginLeft: '6px'}}>
    //     {' (' + toShortcutString(shortcut, useModifierSymbols) + ')'}
    //   </Typography>
    // )
  }

  const [label, setLabel] = useState<React.ReactNode>(null);
  useEffect(() => {
    Promise.resolve(propLabel).then((resolved) => {
      setLabel(resolved);
    });
  }, [propLabel]);

  const title = (
    <Box
      sx={{
        maxWidth: `${maxWidth}px`
      }}
      ref={refForwarded}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          marginBottom: description ? '4px' : '0px'
        }}>
        <Typography
          variant="subtitle1"
          component="div"
          flex="1 1 100%"

        >
          {label}
        </Typography>
        {chips ? <ChipStrip chips={chips}/> : null}
        {shortCutLabel ? <Box key="leadingSpace" sx={{ marginLeft: '8px' }} /> : <></>}
        {shortCutLabel}
      </Box>
      {description ? <Typography variant="caption" sx={{ whiteSpace: 'pre-line', lineHeight: '1.4' }}>{description}</Typography> : <></>}
    </Box>
  );

  /* We want to create interactive components and allow for leaving the little spacing between to respond to mouse events

   * If our tooltip has focus it should not exit. (Capture the previous focus location to restore on close)
   * If we receive an ESC key (when in focus then restore to original location)
  */
  return (
    <SimpleTooltip
      slotProps={{
        popper: {
          // ...other Popper props if needed
          sx: {
            "& .MuiTooltip-tooltip": {
              marginTop: '0px !important'
            },
            ...sxProp
          },
          modifiers: [
            {
              name: "offset",
              options: {
                offset: [0, 14],
              },
            },
          ],
        }
      }}
      className={'tooltip-wrapper'}
      tabIndex={-1}
      title={!disabled && label ? title : ''}
      enterDelay={260} // TODO - drive these from theme but make them medium/slow
      enterNextDelay={130} // TODO - drive these from theme
      leaveDelay={230} // TODO - drive these from theme
      disableInteractive // TODO - later make this conditional base on whether there are any elements to click on
      {...rest}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch'
        }}
      >
        {children}
      </div>
    </SimpleTooltip>
  )
}));