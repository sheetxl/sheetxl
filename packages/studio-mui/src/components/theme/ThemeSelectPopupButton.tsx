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

  propsPanel?: Partial<ThemeSelectPanelProps>;

  darkMode?: boolean;

  /**
   * Ref to the underlying element
   */
  ref?: React.Ref<HTMLElement>;
}

export const ThemeSelectPopupButton = memo( forwardRef<HTMLElement, ThemeSelectPopupButtonProps>(
  (props: ThemeSelectPopupButtonProps, refForwarded) => {
  const {
    themes,
    selectedTheme,
    onSelectTheme,
    icon: propIcon,
    tooltip,
    label,
    variant = PopupButtonType.Toolbar,
    darkMode,
    propsPanel,
    ...rest
  } = props;

  const icon = propIcon || <DynamicIcon iconKey="Theme2" />;
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const { closeFloatAll } = props;
    return (
      <ThemeSelectPanel
        {...propsPanel}
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
  }, [themes, selectedTheme, onSelectTheme, propsPanel, darkMode]);

  const propsButton = {
    // ref: refForwarded,
    createPopupPanel: createPopupPanel,
    // propsPopup: {
    //   propsPopper: {
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
