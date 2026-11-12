import type React from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { type Theme, useTheme } from '@mui/material';
import { Box } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { TextField } from '@mui/material';

import { Color, type IColor } from '@sheetxl/sdk';

import {
  useCallbackRef, useFloatStack, useTranslator, DynamicIcon,
  type FloatStackOptions
} from '@sheetxl/utils-react';

import { ExhibitIconButton, SimpleTooltip, type ExhibitPopupPanelProps } from '@sheetxl/utils-mui';

import { ColorPanel } from '../color';

/** A gradient stop in the shape the editor manipulates — always with an explicit offset. */
export interface GradientStopValue {
  /** `0…1` along the gradient. Explicit, because a defaulted offset does not survive to CSS. */
  offset: number;
  color: IColor.Serializable;
}

export interface GradientStopsBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  stops: GradientStopValue[];
  /** The stops after any edit, in offset order. */
  onChange: (stops: GradientStopValue[]) => void;
  /**
   * The fewest stops the bar will leave; a stop cannot be removed below it.
   * @defaultValue 2 — a gradient is undefined with fewer colors, and the model says so too.
   */
  minStops?: number;
  /**
   * The most stops the bar will add.
   * @defaultValue 8 — beyond this the handles stop being tellable apart in a pane.
   */
  maxStops?: number;
  /** Theme color resolution for the stop pickers and the ramp. */
  schemeLookup?: IColor.SchemeLookup;
  recentColors?: readonly IColor[] | (() => readonly IColor[]);
  darkMode?: boolean;
  disabled?: boolean;
}

const RAMP_HEIGHT = 18;
const HANDLE_WIDTH = 14;
const HANDLE_HEIGHT = 17;
/** How far a handle's point reaches up into the ramp. */
const HANDLE_OVERLAP = 4;
/** How far a press moves before it is a drag and no longer a click. */
const DRAG_SLOP = 3;
/** How long a released drag keeps its preview if the stops it wrote never come back. */
const RELEASE_GRACE = 1000;
/** How long a handle takes to slide to a position it was given (typed, stepped, or undone). */
const SLIDE_MS = 120;
/**
 * A hovered handle's toolbar is a tooltip: it waits a moment to show, and stays a moment after the
 * pointer leaves, so the pointer can get from the handle to a button.
 */
const TOOLBAR_ENTER_DELAY = 250;
const TOOLBAR_LEAVE_DELAY = 400;

/**
 * The popup hangs under its handle, centered, kept in the viewport, and keeps its size when it
 * overflows (as the color picker's own popup does). One object for every handle: the float hook
 * keys effects on it.
 */
const POPPER_PROPS: FloatStackOptions['propsPopper'] = {
  resizeOnOverflow: false, placement: 'bottom', offsets: [0, 2], shift: { padding: 8 }
};

/**
 * A closed polygon with its corners rounded: each corner is cut `radius` short on both edges and
 * joined by a quadratic curve through it.
 */
const roundedPolygon = (points: [x: number, y: number, radius: number][]): string => {
  const parts: string[] = [];
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const [px, py] = points[(i + count - 1) % count];
    const [x, y, radius] = points[i];
    const [nx, ny] = points[(i + 1) % count];
    const toward = (tx: number, ty: number): [number, number] => {
      const length = Math.hypot(tx - x, ty - y) || 1;
      const cut = Math.min(radius, length / 2);
      return [x + (tx - x) / length * cut, y + (ty - y) / length * cut];
    };
    const [ax, ay] = toward(px, py);
    const [bx, by] = toward(nx, ny);
    parts.push(`${i === 0 ? 'M' : 'L'}${ax.toFixed(2)} ${ay.toFixed(2)} Q${x} ${y} ${bx.toFixed(2)} ${by.toFixed(2)}`);
  }
  return parts.join(' ') + ' Z';
};

/** A pointer: the tip up into the ramp, a square body below for the color; softly rounded. */
const HANDLE_PATH = roundedPolygon([
  [HANDLE_WIDTH / 2, 0.5, 1],
  [HANDLE_WIDTH - 0.5, HANDLE_OVERLAP + 2, 1.5],
  [HANDLE_WIDTH - 0.5, HANDLE_HEIGHT - 0.5, 2],
  [0.5, HANDLE_HEIGHT - 0.5, 2],
  [0.5, HANDLE_OVERLAP + 2, 1.5],
]);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A color as the ramp and the handles paint it. */
const toCSS = (color: IColor.Serializable | IColor, schemeLookup: IColor.SchemeLookup | undefined, darkMode: boolean): string => {
  try {
    return (color instanceof Color ? color : new Color(color as string, schemeLookup)).toCSS(darkMode);
  } catch {
    return 'transparent';
  }
};

/** The color halfway between two, as a hex string: what the ramp already shows between them. */
const blend = (a: IColor.Serializable, b: IColor.Serializable, schemeLookup: IColor.SchemeLookup | undefined): IColor.Serializable => {
  try {
    const from = new Color(a as string, schemeLookup).toRGBA();
    const to = new Color(b as string, schemeLookup).toRGBA();
    const mix = (x: number, y: number): string => Math.round((x + y) / 2).toString(16).padStart(2, '0');
    return `${mix(from.red, to.red)}${mix(from.green, to.green)}${mix(from.blue, to.blue)}`;
  } catch {
    return a;
  }
};

const sameStop = (a: GradientStopValue, b: GradientStopValue): boolean =>
  a.offset === b.offset && String(a.color) === String(b.color);

const sameStops = (a: readonly GradientStopValue[], b: readonly GradientStopValue[]): boolean =>
  a.length === b.length && a.every((stop, i) => sameStop(stop, b[i]));

/** Stops as the bar last saw or wrote them, with the key of each. */
interface KeyedStops {
  stops: readonly GradientStopValue[];
  keys: number[];
}

/**
 * The keys for `stops`, from what the bar knows: the stops it last wrote and the stops it last
 * saw. The same stops in the same order take the same keys; otherwise each stop takes the key of a
 * stop it equals, so a re-sort or a render still carrying the previous stops keeps every handle;
 * what matches nothing gets a fresh key.
 */
const keysFor = (stops: readonly GradientStopValue[], known: readonly KeyedStops[], nextKey: () => number): number[] => {
  for (const entry of known) {
    if (sameStops(stops, entry.stops)) return entry.keys;
  }
  const taken = new Set<number>();
  const keys = stops.map((stop) => {
    for (const entry of known) {
      const at = entry.stops.findIndex((candidate, i) => !taken.has(entry.keys[i]) && sameStop(candidate, stop));
      if (at >= 0) {
        taken.add(entry.keys[at]);
        return entry.keys[at];
      }
    }
    return -1;
  });
  return keys.map((key) => (key >= 0 ? key : nextKey()));
};

/**
 * A stop's position field: owns its text while it is being typed in, so a keystroke is never
 * undone by the value coming back a render later (the popup it sits in is re-rendered by an
 * effect, one render behind the stops), and follows the stop again once it is left.
 */
const StopPositionField = memo((props: {
  percent: number;
  disabled: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (percent: number) => void;
}) => {
  const { percent, disabled, inputRef, onChange } = props;
  const t = useTranslator();
  const [text, setText] = useState<string>(String(percent));
  const [isEditing, setEditing] = useState(false);
  useEffect(() => {
    if (!isEditing) setText(String(percent));
  }, [percent, isEditing]);
  return (
    <TextField
      type="number"
      size="small"
      disabled={disabled}
      inputRef={inputRef}
      label={t('fill.gradientPosition')}
      value={text}
      onFocus={() => setEditing(true)}
      onBlur={() => { setEditing(false); setText(String(percent)); }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === '') return;
        const next = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
        onChange(next);
      }}
      slotProps={{
        htmlInput: { min: 0, max: 100, step: 5, style: { textAlign: 'right' } },
        inputLabel: { shrink: true },
        input: { endAdornment: <InputAdornment position="end" disableTypography>%</InputAdornment> }
      }}
      sx={{ width: 120 }}
    />
  );
});
StopPositionField.displayName = 'StopPositionField';

interface StopHandleProps {
  /** The stop's place in `stops` as they are now; its key is its identity across re-sorts. */
  index: number;
  stop: GradientStopValue;
  /** Where the handle sits: the stop's offset, or the offset a drag is previewing. */
  offset: number;
  schemeLookup?: IColor.SchemeLookup;
  recentColors?: readonly IColor[] | (() => readonly IColor[]);
  darkMode: boolean;
  disabled: boolean;
  canRemove: boolean;
  /** The ramp the offsets are measured along. */
  rampRef: React.RefObject<HTMLDivElement | null>;
  /** A drag in flight at `offset`; `released` once the pointer is up and the offset is written. */
  onDrag: (index: number, offset: number, released: boolean) => void;
  onMove: (index: number, offset: number) => void;
  onPreviewColor: (index: number, color: IColor | null) => void;
  onChangeColor: (index: number, color: IColor) => void;
  onRemove: (index: number) => void;
  onOpenChange: (index: number, open: boolean) => void;
}

/**
 * One stop's handle under the ramp: dragged along it; hovered, it shows a toolbar (a tooltip with
 * the stop's color button and its remove button) under it. The color button, a click on the
 * handle, or Enter opens the popup with the color picker and the position, which stays until it
 * is dismissed.
 */
const StopHandle = memo((props: StopHandleProps) => {
  const {
    index, stop, offset, schemeLookup, recentColors, darkMode, disabled, canRemove, rampRef,
    onDrag, onMove, onPreviewColor, onChangeColor, onRemove, onOpenChange
  } = props;

  const t = useTranslator();
  const theme = useTheme();
  const color = useMemo(() => new Color(stop.color as string, schemeLookup), [stop.color, schemeLookup]);
  const [preview, setPreview] = useState<IColor | null | undefined>(undefined);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [isFocused, setFocused] = useState(false);
  // The toolbar tooltip's open state, with the tooltip's own delays.
  const [isHovered, setHovered] = useState(false);

  const refPositionInput = useRef<HTMLInputElement | null>(null);
  // Opened from the keyboard, the popup takes the focus into its position field once it shows.
  const refFocusOnOpen = useRef(false);

  const previewColor = useCallbackRef((next: IColor | null | undefined) => {
    setPreview(next);
    onPreviewColor(index, next ?? null);
  }, [index, onPreviewColor]);

  const movePercent = useCallbackRef((percent: number) => {
    onMove(index, percent / 100);
  }, [index, onMove]);

  const percent = Math.round(offset * 100);
  const css = toCSS(preview ?? color, schemeLookup, darkMode);

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { closeFloat } = panelProps;
    return (
      <Box className="sxl-gradient-stop-popup" sx={{ display: 'flex', flexDirection: 'column' }}>
        <ColorPanel
          selectedColor={color}
          previewColor={preview}
          disableAlpha
          schemeLookup={schemeLookup}
          recentColors={recentColors}
          darkMode={darkMode}
          onDone={closeFloat}
          onPreviewColor={previewColor}
          onPreviewColorImmediate={previewColor}
          onSelectColor={(next: IColor | null) => {
            previewColor(undefined);
            if (next) onChangeColor(index, next);
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, paddingX: 1, paddingBottom: 1 }}>
          <StopPositionField percent={percent} disabled={disabled} inputRef={refPositionInput} onChange={movePercent} />
        </Box>
      </Box>
    );
  }, [color, preview, percent, index, schemeLookup, recentColors, darkMode, disabled, previewColor, onChangeColor, movePercent]);

  const floatStack = useFloatStack({
    anchor,
    label: 'gradient-stop',
    renderPopupPanel,
    propsPopper: POPPER_PROPS,
    onOpen: () => {
      setOpen(true);
      onOpenChange(index, true);
      if (refFocusOnOpen.current) {
        refFocusOnOpen.current = false;
        requestAnimationFrame(() => refPositionInput.current?.focus());
      }
    },
    onClose: () => { setOpen(false); onOpenChange(index, false); previewColor(undefined); }
  });

  const openPopup = useCallbackRef((focusInput: boolean) => {
    refFocusOnOpen.current = focusInput;
    floatStack.reference.open(0);
  }, [floatStack]);

  const togglePopup = useCallbackRef(() => {
    if (isOpen) floatStack.reference.close(0);
    else openPopup(false);
  }, [isOpen, floatStack, openPopup]);

  // A press is a drag once it has moved DRAG_SLOP px; a press that never moves is a click. The
  // stop follows the pointer's travel from where it was pressed, so it never jumps to the pointer.
  const refPress = useRef<{ pointerId: number; startX: number; startOffset: number; moved: boolean; offset: number } | null>(null);

  // The event goes on up: the ramp tells a press on a handle from its own, and an open popup's
  // light-dismiss listens at the document.
  const onPointerDown = useCallbackRef((e: React.PointerEvent<HTMLElement>) => {
    if (disabled || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    refPress.current = { pointerId: e.pointerId, startX: e.clientX, startOffset: offset, moved: false, offset };
  }, [disabled, offset]);

  const onPointerMove = useCallbackRef((e: React.PointerEvent<HTMLElement>) => {
    const press = refPress.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const dx = e.clientX - press.startX;
    if (!press.moved) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      press.moved = true;
      setDragging(true);
      setHovered(false);
      floatStack.reference.close(0);
    }
    const width = rampRef.current?.getBoundingClientRect().width ?? 0;
    press.offset = width > 0 ? clamp01(press.startOffset + dx / width) : press.startOffset;
    onDrag(index, press.offset, false);
  }, [index, rampRef, floatStack, onDrag]);

  const onPointerUp = useCallbackRef((e: React.PointerEvent<HTMLElement>) => {
    const press = refPress.current;
    if (!press || press.pointerId !== e.pointerId) return;
    refPress.current = null;
    if (press.moved) {
      setDragging(false);
      // The preview stays where the pointer left it until the written stops come back, so the
      // handle never shows its old place in between.
      onDrag(index, press.offset, true);
      onMove(index, press.offset);
      return;
    }
    togglePopup();
  }, [index, onDrag, onMove, togglePopup]);

  const onPointerCancel = useCallbackRef((e: React.PointerEvent<HTMLElement>) => {
    const press = refPress.current;
    if (!press || press.pointerId !== e.pointerId) return;
    refPress.current = null;
    if (press.moved) {
      setDragging(false);
      onDrag(index, press.startOffset, true);
    }
  }, [index, onDrag]);

  const onKeyDown = useCallbackRef((e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 0.1 : 0.01;
    switch (e.key) {
      case 'ArrowLeft': onMove(index, clamp01(offset - step)); break;
      case 'ArrowRight': onMove(index, clamp01(offset + step)); break;
      case 'Home': onMove(index, 0); break;
      case 'End': onMove(index, 1); break;
      case 'Delete':
      case 'Backspace':
        if (canRemove) onRemove(index);
        break;
      case 'Enter':
      case ' ':
        openPopup(true);
        break;
      case 'Escape':
        if (!isOpen) return;
        floatStack.reference.close(0);
        break;
      default:
        return;
    }
    e.preventDefault();
  }, [disabled, index, offset, canRemove, isOpen, floatStack, openPopup, onMove, onRemove]);

  const isActive = isOpen || isDragging || isFocused;
  const showToolbar = !disabled && !isDragging && !isOpen && isHovered;
  const toolbar = (
    <Box
      className="sxl-gradient-stop-toolbar"
      onPointerDown={(e: React.PointerEvent) => { e.stopPropagation(); }}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
    >
      <ExhibitIconButton
        tabIndex={-1}
        propsTooltip={{ label: t('fill.gradientStopColor'), simple: true }}
        icon={
          <Box className="color-wrapper" sx={{ lineHeight: 0, '& .activeColor': { fill: css } }}>
            <DynamicIcon iconKey="circle.colored"/>
          </Box>
        }
        onClick={() => { setHovered(false); togglePopup(); }}
      />
      <ExhibitIconButton
        tabIndex={-1}
        disabled={!canRemove}
        propsTooltip={{ label: t('fill.gradientRemoveStop'), simple: true }}
        icon={<DynamicIcon iconKey="Close"/>}
        onClick={() => onRemove(index)}
      />
    </Box>
  );
  return (
    <>
      <SimpleTooltip
        title={toolbar}
        open={showToolbar}
        onOpen={() => setHovered(true)}
        onClose={() => setHovered(false)}
        enterDelay={TOOLBAR_ENTER_DELAY}
        enterNextDelay={TOOLBAR_ENTER_DELAY}
        leaveDelay={TOOLBAR_LEAVE_DELAY}
        placement="bottom"
        disableFocusListener
        disableTouchListener
        slotProps={{
          tooltip: {
            sx: {
              // A toolbar, not a caption: the surface the pane's buttons sit on.
              backgroundColor: (theme: Theme) => theme.palette.background.paper,
              color: (theme: Theme) => theme.palette.text.primary,
              border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: (theme: Theme) => theme.shadows[3],
              padding: '2px',
              marginTop: '4px !important',
            }
          }
        }}
      >
      <Box
        ref={setAnchor}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('fill.gradientStop', { position: percent })}
        aria-disabled={disabled || undefined}
        className={clsx('sxl-gradient-stop', { 'sxl-gradient-stop-open': isOpen, 'sxl-gradient-stop-dragging': isDragging })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        sx={{
          position: 'absolute',
          left: `${offset * 100}%`,
          top: `calc(100% - ${HANDLE_OVERLAP}px)`,
          width: HANDLE_WIDTH,
          height: HANDLE_HEIGHT,
          transform: 'translateX(-50%)',
          // A position the stop was given slides; a drag follows the pointer as it is.
          transition: isDragging ? 'none' : `left ${SLIDE_MS}ms ease-out`,
          lineHeight: 0,
          cursor: disabled ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          touchAction: 'none',
          outline: 'none',
          // The dragged handle rides over its neighbors.
          zIndex: isDragging ? 1 : 0,
          filter: isActive ? `drop-shadow(0 1px 2px ${theme.palette.action.active})` : undefined,
        }}
      >
        <svg width={HANDLE_WIDTH} height={HANDLE_HEIGHT} viewBox={`0 0 ${HANDLE_WIDTH} ${HANDLE_HEIGHT}`} aria-hidden="true">
          <path
            d={HANDLE_PATH}
            fill={css}
            stroke={isActive ? theme.palette.primary.main : theme.palette.text.secondary}
            strokeWidth={isActive ? 1.5 : 1}
            strokeLinejoin="round"
          />
        </svg>
      </Box>
      </SimpleTooltip>
      {floatStack.component}
    </>
  );
});
StopHandle.displayName = 'StopHandle';

/**
 * The stops of a gradient as a ramp with a handle under each stop: drag a handle to move its
 * stop, hover it for its color and remove buttons, press the ramp (or the add button) for a new
 * stop. The ramp runs left to right whatever the gradient's own angle — it edits the stops, not
 * the direction, as Excel's does.
 *
 * @remarks
 * A stop has no identity of its own — the model holds offsets and colors — but a handle must keep
 * one, or a drag past a neighbor swaps the two handles' elements as the stops re-sort, and the
 * focus, the open popup and the armed outline land on the wrong stop. So the bar assigns each stop
 * a key, carries the keys through every edit it makes, and matches the stops it is handed back
 * against what it wrote; stops from elsewhere (an undo, another editor) get fresh keys.
 */
export const GradientStopsBar = memo((props: GradientStopsBarProps) => {
  const {
    stops,
    onChange,
    minStops = 2,
    maxStops = 8,
    schemeLookup,
    recentColors,
    darkMode = false,
    disabled = false,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const rampRef = useRef<HTMLDivElement | null>(null);

  // The keys, aligned with `stops`: what the bar last wrote and last saw, newest first, matched
  // against what it is handed.
  const refKeys = useRef<{ known: KeyedStops[]; next: number }>({ known: [], next: 1 });
  const keys = useMemo((): number[] => {
    const state = refKeys.current;
    const keys = keysFor(stops, state.known, () => state.next++);
    if (state.known[0]?.keys !== keys) state.known = [{ stops, keys }, ...state.known].slice(0, 3);
    return keys;
  }, [stops]);

  // A drag in flight, and a color the open picker is previewing: shown, not yet written. A
  // released drag has been written and shows until the stops come back, or a grace runs out.
  const [drag, setDrag] = useState<{ key: number; offset: number; released: boolean } | null>(null);
  const [preview, setPreview] = useState<{ key: number; color: IColor } | null>(null);
  // The stop whose popup is open, if one is.
  const [openKey, setOpenKey] = useState<number | null>(null);

  // On the stops, not the drag: the preview must outlive the release until its stop comes back
  // at the offset it was given — an intermediate re-render still carrying the old stops must not
  // end it.
  useLayoutEffect(() => {
    setDrag((current) => {
      if (!current?.released) return current;
      const at = keys.indexOf(current.key);
      return at >= 0 && stops[at].offset === current.offset ? null : current;
    });
  }, [stops, keys]);
  useLayoutEffect(() => {
    if (!drag?.released) return;
    const timer = window.setTimeout(() => setDrag((current) => (current?.released ? null : current)), RELEASE_GRACE);
    return (): void => window.clearTimeout(timer);
  }, [drag]);

  const canAdd = !disabled && stops.length < maxStops;
  const canRemove = !disabled && stops.length > minStops;

  /** Writes `next` (each entry's key alongside it) in offset order, and remembers the keys. */
  const commit = useCallbackRef((next: { stop: GradientStopValue; key: number }[]) => {
    const sorted = [...next].sort((x, y) => x.stop.offset - y.stop.offset);
    const written: KeyedStops = { stops: sorted.map((entry) => entry.stop), keys: sorted.map((entry) => entry.key) };
    const state = refKeys.current;
    state.known = [written, ...state.known].slice(0, 3);
    onChange(written.stops.slice());
  }, [onChange]);

  const entries = useCallbackRef(() => stops.map((stop, i) => ({ stop, key: keys[i] })), [stops, keys]);

  const onDrag = useCallbackRef((index: number, offset: number, released: boolean) => {
    setDrag({ key: keys[index], offset, released });
  }, [keys]);

  const onMove = useCallbackRef((index: number, offset: number) => {
    commit(entries().map((entry, i) => (i === index ? { ...entry, stop: { ...entry.stop, offset } } : entry)));
  }, [entries, commit]);

  const onPreviewColor = useCallbackRef((index: number, color: IColor | null) => {
    setPreview(color ? { key: keys[index], color } : null);
  }, [keys]);

  const onOpenChange = useCallbackRef((index: number, open: boolean) => {
    const key = keys[index];
    setOpenKey((current) => (open ? key : (current === key ? null : current)));
  }, [keys]);

  const onChangeColor = useCallbackRef((index: number, color: IColor) => {
    commit(entries().map((entry, i) => (i === index ? { ...entry, stop: { ...entry.stop, color: color.toString() as IColor.Serializable } } : entry)));
  }, [entries, commit]);

  const onRemove = useCallbackRef((index: number) => {
    if (stops.length <= minStops) return;
    commit(entries().filter((_entry, i) => i !== index));
  }, [stops, minStops, entries, commit]);

  /** A new stop at `offset`, or in the middle of the widest gap, in the color the ramp shows there. */
  const addStop = useCallbackRef((offset?: number) => {
    if (stops.length >= maxStops) return;
    const sorted = [...stops].sort((x, y) => x.offset - y.offset);
    let at = offset;
    if (at === undefined) {
      let widest = -1;
      for (let i = 0; i + 1 < sorted.length; i++) {
        const gap = sorted[i + 1].offset - sorted[i].offset;
        if (gap > widest) { widest = gap; at = (sorted[i].offset + sorted[i + 1].offset) / 2; }
      }
      if (at === undefined) at = 1;
    }
    const below = [...sorted].reverse().find((stop) => stop.offset <= at!) ?? sorted[0];
    const above = sorted.find((stop) => stop.offset >= at!) ?? sorted[sorted.length - 1];
    commit([...entries(), { stop: { offset: at, color: blend(below.color, above.color, schemeLookup) }, key: refKeys.current.next++ }]);
  }, [stops, maxStops, schemeLookup, entries, commit]);

  const onRampPointerDown = useCallbackRef((e: React.PointerEvent<HTMLDivElement>) => {
    // A press on a handle is the handle's. One while a stop's popup is open dismisses the popup;
    // it is not a request for a stop.
    if (!canAdd || e.button !== 0 || openKey !== null) return;
    if ((e.target as Element).closest('.sxl-gradient-stop')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    addStop(clamp01((e.clientX - rect.left) / rect.width));
  }, [canAdd, openKey, addStop]);

  // The ramp as the stops are, with the drag and the preview in place of what they stand in for.
  const ramp = useMemo(() => {
    const shown = stops.map((stop, i) => ({
      offset: drag?.key === keys[i] ? drag.offset : stop.offset,
      css: toCSS(preview?.key === keys[i] ? preview.color : stop.color, schemeLookup, darkMode)
    }));
    shown.sort((a, b) => a.offset - b.offset);
    const parts = shown.map((stop) => `${stop.css} ${(stop.offset * 100).toFixed(2)}%`);
    return `linear-gradient(90deg, ${parts.join(', ')})`;
  }, [stops, keys, drag, preview, schemeLookup, darkMode]);

  return (
    <Box
      className={clsx('sxl-gradient-stops', propClassName)}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}
      {...rest}
    >
      <Box sx={{ flex: 1, minWidth: 0, paddingX: `${HANDLE_WIDTH / 2}px`, paddingBottom: `${HANDLE_HEIGHT - HANDLE_OVERLAP + 2}px` }}>
        <Box
          ref={rampRef}
          className="sxl-gradient-stops-ramp"
          onPointerDown={onRampPointerDown}
          sx={{
            position: 'relative',
            height: RAMP_HEIGHT,
            borderRadius: 1,
            border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
            backgroundImage: ramp,
            // Tiled, Chrome paints a sliver of the previous tile's last color down the left edge.
            backgroundRepeat: 'no-repeat',
            cursor: canAdd ? 'copy' : 'default',
            opacity: disabled ? 0.5 : 1
          }}
        >
          {stops.map((stop, index) => (
            <StopHandle
              key={keys[index]}
              index={index}
              stop={stop}
              offset={drag?.key === keys[index] ? drag.offset : stop.offset}
              schemeLookup={schemeLookup}
              recentColors={recentColors}
              darkMode={darkMode}
              disabled={disabled}
              canRemove={canRemove}
              rampRef={rampRef}
              onDrag={onDrag}
              onMove={onMove}
              onPreviewColor={onPreviewColor}
              onChangeColor={onChangeColor}
              onRemove={onRemove}
              onOpenChange={onOpenChange}
            />
          ))}
        </Box>
      </Box>
      <ExhibitIconButton
        disabled={!canAdd}
        propsTooltip={{ label: t('fill.gradientAddStop'), simple: true }}
        icon={<DynamicIcon iconKey="Add"/>}
        onClick={() => addStop()}
        sx={{ marginTop: '-3px' }}
      />
    </Box>
  );
});

GradientStopsBar.displayName = 'GradientStopsBar';
