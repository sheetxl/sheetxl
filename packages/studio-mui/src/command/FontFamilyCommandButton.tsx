import type React from 'react';
import { useMemo, memo, forwardRef, useCallback } from 'react';

import { useTheme, type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { IFontCollection } from '@sheetxl/sdk';

import { useCommands, KeyCodes, measureUIText } from '@sheetxl/utils-react';

import {
  SelectedIcon, defaultRenderPopupPanel, ExhibitMenuItem, ExhibitTooltip, ExhibitPopupIconButton,
  type ExhibitPopupIconButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

export interface FontFamilyCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "label" |"renderPopupPanel"> {
  commandKey: string;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);
}

export const FontFamilyCommandButton = memo(
  forwardRef<HTMLElement, FontFamilyCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    sx: propSx,
    disabled: propDisabled,
    icon: propIcon,
    label: propLabel,
    ...rest
  } = props;

  const [command] = useCommands([commandKey]);
  const currentFontFamily = command?.getState();

  const appTheme = useTheme();
  const defaultWidth = useMemo(() => {
    const templateString = 'Times New Roman';
    return `${measureUIText(templateString, { size: Math.round(appTheme.typography.fontSize), family: appTheme.typography.fontFamily ?? '' })}px`;
  }, [appTheme]);

  const isDisabled = propDisabled ?? (!command || command.disabled());

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const handleSetFont = (newValue: string) => {
      command?.execute(newValue);
    }

    // Read when the menu opens: the offered list changes as fonts are registered.
    const fontsRegistered = IFontCollection.getShared().getFontList();
    const fonts = [];
    for (let i=0; i<fontsRegistered.length; i++) {
      const fontRef = fontsRegistered[i].fontRef;
      if (!fontRef) continue;
      const family = fontRef.getFamily();
      fonts.push({
        key: family,
        description: family
      });
    }
    if (!fonts.some((font) => font.key === currentFontFamily)) {
      fonts.unshift({
          key: currentFontFamily,
          description: currentFontFamily
      });
    }

    const menus = [];
    const fontsLength = fonts.length;
    for (let i=0; i<fontsLength; i++) {
      const font = fonts[i];
      if (!font) continue;
      const fontKey = font.key;
      const selected = font.key === currentFontFamily;
      menus.push(
        <ExhibitMenuItem
          sx={{
            display: 'flex',
            paddingTop: '4px',
            paddingBottom: '4px',
          }}
          selected={selected}
          disabled={propDisabled || !command || command.disabled()}
          key={i + '' + fontKey}
          icon={selected ? <SelectedIcon/> : undefined}
          onMouseUp={(e) => { if (e.button !== 0) return; handleSetFont(fontKey) }}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onKeyDown={(e: React.KeyboardEvent) => {
            // button prevents space so we don't check it
            // if (e.isDefaultPrevented()) return;
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
              handleSetFont(fontKey);
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
                  return fontKey;
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

    return defaultRenderPopupPanel({...props, children});

  }, [isDisabled, command, currentFontFamily]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      sx={{
        ...propSx
      }}
      outlined={true}
      disabled={isDisabled}
      renderPopupPanel={renderPopupPanel}
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
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            color: (theme: Theme) => theme.palette.text.secondary,
            // Grows only when the host gives it room (the format pane's full-width field).
            flex: '1 1 auto',
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