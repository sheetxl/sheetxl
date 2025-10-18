import React, { memo, useCallback } from 'react';

import { IColor, Color } from '@sheetxl/sdk';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import { Swatch, type SwatchProps } from './Swatch';

export interface ColorButtonProps extends React.HTMLAttributes<HTMLElement> {
  colorDef: IColor.DefinitionWithLabel;
  schemeColorLookup: IColor.SchemeLookup;

  selectedColor: IColor;
  previewColor?: IColor;

  onSelectColorDef?: (colorDef: IColor.DefinitionWithLabel) => void;
  onPreviewColorDef?: (colorDef: IColor.DefinitionWithLabel) => void;

  propsSwatch?: Partial<SwatchProps>;
  defaultButtonSize?: number; // default button size in pixels, used for alpha check size
  isLarge?: boolean;
  compareRGB?: boolean;
  darkMode?: boolean;
}

/**
 * Given a colorDef Provides a color preview as a swatch, a tooltip, and returns an adjusted color.
 */
export const ColorButton = memo((props: ColorButtonProps) => {
  const {
    schemeColorLookup,
    selectedColor,
    previewColor,
    colorDef,
    onSelectColorDef,
    onPreviewColorDef,
    propsSwatch,
    defaultButtonSize = 24,
    isLarge = false,
    compareRGB = false,
    darkMode= false,
    ...rest
  } = props;

  const color = new Color({ val: colorDef.definition.val, adjs: colorDef.definition.adjs }, (value) => {
    return schemeColorLookup(value);
  });

  // Compares definitions.
  const colorString = compareRGB ? color.toRGBA().toString() : color.toString();
  const isSelected = selectedColor && (compareRGB ? selectedColor.toRGBA().toString() : selectedColor.toString()) === colorString;
  const isPreview = previewColor && (compareRGB ? previewColor.toRGBA().toString() : previewColor.toString()) === colorString;

  const adjustments:any[] = [];
  adjustments.push({ [IColor.AdjustmentType.Inv]: true });
  adjustments.push({ [IColor.AdjustmentType.Alpha]: 100 });
  const invertedColor = color.adjust(adjustments);

  const handleSelectColor = useCallback(() => {
    onSelectColorDef?.(colorDef);
  }, [onSelectColorDef, colorDef]);

  const handlePreviewColor = useCallback((color: IColor.ISpace.RGBA) => {
    onPreviewColorDef?.(color ? colorDef : null);
  }, [onPreviewColorDef, colorDef]);

  return (
    <SimpleTooltip
      disableInteractive
      // onOpen={() => {
      //   console.log('open tooltip'); // useful for creating breakpoint when open to see flicker associated with disabledPortal workaround
      // }}
      PopperProps={{
        style: {
          pointerEvents: 'none'
        },
        disablePortal: true, // Tooltip is flickering very badly this is because we are usually on a popper already. This causes tooltips to not always show at bottom
        popperOptions: {
          strategy: 'fixed',
          modifiers: [
            // {
            //   name: 'positionFixed',
            //   enabled: true,
            //   options: {
            //     enabled: true
            //   },
            // },
            {
              name: 'preventOverflow',
              enabled: true,
              options: {
                boundariesElement: "viewport"
              },
            },
          ]
        }
      }}
      title={colorDef.description}
      placement="bottom-start"
    >
      <div
        style={{
          width: `${defaultButtonSize * (isLarge ? 1.2 : 1)}px`,
          height: `${defaultButtonSize * (isLarge ? 1.2 : 1)}px`,
          position: 'relative',
          boxSizing: 'border-box',
          cursor: 'pointer',
          outline: 'none',
          // boxShadow: isSelected ? 'inset 0 0 0 1px #ddd' : null
        }}
        {...rest}
      >
        <Swatch
          selectedColor={color}
          title={null}
          onSelectColor={handleSelectColor}
          onPreviewColor={handlePreviewColor}
          alphaCheckSize={isLarge ? 9 : undefined}
          darkMode={darkMode}
          {...propsSwatch}
        >
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: '0px',
            left: '0px',
            pointerEvents: 'none',
            borderColor: invertedColor.toRGBA(darkMode).toString(),
            borderWidth: '2px',
            borderStyle: 'solid',
            boxSizing: 'border-box',
            opacity: isSelected ? '1' : '0'
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: `${defaultButtonSize * 0.33 * (isLarge ? 1.2 : 1)}px`,
            height: `${defaultButtonSize * 0.33 * (isLarge ? 1.2 : 1)}px`,
            left: 'calc(50% - 0.5px)',
            top: 'calc(50% - 0.5px)',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
            background: invertedColor.toRGBA(darkMode).toString(),
            borderRadius: '50%',
            opacity: isPreview ? '1' : '0'
          }}
        />
        </Swatch>
      </div>
    </SimpleTooltip>
  );
});