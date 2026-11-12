import type React from 'react';
import {
  memo, forwardRef, useRef, useLayoutEffect, useReducer, useState, useCallback, cloneElement,
  Children as ReactChildren
} from 'react';

// import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { type SxProps } from '@mui/system';
import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import {
  useMeasure, useImperativeElement, DynamicIcon, useTranslator, useFloat
} from '@sheetxl/utils-react';

import { registerUtilsMuiLocales } from '../locales';

// Module init (not per mount): this package's `t()` strings are fetched data. Called from the modules
// that actually use them — a barrel-file side effect would be tree-shaken (`sideEffects: false`).
registerUtilsMuiLocales();

import { ExhibitTooltip, ExhibitPopupIconButton } from '../button';
import { defaultRenderPopupPanel, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps } from '../float';

export interface OverflowPaletteAttributes {
}

/**
 * Type returned via ref property
 */
export interface IOverflowPaletteElement extends HTMLDivElement, OverflowPaletteAttributes {};

export interface OverflowPaletteProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  /**
   * Reference to the underlying element
   */
  ref?: React.Ref<IOverflowPaletteElement>;
}

/**
 * How the (wrapped) children are split between the inline row and the overflow popup.
 *
 * `null` = not measured yet. `inline: null` = everything fits.
 * An empty `inline` array is a real answer (nothing fits beside the 'more' button) and must stay
 * distinct from 'not measured yet'.
 */
interface Partition {
  inline: React.ReactElement[] | null;
  popup: React.ReactElement[];
}

// Stable identity so an 'everything fits' result doesn't churn the popup panel memo on every measure.
const EVERYTHING_FITS: Partition = { inline: null, popup: [] };

/**
 * Add children in a row layout but overflow into a popup with a 'more' button.
 *
 * TODO
 * - Excel converts toolbar buttons to menu items. We could do this with the commands but would not be a 'general' solution and should
 *   be backed into CommandBar. (I sorta like the toolbar buttons better but will revisit.)
 */
export const OverflowPalette = memo(forwardRef<IOverflowPaletteElement, OverflowPaletteProps>(
  (props: OverflowPaletteProps, refForwarded) => {
  const {
    children,
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  /*
   * Because React needs to render to get the bounds in React we are bit nuanced/complicated/convoluted.
   * The implementation strategy is:
   * 1. Wrap all elements in a div that we can ensure references (including function components) and measure (including margins).
   * 2. Event on reference updates (via the ref callback)
   * 3. Walk all references and measure moving elements to either the popup or inline.
   * 4. Rerender
   *
   * This strategy requires multiple renders.
   */

  const refLocal = useImperativeElement<IOverflowPaletteElement, unknown>(refForwarded, () => ({
    // Add additional attributes here
  }), []);

  const [refOuterMeasure, outerRect] = useMeasure<HTMLElement>();

  const refPopupMeasure = useRef<HTMLElement>(null);
  const refsChildren = useRef<{ refs: { current: Element | null }[]} | null>(null);
  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  /*
   * We do this in 2 renders. The first render layouts ouf the elements and get the bounds
   */
  const [refedChildren, setRefChildren] = useState<React.ReactElement[] | null>(null);
  /*
   * The second render moves the items that are outside of the bounds into the popup.
   */
  const [partition, setPartition] = useState<Partition | null>(null);
  // null means not initialized. Once resolved we set to an array (zero length if empty)
  const popupChildren: React.ReactElement[] | null = partition?.popup ?? null;

  /*
   * The 'more' button is `display: none` while everything fits, so its width reads as 0 exactly when
   * we need to reserve room for it. Keep the last real measurement.
   */
  const refPopupWidth = useRef<number>(0);

  /*
   * The panel repartitions live while it is open. The one state it cannot survive is *empty*: a
   * panel with no children collapses to a stub (the little square), and the button it is anchored to
   * would `display: none` out from under it. So crossing into 'everything fits' dismisses it.
   *
   * The float we are rendered inside is the toolbar's, which the overflow popup also resolves as its
   * parent when it opens — so `closeChild()` dismisses exactly it. Null without an enclosing float,
   * where the button simply stays visible instead.
   */
  const [isPopupOpen, setPopupOpen] = useState<boolean>(false);
  const refPopupOpen = useRef<boolean>(false);
  const enclosingFloat = useFloat();
  const refEnclosingFloat = useRef(enclosingFloat);
  refEnclosingFloat.current = enclosingFloat;

  const dismissPopup = useCallback(() => {
    refEnclosingFloat.current?.closeChild(0);
  }, []);

  const handlePopupOpen = useCallback(() => {
    refPopupOpen.current = true;
    setPopupOpen(true);
  }, []);
  const handlePopupClose = useCallback(() => {
    refPopupOpen.current = false;
    setPopupOpen(false);
  }, []);

  /*
   * Children widths are not static after the first measure: locale catalogs land async (labels sit at
   * the raw key's width until then — NumberFormatCommandButton literally sizes to the measured label),
   * and fonts/icons load late. The outer `useMeasure` only sees *container* resizes, so a child-only
   * width change left a stale partition (clipped icons, or a needless popup) until the window was
   * resized. We record each wrapper's width at measure time and observe them; a real change restarts
   * the measure cycle.
   */
  const refChildObserver = useRef<ResizeObserver>(null);
  const refMeasuredWidths = useRef<Map<Element, number>>(new Map());

  const remeasure = useCallback(() => {
    refMeasuredWidths.current.clear();
    setPartition(null);
    forceRender();
  }, []);

  useLayoutEffect(() => {
    refsChildren.current = { refs: [] };
    const refChildren: React.ReactElement[] = [];

    const asArray = ReactChildren.toArray(children);
    let references = 0;
    const collectReference = () => {
      references++;
      if (references === asArray.length) {
        forceRender();
      }
    }
    asArray.forEach((child, index: number) => {
      /*
       * We wrap in a div so that we can get the measure including margins
       * and add a reference (even for functional components).
       *
       * `flex: 0 0 auto` is load bearing. A shrinkable wrapper lets the row squeeze its buttons
       * rather than overflow, so the row never measures as too wide (nothing moves to the popup) and
       * the buttons render crushed instead. It also keeps the measured width the *natural* width,
       * which is what the partition below compares against.
      */
      refChildren.push((
        <Box
          sx={{
            display:'flex',
            flex: '0 0 auto'
          }}
          key={index}
          ref={(el: Element) => {
            collectReference();
            const refChild: { current: Element | null } = { current: null }; // child.props.ref ??
            refChild.current = el;
            refsChildren.current!.refs[index] = refChild;
            // return refChild;
          }}
        >
          {child}
        </Box>
      ));
    });
    setRefChildren(refChildren);
  }, [children, outerRect]);


  useLayoutEffect(() => {
    if (!refedChildren) return;
    const childrenRefs = refsChildren.current?.refs ?? [];
    const childrenRefsLength = childrenRefs.length;
    if (!refLocal.current || childrenRefsLength === 0) {
      setPartition(null);
      return;
    }

    const rect:DOMRect = refLocal.current?.getBoundingClientRect();
    const inlineChildren = [];
    const popupChildren = [];

    // Snapshot every wrapper's width and observe it. Fires only on a *real* change from what we
    // measured (async label/font/icon load); wrappers detached by the partition are ignored.
    const watchMeasured = () => {
      let observer = refChildObserver.current;
      if (!observer) {
        observer = refChildObserver.current = new ResizeObserver((entries) => {
          for (let i=0; i<entries.length; i++) {
            const target = entries[i].target;
            if (!target.isConnected) continue; // unmounted (moved to popup), not a width change
            const measured = refMeasuredWidths.current.get(target);
            if (measured === undefined) continue;
            if (Math.abs(target.getBoundingClientRect().width - measured) > 0.5) {
              remeasure();
              return;
            }
          }
        });
      } else {
        observer.disconnect();
      }
      refMeasuredWidths.current.clear();
      for (let i=0; i<childrenRefsLength; i++) {
        const el = childrenRefs[i]?.current as unknown as Element;
        if (!el) continue;
        refMeasuredWidths.current.set(el, el.getBoundingClientRect().width);
        observer.observe(el);
      }
    };

    let runningTotal = 0;
    // Scan 2x. 1. To see if we need a popup. 2. To calc the available space (minus the popup)
    let needsPopup = false;
    for (let i=0; !needsPopup && i<childrenRefsLength; i++) {
      const childRef = childrenRefs[i];
      if (!childRef) continue;
      if (!childRef.current) {
        needsPopup = true; // already  trimmed
        continue;
      }
      const childRect:DOMRect = (childRef.current as unknown as any).getBoundingClientRect();
      runningTotal += childRect?.width;
      if (runningTotal > rect.width) {
        needsPopup = true;
      }
    }
    if (!needsPopup) {
      watchMeasured();
      // Nothing left to overflow. An open panel would be emptied down to a stub, so send it away
      // before the button it is anchored to goes.
      if (refPopupOpen.current) {
        dismissPopup();
      }
      setPartition(EVERYTHING_FITS);
      return;
    }

    const rectPopup: DOMRect | undefined = refPopupMeasure.current?.getBoundingClientRect();
    if (rectPopup?.width) {
      refPopupWidth.current = rectPopup.width;
    }
    const available = rect.width - refPopupWidth.current;
    runningTotal = 0;
    for (let i=0; i<childrenRefsLength; i++) {
      const childRef = childrenRefs[i];

      let inline = false;
      if (childRef.current) {
        const childRect:DOMRect = (childRef.current as unknown as any).getBoundingClientRect();
        runningTotal += childRect?.width;
        if (runningTotal <= available) {
          inline = true;
        }
      }

      if (inline) {
        inlineChildren.push(refedChildren[i]);
      } else {
        popupChildren.push(refedChildren[i]);
      }
    }
    // console.log('update children', runningTotal, rect, inlineChildren.length, popupChildren.length, refPopupMeasure.current);
    watchMeasured();
    /*
     * `inline` stays an array even when empty. "Nothing fits beside the 'more' button" is a real
     * answer for a very narrow container; folding it back into the 'not measured yet' null put every
     * child back into the inline row, which is what made a narrow palette spill out of its container
     * instead of collapsing to the 'more' button.
     */
    setPartition({ inline: inlineChildren, popup: popupChildren });
  }, [children, refedChildren, outerRect, _]); // we trigger from inlineRect

  useLayoutEffect(() => {
    return () => {
      refChildObserver.current?.disconnect();
      refChildObserver.current = null;
    };
  }, []);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const reanchoredChildren: React.ReactElement[] = [];
    // popupChildren is null until measured (and the panel memo may run before then).
    const popupChildrenLength = popupChildren?.length ?? 0;
    for (let i=0; i<popupChildrenLength; i++) {
      // We manually unwrap the div we wrapped for measuring. The overflow
      // popup's float reaches these children via context (FloatStackProvider),
      // so no manual parent re-anchoring is needed.
      const asArray = ReactChildren.toArray(popupChildren![i]);
      const asWrapDiv = asArray[0] as React.ReactElement<any>;

      // Get all children, not just the first one
      const childrenToClone = ReactChildren.toArray(
        asWrapDiv.props.children?.props?.children ?? asWrapDiv.props.children
      );

      // Process ALL children, not just the first
      childrenToClone.forEach((child, childIndex) => {
        const toClone = child as React.ReactElement<any>;
        const clonedProps = {
          ...toClone.props,
          //   // style: {
          //   //   ...toClone.props?.style,
          //   //   background: 'pink' // For debugging
          //   // }
          // Preserve existing key if present, otherwise create a unique one
          key: `overflow-${i}-${childIndex}${toClone.key ?? ''}`,
        };

        const cloned = cloneElement(toClone, clonedProps);
        reanchoredChildren.push(cloned);
      });
    }

    const children = (
      <Box
        className="overflow-palette-popup-panel"
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          rowGap: (theme: Theme) => theme.spacing(0.25),
          paddingTop: (theme: Theme) => theme.spacing(0.5),
          paddingBottom: (theme: Theme) => theme.spacing(0.5),
          paddingLeft: (theme: Theme) => theme.spacing(1),
          paddingRight: (theme: Theme) => theme.spacing(1),
          overflow: 'hidden'
        }}
      >
        {reanchoredChildren}
      </Box>
    );
    return defaultRenderPopupPanel({...props, children});
  }, [popupChildren]);

  const refMerged = useMergeRefs([refLocal, refOuterMeasure, refForwarded]);
  return (
    <Box
      className="overflow-palette"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        // The palette owns its own overflow (the popup); an ancestor row that wraps must not get a
        // second say and push part of the row onto a line below.
        flexWrap: 'nowrap',
        flex: '1 1 100%',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        ...propSx
      }}
      ref={refMerged as any}
      {...rest}
    >
      <Box
        sx={{
          flexDirection: 'row',
          display: 'flex',
          flexWrap: 'nowrap',
          maxWidth: '100%',
          flex: '1 1 100%',
          // `min-width: auto` would floor this at the min-content of the (non shrinking) buttons, so
          // the row would push the 'more' button out of the container and squash it to its glyph
          // rather than give up the space. `overflow: hidden` clips the transient pass where
          // everything is inline to be measured.
          minWidth: 0,
          overflow: 'hidden',
          alignItems: 'center',
          //flex: 'none', // setting to none will cause the popup button to be alight left. Not sure which is better
          // flexWrap: 'wrap'
        }}
      >
        {partition?.inline ?? refedChildren}
      </Box>
      <Box
        className="overflow-palette-popup-button"
        sx={{
          // Hide once initialized if no longer needed, but never while it is anchoring an open panel.
          display: (!isPopupOpen && popupChildren !== null && popupChildren.length === 0) ? 'none' : 'flex',
          // Natural width, never shrunk — this is also the width reserved for it when partitioning.
          flex: '0 0 auto',
          alignItems: 'center'
        }}
      >
        <ExhibitPopupIconButton
          renderPopupPanel={renderPopupPanel as any}
          ref={refPopupMeasure}
          onPopupOpen={handlePopupOpen}
          onPopupClose={handlePopupClose}
          renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
            return (
              <ExhibitTooltip
                label={t('overflow.more')}
                description={t('overflow.moreDescription')}
                disabled={disabled}
              >
                {children}
              </ExhibitTooltip>
            );
          }}
          icon={
            <DynamicIcon iconKey='MoreHorizontal'/>
          }
        />
      </Box>
    </Box>
  );
}));
