import type React from 'react';
import { useState, useMemo, useEffect, useRef, memo } from 'react';

import { type Theme } from '@mui/material';
import { Box, Typography } from '@mui/material';

import { type ICalculation, type IFunction, type IRange, type IWorkbook } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import {
  FunctionArgIcons, argTypeKey, createFunctionHint, createFunctionDescriptor,
  formatEvalValue, toArgRows, assembleCall, useWorkbook, type ArgRow, type FunctionDescriptor
} from '@sheetxl/react';

import { FormulaField, FORMULA_FIELD_ABOVE_LABEL_HEIGHT } from '../form';

import { FUNCTION_ARGUMENTS_PANE_HEIGHT } from './paneMetrics';

/**
 * The heading block — the function's name (20) over its summary, THREE lines of it (48) plus the 2px
 * between them. Three because the summary is now the page's own description of what the user is
 * filling in (it used to sit below, sharing a block with the argument's), and a two-line window cut
 * the long ones (`SUMIFS`, the financial set) mid-sentence.
 */
const HEADER_HEIGHT = 70;
/**
 * The focused argument's description — three lines at the page's 16px line box.
 *
 * @remarks
 * It held five while it also carried the summary. On its own, three covers all but the longest
 * argument prose, and the two lines it gives back go to the rows, which is where the user is working.
 */
const ARG_DESCRIPTION_HEIGHT = 48;
/**
 * How an argument row is split between the FIELD and the value beside it.
 *
 * @remarks
 * A share of the row, not a fixed column: the value used to get 76px, which is four characters of a
 * date, a currency amount or an array's `{1, 2, 3…}` — every one of them ellipsed, in the column whose
 * whole job is to show what the argument came out as. The field keeps the majority (it is what the
 * user is aiming at and what holds the longer text), but the two now read as a pair rather than as a
 * field with a margin note. They are `flex` bases, not widths — a narrower host shrinks both in
 * proportion instead of clipping one.
 */
const ARG_FIELD_BASIS = '55%';
const ARG_VALUE_BASIS = '45%';

export interface FunctionArgumentsPanelProps {
  /**
   * The function whose arguments are being filled. ONE function — this panel never searches (in the
   * script editor there is nothing to search: the function is the one being written).
   */
  func: IFunction;
  /**
   * Resolution/evaluation context. Defaults to the enclosing `WorkbookContext`.
   *
   * @remarks
   * Optional, and genuinely so: without one the fields degrade to validated text (no picking, no
   * per-argument values, no result) rather than the panel refusing to render.
   */
  workbook?: IWorkbook | null;
  /**
   * The anchor a bare reference (`A1`) resolves against and serializes bare for — normally the cell
   * the call is being inserted into. Without one the fields fall back to the workbook's selected
   * sheet, and the result evaluates against its own default cell.
   */
  home?: Partial<IRange.CellCoords>;
  /** Take focus (the first argument field) on mount. @defaultValue `false` */
  autoFocus?: boolean;
  /**
   * The assembled call, on every change — `=SUM(A1:A5,B1)`. The host is what inserts it; this panel
   * owns no action row (see the class doc).
   */
  onChangeCall?: (call: string) => void;
  /** Class(es) for the panel root. */
  className?: string;
}

/**
 * Excel's **Function Arguments** — the function's name and summary, then one labelled field per
 * argument (each showing what it evaluates to), the focused argument's description, and the assembled
 * call's result.
 *
 * @remarks
 * A WIDGET, not a dialog page: it takes one function, renders no buttons, and treats `workbook` /
 * `home` as optional, so the same panel serves the Insert Function wizard's second page and (later) a
 * debug pane in the script editor, where a custom function being written can be filled in and watched
 * evaluate.
 *
 * **TEXT is the state of record.** Assembly is string concatenation, and an argument mid-typing
 * (`A1:`) has no `IFormula` at all — which is most of the time this panel is being used. Each row's
 * text is seeded into its field ONCE and never echoed back: `FormulaField`'s `value` is a committed
 * baseline that re-derives the display text whenever it changes, so feeding a keystroke back through
 * it would re-serialize under the caret (`A1` → `=A1`).
 *
 * **Each argument evaluates on its own**, through the `IFormula` its own field parsed — never as a
 * subtree of the assembled call. One blank or half-typed argument fails that parse, and every row's
 * value would blank at once, during the exact activity this panel exists for. Only the result line
 * evaluates the whole call.
 */
export const FunctionArgumentsPanel = memo<FunctionArgumentsPanelProps>((props: FunctionArgumentsPanelProps) => {
  const {
    func,
    workbook: propWorkbook,
    home,
    autoFocus = false,
    onChangeCall,
    className
  } = props;

  const t = useTranslator();
  const contextWorkbook = useWorkbook();
  const workbook = propWorkbook !== undefined ? propWorkbook : contextWorkbook;

  /** What the user has typed, one entry per row — the state of record (see the class doc). */
  const [texts, setTexts] = useState<string[]>([]);
  /** Each row's evaluated value, as display text; `null` while empty, invalid, or in flight. */
  const [values, setValues] = useState<(string | null)[]>([]);
  /**
   * Each row's parse error (a message KEY), collected from the fields rather than shown under them:
   * five reserved error lines is most of this panel's height, and the message reads better once, in
   * full width, where the result would otherwise be.
   */
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<string | null>(null);
  /** The row whose description is shown and whose slot the signature emphasizes. */
  const [activeRow, setActiveRow] = useState<number>(0);
  const [descriptor, setDescriptor] = useState<FunctionDescriptor | null>(null);

  const refRoot = useRef<HTMLDivElement>(null);
  /**
   * Per-row (and, at `-1`, whole-call) evaluation generations. Every evaluation is async and the user
   * keeps typing through it, so a landing result is dropped unless it is still the newest one asked
   * for — otherwise a slow `A1:A100000` overwrites the value of what was typed after it.
   */
  const refGens = useRef<Map<number, number>>(new Map());

  const params = useMemo(() => func.getDeclaration().getParameters(), [func]);
  const rows = useMemo(() => toArgRows(params, texts), [params, texts]);

  // The localized name + the locale's argument separator — what the assembled call is built from,
  // and what the heading shows. No `argIndex`: this page renders no signature to emphasize an
  // argument in (the form IS the argument list), so the hint does not depend on the focused row.
  const hint = useMemo(() => {
    return createFunctionHint(func, { locale: workbook?.getLocale() });
  }, [func, workbook]);

  // The call the host inserts, and the one thing the result line evaluates. The LOCALIZED name: it
  // is what the cell will hold for a user typing in their own language.
  const call = useMemo(() => {
    return assembleCall(hint.nameLocal ?? hint.name, rows, texts, { separator: hint.argSeparator });
  }, [hint, rows, texts]);

  useEffect(() => { onChangeCall?.(call); }, [call, onChangeCall]);

  // The function's own text, lazily (and ignored if the function moved on) — same load the picker's
  // hint does, so the two pages read identically.
  useEffect(() => {
    let cancelled = false;
    const name = func.getName();
    func.getDescriptor()
      .then((resolved) => { if (!cancelled) setDescriptor(createFunctionDescriptor(name, resolved)); })
      .catch(() => { if (!cancelled) setDescriptor(null); });
    return () => { cancelled = true; };
  }, [func]);

  // `autoFocusSel` fires on the DIALOG's mount, and this panel arrives on a later page — so it takes
  // its own first focus, on the first argument's input.
  useEffect(() => {
    if (!autoFocus) return;
    (refRoot.current?.querySelector('input') as HTMLInputElement | null)?.focus();
  }, [autoFocus]);

  /** Invalidate whatever evaluation is in flight for `key`, and return the new generation. */
  const nextGen = useCallbackRef((key: number): number => {
    const gen = (refGens.current.get(key) ?? 0) + 1;
    refGens.current.set(key, gen);
    return gen;
  }, []);

  const setTextAt = useCallbackRef((index: number, text: string): void => {
    setTexts((prev) => {
      const next = prev.slice();
      while (next.length <= index) next.push('');
      next[index] = text;
      return next;
    });
    // The value belongs to the text that produced it. Cleared here (rather than left stale until the
    // next evaluation lands) because the very next keystroke may be one the field cannot parse, in
    // which case no evaluation is coming at all.
    nextGen(index);
    setValues((prev) => {
      if (prev[index] === undefined || prev[index] === null) return prev;
      const next = prev.slice();
      next[index] = null;
      return next;
    });
  }, [nextGen]);

  const setErrorAt = useCallbackRef((index: number, error: string | null): void => {
    setErrors((prev) => {
      if ((prev[index] ?? null) === error) return prev;
      const next = prev.slice();
      while (next.length <= index) next.push(null);
      next[index] = error;
      return next;
    });
  }, []);

  const evaluateAt = useCallbackRef(async (index: number, formula: ICalculation.IFormula | null): Promise<void> => {
    const gen = nextGen(index);
    let text: string | null = null;
    try {
      text = formula ? formatEvalValue(await formula.evaluate()) : null;
    } catch (error: any) {
      text = null; // an argument that cannot be evaluated simply shows no value
    }
    if (refGens.current.get(index) !== gen) return;
    setValues((prev) => {
      const next = prev.slice();
      while (next.length <= index) next.push(null);
      next[index] = text;
      return next;
    });
  }, [nextGen]);

  // The result line — the ONE evaluation of the assembled call.
  useEffect(() => {
    // The SELECTED sheet's calculation, as the editor's own hover evaluation uses: it is what a bare
    // `A1` in an argument resolves against.
    const calculation = workbook ? (workbook.getSelectedWorksheet()?.getCalculation() ?? workbook.getCalculation()) : null;
    // A REQUIRED argument still empty means there is no call to answer yet. `assembleCall` keeps the
    // blank slots (`=PV(0.05,,)` — trimming them would change the call's arity), and that formula is
    // perfectly legal: a blank argument is zero, so it evaluates to 0, exactly as the same formula
    // typed into a cell would. But that 0 is an artifact of the two fields the user has not reached,
    // not the present value of anything, and shown against `Result` it reads as an answer. Excel's
    // dialog holds the line empty for the same reason.
    //
    // Nothing typed AT ALL is the same rule for a function whose arguments are all optional: `=SUM()`
    // is not a question the user asked, and its error is not an answer. A function that takes NO
    // arguments is the exception — `=TODAY()` is complete on arrival.
    const isIncomplete = rows.some((row: ArgRow, index: number) => !row.optional && !texts[index]?.trim());
    if (!calculation || isIncomplete || (rows.length > 0 && !texts.some((text) => text?.trim()))) {
      // Invalidated, not merely cleared: emptying a required field while the COMPLETE call's
      // evaluation is still in flight is the ordinary way to get here, and that result would
      // otherwise land a moment later and fill the line this branch just blanked.
      nextGen(-1);
      setResult(null);
      return undefined;
    }
    const gen = nextGen(-1);
    void (async () => {
      let text: string | null = null;
      try {
        text = formatEvalValue(await calculation.evaluate(call, { ...home, target: 'display' }));
      } catch (error: any) {
        text = null;
      }
      if (refGens.current.get(-1) === gen) setResult(text);
    })();
    return undefined;
  }, [call, workbook, home, texts, rows, nextGen]);

  /**
   * The message the bottom line shows instead of the result: the ACTIVE row's error first (it is the
   * one being typed), else the first row with one — an invalid argument the user has moved on from
   * must not go silent, and the assembled call cannot evaluate through it either.
   */
  const errorMessage = useMemo(() => {
    const index = errors[activeRow] ? activeRow : errors.findIndex((error, i) => !!error && !!rows[i]);
    const error = index >= 0 ? errors[index] : null;
    // `t` on a message KEY; a plain sentence passes through unchanged.
    return error ? `${rows[index]?.label}: ${t(error)}` : null;
  }, [errors, activeRow, rows, t]);

  const activeDescription = useMemo(() => {
    const row = rows[activeRow];
    if (!row || descriptor?.name !== func.getName()) return undefined;
    return descriptor?.params?.[row.descKey]?.description;
  }, [rows, activeRow, descriptor, func]);

  const argRows = useMemo(() => {
    return rows.map((row: ArgRow, index: number) => (
      <Box
        key={row.key}
        sx={{
          display: 'flex',
          // STRETCH, not center: the field's helper line is collapsed here (`helperText={null}`), so
          // the block is label-over-input and its middle is no longer the input. The value beside it
          // pays the label's height back as padding and centers in what is left — the input — which
          // is exact, needs no measuring, and does not move when an error appears (the error goes to
          // the panel's own line, and the field only changes color).
          alignItems: 'stretch',
          columnGap: (theme: Theme) => theme.spacing(1)
        }}
      >
        <FormulaField
          // The label is the FIELD's, placed above it: a label column beside the fields would take
          // ~100px off every one of them, and this panel is narrow and tall by design (the same
          // footprint as the search page, so the dialog does not resize between them).
          labelPlacement="above"
          label={(<>
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'var(--sxl-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
                // Excel's device for required-vs-optional in this form: weight, not the signature's
                // `[…]` brackets (which say the same thing where a single line has nowhere else to
                // put it).
                fontWeight: row.optional ? 400 : 700
              }}
            >
              {row.label}
            </Box>
            {/* The hint's own cluster, WITHOUT its type icon — the type is said in words in the
                field's placeholder below, where an empty field has the room for it and a filled one
                no longer needs it. What is left marks only what the label cannot: repeatable, and
                optional. */}
            <FunctionArgIcons
              param={row.param}
              repeat={row.repeat}
              optional={row.optional}
              showType={false}
              size={14}
            />
          </>)}
          // The declared TYPE, not "Enter Formula" — a repeated instruction down a column of five
          // fields is noise, while "number" / "text" / "logical" answers the question the empty field
          // actually raises, and disappears the moment it is answered.
          placeholder={t(argTypeKey(row.param))}
          // The error goes to the panel's own message line (below), where there is room for it — the
          // field keeps its red outline and says nothing itself. `helperText={null}` then COLLAPSES
          // the line rather than reserving it: five fields' worth of permanently empty message line
          // is ~120px, which is a quarter of this page, and none of it can ever hold anything.
          showError={false}
          helperText={null}
          onChangeError={(error: string | null) => setErrorAt(index, error)}
          workbook={workbook}
          home={home}
          // Seeded EMPTY and never echoed: the field owns its in-progress text (see the class doc).
          value={null}
          onChangeText={(text: string) => setTextAt(index, text)}
          onChangeInput={(formula: ICalculation.IFormula | null) => { void evaluateAt(index, formula); }}
          // No `onDone`, deliberately — which keeps the field LIVE and its adornment the
          // select-current-range action ("put the sheet's selection here"), visible the whole time
          // an argument is being filled. Wiring `onDone` would swap that for the modal ✓/✗ pair
          // *while engaged*, and in a live panel ✓ has nothing to commit: every keystroke is
          // already in `texts`. Picking does not need the pair either — the field is a reference
          // producer from the moment it takes focus (the host suspends its modality on the same
          // bus), and Tab/Enter/another field ends the pick.
          onFocus={() => setActiveRow(index)}
          // An enum argument offers its values while the field is empty — a free-text field still, so
          // a reference or an expression is typed as in any other row.
          argument={{ fn: func, param: row.param }}
          sx={{ minWidth: 0, flex: `1 1 ${ARG_FIELD_BASIS}` }}
        />
        <Typography
          component="span"
          sx={{
            flex: `1 1 ${ARG_VALUE_BASIS}`,
            minWidth: 0,
            display: 'flex',
            // The label's height, paid back — see the row's `alignItems` above. Centering happens in
            // the box that is left, which is exactly the input's.
            boxSizing: 'border-box',
            paddingTop: FORMULA_FIELD_ABOVE_LABEL_HEIGHT,
            alignItems: 'center',
            columnGap: '4px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            color: 'text.secondary',
            fontFamily: 'var(--sxl-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
            fontSize: '0.8rem'
          }}
          // A long value (an array, a wide date format) still ellipses — the full one is one hover
          // away.
          title={values[index] ?? ''}
        >
          {/* The `=` is ALWAYS there — it is the row's shape ("this argument equals…"), not a
              decoration on the value. Appearing and disappearing with the value made the column
              twitch on every keystroke, and an empty row read as if it had no value slot at all. */}
          <Box component="span" aria-hidden>=</Box>
          <Box
            component="span"
            className="function-arg-value"
            sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {values[index] ?? ''}
          </Box>
        </Typography>
      </Box>
    ));
  }, [func, rows, values, workbook, home, setTextAt, setErrorAt, evaluateAt, t]);

  return (
    <Box
      ref={refRoot}
      className={className}
      sx={{
        // What this page ASKS for — a basis, not a pin (see `paneMetrics`): the host sizes to the
        // taller of its pages and this one fills it, and a host too short for it compresses this one
        // rather than overflowing the window. Everything inside is fixed except the argument rows,
        // which absorb the difference either way (they are also the part that GROWS as a rest
        // parameter is filled, so they are the only sane place to put the give).
        height: `${FUNCTION_ARGUMENTS_PANE_HEIGHT}px`,
        flex: '1 1 auto',
        minHeight: 0,
        boxSizing: 'border-box',
        paddingTop: (theme: Theme) => theme.spacing(1),
        display: 'flex',
        flexDirection: 'column',
        rowGap: (theme: Theme) => theme.spacing(1),
        // Stated, not inherited: the hint components below render plain DOM, and an undefined
        // `--sxl-font-family` with no fallback is an invalid declaration — the text then inherits the
        // UA serif.
        fontFamily: (theme: Theme) => theme.typography.fontFamily,
        fontSize: '0.8rem',
        lineHeight: '16px'
      }}
    >
      {/* The function, NAMED and described — Excel's heading for this page, and the two things a
          user who arrived here from the search list still needs. Deliberately NOT the signature: its
          argument list is the form below, rendered at length, with each argument's own field, icons
          and value. Repeating it as a single line would be the same information said worse, and it
          cost the description the room it is short of. */}
      {/* `flexShrink: 0` on every fixed block here, and basis 0 on the scrolling one below: a
          `height` in a flex column is only a starting bid (flex-shrink defaults to 1), so a row
          region whose content outgrows the panel takes the difference out of its siblings — the
          heading, the description and the result line all quietly losing most of their declared
          height. See the same note on the search page's function list. */}
      <Box sx={{ height: `${HEADER_HEIGHT}px`, flexShrink: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            fontFamily: 'var(--sxl-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
            // The accent the signature gives a function name everywhere else it is shown.
            color: 'primary.main',
            fontWeight: 600,
            fontSize: '0.95rem',
            lineHeight: '20px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {hint.nameLocal ?? hint.name}
        </Box>
        {descriptor?.name === func.getName() ? (
          <Box sx={{ paddingTop: '2px', color: 'text.secondary' }}>{descriptor.summary}</Box>
        ) : null}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          // Takes whatever the fixed blocks leave, and scrolls past it — Excel's argument area is an
          // inset region too, and the border is what makes its scrollbar read as belonging to the
          // list rather than floating inside the dialog's padding. Basis ZERO: the rows GROW as a
          // rest parameter is filled, and a content-sized basis would make that growth come out of
          // the blocks above and below.
          flex: '1 1 0',
          // A floor, so a host shorter than this page's preference takes the difference out of the
          // rows only down to a couple of them and then scrolls — rather than closing the region the
          // page exists for to nothing while the blocks around it keep every pixel.
          minHeight: '80px',
          rowGap: '4px',
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '4px',
          padding: (theme: Theme) => theme.spacing(0.5, 1)
        }}
      >
        {argRows}
      </Box>

      <Box
        sx={{
          // Fixed, so the layout does not shift as focus moves between a described argument and one
          // the declaration has nothing to say about. Five lines: argument prose is a sentence or
          // three (`SUMIFS`' `criteria1`), and the block that holds it is the one thing on this page
          // a user is READING — a two-line window onto it scrolls at exactly the wrong moment.
          height: `${ARG_DESCRIPTION_HEIGHT}px`,
          flexShrink: 0,
          overflowY: 'auto',
          color: 'text.secondary'
        }}
      >
        {activeDescription ? (<>
          <Box component="span" sx={{ fontWeight: 600 }}>{rows[activeRow]?.label}: </Box>
          {activeDescription}
        </>) : null}
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexShrink: 0,
          columnGap: (theme: Theme) => theme.spacing(1),
          borderTop: '1px solid',
          borderColor: 'divider',
          paddingTop: (theme: Theme) => theme.spacing(1)
        }}
      >
        {errorMessage ? (
          // The argument errors land HERE, where the result would be: they are the reason there is no
          // result, and one full-width line says more than five clipped ones under the fields.
          <Box className="function-error" sx={{ color: 'error.main', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {errorMessage}
          </Box>
        ) : (<>
          <Box sx={{ color: 'text.secondary' }}>{t('functionArguments.result')}</Box>
          <Box
            className="function-result"
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--sxl-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)'
            }}
            title={result ?? ''}
          >
            {result ?? ''}
          </Box>
        </>)}
      </Box>
    </Box>
  );
});

FunctionArgumentsPanel.displayName = 'FunctionArgumentsPanel';

export default FunctionArgumentsPanel;
