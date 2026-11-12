import type React from 'react';
import {
  memo, useCallback, forwardRef, useMemo, useState, useRef
} from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type IColor } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes, DynamicIcon } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, PopupButtonType,
  type ExhibitPopupPanelProps, type ExhibitPopupIconButtonProps
} from '@sheetxl/utils-mui';

import { ColorPanel, type ColorPanelProps } from './ColorPanel';

const DEFAULT_ICON = <DynamicIcon iconKey='circle.colored'/>;


export interface ColorPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "renderPopupPanel"> {

  /** `null` means no color of its own — the AUTO swatch is the selected one. */
  selectedColor: IColor | null;
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

  const onPreviewColor = useCallbackRef(propOnPreviewColor ?? ((_color: IColor | null) => {}), [propOnPreviewColor]);
  const onPreviewColorImmediate = useCallbackRef(propOnPreviewColorImmediate ?? ((_color: IColor | null) => {}), [propOnPreviewColorImmediate]);
  const onSelectColor = useCallbackRef(propOnSelectColor ?? ((_color: IColor | null, _isCustom: boolean) => {}), [propOnSelectColor]);

  const [previewColor, setPreviewColor] = useState<IColor | null | undefined>(() => undefined);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  /* The preview only means anything while the popup is showing. Gating on `isOpen` (rather than
     clearing on close) sidesteps the closing-animation race below: a stray late preview event may
     still write state, but a closed button reads `selectedColor` regardless — without this, one
     open-and-dismiss froze the swatch at the captured preview and it never followed the model
     again. */
  const activeColorPopup = (isOpen ? previewColor : undefined) || selectedColor;
  const activeColorButton = quickColor || activeColorPopup || propsPanel?.autoColor;
  // const icon = propIcon; // || (<IconComponent dynamicColor={activeColorButton.toString()}/>)

  // Needed for closing animations we can and often do get mouse event after starting close
  const isClosingRef = useRef<boolean>(false);

  const handleClosing = useCallback(() => {
    setIsOpen(false);
    // isClosingRef.current = true;
    // setPreviewColor(undefined);
  }, []);

  const handleOpening = useCallbackRef(() => {
    setPreviewColor(selectedColor);
    setIsOpen(true);
    // isClosingRef.current = false;
  }, [selectedColor]);

  const handleColorPreview = useCallbackRef((color: IColor | null) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(color);
    onPreviewColor?.(color);
  }, [onPreviewColor]);

  const handleColorPreviewImmediate = useCallbackRef((color: IColor | null) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(color);
    onPreviewColorImmediate?.(color);
  }, [onPreviewColorImmediate]);

  const handleColorSelect = useCallbackRef((color: IColor | null, isCustom: boolean) => {
    if (isClosingRef.current) return; // avoid animation race condition
    setPreviewColor(undefined);
    onSelectColor?.(color, isCustom);
  }, [onSelectColor]);

  const iconColorized = useMemo(() => {
    let iconResolved = typeof propIcon === "function" ? propIcon() : propIcon
    if (typeof iconResolved === "string") {
      iconResolved = <DynamicIcon iconKey={iconResolved} />
    }
    const paints = (css?: string): string | undefined => (!css || css === 'none') ? undefined : css;
    const activeSwatchCSS =
      paints(activeColorButton?.toCSS(darkMode)) ??
      paints(propsPanel?.autoColor?.toCSS(darkMode)) ??
      'transparent';
    return (
      <Box
        className='color-wrapper'
        sx={{
          lineHeight: '0', // done expand
          color: 'inherit',
          '& .activeColor': {
            fill: activeSwatchCSS
          },
          "& .style_grey": {
            fill: (theme: Theme) => {
              return ((theme.palette.text as any).icon ?? theme.palette.action.active);
            }
          }
        }}
      >
        {iconResolved}
      </Box>
  )}, [activeColorButton, propsPanel?.autoColor, propIcon, darkMode]);

  const handleSplitClick = useCallbackRef((_e: React.MouseEvent<Element>) => {
    onSelectColor?.(quickColor ?? null, false/*isCustom*/);
  }, [onSelectColor, quickColor]);

  const [_isEyeDropOpen, setEyeDropOpen] = useState<boolean>(false);
  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const { closeFloat, closeFloatAll } = props;
    return (
      <ColorPanel
        {...propsPanel}
        selectedColor={selectedColor}
        previewColor={previewColor}
        onDone={shouldCloseFloatAll ? closeFloatAll : closeFloat}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Enter)) {
            shouldCloseFloatAll ? closeFloatAll?.() : closeFloat?.();
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
    renderPopupPanel: renderPopupPanel,
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