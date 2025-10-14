import React, {
  memo, forwardRef, useRef, useLayoutEffect, useState
} from 'react';

// import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';
import { useMeasure } from 'react-use';

import { type SxProps } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { type TooltipProps } from '@mui/material';

import { useImperativeElement, useCallbackRef, DynamicIcon } from '@sheetxl/utils-react';

import {
  ExhibitTooltip, ExhibitPopupIconButton, type ExhibitPopupPanelProps,
  defaultCreatePopupPanel, useFloatStack, FloatReference
} from '@sheetxl/utils-mui';

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

  parentFloat?: FloatReference;

  /**
   * Reference to the underlying element
   */
  ref?: React.Ref<IOverflowPaletteElement>;
}

/**
 * Add children in a row layout but overflow into a popup.
 *
 * TODO
 * - Popup doesn't close on click submenu. This is due to useFloatStack not allowing 2 popups at the same parent (root)
 *   and we don't 're-anchor' the popup in the submenu as this would require cloning and is too invasive.
 *   The correct approach is to revisit useFloatStack and allow multiple children (with a flag) to be open to the same parent.
 * - Excel converts toolbar buttons to menu items. We could do this with the commands but would not be a 'general' solution and should
 *   be backed into CommandBar. (I sorta like the toolbar buttons better but will revisit.)
 */
export const OverflowPalette = memo(forwardRef<IOverflowPaletteElement, OverflowPaletteProps>(
  (props: OverflowPaletteProps, refForwarded) => {
  const {
    children,
    sx: propSx,
    parentFloat,
    ...rest
  } = props;

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
  const refsChildren = useRef<{ refs: React.RefObject<React.ReactElement>[]}>(null);
  const [_, forceRender] = React.useReducer((s: number) => s + 1, 0);

  /*
   * We do this in 2 renders. The first render layouts ouf the elements and get the bounds
   */
  const [refedChildren, setRefChildren] = useState<React.ReactElement[]>(null);
  /*
   * The second render set the display to none for items that are outside of bounds
   */
  const [inlinedChildren, setInlinedChildren] = useState<React.ReactElement[] | React.ReactNode>(null);
  // null means no initialized. Once resolved we set to an array (zero length if empty)
  const [popupChildren, setPopupChildren] = useState<React.ReactElement[]>(null);

  const {
    reference: floatRefOverflow,
  } = useFloatStack({
    parentFloat,
    label: 'overflow'
  });

  useLayoutEffect(() => {
    refsChildren.current = { refs: [] };
    const refChildren = [];

    const asArray = React.Children.toArray(children);
    let references = 0;
    const collectReference = () => {
      references++;
      if (references === asArray.length) {
        forceRender();
      }
    }
    asArray.forEach((child: React.ReactElement<any>, index: number) => {
      /*
       * We wrap in a div so that we can get the measure including margins
       * and add a reference (even for functional components).
      */
      refChildren.push((
        <Box
          sx={{
            display:'flex',
          }}
          key={index}
          ref={(el: Element) => {
            collectReference();
            const refChild = { current: null }; // child.props.ref ??
            refChild.current = el;
            refsChildren.current.refs[index] = refChild;
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
    const childrenRefs = refsChildren.current.refs;
    const childrenRefsLength = childrenRefs ? childrenRefs.length : 0;
    if (!refLocal.current || childrenRefsLength === 0) {
      setInlinedChildren(null);
      setPopupChildren(null);
      return;
    }

    const rect:DOMRect = refLocal.current?.getBoundingClientRect();
    const inlineChildren = [];
    const popupChildren = [];

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
      setInlinedChildren(null);
      setPopupChildren([]);
      return;
    }

    const rectPopup:DOMRect = refPopupMeasure.current?.getBoundingClientRect();
    runningTotal = 0;
    for (let i=0; i<childrenRefsLength; i++) {
      const childRef = childrenRefs[i];

      let inline = false;
      if (childRef.current) {
        const childRect:DOMRect = (childRef.current as unknown as any).getBoundingClientRect();
        runningTotal += childRect?.width;
        if (runningTotal < (rect.width - rectPopup.width)) {
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
    setInlinedChildren(inlineChildren.length > 0 ? inlineChildren : null);
    setPopupChildren(popupChildren.length > 0 ? popupChildren : null);
  }, [children, refedChildren, outerRect, floatRefOverflow, _]); // we trigger from inlineRect

  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const reanchoredChildren = [];
    const popupChildrenLength = popupChildren.length;
    for (let i=0; i<popupChildrenLength; i++) {
      // We manually unwrap the div we wrapped for measuring.
      // We then 're-anchor' the parent float to the overflow popup panel
      const asArray = React.Children.toArray(popupChildren[i]);
      const asWrapDiv = asArray[0] as React.ReactElement<any>;

      // Get all children, not just the first one
      const childrenToClone = React.Children.toArray(
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

        if (clonedProps.parentFloat && props) {
          clonedProps.parentFloat = props.floatReference;
        }

        const cloned = React.cloneElement(toClone, clonedProps);
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
    return defaultCreatePopupPanel({...props, children});
  }, [popupChildren]);

  return (
    <Box
      className="overflow-palette"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flex: '1 1 100%',
        width: '100%',
        maxWidth: '100%',
        ...propSx
      }}
      ref={mergeRefs([refLocal, refOuterMeasure, refForwarded]) as any}
      {...rest}
    >
      <Box
        sx={{
          flexDirection: 'row',
          display: 'flex',
          maxWidth: '100%',
          flex: '1 1 100%',
          alignItems: 'center',
          //flex: 'none', // setting to none will cause the popup button to be alight left. Not sure which is better
          // flexWrap: 'wrap'
        }}
      >
        {inlinedChildren ?? refedChildren}
      </Box>
      <Box
        className="overflow-palette-popup-button"
        sx={{
          display: (popupChildren !== null && popupChildren.length === 0) ? 'none' : 'flex', // Hide once initialized if no longer needed
          flex: '1 1 0',
        }}
      >
        <ExhibitPopupIconButton
          createPopupPanel={createPopupPanel as any}
          ref={refPopupMeasure}
          parentFloat={floatRefOverflow}
          createTooltip={({children}: TooltipProps, disabled: boolean) => {
            return (
              <ExhibitTooltip
                label="More"
                description={`More toolbar options\u2026`} // '...' // ellipsis
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