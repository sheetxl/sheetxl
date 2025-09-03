import { alpha } from '@mui/system';

import { GridStyle } from '@sheetxl/grid-react';

import { Theme } from '@mui/material/styles';
import { elevateColor } from '@sheetxl/utils-mui';

const DIVIDER_MULTI = 0.12;
const DIVIDER_SELECT_MULTI = 0.22;

/**
 * Creates a gridStyle from a MUI theme
 * @param appTheme The outer theme used for toolbars and any containing application.
 * @param bodyTheme The theme used specifically for the grid.
 * @returns A `GridStyle` that merges appTheme and bodyTheme.
 */
export const createGridStyleFromMUITheme = (appTheme: Theme, bodyTheme?: Theme): GridStyle => {
  const retValue:GridStyle = {};

  const toGridSurface = (theme: Theme): GridStyle => {
    const defaultSurface = theme.palette?.background.default ?? 'rgba(255,255,255,1)';
    return {
      text: {
        fontFamily: theme.typography?.fontFamily ?? 'Calibri',
        fontSize: (theme.typography?.fontSize ?? 11 * 72/96),
        fontWeight: theme.typography?.fontWeightRegular ?? '400',
        fill: (theme.palette.mode === 'dark' ? theme.palette?.text?.secondary : theme.palette?.text?.primary),
      },
      fill: defaultSurface,
      strokeFill: elevateColor(defaultSurface, DIVIDER_MULTI, theme.palette?.mode),
      darkMode: theme.palette.mode === 'dark'
    };
  }

  const bodyThemeGridSurface = toGridSurface(bodyTheme);
  retValue.body = toGridSurface(appTheme);
  retValue.header = {
    ...retValue.body,
    strokeFill: elevateColor(retValue.body.fill, DIVIDER_MULTI, appTheme.palette?.mode),
    // we only elevate if we are not using a contrasting theme.
    //fill: elevateColor(retValue.body.fill, .055, appTheme.palette?.mode),
    fill: (!bodyTheme || appTheme.palette.mode !== 'dark' || (bodyTheme.palette.mode === appTheme.palette.mode)) ? elevateColor(retValue.body.fill, .055, appTheme.palette?.mode) : retValue.body.fill,
    edgeStrokeFill: appTheme.palette.mode === 'dark' ? retValue.body.strokeFill : elevateColor(retValue.body.fill, .328, appTheme.palette?.mode),
  };
  retValue.headerHover = (style: GridStyle) => { // headerSelect
    return {
      ...retValue.header,
      // strokeFill: appTheme.palette.mode !== 'dark' ? elevateColor(retValue.body.fill, DIVIDER_SELECT_MULTI, appTheme.palette?.mode) : appTheme.palette.text.secondary,
      strokeFill: elevateColor(style?.fill ?? retValue.body.fill, DIVIDER_SELECT_MULTI, appTheme.palette?.mode),
      fill: elevateColor(style?.fill ?? retValue.header.fill, .065, appTheme.palette?.mode), //.055,
      text: {
        ...style?.text,
        fontWeight: appTheme.typography?.fontWeightBold
      }
    }
  };
  const mutedColor = elevateColor(appTheme.palette.mode !== 'dark' ? appTheme.palette.primary.light : appTheme.palette.primary.main, .055, appTheme.palette?.mode);
  retValue.headerSelect = { // headerSelectAll
    ...retValue.header,//headerSelect,
    strokeFill: appTheme.palette.primary.main,
    fill: alpha(mutedColor, 0.2),
    text: {
      ...retValue.header.text, // headerSelect.text,
      fill: appTheme.palette.primary.main,
      // fontWeight: appTheme.typography?.fontWeightBold
    },
    dividerStrokeFill: alpha(mutedColor, 0.7),
    // edgeStrokeFill: 'red',//retValue.headerSelect.strokeFill //headerSelectAll.strokeFill
  };

  retValue.headerSelectAll = { // headerHover
    ...retValue.headerSelect,//headerSelectAll,
    fill: alpha(mutedColor, 0.9),
    text: {
      ...retValue.headerSelect.text, //headerSelectAll.text,
      fill: appTheme.palette.primary.contrastText
    },
    edgeStrokeFill: retValue.headerSelect.strokeFill //headerSelectAll.strokeFill
  };

  retValue.buttonSurface = {
    ...bodyThemeGridSurface,
    strokeFill: elevateColor(bodyThemeGridSurface.fill, DIVIDER_MULTI, bodyTheme.palette?.mode),
    // we only elevate if we are not using a contrasting theme.
    //fill: elevateColor(retValue.body.fill, .055, appTheme.palette?.mode),
    fill: (!bodyTheme || bodyTheme.palette.mode !== 'dark' || (bodyTheme.palette.mode === appTheme.palette.mode)) ? elevateColor(bodyThemeGridSurface.fill, .055, bodyTheme.palette?.mode) : bodyThemeGridSurface.fill,
    edgeStrokeFill: bodyTheme.palette.mode === 'dark' ? bodyThemeGridSurface.strokeFill : elevateColor(bodyThemeGridSurface.fill, .328, bodyTheme.palette?.mode),
  }

  retValue.headerSelection = {
    fill: appTheme.palette?.primary?.main ? alpha(appTheme.palette?.primary?.main, 0.1) : undefined,
    strokeFill: appTheme.palette?.primary?.main
  }

  retValue.headerSelectionInactive = {
    ...retValue.headerSelection,
    fill: appTheme.palette?.divider ? alpha(appTheme.palette?.divider, 0.05) : undefined,
    strokeFill: 'transparent'
  }

  const bodySelectionTheme = bodyTheme ?? appTheme;
  const isBodyDarkMode = bodySelectionTheme.palette.mode === 'dark';
  retValue.selection = {
    fill: bodySelectionTheme.palette?.primary?.main ? alpha(bodySelectionTheme.palette?.primary?.main, 0.1) : undefined,
    strokeFill: bodySelectionTheme.palette?.primary?.main
  }

  retValue.selectionInactive = {
    ...retValue.selection,
    fill: bodySelectionTheme.palette?.divider ? alpha(bodySelectionTheme.palette?.divider, 0.05) : undefined,
    strokeFill: 'transparent'
  }

  retValue.selectionRemove = {
    ...retValue.selection,
    fill: alpha(bodySelectionTheme.palette.warning.light, 0.05),
    strokeFill: bodySelectionTheme.palette.warning.dark,
  }

  if (bodyTheme) {
    retValue.body = toGridSurface(bodyTheme);
  }

  retValue.colorShadow = alpha(bodySelectionTheme.palette.action.active, 0.5);
  retValue.colorGrey = bodySelectionTheme.palette.action.active;
  retValue.filterDarkInvert = isBodyDarkMode ? `hue-rotate(180deg) invert(1) brightness(95%)` : 'none';

  // TODO - revert back to none inactive because of editing/focus issue, also flickers when tabbing, many issues.
//   retValue.selectionBorderFillInactive = retValue.selectionBorderFill;
//   retValue.selectionBackgroundFillInactive = retValue.selectionBackgroundFill;

  return retValue;
}
