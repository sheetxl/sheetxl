
import React, { memo, forwardRef, useMemo } from 'react';

import { SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';

import { IThemeCollection, ITheme } from '@sheetxl/sdk';

import { KeyCodes } from '@sheetxl/utils-react';

import { ExhibitMenuHeader, ExhibitDivider } from '@sheetxl/utils-mui';

import { ThemeSelectButton } from './ThemeSelectButton';

// TODO - make theme2icon show the current theme colors. (kinda neat)
export interface ThemeSelectPanelProps extends React.HTMLAttributes<HTMLElement> {
  themes: IThemeCollection;
  selectedTheme: ITheme;
  onSelectTheme: (docTheme: ITheme) => void;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  disabled?: boolean;
  darkMode?: boolean;
}

export const ThemeSelectPanel: React.FC<ThemeSelectPanelProps> = memo(
  forwardRef<any, ThemeSelectPanelProps>((props: ThemeSelectPanelProps, refForwarded) => {
  const {
    themes,
    selectedTheme,
    onSelectTheme,
    sx: sxProps,
    disabled: propDisabled=false,
    darkMode,
    ...rest
  } = props;

  const themeSelects = useMemo(() => {
    const arrThemes:ITheme[] = themes?.getItems({ selected: selectedTheme }) ?? [];
    const retValue = [];
    if (arrThemes.length === 0) {
      return (
        <ExhibitMenuHeader
          sx={{
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '6px',
            paddingBottom: '6px'
          }}
        >
          No themes
        </ExhibitMenuHeader>
      );
    }
    const arrThemesLength = arrThemes.length;
    for (let i=0; i<arrThemesLength; i++) {
      const docTheme = arrThemes[i];
      const selected = selectedTheme && docTheme?.getName() === selectedTheme.getName();
      const nextDocTheme = arrThemes[i+1];
      if (nextDocTheme && nextDocTheme.isCustom() !== docTheme.isCustom()) {
        retValue.push(
          <ExhibitDivider
            orientation="horizontal"
            key={`divider-${i}`}
            sx={{
              marginBottom: '4px'
            }}
          />
        )
      }
      retValue.push(
        <ThemeSelectButton
          docTheme={docTheme}
          onSelectTheme={() => onSelectTheme(docTheme)}
          isSelected={selected}
          key={docTheme.getName()}
          disabled={propDisabled}
          darkMode={darkMode}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onMouseUp={(e) => { if (e.button !== 0) return; onSelectTheme(docTheme); }}
          onKeyDown={(e: React.KeyboardEvent) => {
            // button prevents space so we don't check it
            // if (e.isDefaultPrevented()) return;
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
              onSelectTheme(docTheme);
            }
          }}
        />
      )
    }
    return retValue;
  }, [selectedTheme, onSelectTheme, darkMode]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 100%'
      }}
      ref={refForwarded}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <ExhibitMenuHeader
          sx={{
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '4px',
            paddingBottom: '2px'
          }}
        >
          Themes
        </ExhibitMenuHeader>
        <ExhibitDivider/>
        <Box
          sx={{
            flex: '1 1 100%',
            overflow: 'auto',
            padding: '6px 16px'
          }}
        >
          {themeSelects}
        </Box>
      </Box>
    </Box>
  );
}));

export default ThemeSelectPanel;
