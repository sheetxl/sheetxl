import type React from 'react';
import {
  useState, useMemo, useCallback, memo, forwardRef
} from 'react';

import { Box } from '@mui/material';

import { IColor, Color, IBorders } from '@sheetxl/sdk';

import {
  useCallbackRef, useCommandButtonEntry, DynamicIcon, themeSurfaceProps, useTranslator
} from '@sheetxl/utils-react';

import {
  ExhibitDivider, PopupButtonType, ExhibitTooltip, ExhibitPopupIconButton, ExhibitIconButton,
  type ExhibitPopupPanelProps, type ExhibitPopupIconButtonProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { ColorPopupButton } from '../color';
import { BorderStylePopupButton } from './BorderStylePopupButton';
import { BorderTemplateIcon } from './BorderTemplateIcon';

export interface BorderPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "color" | "icon" | "renderPopupPanel"> {
  selectedBorder: Partial<IBorders.Properties>;
  /**
   * Create a border.
   */
  createBorder: (props: Partial<IBorders.Properties>) => IBorders;
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
  autoStrokeStyle?: IBorders.StrokeStyle;

  showStylingBefore?: boolean;

  onSelectBorder?: (border: Partial<IBorders.Properties> | null) => void;

  onPreviewBorder?: (border: Partial<IBorders.Properties> | null) => void;
}

export const BorderPopupButton = memo(
  forwardRef<HTMLElement, BorderPopupButtonProps>((props, refForwarded) => {
  const {
    autoColor,
    schemeLookup,
    autoStrokeStyle = IBorders.StrokeStyle.Thin,
    disabled: propDisabled,
    darkMode=false,
    showStylingBefore = true,
    onSelectBorder: propOnSelectBorder,
    onPreviewBorder: propOnPreviewBorder,
    selectedBorder : propSelectedBorder,
    createBorder,
    ...rest
  } = props;

  const onSelectBorder = useCallbackRef(propOnSelectBorder ?? ((_border: Partial<IBorders.Properties> | null) => {}), [propOnSelectBorder]);
  const onPreviewBorder = useCallbackRef(propOnPreviewBorder ?? ((_border: Partial<IBorders.Properties> | null) => {}), [propOnPreviewBorder]);
  const t = useTranslator();

  const entryBorders = useCommandButtonEntry('borderOptions');

  const [previewStyle, setPreviewStyle] = useState<IBorders.StrokeStyle | null>();
  const [previewColor, setPreviewColor] = useState<IColor | null>();

  // const handleClose = useCallback(() => {
    // setPreviewStyle(undefined);
    // setPreviewColor(undefined);
  // }, []);

  const selectedBorder:Partial<IBorders.Properties> = propSelectedBorder ? propSelectedBorder : {
    bottom: {
      style: autoStrokeStyle,
      color: autoColor?.toString() ?? IColor.Named.Gray // hardcode a color that is not too offensive to dark or light.
    }
  }
  // **Note** - Not sure what to make the initial preview color.
  // For now it will be either the bottom selected border or the autoColor.
  // This will then 'say' the preview color for the life time of the popup.
  // We could move it to usePersistentState is a key is provided.
  const activeStyle:IBorders.StrokeStyle = previewStyle ?? selectedBorder?.bottom?.style ?? autoStrokeStyle;
  const activeColor:IColor | null = previewColor ?? (selectedBorder?.bottom?.color ? new Color(selectedBorder?.bottom?.color, schemeLookup) : undefined) ??  autoColor ?? null;

  const generateIcon = useCallbackRef((border: Partial<IBorders.Properties> | null) => {
    return <BorderTemplateIcon border={border} createBorder={createBorder}/>;
  }, [createBorder]);

  const newBorder = useCallback((edges: string[], color: IColor | null, style: IBorders.StrokeStyle): Partial<IBorders.Properties> | null => {
    let retValue:Partial<IBorders.Properties> | null = null;
    if (edges && edges.length > 0) {
      let values:IBorders.StrokeProperties | undefined = undefined;
      if (color || style)
        values = {
          style,
          color: color?.toString()
        }
      retValue = {};
      const edgesLength = edges.length;
      for (let i=0; i<edgesLength; i++) {
        retValue[edges[i] as keyof IBorders.Properties] = values;
      }
    }
    return retValue;
  }, []);

  /**
   * Allow for null or value to be set
   */
  const handleBorderSelect = useCallback((border:Partial<IBorders.Properties> | null) => {
    onSelectBorder?.(border);
  }, []);

  const handleBorderPreview = useCallback((border:Partial<IBorders.Properties> | null) => {
    onPreviewBorder?.(border);
  }, []);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const {
      closeFloatAll,
      // ...rest
    } = props;

    const borderButton = (edges: IBorders.Edge[], tooltip: string, placement: any='bottom', isNone: boolean=false) => { //placement: TooltipProps.placement enum
      const borderTemplate = newBorder(edges, activeColor ?? null, isNone ? IBorders.StrokeStyle.None : activeStyle ?? null);
      // TODO - remove when we have nicer border icon rendering
      const renderTemplate = isNone ? newBorder([], activeColor ?? null, activeStyle ?? null) : borderTemplate;

      return (
        <ExhibitIconButton
          icon={generateIcon(renderTemplate)}
          propsTooltip={{
            label: tooltip,
            simple: true,
            placement
          }}
          onClick={() => {
            closeFloatAll?.();
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
        {borderButton([IBorders.Edge.Left, IBorders.Edge.Top, IBorders.Edge.Right, IBorders.Edge.Bottom, IBorders.Edge.Horizontal, IBorders.Edge.Vertical], t('border.all'), 'top')}
        {borderButton([IBorders.Edge.Horizontal, IBorders.Edge.Vertical], t('border.inner'), 'top')}
        {borderButton([IBorders.Edge.Horizontal], t('border.insideHorizontal'), 'top')}
        {borderButton([IBorders.Edge.Vertical], t('border.insideVertical'), 'top')}
        {borderButton([IBorders.Edge.Left, IBorders.Edge.Top, IBorders.Edge.Right, IBorders.Edge.Bottom], t('border.outside'), 'top')}
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
        {borderButton([IBorders.Edge.Left], t('border.left'))}
        {borderButton([IBorders.Edge.Top], t('border.top'))}
        {borderButton([IBorders.Edge.Right], t('border.right'))}
        {borderButton([IBorders.Edge.Bottom], t('border.bottom'))}
        {borderButton([IBorders.Edge.Left, IBorders.Edge.Top, IBorders.Edge.Right, IBorders.Edge.Bottom, IBorders.Edge.Horizontal, IBorders.Edge.Vertical, IBorders.Edge.DiagonalUp, IBorders.Edge.DiagonalDown], t('border.none'), 'bottom', true)}
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
          selectedColor={activeStyle === IBorders.StrokeStyle.None ? new Color('transparent') : (activeColor ?? new Color('transparent'))}
          onPreviewColor={(color: IColor | null) => {
            setPreviewColor(color);
          }}
          onSelectColor={(color: IColor | null, _isCustom: boolean) => {
            setPreviewColor(color);
          }}
          darkMode={darkMode}
          tooltip={t('border.colorTooltip')}
          propsPanel={{
            disableAlpha: true,
            autoColor,
            schemeLookup,
            // Nested color popup is its own float (re-carries the app surface), so re-adopt the grid surface
            // on its panel too — keeps `auto`/system swatches resolving against the grid.
            ...themeSurfaceProps('grid', darkMode ? 'dark' : 'light')
            // recentColors: recentColors
          }}
          // renderTooltip={renderTooltip}
          // label={command?.getLabel()}
          disabled={propDisabled || activeStyle === IBorders.StrokeStyle.None}
          shouldCloseFloatAll={false}
        />
        <BorderStylePopupButton
          selectedStyle={activeStyle}
          onSelectStyle={setPreviewStyle}
          styleColor={activeColor}
          darkMode={darkMode}
          variant={PopupButtonType.Toolbar}
        />
      </Box>
    </>);
    return (
      <Box
        // Portaled outside the grid subtree, so adopt the grid surface here: border previews + the embedded
        // color swatches (var(--sxl-sys-color-*)) then resolve against the grid via the float-carried scope class.
        {...themeSurfaceProps('grid', darkMode ? 'dark' : 'light')}
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
  }, [activeStyle, activeColor, autoColor, activeStyle, schemeLookup, darkMode, t]);

  const selectedBorderIcon = useMemo(() => {
    return generateIcon(selectedBorder);
  }, [selectedBorder, darkMode]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      propsPopup={{
        propsPopper: {
          resizeOnOverflow: false
        }
      }}
      // onPopupClose={handleClose}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            // Tooltip chrome from the registered `borderOptions` entry (catalog-backed).
            label={entryBorders?.getLabel?.()}
            description={entryBorders?.getDescription?.()}
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      onQuickClick={() => {
        onSelectBorder?.(selectedBorder);
      }}
      // propsQuickButton={{
      //   sx: {
      //   }
      // }}
      disabled={propDisabled}
      icon={selectedBorderIcon}
      {...rest}
    />
  )
}));