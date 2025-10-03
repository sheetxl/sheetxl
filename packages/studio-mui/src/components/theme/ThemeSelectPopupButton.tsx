import React, { memo, forwardRef, useCallback } from 'react';

import { IThemeCollection, ITheme } from '@sheetxl/sdk';

import { KeyCodes, DynamicIcon } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, type ExhibitPopupPanelProps,
  type ExhibitPopupIconButtonProps, PopupButtonType
} from '@sheetxl/utils-mui';

import { ThemeSelectPanel, type ThemeSelectPanelProps } from './ThemeSelectPanel';

export interface ThemeSelectPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "createPopupPanel"> {
  themes: IThemeCollection;
  selectedTheme?: ITheme;
  onSelectTheme?: (docTheme: ITheme) => void;

  icon?: React.ReactNode;

  label?: React.ReactNode;

  /**
   * Rendering styles
   * @defaultValue to Toolbar
   */
  variant?: PopupButtonType;

  panelProps?: Partial<ThemeSelectPanelProps>;

  darkMode?: boolean;
}

export const ThemeSelectPopupButton: React.FC<ThemeSelectPopupButtonProps & { ref?: any }> = memo(
  forwardRef<any, ThemeSelectPopupButtonProps>((props, refForwarded) => {
  const {
    themes,
    selectedTheme,
    onSelectTheme,
    icon: propIcon,
    tooltip,
    label,
    variant = PopupButtonType.Toolbar,
    darkMode,
    panelProps,
    ...rest
  } = props;

  const icon = propIcon || <DynamicIcon iconKey="Theme2" />;
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const { closeFloatAll } = props;
    return (
      <ThemeSelectPanel
        {...panelProps}
        themes={themes}
        selectedTheme={selectedTheme}
        onSelectTheme={onSelectTheme}
        darkMode={darkMode}
        // onDone={closeFloatAll}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Enter)) {
            closeFloatAll();
          }
        }}
      />
    )
  }, [themes, selectedTheme, onSelectTheme, panelProps, darkMode]);

  const propsButton = {
    // ref: refForwarded,
    createPopupPanel: createPopupPanel,
    // popupProps: {
    //   popperProps: {
    //   },
    // },
    tooltip: tooltip || label || "Theme",
    label,
    icon,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton ref={refForwarded} {...propsButton}/> :
    <ExhibitPopupMenuItem ref={refForwarded} {...propsButton}/>
  );
}));
