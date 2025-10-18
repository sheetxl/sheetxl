import React, { useMemo, memo, forwardRef, useCallback } from 'react';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';

import { IBorder, IColor } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

import { StyledStrokePath } from '@sheetxl/react';

import {
  ExhibitPopupButtonProps, PopupButtonType, ExhibitPopupPanelProps, ExhibitPopupIconButton,
  ExhibitPopupMenuItem, ExhibitMenuItem, createStrokeShadowFilter
} from '@sheetxl/utils-mui';

import { SvgIcon, SvgIconProps } from '@mui/material';

export interface BorderStylePopupButtonProps extends ExhibitPopupButtonProps {
  selectedStyle: IBorder.StrokeStyle;

  onSelectStyle?: (style: IBorder.StrokeStyle | null) => void;

  /**
   * Rendering styles
   * @defaultValue to Toolbar
   */
  variant?:PopupButtonType;

  /**
   * @defaultValue false
   */
  showLabels?:boolean;

  /**
   * Where there are any custom borders
   * @remarks
   * None does not mean there is no gridline just no custom border. Excel doesn't have a way to partially remove gridlines.
   * We could accomplish this by adding a transparent border.
   *
   * @defaultValue true
   */
  showNone?: boolean;

  styleColor?: IColor;

  darkMode?: boolean;
}

const DEFAULT_LENGTH = 82;

export interface StyledStrokeIconProps extends SvgIconProps {
  styleColor?: IColor;
  length: number;
  width?: number; // defaults to 1
  dashArray?: number[]; // defaults to solid line
  isDouble?: boolean;
  isAngled?: boolean;
  darkMode?: boolean;
  // colorized? how is this don't with adjustedColor. Do the same thing.
}

export const StyledStrokeIcon = (props: StyledStrokeIconProps): React.ReactElement => {
  const {
    styleColor,
    length = DEFAULT_LENGTH,
    width = 1,
    dashArray = null,
    sx: propSx,
    isDouble = false,
    isAngled = false,
    darkMode = false,
    ...rest
  } = props;

  return (
    <SvgIcon
      sx={{
        width: `${length}px`,
        height: `${width}px`,
        color: 'inherit',
        overflow: 'visible',
        '& .activeColor': {
          stroke: (theme: Theme) => {
            return `${styleColor ? styleColor.toRGBA(darkMode).toString() : ((theme.palette.text as any).icon ?? theme.palette.action.active)}`;
          }
        },
        "& .style_grey": {
          stroke: (theme: Theme) => {
            return ((theme.palette.text as any).icon ?? theme.palette.action.active);
          }
        },
        ...propSx
      }}
      height={width}
      width={length}
      viewBox={`0 0 ${length} ${width}`}
      {...rest}
    >
      <StyledStrokePath
        length={length}
        width={width}
        dashArray={dashArray}
        isDouble={isDouble}
        isAngled={isAngled}
        className="activeColor"
      />
    </SvgIcon>
  );
}

export const BorderStylePopupButton = memo(
  forwardRef<HTMLElement, BorderStylePopupButtonProps>((props, _refForwarded) => {
  const {
    variant,
    showLabels = false,
    disabled: propDisabled = false,
    createPopupPanel: propCreatePopupPanel, // what to do with this?
    styleColor,
    selectedStyle,
    onSelectStyle: propOnSelectStyle,
    showNone: propShowNone = true,
    darkMode,
    sx: propSx,
    // onPreviewStyle - TODO - determine if we want this
    ...rest
  } = props;

  const onSelectStyle = useCallbackRef(propOnSelectStyle, []);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const {
      popupContainer,
      floatReference,
      closeFloat, // not closeFloatAll
      ..._rest
    } = props;

    const borderElements = [];
    const builtIns = IBorder.BuiltInDefinitionsArray;
    for (let i=0; i<builtIns.length; i++) {
      const definition = builtIns[i];
      const isNone = definition.description === "None";
      if (isNone && !propShowNone)
        continue;
      const styledItem = (
        <StyledStrokeIcon
          styleColor={styleColor}
          length={DEFAULT_LENGTH}
          width={definition.width}
          darkMode={darkMode}
          dashArray={definition.pattern}
          isDouble={definition.description.toLowerCase().includes('double')}
          isAngled={definition.description.toLowerCase().includes('slant')}
        />
      );
      let menuItem = null;
      if (showLabels) {
        menuItem = (<>
          <Box
            sx={{
              marginRight: '6px'
            }}
          >
            {definition.description}
          </Box>
          <Box
            sx={{
              marginLeft: '6px',
              marginRight: '6px',
              display: 'flex',
              alignItems: 'center',
              flex: '1 1 100%'
            }}
          >
            <div
              style={{
                flex: '1 1 100%'
              }}
            />
            {styledItem}
          </Box>
        </>);
      } else {
        menuItem = definition.description === "None" ? 'None' : styledItem;
      }
      borderElements.push(
        <ExhibitMenuItem
          key={i}
          className="border-stroke"
          tabIndex={0}
          sx={{
            height: '28px',
            '& svg path.activeColor': {
              filter: createStrokeShadowFilter(4)
            },
            // adding padding make the popup center but makes it unaligned with the renderer
            // hardcoded to aligned to dropdown/button icon
            paddingLeft: '16px',
            background: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
          }}
          propsTooltip={{
            description: !showLabels ? definition.description : ''
          }}
          icon={null} // setting to null removes the padding
          disabled={propDisabled}
          onMouseDown={e => e.preventDefault()}
          onMouseUp={() => { closeFloat(); onSelectStyle(definition.style) }}
          onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
            if ((e.which === KeyCodes.Enter)) {
              closeFloat();
            }
          }}
          selected={definition.style === selectedStyle}
          parentFloat={floatReference}
          // {...rest}
        >
          {menuItem}
        </ExhibitMenuItem>
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '4px', // TODO - size of rounded border from theme
          paddingBottom: '4px', // TODO - size of rounded border from theme
        }}
      >
       {borderElements}
      </Box>
    );
  }, [propDisabled, propShowNone, styleColor, selectedStyle, darkMode]);

  const iconSelected = useMemo(() => {
    const definition = IBorder.BuiltInDefinitions.get(selectedStyle);
    let styledIcon: React.ReactNode;
    if (definition.description === "None") {
      styledIcon = (
      <Box sx={{
        minWidth: `${DEFAULT_LENGTH}px` // To match stroke icon
      }}>
        None
      </Box>
      );
    } else {
      styledIcon = (
        <StyledStrokeIcon
          styleColor={styleColor}
          length={DEFAULT_LENGTH}
          width={definition.width}
          dashArray={definition.pattern}
          darkMode={darkMode}
          isDouble={definition.description.toLowerCase().includes('double')}
          isAngled={definition.description.toLowerCase().includes('slant')}
        />
      );
    }

    return (
      <Box
        className="border-stroke"
        sx={{
          // hardcoded to aligned to dropdown/button icon
          paddingLeft: '12px',
          marginLeft: '4px',
          marginRight: '4px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          '& svg path.activeColor': {
            filter: createStrokeShadowFilter()
          }
        }}
      >
        {styledIcon}
      </Box>
    );
  }, [selectedStyle, styleColor]);

  const definition = useMemo(() => {
    return IBorder.BuiltInDefinitions.get(selectedStyle);
  }, [selectedStyle]);

  const localPropsButton:ExhibitPopupButtonProps = {
    disabled: propDisabled,
    icon: iconSelected,
    tooltip: "Border Style: " + definition.description,
    sx: {
      background: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
      ...propSx
    },
    createPopupPanel,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton {...localPropsButton}/> :
    <ExhibitPopupMenuItem {...localPropsButton}/>
  );

}));
