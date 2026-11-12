import React, { useEffect, useState } from 'react';

import {
  CellControlRegistry, ICellRange, IRichDataKind, RichDataRegistry,
  type ICell, type ICellControl, type IFunction, type IRichData, type IRichType, type IWorksheet, type Scalar
} from '@sheetxl/sdk';

import {
  CellContent, registerCellControl, registerRichData,
  type CellContentEntry, type CellContentRenderer, type CellControlContext, type CellControlPaneProps,
  type CellKeyTarget
} from '@sheetxl/react';

import { DynamicIcon } from '@sheetxl/utils-react';

/**
 * Cell controls and rich data values a host might register, shared by the sheet and studio
 * stories. A cell control is two registrations: an `ICellControlKind` in the sdk says which values
 * the control draws (so a headless workbook agrees), and a `CellContentEntry` in react says how it
 * draws, what a press does, what a key does, and what the cell control pane shows. A rich data
 * value is the same two: an `IRichDataKind` in the sdk makes the value from its JSON, and a
 * `CellContentEntry` registered by the value's type draws it wherever no control does. A renderer
 * is a pure function of its props inside a cached tile: no hooks, no state. `CellContent` is its
 * root: the props go onto it whole, and it places the children by the cell's alignment in the
 * cell's font. A pane is an ordinary component: hooks are fine there.
 *
 * - **Rating** (control): several hit zones in one cell. The stars carry a `data-star` attribute
 *   of their own and `onPress` reads it off the event; the hover preview is CSS alone, since the
 *   renderer keeps no state. Typing `1`…`5` sets every rating cell the selection touches.
 * - **Slider** (control) over a **range** (rich data `{ min, max, value, step? }` reading as
 *   `value`): a drag. Over a plain number the bounds are the control's, so a slider can sit over a
 *   formula and follow its result; over a range value the value's bounds win, and a range value
 *   with no control draws as a slider by its type. The track handles its own pointer events and
 *   writes through `props.context`; it tracks the drag on `window`, not with pointer capture,
 *   because every write re-renders the tile and the track element may be replaced mid-drag.
 * - **Button** (rich data `{ label, macro }` reading as `label`): a press, or Space, runs the
 *   macro by name. `=A1` over a button is a button too.
 */

// ── Rating ─────────────────────────────────────────────────────────────────────────────────────

const STAR_FEATURES: readonly ICellRange.Feature[] = Object.freeze([ICellRange.Feature.CellControl, ICellRange.Feature.Formula]);

const RatingRenderer: CellContentRenderer = (props) => {
  const cell = props.value;
  const max = Number(props.control?.toJSON().max ?? 5);
  const rating = Number(cell.getValue() ?? 0);
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= max; i++) {
    stars.push(<span key={i} data-star={i} className={i <= rating ? 'on' : undefined}>★</span>);
  }
  return (
    <CellContent {...props} alignAs="text">
      <div {...props.interactiveProps} className="sxl-rating" title={`${rating} of ${max}`}>{stars}</div>
    </CellContent>
  );
};

/** Writes `rating` into every rating cell the selection touches that holds no formula. */
const setRatingOnSelection = (target: CellKeyTarget, ctx: CellControlContext, rating: number): boolean => {
  const ranges = target.selection.getRanges();
  const count = ranges.getCount();
  let written = false;
  ctx.sheet.doBatch(() => {
    for (let i = 0; i < count; i++) {
      for (const region of ranges.at(i).getRegions(STAR_FEATURES)) {
        const anchor = region.getCell();
        if (anchor.getControl()?.getType() !== 'rating' || anchor.getFormula() !== null) continue;
        if (ctx.setRangeValue(region.getRange(), rating)) written = true;
      }
    }
  });
  return written;
};

const RatingContent: CellContentEntry = {
  renderer: RatingRenderer,
  icon: (
    <DynamicIcon>
      <svg viewBox="0 0 24 24">
        <path fill="#f5a623" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
      </svg>
    </DynamicIcon>
  ),
  // The event says which star: a second press on the current rating clears it.
  onPress: (cell: ICell, ctx, event): void => {
    const star = (event.target as Element).closest('[data-star]')?.getAttribute('data-star');
    if (!star) return;
    const pressed = Number(star);
    ctx.setCellValue(cell, Number(cell.getValue() ?? 0) === pressed ? 0 : pressed);
  },
  // A digit sets the rating of every rating cell the selection touches; anything else is the editor's.
  onKey: (key, target, ctx): boolean => {
    if (!/^[0-9]$/.test(key)) return false;
    return setRatingOnSelection(target, ctx, Number(key));
  }
};

/** The hover preview: pure CSS over the stars' document order, so the renderer keeps no state. */
export const RATING_CSS = `
.sxl-rating { display: inline-flex; gap: 1px; cursor: pointer; color: #c8c8c8; user-select: none; line-height: 1; }
.sxl-rating .on { color: #f5a623; }
.sxl-rating:hover [data-star] { color: #f5a623; }
.sxl-rating [data-star]:hover ~ [data-star] { color: #c8c8c8; }
`;

// ── Range: a rich value the slider draws ───────────────────────────────────────────────────────

const RANGE_TYPE = 'numberRange';

/**
 * A number with its own bounds. Reads as `value` wherever a primitive is consumed, so `=C9*2`
 * and `SUM` see the number. Immutable: a drag or the pane writes a new range.
 */
class NumberRange implements IRichData {
  readonly min: number;
  readonly max: number;
  readonly value: number;
  /** The increment a drag snaps to; `null` for the control's, else 1. */
  readonly step: number | null;

  constructor(min: number, max: number, value: number, step: number | null = null) {
    this.min = min;
    this.max = max;
    this.value = value;
    this.step = step;
  }

  static fromJSON(json: IRichData.JSON): NumberRange {
    const data = json?.data ?? {};
    const min = Number(data.min ?? 0);
    return new NumberRange(min, Number(data.max ?? 100), Number(data.value ?? min), data.step == null ? null : Number(data.step));
  }

  withValue(value: number): NumberRange {
    return new NumberRange(this.min, this.max, value, this.step);
  }

  getKind(): IRichType {
    return NumberRangeKind;
  }

  getProperty(name: string): Scalar {
    switch (name) {
      case 'min': return this.min;
      case 'max': return this.max;
      case 'value': return this.value;
      case 'step': return this.step;
    }
    return null;
  }

  toString(): string {
    return String(this.value);
  }

  toPrimitive(): number {
    return this.value;
  }

  toJSON(): IRichData.JSON {
    const data: Record<string, number> = { min: this.min, max: this.max, value: this.value };
    if (this.step !== null) data.step = this.step;
    return { type: RANGE_TYPE, data };
  }

  get isIRichData(): true {
    return true;
  }
}

const NumberRangeKind: IRichDataKind<NumberRange> = IRichDataKind.create({
  name: RANGE_TYPE,
  label: 'Number Range',
  fromJSON: NumberRange.fromJSON
});

const asRange = (value: Scalar): NumberRange | null => (value instanceof NumberRange ? value : null);

// ── Slider ─────────────────────────────────────────────────────────────────────────────────────

/** What a slider cell draws between: the range value's bounds when it holds one, else the control's. */
interface SliderBounds {
  min: number;
  max: number;
  step: number;
  current: number;
  /** The cell's range value, or `null` over a plain number. */
  range: NumberRange | null;
}

const sliderBounds = (cell: ICell, control: ICellControl | null): SliderBounds => {
  const json: Record<string, unknown> = control?.toJSON() ?? {};
  const controlStep = json.step == null ? null : Number(json.step);
  const value = cell.getValue();
  const range = asRange(value);
  const min = range ? range.min : Number(json.min ?? 0);
  const max = range ? range.max : Number(json.max ?? 100);
  const step = (range ? range.step : null) ?? controlStep ?? 1;
  const raw = range ? range.value : Number(value ?? min);
  return { min, max, step, current: Math.min(max, Math.max(min, raw)), range };
};

const SliderRenderer: CellContentRenderer = (props) => {
  const { value: cell, control, context, interactiveProps, zoom = 1 } = props;
  const { min, max, step, current, range } = sliderBounds(cell, control);
  const fraction = max > min ? (current - min) / (max - min) : 0;
  const isFormula = cell.getFormula() !== null;
  // The thumb's center travels half a thumb in from each end, so the thumb stays inside the cell.
  const thumb = 12 * zoom;
  const travel = `calc(${thumb / 2}px + ${fraction} * (100% - ${thumb}px))`;

  // The drag: value from the pointer's position over the track, written on every move. Tracked
  // on `window` (not pointer capture): each write re-renders the tile, which may replace this
  // element. The press is stopped, so the layer's own press stays out of it.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || isFormula) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const write = (clientX: number): void => {
      const span = rect.width - thumb;
      const f = span > 0 ? Math.min(1, Math.max(0, (clientX - rect.left - thumb / 2) / span)) : 0;
      const snapped = Math.round((min + f * (max - min)) / step) * step;
      context.setCellValue(cell, range ? range.withValue(snapped) : snapped);
    };
    const move = (ev: PointerEvent): void => write(ev.clientX);
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    write(e.clientX);
  };

  // The slider keeps its own size, whatever the font, but centers on the line the cell's text
  // paints in. The track is a stripe through its middle.
  const track = 6 * zoom;
  return (
    <CellContent {...props} centerOnTextLine>
      <div
        {...interactiveProps}
        onPointerDown={onPointerDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        title={String(current)}
        style={{
          flex: 1, height: thumb, position: 'relative',
          cursor: isFormula ? undefined : 'pointer', opacity: isFormula ? 0.6 : undefined
        }}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%', height: track, transform: 'translateY(-50%)',
          borderRadius: track, background: '#d8d8d8', overflow: 'hidden'
        }}>
          <div style={{ height: '100%', width: travel, background: '#4a90e2' }} />
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: travel, width: thumb, height: thumb,
          transform: 'translate(-50%, -50%)', borderRadius: '50%', background: '#fff', border: '1px solid #4a90e2', boxSizing: 'border-box'
        }} />
      </div>
    </CellContent>
  );
};

/** A small slider in the icon box: a track, filled to a thumb, in the menu's own color. */
const SLIDER_ICON = (
  <DynamicIcon>
    <svg viewBox="0 0 24 24">
      <rect x="2" y="10.5" width="20" height="3" rx="1.5" fill="currentColor" opacity={0.35} />
      <rect x="2" y="10.5" width="12" height="3" rx="1.5" fill="currentColor" />
      <circle cx="14" cy="12" r="4" fill="currentColor" />
    </svg>
  </DynamicIcon>
);

// ── Panes ──────────────────────────────────────────────────────────────────────────────────────

const PANE_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, padding: 8, fontSize: 13 };
const FIELD_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 };
const NOTE_STYLE: React.CSSProperties = { opacity: 0.7 };

/** A number field that commits a valid number on every edit. */
const NumberField: React.FC<{ label: string; value: number | null; disabled?: boolean; onCommit: (value: number | null) => void }> = (props) => {
  const { label, value, disabled, onCommit } = props;
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <label style={FIELD_STYLE}>
      {label}
      <input
        type="number"
        value={text}
        disabled={disabled}
        style={{ width: 90 }}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value === '') { onCommit(null); return; }
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onCommit(n);
        }}
      />
    </label>
  );
};

/**
 * The slider's options. Over a plain number it edits the control, on every cell the control
 * covers; over a range value it writes a new value into the cell, so it edits literals only (a
 * formula's range comes from the formula).
 */
const SliderPane: React.FC<CellControlPaneProps> = ({ sheet, cell, control }) => {
  const { min, max, step, range } = sliderBounds(cell, control);
  const isFormula = cell.getFormula() !== null;

  if (range) {
    const write = (patch: Partial<{ min: number; max: number; step: number | null }>): void => {
      const current = asRange(cell.getValue()) ?? range;
      const next = new NumberRange(patch.min ?? current.min, patch.max ?? current.max, current.value, patch.step === undefined ? current.step : patch.step);
      cell.getRange().setValue(next);
    };
    return (
      <div style={PANE_STYLE}>
        <div style={NOTE_STYLE}>
          {isFormula
            ? 'A range from a formula: change the formula to change it.'
            : control ? 'A range value: its bounds win over the slider control\'s.' : 'A range value, drawn as a slider by its type.'}
        </div>
        <NumberField label="Minimum" value={min} disabled={isFormula} onCommit={(n) => n !== null && write({ min: n })} />
        <NumberField label="Maximum" value={max} disabled={isFormula} onCommit={(n) => n !== null && write({ max: n })} />
        <NumberField label="Step" value={range.step} disabled={isFormula} onCommit={(n) => write({ step: n })} />
      </div>
    );
  }

  if (!control) return null;
  // A control is immutable: setting it again over its own ranges replaces it everywhere at once.
  const write = (patch: Record<string, number | null>): void => {
    const next: Record<string, unknown> = { ...control.toJSON() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete next[key]; else next[key] = value;
    }
    const ranges = control.getRanges();
    sheet.doBatch(() => {
      for (let i = 0; i < ranges.getCount(); i++) ranges.at(i).setControl(next as ICellControl.JSON);
    });
  };
  return (
    <div style={PANE_STYLE}>
      <div style={NOTE_STYLE}>
        {isFormula ? 'The slider follows the formula\'s result.' : 'Applies to every cell of this slider.'}
      </div>
      <NumberField label="Minimum" value={min} onCommit={(n) => n !== null && write({ min: n })} />
      <NumberField label="Maximum" value={max} onCommit={(n) => n !== null && write({ max: n })} />
      <NumberField label="Step" value={step} onCommit={(n) => write({ step: n })} />
    </div>
  );
};

const SliderContent: CellContentEntry = {
  renderer: SliderRenderer,
  icon: SLIDER_ICON,
  pane: SliderPane
};

// ── Button: a rich value that runs a macro ─────────────────────────────────────────────────────

const BUTTON_TYPE = 'button';

/** A button as a cell value: reads as its label; a press runs its macro by name. Immutable. */
class CellButton implements IRichData {
  readonly label: string;
  /** The macro's name, or `null` when it runs nothing yet. */
  readonly macro: string | null;

  constructor(label: string, macro: string | null = null) {
    this.label = label;
    this.macro = macro;
  }

  static fromJSON(json: IRichData.JSON): CellButton {
    const data = json?.data ?? {};
    // `{ type }` alone is the default a UI inserts: a button labeled Button that runs nothing yet.
    return new CellButton(String(data.label ?? 'Button'), data.macro ? String(data.macro) : null);
  }

  getKind(): IRichType {
    return CellButtonKind;
  }

  getProperty(name: string): Scalar {
    if (name === 'label') return this.label;
    if (name === 'macro') return this.macro;
    return null;
  }

  toString(): string {
    return this.label;
  }

  toPrimitive(): string {
    return this.label;
  }

  toJSON(): IRichData.JSON {
    const data: Record<string, string> = { label: this.label };
    if (this.macro) data.macro = this.macro;
    return { type: BUTTON_TYPE, data };
  }

  get isIRichData(): true {
    return true;
  }
}

const CellButtonKind: IRichDataKind<CellButton> = IRichDataKind.create({
  name: BUTTON_TYPE,
  label: 'Button',
  fromJSON: CellButton.fromJSON
});

const asButton = (value: Scalar): CellButton | null => (value instanceof CellButton ? value : null);

/**
 * Runs the button's macro. The result is not written to the selection: the selection is the
 * button's own cell, which the macro's return would overwrite.
 */
const runButton = (button: CellButton, ctx: CellControlContext): void => {
  if (!button.macro) {
    ctx.notifier.showMessage(`"${button.label}" has no macro. Set one in Control Options.`);
    return;
  }
  const scripts = ctx.sheet.getWorkbook()?.getScripts();
  if (!scripts) {
    ctx.notifier.showMessage(`"${button.label}" runs ${button.macro}, but this sheet has no workbook to run it in.`);
    return;
  }
  scripts.executeMacro(button.macro, undefined, { applyResult: false }).catch((error: unknown) => {
    ctx.notifier.showError(error instanceof Error ? error : String(error));
  });
};

const ButtonRenderer: CellContentRenderer = (props) => {
  const button = asButton(props.value.getValue());
  if (!button) return <props.Default {...props} />;
  return (
    <CellContent {...props}>
      <button
        {...props.interactiveProps}
        type="button"
        tabIndex={-1}
        className="sxl-cell-button"
        title={button.macro ? `Runs ${button.macro}` : 'No macro'}
      >
        {button.label}
      </button>
    </CellContent>
  );
};

/** The button's label and macro. A button from a formula is read-only here. */
const ButtonPane: React.FC<CellControlPaneProps> = ({ sheet, cell }) => {
  const button = asButton(cell.getValue());
  const isFormula = cell.getFormula() !== null;
  // The pane is not re-rendered when the cell's value changes, so the fields keep their own state.
  const [label, setLabel] = useState(button?.label ?? '');
  const [macro, setMacro] = useState(button?.macro ?? null);
  const [macros, setMacros] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    const scripts = sheet.getWorkbook()?.getScripts();
    scripts?.searchFunctions({ type: 'macro' }).then((found: IFunction[]) => {
      if (live) setMacros(found.map(f => f.getName()).filter((name): name is string => !!name));
    }).catch(() => { if (live) setMacros([]); });
    return () => { live = false; };
  }, [sheet]);

  if (!button) return null;
  const write = (next: CellButton): void => { cell.getRange().setValue(next); };
  const options = macros ? [...macros] : [];
  if (macro && !options.includes(macro)) options.unshift(macro);
  return (
    <div style={PANE_STYLE}>
      {isFormula ? <div style={NOTE_STYLE}>A button from a formula: change the formula to change it.</div> : null}
      <label style={FIELD_STYLE}>
        Label
        <input
          value={label}
          disabled={isFormula}
          onChange={(e) => {
            setLabel(e.target.value);
            write(new CellButton(e.target.value, macro));
          }}
        />
      </label>
      <label style={FIELD_STYLE}>
        Macro
        <select
          value={macro ?? ''}
          disabled={isFormula || macros === null}
          onChange={(e) => {
            const next = e.target.value || null;
            setMacro(next);
            write(new CellButton(label, next));
          }}
        >
          <option value="">(none)</option>
          {options.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {macros?.length === 0 ? <div style={NOTE_STYLE}>The workbook has no macros. Add one in the script editor.</div> : null}
    </div>
  );
};

const ButtonContent: CellContentEntry = {
  renderer: ButtonRenderer,
  onPress: (cell: ICell, ctx): void => {
    const button = asButton(cell.getValue());
    if (button) runButton(button, ctx);
  },
  // Space presses the anchor's button; any other key types over the cell as usual.
  onKey: (key, target, ctx): boolean => {
    if (key !== ' ') return false;
    const button = asButton(target.anchor.getValue());
    if (!button) return false;
    runButton(button, ctx);
    return true;
  },
  pane: ButtonPane
};

/** The button's look: a plain push button that fills the cell's content box. */
export const BUTTON_CSS = `
.sxl-cell-button { font: inherit; padding: 0 8px; height: calc(100% - 2px); width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; border: 1px solid #a0a0a0; border-radius: 3px; background: #f4f4f4; color: inherit; }
.sxl-cell-button:hover { background: #e8e8e8; }
.sxl-cell-button:active { background: #dcdcdc; }
`;

/** A macro for the buttons to run: stamps the time beside the first one. */
export const BUTTON_MACRO_SOURCE = `export function stampTime(sheet: IWorksheet): void {
  sheet.getRange('C14').setValue('Pressed at ' + new Date().toLocaleTimeString());
}
`;

// ── Registration and a seeded sheet ────────────────────────────────────────────────────────────

let registered = false;
/** Registers every kind, sdk and react halves, once. */
export const registerStoryCellControls = (): void => {
  if (registered) return;
  registered = true;
  CellControlRegistry.register({
    type: 'rating',
    label: 'Rating',
    accepts: (value: Scalar): boolean => value === null || value === undefined || (typeof value === 'number' && value >= 0)
  });
  registerCellControl('rating', RatingContent);

  RichDataRegistry.register(NumberRangeKind);
  CellControlRegistry.register({
    type: 'slider',
    label: 'Slider',
    accepts: (value: Scalar): boolean =>
      value === null || value === undefined || typeof value === 'number' || value instanceof NumberRange
  });
  registerCellControl('slider', SliderContent);
  // The same entry by the value's type: a range value with no slider control is a slider too.
  registerRichData(RANGE_TYPE, SliderContent);

  RichDataRegistry.register(CellButtonKind);
  registerRichData(BUTTON_TYPE, ButtonContent);
};

/**
 * Adds {@link BUTTON_MACRO_SOURCE} to the workbook's scripts. Compiling loads the TypeScript
 * compiler, so it settles later; until then the button says the macro is missing.
 */
export const addButtonMacro = async (sheet: IWorksheet): Promise<void> => {
  const scripts = sheet.getWorkbook()?.getScripts();
  if (!scripts) return;
  try {
    const module = await scripts.createModule({ source: BUTTON_MACRO_SOURCE });
    if (module) scripts.addModule('storyButtons', module);
  } catch (error) {
    console.warn('The button macro did not compile; the buttons will report it missing.', error);
  }
};

/** Fills `sheet` with a rating column, a slider column, a checkbox column and a formula row of each. */
export const seedCellControls = (sheet: IWorksheet): void => {
  sheet.getRange('A1:E1').setValues([['Item', 'Rating', 'Volume', 'Notes', 'Done']]);
  sheet.getRange('A1:E1').getStyle().update({ font: { weight: 700 } });
  sheet.getRange('A2:A6').setValues([['Coffee'], ['Tea'], ['Water'], ['Juice'], ['=A2&" again"']]);
  sheet.getRange('B2:B6').setControl({ type: 'rating', max: 5 });
  sheet.getRange('B2:B5').setValues([[4], [3], [5], [0]]);
  sheet.getRange('B6').setValue('=B2');
  sheet.getRange('C2:C6').setControl({ type: 'slider', min: 0, max: 100, step: 5 });
  sheet.getRange('C2:C5').setValues([[70], [35], [100], [0]]);
  sheet.getRange('C6').setValue('=AVERAGE(C2:C5)');
  sheet.getRange('D2:D6').setValues([
    ['press a star; press it again to clear'], ['type 1 to 5 with ratings selected'], ['a formula rating draws but takes no press'],
    ['drag the slider'], ['a formula slider draws but takes no drag']
  ]);
  // The built-in checkbox beside them: TRUE/FALSE/blank draw a box, a formula box takes no press.
  sheet.getRange('E2:E6').setControl({ type: 'checkbox' });
  sheet.getRange('E2:E4').setValues([[true], [false], [true]]);
  sheet.getRange('E6').setValue('=E2');

  // Range values: one with no control, one under the slider control (its bounds win), one from a formula.
  sheet.getRange('A8:D8').setValues([['Range', '', 'Slider', 'Notes']]);
  sheet.getRange('A8:D8').getStyle().update({ font: { weight: 700 } });
  sheet.getRange('A9:A11').setValues([['No control'], ['Under the control'], ['=C9']]);
  sheet.getRange('C9').setValue(new NumberRange(0, 10, 4, 1));
  sheet.getRange('C10').setControl({ type: 'slider', min: 0, max: 100, step: 5 });
  sheet.getRange('C10').setValue(new NumberRange(-50, 50, 10, 10));
  sheet.getRange('C11').setValue('=C9');
  sheet.getRange('D9:D11').setValues([
    ['a range value draws as a slider by its type (0 to 10)'],
    ['the value\'s bounds (-50 to 50) win over the control\'s (0 to 100)'],
    ['a formula over a range is a range: it draws but takes no drag']
  ]);

  // Buttons: a press or Space runs the macro; a formula over a button is a button.
  sheet.getRange('A13:D13').setValues([['Button', 'Press', 'Result', 'Notes']]);
  sheet.getRange('A13:D13').getStyle().update({ font: { weight: 700 } });
  sheet.getRange('B14').setValue(new CellButton('Stamp time', 'stampTime'));
  sheet.getRange('B15').setValue(new CellButton('No macro'));
  sheet.getRange('B16').setValue('=B14');
  sheet.getRange('D14:D16').setValues([
    ['runs stampTime, which writes C14 (the studio story adds the macro)'],
    ['says it has no macro; set one in Insert ▸ Controls ▸ Control Options'],
    ['=B14: the same button']
  ]);

  sheet.getRange('B1:C1').getColumnHeaders().setSize(110);
  sheet.getRange('D1').getColumnHeaders().setSize(380);
  sheet.getRange('E1').getColumnHeaders().setSize(60);
};
