import { memo, forwardRef, useMemo } from 'react';

import { ExhibitFloatProvider } from '@sheetxl/utils-mui';

import { TooltipProvider, useTooltipSurface } from '@sheetxl/grid-react';

import {
  WorkbookElement as ReactWorkbookElement, type WorkbookElementProps, type IWorkbookElement,
  type WorksheetElementProps
} from '@sheetxl/react';

import {
  defaultRenderMovableMenu, defaultRenderColumnMenu, defaultRenderPivotMenu, defaultRenderContextMenu, defaultRenderFillMenu,
  defaultRenderWorkbookLoading, defaultRenderTabs, defaultRenderCommentCard, defaultRenderHyperlinkCard,
  defaultRenderTableToolbar, defaultRenderPivotToolbar, defaultRenderOutlineButton, defaultRenderOutlineLevelButton, defaultRenderTooltip
} from './DefaultRenderers';

/**
 * The MUI workbook element.
 *
 * A thin wrapper around the chromeless `WorkbookElement` from `@sheetxl/react`: it supplies the grid's
 * own MUI popups (tabs, context/column/movable menus, comment cards, loading, tooltips) via the render
 * slots. A slot left `undefined` gets the MUI default; `null` turns it off. Theming flows through the
 * injected `--sxl-*` token matrix (from the studio root) — no theme bridge is needed here; the grid
 * self-sources its light/dark scheme from the shared appearance preference. The surrounding chrome
 * (toolbar, formula bar, status bar) is composed by the Studio layer, not here.
 */
export const WorkbookElement = memo(forwardRef<IWorkbookElement, WorkbookElementProps>(
  (props: WorkbookElementProps, refForwarded) => {
  const {
    renderTabs = defaultRenderTabs,
    renderContextMenu = defaultRenderContextMenu,
    renderColumnMenu = defaultRenderColumnMenu,
    renderPivotMenu = defaultRenderPivotMenu,
    renderMovableMenu = defaultRenderMovableMenu,
    renderFillMenu = defaultRenderFillMenu,
    renderWorkbookLoading = defaultRenderWorkbookLoading,
    propsSheet: propPropsSheet,
    ...rest
  } = props;

  const propsSheet = useMemo((): Partial<WorksheetElementProps> => {
    const {
      renderCommentCard = defaultRenderCommentCard,
      // The hyperlink card shows no preview of the linked page unless the host turns one on
      // (`propsSheet.propsHyperlink.preview`): a preview is a request to a third party per hovered link.
      renderHyperlinkCard = defaultRenderHyperlinkCard,
      renderTableToolbar = defaultRenderTableToolbar,
      renderPivotToolbar = defaultRenderPivotToolbar,
      propsOutline,
      ...restSheet
    } = propPropsSheet ?? {};
    return {
      ...restSheet,
      renderCommentCard,
      renderHyperlinkCard,
      renderTableToolbar,
      renderPivotToolbar,
      propsOutline: {
        ...propsOutline,
        renderButton: propsOutline?.renderButton === undefined ? defaultRenderOutlineButton : propsOutline.renderButton,
        renderLevelButton: propsOutline?.renderLevelButton === undefined
          ? defaultRenderOutlineLevelButton : propsOutline.renderLevelButton
      }
    };
  }, [propPropsSheet]);

  // A host's own `TooltipProvider` bubble wins; the MUI one is only the default.
  const { renderTooltip: inheritedTooltip } = useTooltipSurface();
  return (
    <ExhibitFloatProvider>
      <TooltipProvider renderTooltip={inheritedTooltip ?? defaultRenderTooltip}>
        <ReactWorkbookElement
          ref={refForwarded}
          {...rest}
          renderTabs={renderTabs}
          renderContextMenu={renderContextMenu}
          renderColumnMenu={renderColumnMenu}
          renderPivotMenu={renderPivotMenu}
          renderMovableMenu={renderMovableMenu}
          renderFillMenu={renderFillMenu}
          renderWorkbookLoading={renderWorkbookLoading}
          propsSheet={propsSheet}
        />
      </TooltipProvider>
    </ExhibitFloatProvider>
  );
}));

WorkbookElement.displayName = 'WorkbookElement';
