import type React from 'react';
import { useRef, memo, forwardRef } from 'react';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { useMeasure, type SplitPaneProps, SplitPane, usePersistentState } from '@sheetxl/utils-react';

import { useTheme, type Theme } from '@mui/material';

import styles from './StudioSplitPane.module.css';


/** Whether the split is a horizontal (`row`) or vertical (`column`) divider. */
export type SplitPaneOrientation = 'row' | 'column';
/** Which side the task pane sits on. `before` = `taskSide: 'left'`, `after` = `taskSide: 'right'`. */
export type SplitPaneSide = 'before' | 'after';
/**
 * A layout slot key, `${orientation}:${side}` (e.g. `'row:after'`). The resized position is meaningfully
 * different per slot (a horizontal drag isn't a vertical drag, a left pane isn't a right pane), so persisted
 * positions are stored as a map keyed by this. New slots populate lazily as they are used.
 */
export type SplitPaneLayoutKey = `${SplitPaneOrientation}:${SplitPaneSide}`;

/** Context describing which layout slot a position change belongs to. */
export interface SplitPaneLayout {
  orientation: SplitPaneOrientation;
  side: SplitPaneSide;
  key: SplitPaneLayoutKey;
}

export interface StudioSplitPaneProps extends React.HTMLAttributes<HTMLDivElement> {

  mainElement?: React.ReactElement;

  sidebarElement?: React.ReactElement;

  /**
   * The split position. Either a single value (percent as a `number` or `'40%'`, pixels as `'280px'`) applied
   * to whatever layout is active, or a map keyed by {@link SplitPaneLayoutKey} of per-slot percents. Slots
   * missing from the map (or an omitted `position`) fall back to `'40%'`.
   *
   * @remarks When {@link persistKey} is set this acts as the SEED: a slot the user has already resized reads
   * from the persisted map, and any slot they haven't yet resized falls back to this (so `position` wins on
   * first load).
   */
  position?: number | string | Partial<Record<SplitPaneLayoutKey, number>>;

  /**
   * When set, the split position is self-managed and persisted under this key (via `usePersistentState`
   * against the surrounding persistence store) as a per-slot map. The resized position of each layout slot
   * (horizontal vs vertical split, and eventually before/after side) is remembered independently. Any slot
   * not yet resized is seeded from {@link position}; {@link onPositionChange} still fires if provided.
   */
  persistKey?: string;

  /**
   * Fired when the user finishes dragging the resizer (not during drag). The second argument identifies the
   * active layout slot so a caller persisting a per-slot map knows which entry to update.
   */
  onPositionChange?: (position: { pixels: number, percent: number }, layout: SplitPaneLayout) => void;

  /**
   * Whether the layout should be right to left. This will flip the order of the panes and the direction of the split.
   *
   * @defaultValue 'left'
   */
  taskSide?: 'left' | 'right';
}

/** Resolve the position for the active layout slot to a value `SplitPane` understands. */
const resolvePosition = (
  position: number | string | Partial<Record<SplitPaneLayoutKey, number>> | undefined,
  key: SplitPaneLayoutKey
): number | string => {
  if (position == null) return '40%';
  if (typeof position === 'number' || typeof position === 'string') return position;
  const percent = position[key];
  return percent != null ? `${percent}%` : '40%';
};

/** Stable default so `usePersistentState` doesn't re-seed on every render. */
const _EmptyPositions: Partial<Record<SplitPaneLayoutKey, number>> = {};

const styleFlexFull: React.CSSProperties = {
  flex: `1 1 100%`,
  display: 'flex',
  boxSizing: 'border-box'
}

/**
 * Wraps a Workbook element and a taskPane into a split pane.
 *
 * @remarks
 * This adds a split pane to support the task pane alongside the workbook.
 */
export const StudioSplitPane = memo(
  forwardRef<HTMLDivElement, StudioSplitPaneProps>((props, refForwarded) => {
  const {
    mainElement,
    sidebarElement,
    position,
    persistKey,
    onPositionChange,
    className: propClassName,
    style: propsStyle,
    taskSide = 'right',
    ...rest
  } = props;

  // Self-managed persistence: when `persistKey` is set the per-slot position map is owned here (a `null` key
  // makes `usePersistentState` behave as plain local state, so the hook is always called). A persisted slot
  // wins, but any slot the user hasn't resized yet is SEEDED from the `position` prop (see resolution below).
  const [persistedPositions, setPersistedPositions] =
    usePersistentState<Partial<Record<SplitPaneLayoutKey, number>>>(persistKey ?? null, _EmptyPositions);

  const appTheme:Theme = useTheme();
  const [refMeasureContainer, { width: widthContainer }] = useMeasure<HTMLDivElement>();
  const isStandardScreen =  widthContainer > 530 || widthContainer === 0; // when 0 we are not yet measured

  const refLocal = useRef<HTMLDivElement>(null);

  let path = null;
  let width = 4;
  let height = 13;
  if (isStandardScreen) {
    path = 'm 3.6261898,11.36243 c 0,0.88365 -0.71627,1.59991 -1.59991,1.59991 -0.8836498,0 -1.60004965,-0.71626 -1.60004965,-1.59991 0,-0.88365 0.71639985,-1.6000508 1.60004965,-1.6000508 0.88364,0 1.59991,0.7164008 1.59991,1.6000508 m 0,-4.881294 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 -0.8836498,0 -1.60004965,-0.7164 -1.60004965,-1.60004 0,-0.88365 0.71639985,-1.60005 1.60004965,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-4.881226 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 1.14263,3.19996 0.42623015,2.48356 0.42623015,1.59991 0.42623015,0.71626 1.14263,0 2.0262798,0 c 0.88364,0 1.59991,0.71626 1.59991,1.59991';
  } else {
    path = 'M 1.59991,3.62619 C 0.71626,3.62619 0,2.90992 0,2.02628 0,1.1426301 0.71626,0.42623015 1.59991,0.42623015 c 0.88365,0 1.6000508,0.71639995 1.6000508,1.60004985 0,0.88364 -0.7164008,1.59991 -1.6000508,1.59991 m 4.881294,0 c -0.88364,0 -1.60004,-0.71627 -1.60004,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60004,-1.60004985 0.88365,0 1.60005,0.71639995 1.60005,1.60004985 0,0.88364 -0.7164,1.59991 -1.60005,1.59991 m 4.881226,0 c -0.88365,0 -1.60005,-0.71627 -1.60005,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60005,-1.60004985 0.88365,0 1.59991,0.71639995 1.59991,1.60004985 0,0.88364 -0.71626,1.59991 -1.59991,1.59991';
    width = 13;
    height = 4;
  }

  let propsPaneBefore: React.HTMLAttributes<HTMLElement>;
  let propsPaneAfter: React.HTMLAttributes<HTMLElement>;
  let elementBefore = mainElement;
  let elementAfter = sidebarElement;

  let propsPane: SplitPaneProps;

  const isLeft = taskSide !== 'right';
  // The active layout slot: horizontal vs vertical split, and which side the task pane is on. Persisted
  // positions are stored per slot (see SplitPaneLayoutKey), so resolve/report against this.
  const orientation: SplitPaneOrientation = isStandardScreen ? 'row' : 'column';
  const side: SplitPaneSide = (isLeft && elementAfter) ? 'before' : 'after';
  const layoutKey: SplitPaneLayoutKey = `${orientation}:${side}`;
  // Persisted slot wins; otherwise seed from the `position` prop (scalar or partial map), else '40%'.
  const persistedSlot = persistKey ? persistedPositions[layoutKey] : undefined;
  const resolvedPosition = persistedSlot != null
    ? `${persistedSlot}%`
    : resolvePosition(position, layoutKey);
  const handlePositionChange = (persistKey || onPositionChange)
    ? (pos: { pixels: number, percent: number }) => {
        if (persistKey) {
          setPersistedPositions((prev) => ({ ...prev, [layoutKey]: pos.percent }));
        }
        onPositionChange?.(pos, { orientation, side, key: layoutKey });
      }
    : undefined;
  // TODO - allow either side to be missing. currently only after is allowed
  if (isLeft && elementAfter) { // if single must be after
    elementBefore = sidebarElement;
    elementAfter = mainElement;
    propsPaneAfter = {
      style: {
        flexDirection: 'column',
        boxSizing: 'border-box',
        paddingRight: '2px'
        // marginRight: sidebarElement ? '8px' : undefined,
      }
    }
    propsPaneBefore = {
      // style: {
      // //   marginLeft: isStandardScreen ? '0px' : '4px',
      //   marginRight: isStandardScreen ? '8px' : '4px'
      // }
    }
    propsPane = {
      fixedPane: 'before',
      position: resolvedPosition,
      minBefore: isStandardScreen ? '280px' : '120px',
      splitDirection: isStandardScreen ? 'row' : 'column'
    }
  } else {
    propsPaneBefore = {
      style: {
        flexDirection: 'column',
        marginRight: !sidebarElement ? '6px' : undefined,
      }
    }
    propsPaneAfter = {
      style: {
        marginLeft: isStandardScreen ? '0px' : '4px',
        marginRight: isStandardScreen ? '8px' : '4px'
      }
    }
    propsPane = {
      fixedPane: 'after',
      position: resolvedPosition,
      minAfter: isStandardScreen ? '280px' : '120px',
      splitDirection: isStandardScreen ? 'row' : 'column'
    }
  }

  const refMerged = useMergeRefs([refLocal, refMeasureContainer, refForwarded]);
  return (
    <SplitPane
      ref={refMerged as React.Ref<HTMLDivElement>}
      className={propClassName}
      style={propsStyle ? { ...styleFlexFull, ...propsStyle } : styleFlexFull}
      {...rest as any} // TODO - fix types
      {...propsPane}
      onPositionChange={handlePositionChange}

      propsResizer={{
        className: clsx('styled-resizer', styles['styled-resizer']),
        // todo - move this to css
        style: {
          minWidth: isStandardScreen ? '7px' : undefined,
          minHeight: isStandardScreen ? undefined : '6px',
          maskImage: `url("data:image/svg+xml,%3Csvg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' version='1.1' fill='${(appTheme.palette.text as any).icon ?? appTheme.palette.action.active}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='${path}' /%3E%3C/svg%3E%0A")`,
          maskRepeat: 'no-repeat',
          maskPosition: isLeft ? isStandardScreen  ? 'center center' : 'bottom center' : isStandardScreen  ? 'left center' : 'top center',
        },
      }}
      elementBefore={elementBefore}
      propsPaneBefore={propsPaneBefore}
      elementAfter={elementAfter}
      propsPaneAfter={propsPaneAfter}
    />
  );
}));

StudioSplitPane.displayName = 'StudioSplitPane';