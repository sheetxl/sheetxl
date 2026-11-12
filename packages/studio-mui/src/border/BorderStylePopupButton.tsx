import type React from 'react';
import { useMemo, memo, forwardRef, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { IBorders, type IColor } from '@sheetxl/sdk';

import { useCallbackRef, KeyCodes, useTranslator, type TranslateFn } from '@sheetxl/utils-react';

import { StyledStrokePath } from '@sheetxl/react';

import {
  PopupButtonType, ExhibitPopupIconButton,
  ExhibitPopupMenuItem, ExhibitMenuItem, createStrokeShadowFilter,
  type ExhibitPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { SvgIcon, type SvgIconProps } from '@mui/material';

export interface BorderStylePopupButtonProps extends ExhibitPopupButtonProps {
  selectedStyle: IBorders.StrokeStyle;

  onSelectStyle?: (style: IBorders.StrokeStyle | null) => void;

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

  styleColor?: IColor | null;

  darkMode?: boolean;
}

const DEFAULT_LENGTH = 82;

/**
 * Localized display name for a built-in stroke style. The SDK's `definition.description` is canonical
 * English; a literal `t()` pair per style keeps the extractor seeing `key → english` (dynamic keys
 * would be invisible to it). Unknown styles fall back to the canonical description.
 */
function styleLabel(t: TranslateFn, definition: IBorders.Definition | undefined): string {
  if (!definition) return '';
  switch (definition.style) {
    case IBorders.StrokeStyle.None: return t('border.style.none');
    case IBorders.StrokeStyle.Hair: return t('border.style.hair');
    case IBorders.StrokeStyle.Dotted: return t('border.style.dotted');
    case IBorders.StrokeStyle.Dashed: return t('border.style.dashed');
    case IBorders.StrokeStyle.DashDot: return t('border.style.dashDot');
    case IBorders.StrokeStyle.DashDotDot: return t('border.style.dashDotDot');
    case IBorders.StrokeStyle.Double: return t('border.style.double');
    case IBorders.StrokeStyle.Thin: return t('border.style.thin');
    case IBorders.StrokeStyle.Medium: return t('border.style.medium');
    case IBorders.StrokeStyle.MediumDashed: return t('border.style.mediumDashed');
    case IBorders.StrokeStyle.MediumDashDot: return t('border.style.mediumDashDot');
    case IBorders.StrokeStyle.MediumDashDotDot: return t('border.style.mediumDashDotDot');
    case IBorders.StrokeStyle.SlantDashDot: return t('border.style.slantDashDot');
    case IBorders.StrokeStyle.Thick: return t('border.style.thick');
    default: return definition.description;
  }
}

export interface StyledStrokeIconProps extends SvgIconProps {
  styleColor?: IColor | null;
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
    dashArray,
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
    disabled: propDisabled,
    renderPopupPanel: propRenderPopupPanel, // what to do with this?
    styleColor,
    selectedStyle,
    onSelectStyle: propOnSelectStyle,
    showNone: propShowNone = true,
    darkMode,
    sx: propSx,
    // onPreviewStyle - TODO - determine if we want this
    ...rest
  } = props;

  const onSelectStyle = useCallbackRef(propOnSelectStyle ?? ((_style: IBorders.StrokeStyle | null) => {}), []);
  const t = useTranslator();

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const {
      popupContainer,
      closeFloat, // not closeFloatAll
      ..._rest
    } = props;

    const borderElements = [];
    const builtIns = IBorders.BuiltInDefinitionsArray;
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
            {styleLabel(t, definition)}
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
        menuItem = definition.description === "None" ? styleLabel(t, definition) : styledItem;
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
            paddingLeft: '16px'
          }}
          propsTooltip={{
            description: !showLabels ? styleLabel(t, definition) : ''
          }}
          icon={null} // setting to null removes the padding
          disabled={propDisabled}
          onMouseDown={e => e.preventDefault()}
          onMouseUp={() => { closeFloat?.(); onSelectStyle(definition.style) }}
          onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
            if ((e.which === KeyCodes.Enter)) {
              closeFloat?.();
            }
          }}
          selected={definition.style === selectedStyle}
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
  }, [propDisabled, propShowNone, styleColor, selectedStyle, darkMode, t]);

  const iconSelected = useMemo(() => {
    const definition = IBorders.BuiltInDefinitions.get(selectedStyle);
    if (!definition) return null;
    let styledIcon: React.ReactNode;
    if (definition.description === "None") {
      styledIcon = (
      <Box sx={{
        minWidth: `${DEFAULT_LENGTH}px` // To match stroke icon
      }}>
        {styleLabel(t, definition)}
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
  }, [selectedStyle, styleColor, t]);

  const definition = useMemo(() => {
    return IBorders.BuiltInDefinitions.get(selectedStyle);
  }, [selectedStyle]);

  const localPropsButton:ExhibitPopupButtonProps = {
    disabled: propDisabled,
    icon: iconSelected,
    tooltip: t('border.styleTooltip', { style: styleLabel(t, definition) }),
    sx: propSx,
    renderPopupPanel,
    ...rest
  }
  return (variant === PopupButtonType.Toolbar ?
    <ExhibitPopupIconButton {...localPropsButton}/> :
    <ExhibitPopupMenuItem {...localPropsButton}/>
  );

}));
