import React from 'react';

import clsx from 'clsx';

import { ButtonBase, Box, Link, Paper, styled, tooltipClasses, useTheme } from '@mui/material';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import {
  WorksheetElement, type WorksheetElementProps,
  SheetTab, type SheetTabProps, type SheetTabSurfaceProps, type CommentCardRenderProps, type HyperlinkCardRenderProps,
  type RangeToolbarRenderProps, type TableToolbarRenderProps, type PivotToolbarRenderProps, LinkPreviewImage,
  type OutlineButtonProps, type OutlineLevelButtonProps
} from '@sheetxl/react';

import { type TooltipRenderProps } from '@sheetxl/grid-react';

import {
  AnimatedLoadingPanel, type AnimatedLoadingPanelProps, StackTraceErrorPanel, type StackTraceErrorPanelProps,
  ExhibitIconButton
} from '@sheetxl/utils-mui';

import { FormulaBar, MobileFormulaBar, type FormulaBarProps } from '../formulaBar';
import { ColumnMenu, PivotMenu, type ColumnMenuProps, type PivotMenuProps } from '../filter';
import { StatusBar, type StatusBarProps } from '../statusBar';
import { MovableContextMenu, type MovableContextMenuProps } from '../movable';
import {
  SheetTabMenu, SheetsAllMenu, type SheetsAllMenuProps, type SheetTabMenuProps
} from '../sheet';

import { WorkbookStrip, type WorkbookStripProps } from './WorkbookStrip';
import { WorkbookContextMenu, type WorkbookContextMenuProps } from './WorkbookContextMenu';
import { FillMenu, type FillMenuProps } from './FillMenu';
import { CommentCard } from '../comments/CommentCard';
// By module: the command barrel is wide, and only the split button is wanted here.
import { PresetTableStylesCommandButton } from '../command/PresetTableStylesCommandButton';
import { PresetPivotStylesCommandButton } from '../command/PresetPivotStylesCommandButton';
import { OutlineButton, OutlineLevelButton } from './OutlineButtons';

// MUI's own `Tooltip` slot styles, under its name and slot so the theme's `MuiTooltip` `tooltip`
// overrides apply here too.
const TooltipBubble = styled('div', {
  name: 'MuiTooltip',
  slot: 'Tooltip',
  overridesResolver: (_props, styles) => styles.tooltip
})(({ theme }) => ({
  backgroundColor: theme.vars ? theme.vars.palette.Tooltip.bg : theme.alpha(theme.palette.grey[700], 0.92),
  borderRadius: (theme.vars || theme).shape.borderRadius,
  color: (theme.vars || theme).palette.common.white,
  fontFamily: theme.typography.fontFamily,
  padding: '4px 8px',
  fontSize: theme.typography.pxToRem(11),
  maxWidth: 300,
  margin: 2,
  wordWrap: 'break-word',
  fontWeight: theme.typography.fontWeightMedium
}));

/**
 * The bubble of the grid's tooltips (a resize readout, a drag's destination, a range tip) in MUI's
 * `Tooltip` look, so they match the toolbar's.
 */
export const defaultRenderTooltip = (props: TooltipRenderProps): React.ReactNode => {
  const { children, interactive, tipProps, className, style } = props;
  return (
    <TooltipBubble
      {...tipProps}
      className={clsx(tooltipClasses.tooltip, className)}
      style={{ ...style, pointerEvents: interactive ? 'auto' : 'none' }}
    >
      {children}
    </TooltipBubble>
  );
};

/** The card of a threaded comment as it floats beside its cell. */
export const defaultRenderCommentCard = (props: CommentCardRenderProps): React.ReactElement => {
  const { sheet, coords, comment, focusRequest, onClose } = props;
  return (
    <CommentCard
      sheet={sheet}
      coords={coords}
      comment={comment}
      focusRequest={focusRequest}
      onClose={onClose}
      elevated
    />
  );
}

/**
 * The card beside a hovered hyperlink cell, as Excel Online draws it: the page's title over the address
 * (the address alone until the preview arrives), copy / edit / remove at the right, and the page's
 * picture below. Fixed width, so the card does not grow as the preview arrives. Its edge is the theme's
 * border and shadow tokens, so it separates from a dark grid as well as a light one. `tipProps` keeps it
 * open while the pointer is on it.
 */
const HyperlinkCard = (props: HyperlinkCardRenderProps): React.ReactElement => {
  const { hyperlink, open, copy, edit, remove, disabled, preview, tipProps } = props;
  const t = useTranslator();
  const screenTip = hyperlink.getScreenTip();
  const address = hyperlink.getAddress();
  const follow = (): void => { void open(); };
  const title = preview?.title;
  const linkSx = { font: 'inherit', display: 'block', width: '100%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
  return (
    <Paper
      {...tipProps}
      elevation={6}
      role="toolbar"
      sx={{
        display: 'flex', flexDirection: 'column', width: 320, boxSizing: 'border-box', p: 1,
        // Sized like the toolbar: its icon size (ExhibitTheme's `--icon-size`, lost across the portal) and
        // the app's font size.
        '--icon-size': '1.25rem', fontSize: 'var(--sxl-font-size, 13px)',
        border: '1px solid var(--sxl-color-base-border, rgba(0,0,0,0.26))',
        boxShadow: '0 4px 16px var(--sxl-color-shadow, rgba(0,0,0,0.2))',
        ...(tipProps.style as object)
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <ExhibitIconButton dense icon={<DynamicIcon iconKey="HyperlinkGoto" />} propsTooltip={{ title: t('hyperlink.open') }} onClick={follow} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Link component="button" type="button" underline="hover" title={title} sx={{ ...linkSx, fontWeight: 600 }} onClick={follow}>
              {title}
            </Link>
          ) : null}
          <Link
            component="button" type="button" underline="none" title={screenTip ?? address}
            color={title ? 'text.secondary' : 'primary'}
            sx={linkSx} onClick={follow}
          >
            {screenTip ?? address}
          </Link>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <ExhibitIconButton dense icon={<DynamicIcon iconKey="ContentCopy" />} propsTooltip={{ title: t('hyperlink.copy') }} onClick={() => { void copy(); }} />
          <ExhibitIconButton dense icon={<DynamicIcon iconKey="HyperlinkEdit" />} propsTooltip={{ title: t('hyperlink.edit') }} disabled={disabled} onClick={edit} />
          <ExhibitIconButton dense icon={<DynamicIcon iconKey="HyperlinkDelete" />} propsTooltip={{ title: t('hyperlink.remove') }} disabled={disabled} onClick={remove} />
        </Box>
      </Box>
      {preview?.image ? (
        <ButtonBase onClick={follow} tabIndex={-1} sx={{ display: 'block', borderRadius: 1, overflow: 'hidden' }}>
          <LinkPreviewImage src={preview.image} expectedWidth={preview.imageWidth} style={{ marginTop: 8 }} />
        </ButtonBase>
      ) : null}
    </Paper>
  );
};

export const defaultRenderHyperlinkCard = (props: HyperlinkCardRenderProps): React.ReactElement => {
  return <HyperlinkCard {...props} />;
};

/**
 * The paper's edge is the button's edge: the split button draws no rest or hover outline of its own,
 * nor the 1px side margin an outlined button keeps.
 */
const SOLE_BUTTON_OUTLINE = { color: 'transparent', hoverColor: 'transparent' };
const SOLE_BUTTON_ROOT = { sx: { mx: 0 } };

/**
 * The paper a toolbar floated over a hovered range sits on. With a single button it hugs it (no
 * padding), so it reads as one floating button rather than a button inside a toolbar.
 */
const RangeToolbarPaper: React.FC<{ props: RangeToolbarRenderProps; label: string; children: React.ReactNode }> = ({ props, label, children }) => {
  const { floatProps } = props;
  return (
    <Paper
      {...floatProps}
      elevation={6}
      role="toolbar"
      aria-label={label}
      sx={{
        display: 'inline-flex', p: 0, borderRadius: '4px', overflow: 'hidden',
        // The toolbar's icon size (ExhibitTheme's `--icon-size`, lost across the portal).
        '--icon-size': '1.25rem',
        border: '1px solid var(--sxl-color-base-border, rgba(0,0,0,0.26))',
        boxShadow: '0 2px 8px var(--sxl-color-shadow, rgba(0,0,0,0.2))',
        ...(floatProps.style as object)
      }}
    >
      {children}
    </Paper>
  );
};

/**
 * The toolbar at a hovered table's corner: the toolbar's own table split button — the quick press edits
 * the table, the dropdown is the style gallery.
 */
export const TableToolbar: React.FC<TableToolbarRenderProps> = (props) => {
  const { table, setHeld } = props;
  return (
    <RangeToolbarPaper props={props} label={table.getName()}>
      <PresetTableStylesCommandButton
        commandKey="formatTableStyle"
        selectedTable={table}
        outlined={SOLE_BUTTON_OUTLINE}
        propsButton={SOLE_BUTTON_ROOT}
        onPopupOpen={() => setHeld(true)}
        onPopupClose={() => setHeld(false)}
      />
    </RangeToolbarPaper>
  );
};

export const defaultRenderTableToolbar = (props: TableToolbarRenderProps): React.ReactElement => {
  return <TableToolbar {...props} />;
};

/**
 * The toolbar at a hovered pivot table's corner, as the {@link TableToolbar table's}: the quick press
 * edits the pivot table, the dropdown is the pivot style gallery.
 */
export const PivotToolbar: React.FC<PivotToolbarRenderProps> = (props) => {
  const { pivot, setHeld } = props;
  return (
    <RangeToolbarPaper props={props} label={pivot.getName()}>
      <PresetPivotStylesCommandButton
        commandKey="formatPivotStyle"
        selectedPivot={pivot}
        quickCommand="editPivotTable"
        outlined={SOLE_BUTTON_OUTLINE}
        propsButton={SOLE_BUTTON_ROOT}
        onPopupOpen={() => setHeld(true)}
        onPopupClose={() => setHeld(false)}
      />
    </RangeToolbarPaper>
  );
};

export const defaultRenderPivotToolbar = (props: PivotToolbarRenderProps): React.ReactElement => {
  return <PivotToolbar {...props} />;
};

/** The collapse / expand button of a row or column group, in the outline gutter. */
export const defaultRenderOutlineButton = (props: OutlineButtonProps): React.ReactElement => {
  return <OutlineButton {...props}/>
}

/** A level button `1`..`n` of the outline. */
export const defaultRenderOutlineLevelButton = (props: OutlineLevelButtonProps): React.ReactElement => {
  return <OutlineLevelButton {...props}/>
}

export const defaultRenderMovableMenu = (props: MovableContextMenuProps): React.ReactElement => {
  return <MovableContextMenu {...props}/>
}

export const defaultRenderFillMenu = (props: FillMenuProps): React.ReactElement => {
  return <FillMenu {...props}/>
}

export const defaultRenderContextMenu = (props: WorkbookContextMenuProps): React.ReactElement => {
  return <WorkbookContextMenu {...props}/>
}

export const defaultRenderColumnMenu = (props: ColumnMenuProps): React.ReactElement => {
  return <ColumnMenu {...props}/>
}

export const defaultRenderPivotMenu = (props: PivotMenuProps): React.ReactElement => {
  return <PivotMenu {...props}/>
}

/**
 * The formula bar for the studio's placement: the desktop bar above the grid, the mobile host when
 * the bar sits at the bottom.
 */
export const defaultRenderFormulaBar = (props: FormulaBarProps): React.ReactElement => {
  if (props.placement === 'bottom') return <MobileFormulaBar {...props}/>;
  return <FormulaBar {...props}/>
}

export const defaultRenderWorkbookLoading = (props: AnimatedLoadingPanelProps): React.ReactElement => {
  return <AnimatedLoadingPanel
    transitionDelay='160ms'
    transparentBackground={true}
    {...props}
  />
}

export const defaultRenderWorkbookError = (props: StackTraceErrorPanelProps): React.ReactElement => {
  // A workbook that fails to load (e.g. an invalid file) is terminal for the open flow, so show a
  // simple, contained message card — no stack trace (not helpful to a user) and NOT `fullscreen`
  // (which stretches it to 70vw even for a short message). Consumers can pass a custom
  // `renderWorkbookError` if they want the stack or other affordances.
  return <StackTraceErrorPanel
    hideStackTrace={true}
    {...props}
  />
}

export const defaultRenderWorksheet = (props: WorksheetElementProps): React.ReactElement => {
  const { key, ...rest } = props;
  return <WorksheetElement key={key} {...rest}/>
}

export const defaultRenderStatusBar = (props: StatusBarProps): React.ReactElement => {
  const { key, ...rest } = props;
  return <StatusBar key={key} {...rest}/>
}

export const defaultRenderTabs = (props: WorkbookStripProps): React.ReactElement => {
  return <WorkbookStrip {...props}/>
}

export const defaultRenderSheetTabMenu = (props: SheetTabMenuProps): React.ReactElement => {
  return <SheetTabMenu {...props}/>
}

export const defaultRenderSheetsAll = (props: SheetsAllMenuProps): React.ReactElement => {
  return <SheetsAllMenu {...props}/>
}

/**
 * The sheet tab's clickable surface for the MUI studio: a `ButtonBase` (rendered as
 * a `div`) that re-adds the ripple the chromeless react tab omits. `disabled`
 * already suppresses the ripple in `ButtonBase`; only `editing` needs the explicit
 * opt-out (it keeps pointer events so the inline rename input still works).
 */
const SheetTabSurface = (props: SheetTabSurfaceProps): React.ReactElement => {
  const { disabled, editing, children, style, ...rest } = props;
  const theme = useTheme();
  return (
    <ButtonBase
      component="div"
      disabled={disabled}
      disableRipple={editing}
      focusRipple={false}
      style={{
        ...style,
        ['--sxl-tab-hover-bg' as any]: theme.palette.action.hover,
        ['--sxl-tab-hover-border' as any]: theme.palette.divider
      }}
      {...rest}
    >
      {children}
    </ButtonBase>
  );
}

export const defaultRenderSheetTab = (props: SheetTabProps): React.ReactElement => {
  return <SheetTab slotSurface={SheetTabSurface} {...props}/>
}
