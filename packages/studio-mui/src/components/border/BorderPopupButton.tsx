import React, {
  useState, useMemo, useCallback, memo, forwardRef
} from 'react';

import { alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { TooltipProps } from '@mui/material';

import { IColor, Color, IBorder, ICell } from '@sheetxl/sdk';

import { useCallbackRef, DynamicIcon } from '@sheetxl/utils-react';

import {
  ExhibitDivider, ExhibitPopupPanelProps, PopupButtonType,
  ExhibitTooltip, ExhibitPopupIconButton, ExhibitPopupIconButtonProps,
  ExhibitIconButton, strokeShadowFilter
} from '@sheetxl/utils-mui';

import { StaticBorderRenderer } from '@sheetxl/react';

import { ColorPopupButton } from '../color';
import { BorderStylePopupButton } from './BorderStylePopupButton';

export interface BorderPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "createPopupPanel"> {
  selectedBorder: Partial<IBorder.Properties>;
  /**
   * Create a border.
   */
  createTemporaryBorder: (props: Partial<IBorder.Properties>) => IBorder;
  /**
   * For color picker.
   */
  // TODO - change to parseColor
  schemeLookup: IColor.SchemeLookup

  /**
   * If autoColor is set the a special Swatch is create that will
   * disable this color. When it is selected or previewed the color
   * passed will be null any consumer will then know to use the auto color
   */
  autoColor?: IColor;

  darkMode?: boolean;
  /**
   * If no values are specified
   */
  autoStrokeStyle?: IBorder.StrokeStyle;

  showStylingBefore?: boolean;

  onSelectBorder?: (border: Partial<IBorder.Properties> | null) => void;

  onPreviewBorder?: (border: Partial<IBorder.Properties> | null) => void;
}

export const BorderPopupButton = memo(
  forwardRef<HTMLElement, BorderPopupButtonProps>((props, refForwarded) => {
  const {
    autoColor = null,
    schemeLookup,
    autoStrokeStyle = IBorder.StrokeStyle.Thin,
    disabled: propDisabled = false,
    darkMode=false,
    showStylingBefore = true,
    onSelectBorder: propOnSelectBorder,
    onPreviewBorder: propOnPreviewBorder,
    selectedBorder : propSelectedBorder,
    createTemporaryBorder,
    ...rest
  } = props;

  const onSelectBorder = useCallbackRef(propOnSelectBorder, [propOnSelectBorder]);
  const onPreviewBorder = useCallbackRef(propOnPreviewBorder, [propOnPreviewBorder]);

  const [previewStyle, setPreviewStyle] = useState<IBorder.StrokeStyle>();
  const [previewColor, setPreviewColor] = useState<IColor>();

  // const handleClose = useCallback(() => {
    // setPreviewStyle(undefined);
    // setPreviewColor(undefined);
  // }, []);

  const activeStyle:IBorder.StrokeStyle = previewStyle ?? autoStrokeStyle;
  const activeColor:IColor = previewColor ?? autoColor;

  const selectedBorder:Partial<IBorder.Properties> = propSelectedBorder ? propSelectedBorder : {
    bottom: {
      style: autoStrokeStyle,
      color: autoColor?.toString()
    }
  }

  const generateIcon = useCallbackRef((border: Partial<IBorder.Properties>) => {
    const borderTemplate: Partial<IBorder.Properties> = {};
    const edges = border ? Object.keys(border) : [];
    let hasNonNone = false; /* if all borders are none we special case to treat as clear */
    const edgesLength = edges.length;
    for (let i=0; i<edgesLength; i++) {
      const edge = edges[i];
      if (border[edge]?.style) { //  && border[edge].style !== IBorder.StrokeStyle.None
        borderTemplate[edge] = {
          style: border[edge].style,
          color: border[edge].color,
        }
        if (!hasNonNone && borderTemplate[edge].style !== IBorder.StrokeStyle.None) {
          hasNonNone = true;
        }
        // if (borderTemplate[edges[i]].style === IBorder.StrokeStyle.None) {
        //   borderTemplate[edges[i]] = {
        //     style: IBorder.StrokeStyle.Medium,
        //     color: new Color.Adjustment.Color(IColor.Scheme.Bg1, [new Color.Adjustment(Color.AdjustmentType.LumMod, 90)], styles.schemeLookup())//'red'defaultColor
        //   }
        // }
      }
    }


    if (edges.length < 6) /* if we didn't set all borders to none then treat as if we have one. */
      hasNonNone = true;
    const left = hasNonNone ? borderTemplate.left : null;
    const top = hasNonNone ? borderTemplate.top : null;
    const right = hasNonNone ? borderTemplate.right : null;
    const bottom = hasNonNone ? borderTemplate.bottom : null;
    const vertical = hasNonNone ? borderTemplate.vertical : null;
    const horizontal = hasNonNone ? borderTemplate.horizontal : null;

    const getBorderAt = (coords: ICell.Coords, _index: number): IBorder =>{
      if (!createTemporaryBorder || edges.length === 0) return null;
      const rowIndex = coords.rowIndex;
      const colIndex = coords.colIndex;
      const borderPropsRender: Partial<IBorder.Properties> = {};

      if (rowIndex === 0) {
        borderPropsRender.top = borderTemplate.top;
        borderPropsRender.bottom = borderTemplate.horizontal;
      } else {
        borderPropsRender.top = borderTemplate.horizontal;
        borderPropsRender.bottom = borderTemplate.bottom;
      }
      if (colIndex === 0) {
        borderPropsRender.left = borderTemplate.left;
        borderPropsRender.right = borderTemplate.vertical;
      } else {
        borderPropsRender.left = borderTemplate.vertical;
        borderPropsRender.right = borderTemplate.right;
      }
      return createTemporaryBorder?. (borderPropsRender);
    }

    // placing this on a non-pixel-boundary causes it to blur but makes it look 'nicer'. (and better aligned)
    const transform = `translate(-0.5px, -0.5px)`;
    /*
     * 5x5 grid with a all the dots.
     */
    let path = "";
    if (!(top || left)) // top left
      path += `M 3,5 H 5 V 3 H 3 `;
    if (!(top)) // top 2
      path += `M 7,5 H 9 V 3 H 7 `;
    if (!(top || vertical)) // // top center
      path += `M 11,5 h 2 V 3 h -2 `;
    if (!(top)) // top 4
      path += `M 15,5 h 2 V 3 h -2 `;
    if (!(top || right)) // top right
      path += `M 19,5 h 2 V 3 h -2 `;
    if (!(left)) // left 2
      path += `M 3,9 H 5 V 7 H 3 `;
    if (!(vertical)) // left 2, center
      path += `M 11,9 h 2 V 7 h -2 `;
    if (!(right)) // left 2 right
      path += `M 19,9 h 2 V 7 h -2 `;
    if (!(horizontal || left)) // horizontal, left
      path += `M 3,13 H 5 V 11 H 3 `;
    if (!(horizontal)) // horizontal, 2
      path += `M 7,13 H 9 V 11 H 7 `;
    if (!(horizontal || vertical))
      path += `M 11,13 h 2 v -2 h -2 `;
    if (!(horizontal || right)) // horizontal, vertical
      path += `M 19,13 h 2 v -2 h -2 `;
    if (!(horizontal)) // horizontal 4
      path += `M 15,13 h 2 v -2 h -2 `;
    if (!(left)) // left 4
      path += `M 3,17 H 5 V 15 H 3 `;
    if (!(vertical)) // left 4, center
      path += `M 11,17 h 2 v -2 h -2 `;
    if (!(right)) // left 4 right
      path += `M 19,17 h 2 v -2 h -2 `;
    if (!(bottom || left)) // bottom, left
      path += `M 3,21 H 5 V 19 H 3 `;
    if (!(bottom)) // bottom, 2
      path += `M 7,21 H 9 V 19 H 7 `;
    if (!(bottom || vertical)) // bottom, vertical
      path += `M 11,21 h 2 v -2 h -2 `;
    if (!(bottom)) // bottom, 4
      path += `M 15,21 h 2 v -2 h -2 `;
    if (!(bottom || right)) // bottom right
      path += `M 19,21 h 2 v -2 h -2 `;
    return (
      <DynamicIcon> {/* blank - for sizing */}
        <Box
          className="border-icon"
          sx={{
            width: 'var(--icon-size, var(--icon-size-md))',
            height: 'var(--icon-size, var(--icon-size-md))',
            position: 'relative',
            '& .grid > path': {
              // '& path': {
                opacity: '0.8',
              //   transform
              // }
            }
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="grid"
            style={{
              top: '0px',
              left: '0px',
              width: 'calc(var(--icon-size, var(--icon-size-md)) + 1px)', // +1 to account for transform
              height: 'calc(var(--icon-size, var(--icon-size-md)) + 1px)', // +1 to account for transform
              position: 'absolute'
            }}
          >
            <path
              className="fill"
              d={path}
            />
          </svg>
        <Box
          className='border-container'
          sx={{
            // background: 'pink',
            position: 'absolute',
            display: 'flex',
            justifyContent: 'stretch',
            alignItems: 'stretch',
            top: '0px',
            left: '0px',
            width: 'var(--icon-size, var(--icon-size-md))',
            height: 'var(--icon-size, var(--icon-size-md))',
            padding: '1px 1px',
            // top: '-1px',
            // left: '-1px',
            '& svg path': {
              filter: strokeShadowFilter
            }
          }}
        >
          <StaticBorderRenderer
            getBorderAt={getBorderAt}
            darkMode={darkMode}
            style={{
              top: '2px',
              left: '2px',
              width: 'calc(100% - 5px)',
              height: 'calc(100% - 5px)',
              position: 'absolute'
            }}
          />
        </Box>
      </Box>
    </DynamicIcon>
    )
  }, [activeColor, activeStyle, darkMode]);

  const newBorder = useCallback((edges: string[], color: IColor, style: IBorder.StrokeStyle): Partial<IBorder.Properties> => {
    let retValue:Partial<IBorder.Properties> = null;
    if (edges && edges.length > 0) {
      let values:IBorder.StrokeProperties = null;
      if (color || style)
        values = {
          style,
          color: color?.toString() ?? null
        }
      retValue = {};
      const edgesLength = edges.length;
      for (let i=0; i<edgesLength; i++) {
        retValue[edges[i]] = values;
      }
    }
    return retValue;
  }, []);

  /**
   * Allow for null or value to be set
   */
  const handleBorderSelect = useCallback((border:Partial<IBorder.Properties>) => {
    onSelectBorder?.(border);
  }, []);

  const handleBorderPreview = useCallback((border:Partial<IBorder.Properties>) => {
    onPreviewBorder?.(border);
  }, []);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const {
      closeFloatAll,
      floatReference,
      // ...rest
    } = props;

    const borderButton = (edges: IBorder.Edge[], tooltip: string, placement: any='bottom', isNone: boolean=false) => { //placement: TooltipProps.placement enum
      const borderTemplate = newBorder(edges, activeColor ?? null, isNone ? IBorder.StrokeStyle.None : activeStyle ?? null);
      // TODO - remove when we have nicer border icon rendering
      const renderTemplate = isNone ? newBorder([], activeColor ?? null, activeStyle ?? null) : borderTemplate;

      return (
        <ExhibitIconButton
          icon={generateIcon(renderTemplate)}
          sx={{
            background: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
          }}
          tooltipProps={{
            label: tooltip,
            simple: true,
            placement
          }}
          onClick={() => {
            closeFloatAll();
            handleBorderPreview(borderTemplate);
            handleBorderSelect(borderTemplate);
          }}
        />
      )
    }


    const borderLocations = (<>
      <Box
        sx={{
          display: 'flex',
          padding: '6px 16px',
          justifyContent: 'center',
          rowGap: '2px',
          gap: '2px'
        }}
      >
        {borderButton([IBorder.Edge.Left, IBorder.Edge.Top, IBorder.Edge.Right, IBorder.Edge.Bottom, IBorder.Edge.Horizontal, IBorder.Edge.Vertical], 'All Borders', 'top')}
        {borderButton([IBorder.Edge.Horizontal, IBorder.Edge.Vertical], 'Inner Borders', 'top')}
        {borderButton([IBorder.Edge.Horizontal], 'Inside Horizontal Borders', 'top')}
        {borderButton([IBorder.Edge.Vertical], 'Inside Vertical Borders', 'top')}
        {borderButton([IBorder.Edge.Left, IBorder.Edge.Top, IBorder.Edge.Right, IBorder.Edge.Bottom], 'Outside Borders', 'top')}
      </Box>
      <Box
        sx={{
          display: 'flex',
          padding: '6px 16px',
          justifyContent: 'center',
          rowGap: '2px',
          gap: '2px'
        }}
      >
        {borderButton([IBorder.Edge.Left], 'Left Borders')}
        {borderButton([IBorder.Edge.Top], 'Top Borders')}
        {borderButton([IBorder.Edge.Right], 'Right Borders')}
        {borderButton([IBorder.Edge.Bottom], 'Bottom Borders')}
        {borderButton([IBorder.Edge.Left, IBorder.Edge.Top, IBorder.Edge.Right, IBorder.Edge.Bottom, IBorder.Edge.Horizontal, IBorder.Edge.Vertical, IBorder.Edge.DiagonalUp, IBorder.Edge.DiagonalDown], 'No Borders', 'bottom', true)}
      </Box>
    </>);
    const borderStyling = (<>
      <Box
        sx={{
          display: 'flex',
          padding: '6px 16px',
          flexDirection: 'row',
          gap: '6px'
        }}
      >
        <ColorPopupButton
          // {...rest}
          variant={PopupButtonType.Toolbar}
          icon={<DynamicIcon iconKey="stroke.colored" />}
          selectedColor={activeStyle === IBorder.StrokeStyle.None ? new Color('transparent') : activeColor}
          onPreviewColor={(color: IColor | null) => {
            setPreviewColor(color);
          }}
          onSelectColor={(color: IColor | null, _isCustom: boolean) => {
            setPreviewColor(color);
          }}
          darkMode={darkMode}
          tooltip={"Border Color"}
          panelProps={{
            disableAlpha: true,
            autoColor,
            schemeLookup
            // recentColors: recentColors
          }}
          // createTooltip={createTooltip}
          // label={command?.label()}
          disabled={propDisabled || activeStyle === IBorder.StrokeStyle.None}
          parentFloat={floatReference}
          shouldCloseFloatAll={false}
        />
        <BorderStylePopupButton
          selectedStyle={activeStyle}
          onSelectStyle={setPreviewStyle}
          styleColor={activeColor}
          darkMode={darkMode}
          variant={PopupButtonType.Toolbar}
          parentFloat={floatReference}
        />
      </Box>
    </>);
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: '4px', // TODO - size of rounded border from theme
          paddingBottom: '4px', // TODO - size of rounded border from theme
        }}
        onClick={(e) => e.stopPropagation() } // Prevent the quick buttons from closing the menu
      >
        {showStylingBefore ? borderStyling : borderLocations}
        <ExhibitDivider orientation="horizontal"/>
        {showStylingBefore ? borderLocations : borderStyling}
      </Box>
    );
  }, [activeStyle, activeColor, autoColor, schemeLookup, darkMode]);

  const selectedBorderIcon = useMemo(() => {
    return generateIcon(selectedBorder);
  }, [selectedBorder, darkMode]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      createPopupPanel={createPopupPanel}
      popupProps={{
        popperProps: {
          resizeOnOverflow: false
        }
      }}
      // onPopupClose={handleClose}
      createTooltip={({children}: TooltipProps, disabled: boolean) => {
        return (
          <ExhibitTooltip
            label="Borders"
            description="Set the borders."
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      onQuickClick={() => {
        onSelectBorder?.(selectedBorder);
      }}
      quickButtonProps={{
        sx: {
          // backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
        }
      }}
      disabled={propDisabled}
      icon={selectedBorderIcon}
      {...rest}
    />
  )
}));