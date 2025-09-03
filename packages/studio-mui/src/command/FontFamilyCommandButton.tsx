import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { Theme, useTheme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';
import { TooltipProps } from '@mui/material';

import { IFont } from '@sheetxl/sdk';
import { IFontCollection } from '@sheetxl/sdk';

import {
  Command, useCommand, ICommand, ICommandHook, KeyCodes
} from '@sheetxl/utils-react';

import {
  defaultCreatePopupPanel, ExhibitMenuItem, ExhibitTooltip, ExhibitPopupIconButton,
  ExhibitPopupIconButtonProps, ExhibitPopupPanelProps, SelectedIcon
 } from '@sheetxl/utils-mui';

export interface FontFamilyCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" |"createPopupPanel"> {
  command: Command<string>;

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
}

const fontsRegistered = IFontCollection.getFontList();
const mapFontsRegistered = new Map();
for (let i=0; i<fontsRegistered.length; i++) {
  mapFontsRegistered.set(fontsRegistered[i].fontRef.getFamily(), fontsRegistered[i]);
}
export const FontFamilyCommandButton = memo(
  forwardRef<HTMLElement, FontFamilyCommandButtonProps>((props, refForwarded) => {
  const {
    command,
    commandHook: propCommandHook,
    sx: propSx,
    disabled: propDisabled = false,
    parentFloat,
    icon: propIcon,
    label: propLabel,
    ...rest
  } = props;

  const _ = useCommand(command);
  const currentFontFamily = command?.state();

  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = 'Times New Roman';
    return `${IFont.getSharedMeasurer()(templateString, Math.round(appTheme.typography.fontSize), appTheme.typography.fontFamily).width}px`;
  }, [appTheme]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const handleSetFont = (newValue: string) => {
      command?.execute(newValue, propCommandHook);
    }

    const fonts = [];
    for (let i=0; i<fontsRegistered.length; i++) {
      fonts.push({
        key: fontsRegistered[i].fontRef.getFamily(),
        description: fontsRegistered[i].fontRef.getFamily()
      });
    }
    if (!mapFontsRegistered.get(currentFontFamily)) {
      fonts.unshift({
          key: currentFontFamily,
          description: currentFontFamily
      });
    }

    const menus = [];
    for (let i=0; i<fonts.length; i++) {
      const selected = fonts[i].key === currentFontFamily;
      menus.push(
        <ExhibitMenuItem
          sx={{
            display: 'flex',
            paddingTop: '4px',
            paddingBottom: '4px',
          }}
          selected={selected}
          disabled={propDisabled || !command || command.disabled()}
          key={i + '' + fonts[i].key}
          icon={selected ? <SelectedIcon/> : undefined}
          onMouseUp={(e) => { if (e.button !== 0) return; handleSetFont(fonts[i].key) }}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onKeyDown={(e: React.KeyboardEvent) => {
            // button prevents space so we don't check it
            // if (e.isDefaultPrevented()) return;
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
              handleSetFont(fonts[i].key);
            }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flex: '1 1 100%',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <Typography
              // variant="caption"
              component="div"
              sx={{
                whiteSpace: 'nowrap',
                // color: (theme: Theme) => alpha(theme.palette.text.secondary, 1),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: () => {
                  return fonts[i]?.key;
                }
              }}
            >
              {fonts[i].description}
            </Typography>
          </Box>
        </ExhibitMenuItem>
      )
    }

    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%'
        }}
        {...rest}
      >
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

  }, [propDisabled, command?.state()]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      sx={{
        ...propSx
      }}
      outlined={true}
      disabled={propDisabled}
      parentFloat={parentFloat}
      createPopupPanel={createPopupPanel}
      // onClick={async () => {
      //   try {
      //     console.log('trying to find local fonts');
      //     // @ts-ignore
      //     const array = await window.queryLocalFonts?.();

      //     array.forEach(metadata => {
      //       console.log(metadata.postscriptName);
      //       console.log(` full name: ${metadata.fullName}`);
      //       console.log(` family: ${metadata.family}`);
      //       console.log(` style: ${metadata.style}`);

      //       console.log(` italic: ${metadata.italic}`);
      //       console.log(` stretch: ${metadata.stretch}`);
      //       console.log(` weight: ${metadata.weight}`);
      //     });
      //    } catch(e) {
      //     // Handle error, e.g. user cancelled the operation.
      //     // Handle error, e.g. user cancelled the operation.
      //     console.warn(`Local font access not available: ${e.message}`);
      //   }
      // }}
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
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            color: (theme: Theme) => theme.palette.text.secondary,
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
            {currentFontFamily}
          </Box>
        </Box>
      }
      {...rest}
    />
  )

}));

export default FontFamilyCommandButton;