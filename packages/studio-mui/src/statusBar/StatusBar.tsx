import type React from 'react';
import {
  useRef, useEffect, useLayoutEffect, useState, memo, forwardRef, useMemo
} from 'react';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { type Theme } from '@mui/material';
import { Typography } from '@mui/material';

import { CommonUtils } from '@sheetxl/sdk';

import { DynamicIcon, useEditMode, useTranslator, exitEditMode } from '@sheetxl/utils-react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import { useReferenceMode } from '@sheetxl/react';

import { SheetZoomScale } from './SheetZoomScale';
import { NumberStats } from './NumberStats';
import { CircularReferenceStatus } from './CircularReferenceStatus';
import { CalculationRequiredStatus } from './CalculationRequiredStatus';
import { PendingStatus } from './PendingStatus';

/**
 * How long, in ms, the bus must hold a mode before the bar shows it. Rapid edits switch the mode on
 * and off faster than that, and the bar would flicker with them.
 */
const MODE_SETTLE_MS = 150;

/** `value` once it has held for `delay` ms; until then, the value that last did. */
const useSettled = <T,>(value: T, delay: number): T => {
  const [settled, setSettled] = useState<T>(value);
  useEffect(() => {
    if (value === settled) return;
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, settled, delay]);
  return settled;
};

export interface StatusBarItem {
  /**
   * Use for identifying the item
   */
  key: string;
  /**
   * Create the status bar element to show in the status bar
   * @param props
   */
  createElement(props: React.HTMLAttributes<HTMLDivElement>): React.ReactElement;
  /**
   * A label use for toggling visibility or identification
   */
  createLabel(): string;
  /**
   * Should we show a divider before this item
   */
  // TODO - is group?
  hasDivider?: boolean;
}

export interface StatusBarProps extends React.HTMLAttributes<HTMLDivElement>, React.Attributes {
  childrenEnd?: React.ReactNode | undefined; // TODO - replace with items

  items?: StatusBarItem[];

  ref?: React.Ref<StatusBarElement>;
}

export interface StatusBarAttributes {
  // No returns yet
}

export interface StatusBarElement extends HTMLDivElement, StatusBarAttributes {};

/**
 * This show the current cell state as an unstyled editable field.
 * This wraps this with material styling and submit and cancel buttons
 */

// TODO - useFloat to create Context Menu
// TODO - use Items to create status bar items
export const StatusBar = memo(
  forwardRef<StatusBarElement, StatusBarProps>((props, refForwarded) => {
  const {
    style: propStyle,
    className: propClassName,
    // workbook,
    children, // disallow
    childrenEnd,
    items,
    ...rest
  } = props;

  /* Expose some methods in ref */
  // useImperativeElement(refForwarded, () => {
  //   return {
  //     isStatusBar: () => true
  //   };
  // });

  const refLocal = useRef<HTMLDivElement>(null);
  // Note - This isn't working because the Workbook is not returning a correct ref.
  // This should be at workbook standalone. Not here
  useEffect(() => {
    const handleWheel = (e: globalThis.WheelEvent) => e.preventDefault();
    refLocal.current?.addEventListener("wheel", handleWheel, {
       passive: false,
     });
    return () => {
      refLocal.current?.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const editModeHandler = useEditMode();
  // Point mode rides its own bus (the reference/point dimension, sibling of edit-mode), so read it
  // directly — `mode: 'point'` (armed picking) supersedes the edit-mode label ("Enter"/"Edit"), exactly
  // as Excel shows "Point" in the status bar while pointing.
  const referenceModeHandler = useReferenceMode();
  const isPointing = referenceModeHandler.getMode()?.mode === 'point';
  const t = useTranslator(); // mode labels bake t() strings; `t` identity is the memo dep
  // The bar shows the mode once it has settled (see MODE_SETTLE_MS); a press acts on the live one.
  const liveMode = editModeHandler.getMode();
  const refLiveMode = useRef(liveMode);
  refLiveMode.current = liveMode;
  const mode = useSettled(liveMode, MODE_SETTLE_MS);
  const modeMessage = useMemo(() => {
    if (isPointing) return t('statusBar.point');
    if (mode?.description) {
      // EditMode descriptions (marching ants, drag modes) are declared with `messageKey`, so the
      // STORED value is a key — resolve it here, at display, and it follows a language switch.
      // Key-only form: a miss renders the key, so a plain-text description passes through unchanged.
      return t(mode.description);
    }
    return t('statusBar.ready');
  }, [mode, isPointing, t]);
  // The mode's ways out from chrome, ahead of its description as the formula bar orders them: ✕
  // (cancel) and ✓ (do and be done). A phone has no Escape or Enter, so these are the only ways out
  // there; they show on every device because one rule is simpler than a per-device one.
  const cancelMode = mode?.cancel;
  const doneMode = mode?.done;
  const hasWaysOut = !!(cancelMode || doneMode);

  // A mode with ways out wins the bar: when its buttons and description do not fit beside the rest,
  // the rest goes (all of it; `childrenEnd` stays) rather than the description being cut. Held for
  // the message it was hidden for, and until the bar is wider than it was when hidden.
  const refModeText = useRef<HTMLDivElement>(null);
  const [restHiddenFor, setRestHiddenFor] = useState<{ message: string, width: number } | null>(null);
  const restHidden = hasWaysOut && restHiddenFor?.message === modeMessage;
  useLayoutEffect(() => {
    if (!hasWaysOut) {
      if (restHiddenFor) setRestHiddenFor(null);
      return;
    }
    if (restHidden) return;
    const text = refModeText.current;
    const bar = refLocal.current;
    if (!text || !bar || text.scrollWidth <= text.clientWidth) return;
    setRestHiddenFor({ message: modeMessage, width: bar.clientWidth });
  });
  useEffect(() => {
    const bar = refLocal.current;
    if (!restHidden || !bar || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (bar.clientWidth > restHiddenFor!.width) setRestHiddenFor(null);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [restHidden, restHiddenFor]);

  const elementMode = useMemo(() => {
    // The press must not move focus: the mode's owner (the cell editor, the grid) keeps it, and on a
    // phone the keyboard stays where it is.
    const keepFocus = (e: React.MouseEvent<HTMLElement>): void => { if (e.button !== 0) return; e.preventDefault(); };
    // The live mode, while it is still the kind shown; a press in the moment the bar lags does nothing.
    const exit = (how: 'done' | 'cancel'): void => {
      const live = refLiveMode.current;
      if (live && live.key === mode?.key) exitEditMode(live, how);
    };
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: '1 1 auto',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          minWidth: '3rem' // length of ready
        }}
      >
        {cancelMode && (
          <ExhibitIconButton
            aria-label="cancel-mode"
            color="warning"
            icon={<DynamicIcon iconKey="CloseError" />}
            propsTooltip={{ label: t('statusBar.cancelMode'), simple: true }}
            onMouseDown={keepFocus}
            onClick={() => exit('cancel')}
            sx={{ marginRight: '4px' }}
          />
        )}
        {doneMode && (
          <ExhibitIconButton
            aria-label="done-mode"
            color="primary"
            icon={<DynamicIcon iconKey="CheckSuccess" />}
            propsTooltip={{ label: t('statusBar.doneMode'), simple: true }}
            onMouseDown={keepFocus}
            onClick={() => exit('done')}
            sx={{ marginRight: '4px' }}
          />
        )}
        <Typography
          ref={refModeText}
          component="div"
          sx={{
            flex: '0 1 auto',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            // height: '1rem',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          variant="caption"
        >
          {modeMessage}
        </Typography>
      </div>
    );
  }, [modeMessage, mode, cancelMode, doneMode, t]);

  const elementItems = useMemo<React.ReactNode[]>(() => {
    if (!items || items.length === 0) {
      return CommonUtils.EmptyArray;
    }
    return items.map((item) => {
      return (
        <div
          key={item.key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          { item.createElement({}) }
        </div>
      );
    });
  }, [items]);

  const elementNumStats = useMemo(() => {
    return (
      <div
        style={{
          // overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <NumberStats
          style={{
            overflow: 'hidden',
            minWidth: 0,
            flex: '1 1 auto',
            maxWidth: 'fit-content',
            justifySelf: 'end',
          }}
          // workbook={workbook}
        />
      </div>
    )
  }, []);

  const elementZoom = useMemo(() => {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          // gap: 1,
        }}
      >
        <SheetZoomScale
          sx={{
            // hardcoded to make the slider width the same as excel desktop inclusive of +/- padding
            // weirdly 'looks' smaller than excel but screen measure shows it's not. On small screens the
            // slider hides itself (see SheetZoomScale) and only the percent button remains.
            minWidth: { xs: 0, sm: "190px" }
          }}
        />
      </div>
    );
  }, []);

  const refMerged = useMergeRefs([refLocal, refForwarded]);
  return (
    <div
      {...rest}
      className={clsx('statusBar', propClassName)}
      ref={refMerged as React.Ref<HTMLDivElement>}
      style={{
        display: "flex",
        alignItems: "stretch",
        flex: "0",
        paddingLeft: "12px",
        paddingRight: "12px",
        gap: '8px',
        minHeight: "calc(1em + 8px)",
        // The status bar's segment of the seam framing the grid — a shadow, not a border, so it doesn't take
        // part in this element's box sizing. Same `--sxl-color-base-border` the chrome above it draws with.
        boxShadow: '0px -1px 0px var(--sxl-color-base-border, light-dark(rgba(0, 0, 0, 0.26), rgba(255, 255, 255, 0.3)))',
        zIndex: 1000, // To ensure box shadow is above item before it
        ...propStyle
      }}
      // onContextMenu={handleContextMenu}
    >
      {/** Column 1: Mode display - fits content, won't shrink until necessary */}
      {elementMode}
      {/* <div style={{flex: '1 1 100%', background: 'pink'}}/> */}
      {/* `contents`, so the items lay out as the bar's own children; `none` keeps them mounted. */}
      <div className="statusBar-items" style={{ display: restHidden ? 'none' : 'contents' }}>
        {children}
        {/* Anchored beside the number stats, not the mode text, so it never drifts with the
            mode message's length. Empty on a clean sheet. */}
        <CircularReferenceStatus />
        {/* Manual mode's `Calculate` (F9) — empty otherwise. */}
        <CalculationRequiredStatus />
        {/* Async results being waited for, and live streams; pressing it cancels them. Empty otherwise. */}
        <PendingStatus />
        {/** Column 2: Number labels - shrinks first, can go down to 80px */}
        {elementNumStats}
        {elementItems}
        {elementZoom}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          // gap: 1,
          // minWidth: '30px'
        }}
      >
        { childrenEnd }
      </div>
      {/* <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        hideBackdrop={true}
        anchorReference="anchorPosition"
        anchorPosition=
          {contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
          }
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
            }
          }
        }}
      >
        <ExhibitMenuItem onClick={handleCloseContextMenu}>
          Customize Status Bar
        </ExhibitMenuItem>
        <ExhibitMenuItem onClick={handleCloseContextMenu}>
          Show/Hide Items
        </ExhibitMenuItem>
        <ExhibitMenuItem onClick={handleCloseContextMenu}>
          Placeholder Item 3
        </ExhibitMenuItem>
      </Menu> */}
    </div>
    );
  })
);

StatusBar.displayName = "StatusBar";