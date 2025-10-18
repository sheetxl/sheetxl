import React, {
  memo, useCallback, forwardRef, useMemo, useState, useRef
} from 'react';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';

import { IColor } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes, DynamicIcon } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, type ExhibitPopupPanelProps,
  type ExhibitPopupIconButtonProps, PopupButtonType
} from '@sheetxl/utils-mui';

import { ColorPanel, type ColorPanelProps } from './ColorPanel';

const DEFAULT_ICON = <DynamicIcon iconKey='circle.colored'/>;


export interface ColorPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "createPopupPanel"> {

  selectedColor: IColor;
  onSelectColor?: (color: IColor | null, isCustom: boolean) => void;
  onPreviewColor?: (color: IColor | null) => void;
  onPreviewColorImmediate?: (color: IColor | null) => void;

  /**
   * A short cut for a quick color. This is generally the last color chosen
   */
  quickColor?: IColor;

  /**
   * Rendering styles
   * @defaultValue to Toolbar
   */
  variant?:PopupButtonType;

  propsPanel?: Partial<ColorPanelProps>;

  /**
   * When closing the popup closeAll movables or just the current.
   * @defaultValue true
   */
  shouldCloseFloatAll?: boolean;

  compareRGB?: boolean;

  darkMode?: boolean;
}

export const ColorPopupButton = memo(
  forwardRef<HTMLElement, ColorPopupButtonProps>((props, refForwarded) => {
  const {
    selectedColor,
    quickColor,
    icon: propIcon = DEFAULT_ICON,
    tooltip,
    label,
    onPreviewColor: propOnPreviewColor,
    onPreviewColorImmediate: propOnPreviewColorImmediate,
    onSelectColor: propOnSelectColor,
    variant = PopupButtonType.Toolbar,
    propsPanel,
    shouldCloseFloatAll = true,
    compareRGB = false,
    darkMode = false,
    ...rest
  } = props;

  const onPreviewColor = useCallbackRef(propOnPreviewColor, [propOnPreviewColor]);
  const onPreviewColorImmediate = useCallbackRef(propOnPreviewColorImmediate, [propOnPreviewColorImmediate]);
  const onSelectColor = useCallbackRef(propOnSelectColor, [propOnSelectColor]);

  const [previewColor, setPreviewColor] = useState<IColor>(() => undefined);

  const activeColorPopup = previewColor || selectedColor;
  const activeColorButton = quickColor || activeColorPopup || propsPanel?.autoColor;
  // const icon = propIcon; // || (<IconComponent dynamicColor={activeColorButton.toString()}/>)

  // Needed for closing animations we can and often do get mouse event after starting close
  const isClosingRef = useRef<boolean>(false);

  const handleClosing = useCallback(() => {
    // isClosingRef.current = true;
    // setPreviewColor(undefined);
  }, []);

  const handleOpening = useCallbackRef(() => {
    setPreviewColor(selectedColor);
    // isClosingRef.current = false;
  }, [selectedColor]);

  const handleColorPreview = useCallbackRef((color: IColor) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(color);
    onPreviewColor?.(color);
  }, [onPreviewColor]);

  const handleColorPreviewImmediate = useCallbackRef((color: IColor) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(color);
    onPreviewColorImmediate?.(color);
  }, [onPreviewColorImmediate]);

  const handleColorSelect = useCallbackRef((color: IColor, isCustom: boolean) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(undefined);
    onSelectColor?.(color, isCustom);
  }, [onSelectColor]);

  const iconColorized = useMemo(() => {
    // TODO - make this more generic and move to a common area.
    return (
      <Box
        className='color-wrapper'
        sx={{
          lineHeight: '0', // done expand
          color: 'inherit',
          '--sxl-color-active': `${activeColorButton?.toCSS(darkMode) ?? 'transparent'}`,
          '& .activeColor': {
            fill: `${activeColorButton?.toCSS(darkMode) ?? 'transparent'}`
          },
          "& .style_grey": {
            fill: (theme: Theme) => {
              return ((theme.palette.text as any).icon ?? theme.palette.action.active);
            }
          }
        }}
      >
        {typeof propIcon === "function" ? propIcon() : propIcon}
      </Box>
  )}, [activeColorButton, propIcon, darkMode]);

  const handleSplitClick = useCallbackRef((_e: React.MouseEvent<Element>) => {
    onSelectColor?.(quickColor, false/*isCustom*/);
  }, [onSelectColor, quickColor]);

  const [_isEyeDropOpen, setEyeDropOpen] = useState<boolean>(false);
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const { closeFloat, closeFloatAll } = props;
    return (
      <ColorPanel
        {...propsPanel}
        selectedColor={selectedColor}
        previewColor={previewColor}
        onDone={shouldCloseFloatAll ? closeFloatAll : closeFloat}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Enter)) {
            shouldCloseFloatAll ? closeFloatAll() : closeFloat();
          }
        }}
        onPreviewColorImmediate={handleColorPreviewImmediate}
        onPreviewColor={handleColorPreview}
        onSelectColor={handleColorSelect}
        onEyeDropStart={() => setEyeDropOpen(true)}
        onEyeDropStop={() => setEyeDropOpen(false)}
        compareRGB={compareRGB}
        darkMode={darkMode}
      />
    )
  }, [selectedColor, previewColor, shouldCloseFloatAll, activeColorButton, propsPanel?.autoColor, darkMode]); // Note - we should be watching panelProps but most consumers are not memo-ing.

  const propsButton = {
    // ref: refForwarded,
    onQuickClick: quickColor ? handleSplitClick : undefined,
    createPopupPanel: createPopupPanel,
    propsPopup: {
      propsPopper: {
        resizeOnOverflow: false,
      },
    },
    onPopupOpen: handleOpening,
    onPopupClose: handleClosing,
    tooltip: tooltip || label || "Color",
    label: label,
    icon: iconColorized,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton ref={refForwarded} {...propsButton}/> :
    <ExhibitPopupMenuItem ref={refForwarded} {...propsButton}/>
  );
}));