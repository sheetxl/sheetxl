import type React from 'react';
import {
  memo, forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef
} from 'react';

import clsx from 'clsx';

import { useFormContext, type RegisterOptions } from 'react-hook-form';

import { type Theme } from '@mui/material';
import { Box, FormControl, type FormControlProps } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { TextField } from '@mui/material';

import { type ICalculation, type ICellRanges, type IRange, type IWorkbook } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';
import { ExhibitIconButton } from '@sheetxl/utils-mui';

import {
  useFormulaInput, useFormulaInputParts,
  type FormulaInputApi, type FormulaInputGrammar, type FormulaInputEquals, type ReferenceDoneArgs,
  type FormulaArgument
} from '@sheetxl/react';

/** Keep a left-click on an adornment button from blurring the field (the formula bar's trick). */
const noFocusSteal = (e: React.MouseEvent<HTMLElement>): void => { if (e.button === 0) e.preventDefault(); };

/**
 * The line box of the helper/error text under the field — and of an `'above'` label over it. ONE
 * constant for both: the two have to occupy the same height for the input to sit in the middle of
 * the block (see `labelPlacement`).
 */
const LABEL_LINE_HEIGHT = '20px';
/** The gap between that line and the field, on either side. */
const LABEL_LINE_GAP = '4px';
/**
 * The horizontal inset of that line — MUI's outlined input text inset (`sizeSmall` pads its input
 * `8.5px 14px`), which is also what `FormHelperText` already uses for its own margins. Without it an
 * `'above'` label starts 14px left of the text it names, and reads as belonging to the dialog rather
 * than to the field.
 */
const LABEL_LINE_INDENT = '14px';

/**
 * The height an `'above'` label adds over the input — its line plus the gap under it.
 *
 * @remarks
 * Exported for a host aligning something to the INPUT of a field whose helper line is collapsed
 * (`helperText: null`): the block is no longer symmetric, so its middle is no longer the input, and
 * `align-items: center` on the row would sit that high by exactly this much. Pad the sibling by this
 * and center it in what is left. With the helper line RESERVED (the default) nothing needs it.
 */
export const FORMULA_FIELD_ABOVE_LABEL_HEIGHT = `calc(${LABEL_LINE_HEIGHT} + ${LABEL_LINE_GAP})`;

export interface FormulaFieldProps extends FormControlProps {
  /**
   * The field's grammar. `'formula'` (default) accepts any expression (`=SUM(A1:A5)*2`);
   * `'reference'` is the "limit input" specialization — a pure reference list
   * (`Sheet1!A1:B2, Sheet2!C1`), rejecting function calls and computed references per
   * `ICalculation.IFormula.isReferenceOnly` (Excel's RefEdit contract).
   */
  grammar?: FormulaInputGrammar;
  /**
   * If provided will be registered with react-hook-form.
   *
   * @remarks
   * We don't support changing the formName once rendered.
   * @see
   * {@link https://react-hook-form.com/}
   */
  formName?: string;
  /**
   * React-hook-form options.
   *
   * @remarks
   * Only used if formName is provided.
   */
  formOptions?: RegisterOptions;
  /**
   * The committed value. The display text re-derives whenever it changes (per the grammar's
   * serialization policy). Accepted as `IFormula | ICellRanges | string` for DX — a host holding
   * ranges passes them straight in. With a {@link home} the address is localized to it (bare there,
   * qualified elsewhere); without one the ranges' own scoping is what the field shows (sheet-scoped
   * read bare, workbook-scoped sheet-qualified; see `ICellRanges.getAddress`). The change channels
   * always emit `IFormula` — read ranges via `value.getReferences()` or `apiRef.current.getRanges()`.
   */
  value: ICalculation.IFormula | ICellRanges | string | null;
  /**
   * Live notification of the value change — fires on every VALID text state (typed or picked);
   * invalid in-progress text shows the error state instead.
   *
   * A PREVIEW channel: hosts that mutate the model per change (resize a table, re-source a chart)
   * should act on {@link onDone} instead and treat this as optional live feedback.
   */
  onChangeInput?: (value: ICalculation.IFormula | null) => void;
  /**
   * The raw TEXT channel: every display-text change the user causes (typed, picked, F4'd, reverted) —
   * INVALID states included, and regardless of {@link changeOn}.
   *
   * For hosts that persist authored TEXT rather than a parsed value (a name's "refers to", written
   * through to a draft that validates on save): {@link onChangeInput} would leave them holding the
   * last VALID text while the field shows something else. An outside {@link value} change does not
   * fire it.
   */
  onChangeText?: (text: string) => void;
  /**
   * The COMMIT channel: fires once with the final parsed value when the edit finishes — a done key
   * (Enter/Tab/Escape, from the field or the grid), the adornment toggle-off, or blur to another
   * field. `args.reason` distinguishes accept from cancel (a cancel delivers the reverted session
   * baseline). Not fired on an accept while the text is invalid — the error stays shown instead.
   */
  onDone?: (value: ICalculation.IFormula | null, args: ReferenceDoneArgs) => void;
  /**
   * The field's CHANGE MODEL. Default `'live'`.
   *
   * `'done'` does three things, not one:
   *
   * 1. suppresses the live {@link onChangeInput} notifications entirely — parsing still runs (error
   *    state, picker sync) and the host hears only {@link onDone};
   * 2. makes Enter the FIELD's commit point — captured, so a host dialog's default button never
   *    submits over it (in `'live'` mode Enter bubbles, since every change already applied);
   * 3. drops the picker to caret-edit while the user TYPES (`'reference'` grammar; a pick re-arms) —
   *    a `'live'` field points for its whole engagement, the Excel RefEdit contract.
   *
   * A host that acts only on the commit channel should say so here rather than merely leaving
   * {@link onChangeInput} unwired — the two look the same to the host but differ at the keyboard.
   *
   * The ✓/✗ adornments follow it too: shown in `'done'` while the text differs from the committed
   * value, never in `'live'`, where there is no pending text for them to accept. {@link onDone} fires
   * the same way in both.
   */
  changeOn?: 'live' | 'done';
  /**
   * The headless field API, for host-driven commit points the blur heuristic can't see — a dialog's
   * OK handler calls `apiRef.current?.commit()` (Cancel: `.cancel()`).
   */
  apiRef?: React.Ref<FormulaInputApi>;
  /** Resolution/picking context. Defaults to the enclosing `WorkbookContext`. */
  workbook?: IWorkbook | null;
  /**
   * The field's HOME anchor — the coords (with `scope`) a bare reference (`A1`) resolves against and
   * serializes bare for. BOTH grammars honor it; a field with no home (either grammar) has no bare
   * form and stays fully qualified, picks included — the visible tab does not stand in for one.
   */
  home?: Partial<IRange.CellCoords>;
  /** Leading-`=` policy (`'formula'` grammar only). Default `'optional'`. */
  equals?: FormulaInputEquals;
  /**
   * What a PICK writes — `'absolute'` (`$A$1:$B$2`) or `'relative'` (`A1:B2`). Default `'relative'`
   * (the cell editor's behavior). A DEFAULT, not a constraint: typing and F4 still reach either form,
   * and a value handed in keeps the fixability it came with. `'absolute'` is the defined-name and
   * table-resize shape. See `UseFormulaInputOptions.pickAs`.
   */
  pickAs?: 'absolute' | 'relative';
  /**
   * Whether a pick that is exactly a dynamic array's spill writes `D2#` instead of its address.
   * Default `false`, as Excel's range fields; the cell editor always does. See
   * `UseFormulaInputOptions.pickSpills`.
   */
  pickSpills?: boolean;
  /**
   * Allow a comma-separated multi-range reference (typed, or Ctrl+click-picked). Default `false`;
   * a `'formula'` field defaults to `true` and gates only the pick. See `UseFormulaInputOptions.allowMulti`.
   */
  allowMulti?: boolean;
  /**
   * Whether references may reach other sheets. Default `true`. Set `false` for a single-sheet input (a
   * table's range, conditional formatting's "Applies to"): typed cross-sheet references become errors,
   * the grid refuses picks on other sheets, and addresses display bare. Independent of
   * {@link allowMulti} — see `UseFormulaInputOptions.allowCrossSheet`.
   */
  allowCrossSheet?: boolean;
  /**
   * Whether the field must hold a value. Default `false`: empty text is the cleared value (`null`).
   * `true` makes empty text an error, so it is never committed — see
   * `UseFormulaInputOptions.required`.
   */
  required?: boolean;
  /**
   * Field label. Default `"Formula"` (`'reference'` grammar: `"Range"`).
   *
   * @remarks
   * `null` (explicitly — not `undefined`, which takes the default) renders NO label, and the
   * input's text re-centers in its box (the asymmetric padding only exists to clear the label on
   * the border). For a field composed into a row whose meaning the row already states — pair with
   * `helperText: null` for a fully compact field that centers against its siblings.
   */
  label?: React.ReactNode | null;
  /**
   * Where the label goes.
   *
   * @defaultValue `'floating'` — MUI's notched outline label.
   *
   * @remarks
   * `'above'` puts it on its own line above the field, sized to match the helper/error line BELOW
   * the field. That symmetry is the point: it leaves the input at the vertical middle of the whole
   * field block, so a host can vertically center something beside it (a per-argument evaluated
   * value) and have it line up with the text in the field — without measuring anything, and without
   * moving when an error appears.
   */
  labelPlacement?: 'floating' | 'above';
  /**
   * Show the parse error under the field.
   *
   * @defaultValue `true`
   *
   * @remarks
   * `false` keeps the error OUTLINE (the field still reads as wrong) but leaves the helper line to
   * {@link helperText} — for a host that collects errors through {@link onChangeError} and shows
   * them somewhere of its own: one message area for a form of many fields, rather than a line under
   * each.
   */
  showError?: boolean;
  /**
   * The parse error CHANGED — the message key, or `null` when the text became valid again.
   *
   * @remarks
   * The error as the field would show it: held back while an operand is expected at the caret
   * (`=A1+`, a lone `=`), and reported when the field is left that way.
   *
   * A message KEY, not a sentence (the same rule as `disabledReasons`): the error is state that
   * outlives a language switch, so the chrome that renders it translates at display — `t(key)`, which
   * passes a non-key through unchanged.
   */
  onChangeError?: (error: string | null) => void;
  /**
   * An error the host found in text that PARSES — a list item holding the separator. Outlines the
   * field and takes the helper line as a parse error does; a parse error wins when there are both.
   * A message key or plain text, as {@link onChangeError}'s.
   */
  validationError?: string | null;
  /** Placeholder. Default `"Enter Formula"` (`'reference'` grammar: `"Enter Range"`). */
  placeholder?: string;
  /**
   * Guidance shown under the field while it is VALID. The error takes that line when there is one —
   * the field reserves it either way, so the layout never shifts.
   *
   * @remarks
   * Without this a host had to render its own caption below the field, on top of the reserved line
   * (which then hid the error).
   *
   * `null` (explicitly — not `undefined`, which takes the reserved default) COLLAPSES the line
   * instead: the field's block ends at the input. For a form of many fields that shows its messages
   * somewhere else, ~24px per field of reserved emptiness is most of the page. Pair it with
   * {@link showError} `false` — otherwise an error still claims a line, and the layout shifts as it
   * appears — and note that an `'above'` label then leaves the block ASYMMETRIC (see
   * {@link FORMULA_FIELD_ABOVE_LABEL_HEIGHT}).
   */
  helperText?: React.ReactNode | null;
  /** Hide the adornment cluster (✓/✗ while editing in `'done'` mode; the select-current action). */
  hideAdornment?: boolean;
  /**
   * Class(es) for the INNER `<input>` — `className` styles the FormControl root, which selectors
   * aimed at the input (a dialog's `autoFocusSel`) can't use. The dialogs' autofocus convention is
   * the main use: pass `'autoFocus'` and the host's `.autoFocus` selector finds this field.
   * OPT-IN, unlike `InputField` (which always tags its input): a dialog holding both field kinds
   * decides which one takes first focus by tagging it, rather than by DOM order.
   */
  classNameInput?: string;
  /**
   * The call argument this field's whole text is — the Function Arguments form's rows. An empty field
   * then offers, in its hint popup, the values the parameter is limited to.
   */
  argument?: FormulaArgument | null;
  /**
   * Reference to the element.
   */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The **formula field**, MUI tier (supersedes `ReferenceInput`/`RangeInput` — see
 * `@sheetxl/react` `form/README-FORM-INPUTS.md`): a form-shaped (TextField) input whose value is an
 * `ICalculation.IFormula`. One component covers both grammars (see {@link FormulaFieldProps.grammar})
 * — a `'formula'` field colors its tokens with the editor's syntax palette; a `'reference'` field is
 * the "limit input" (a pure reference list — multi-range per `allowMulti`, cross-sheet per
 * `allowCrossSheet`, addressed against `home`) coloring its segments by picker index. While focused it is the
 * reference-mode bus PRODUCER — grid drags, header picks and keyboard point-nav write into the field
 * through the same machinery the formula editor uses — with keyboard pointing armed without F2 (a
 * live field points while engaged; a done-mode field drops to caret-edit while typing; Enter/Escape
 * on the grid come home to the field via `onDone`).
 *
 * @remarks
 * A THIN chrome wrapper: all behavior lives in the headless `useFormulaInput` + the shared
 * chrome parts `useFormulaInputParts` (`@sheetxl/react`) — this file is only the MUI field +
 * adornments + react-hook-form wiring around them. Without a workbook (no context, no prop) it
 * degrades to a plain validated text field — picking requires the resolution context.
 */
export const FormulaField = memo(forwardRef<HTMLDivElement, FormulaFieldProps>(
  (props: FormulaFieldProps, refForwarded) => {
  const {
    grammar = 'formula',
    formName,
    formOptions,
    disabled: propDisabled,
    className: propClassName,
    sx: propSx,
    onKeyDown: propOnKeyDown,
    onFocus: propOnFocus,
    value,
    onChangeInput,
    onChangeText,
    onDone,
    changeOn,
    apiRef,
    workbook,
    home,
    equals,
    pickAs,
    pickSpills,
    allowMulti,
    allowCrossSheet,
    required,
    label: propLabel,
    labelPlacement = 'floating',
    placeholder: propPlaceholder,
    helperText: propHelperText,
    showError: propShowError = true,
    onChangeError,
    validationError,
    hideAdornment,
    classNameInput,
    argument,
    id: propId,
    ...rest
  } = props;
  const t = useTranslator();
  const isLabelAbove = labelPlacement === 'above';
  // The label is rendered by US in `'above'` mode, so it needs the input's id to point at — MUI's own
  // (floating) label gets it from the TextField's internal FormControl, which is out of reach here.
  const generatedId = useId();
  const inputId = propId ?? generatedId;
  const isFormulaGrammar = grammar === 'formula';
  // `null` opts out of the label entirely (see the prop) — `??` cannot make that distinction.
  const label = propLabel === undefined
    ? (isFormulaGrammar ? t('formulaInput.label') : t('rangeInput.label'))
    : propLabel;
  const placeholder = propPlaceholder ?? (isFormulaGrammar ? t('formulaInput.placeholder') : t('rangeInput.placeholder'));
  const formContext = useFormContext<any>();
  const formHandler = (formName && formContext) ? formContext.register(formName, formOptions) : null;

  const api = useFormulaInput({
    value,
    onChange: onChangeInput,
    onChangeText,
    onDone,
    changeOn,
    workbook,
    home,
    equals,
    pickAs,
    pickSpills,
    allowMulti,
    allowCrossSheet,
    required,
    disabled: propDisabled
  }, grammar);
  useImperativeHandle(apiRef, () => api, [api]);

  // The shared chrome parts — the coloring overlay + the hover eval tip (`@sheetxl/react`). The
  // overlay measures the MUI input's box + computed text styles, so it tracks the TextField's own
  // size/variant without duplicating MUI's styling rules.
  const parts = useFormulaInputParts({ api, grammar, disabled: propDisabled, workbook, home, argument });

  // Don't present "invalid" while the user is 99% mid-typing (`=A1+` — the trailing marker is
  // showing); the commit gate still blocks an incomplete accept, and the error surfaces on blur.
  const hasParseError = !!api.error && !parts.inputExpected;
  const hasError = hasParseError || !!validationError;

  // See the `helperText` prop: `undefined` reserves the line (a space), an explicit `null` collapses
  // it, and a shown error takes it from either.
  const helperText = (propShowError && hasError)
    ? (hasParseError ? t(api.error!) : t(validationError!))
    : (propHelperText === undefined ? " " : propHelperText);

  // Mirror the parse state OUT — to react-hook-form (when registered) and to `onChangeError` —
  // on TRANSITIONS only, with both read through refs. All of that is load-bearing: RHF's
  // `FormProvider` mints a NEW context object every provider render, and `clearErrors`/`setError`
  // always emit a form-state change — so a context dep plus an unconditional call is a render↔effect
  // loop with any dialog that reads `formState` (OptionsDialog does). An initial no-error mount
  // writes nothing at all.
  const formContextRef = useRef(formContext);
  formContextRef.current = formContext;
  const onErrorRef = useRef(onChangeError);
  onErrorRef.current = onChangeError;
  const prevErrorRef = useRef<string | null>(null);
  // The host hears the error this field would show, so an error line of its own (`showError` off)
  // holds back mid-typing as the field's does. The form keeps the raw error: it gates the submit.
  const shownParseError = hasParseError ? api.error : null;
  const prevShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (shownParseError === prevShownRef.current) return;
    prevShownRef.current = shownParseError;
    onErrorRef.current?.(shownParseError);
  }, [shownParseError]);
  useEffect(() => {
    if (api.error === prevErrorRef.current) return;
    prevErrorRef.current = api.error;
    if (!formName) return;
    const ctx = formContextRef.current;
    if (!ctx) return;
    if (api.error) ctx.setError(formName, { message: api.error });
    else ctx.clearErrors(formName);
  }, [api.error, formName]);

  // The ✓/✗ pair is a `'done'`-mode affordance, shown while the text differs from the committed value
  // — only then is there something for it to accept or drop: ✓ commits (disabled while the text is
  // invalid), ✗ cancels back to the session baseline; drags never commit — the user finishes here (or
  // Enter/blur). ✓ sits FIRST — closest to the input (Excel's order for a trailing pair; the formula
  // bar's pair is leading, hence mirrored). In `'live'` every valid change has already gone out, so
  // the pair never shows. The select icon is a plain
  // ACTION in every mode — "copy the sheet's selection to here" (engaging first when idle; never a
  // toggle). `onMouseDown` preventDefault (same trick as the formula bar) keeps a click from blurring
  // the field.
  const modal = changeOn === 'done';
  const endAdornment = useMemo(() => {
    if (hideAdornment) return undefined;
    const buttons = (api.engaged && modal && api.dirty) ? (
      <>
        <ExhibitIconButton
          dense={true}
          outlined={false}
          color="primary"
          aria-label="commit-reference"
          icon={<DynamicIcon iconKey="CheckSuccess" />}
          propsTooltip={{ label: t('referenceInput.commit'), simple: true }}
          disabled={!!api.error}
          tabIndex={-1} // pointer affordance only — Tab must leave the FIELD, not stop on its adornments
          onMouseDown={noFocusSteal}
          onClick={() => { api.commit(); }}
        />
        <ExhibitIconButton
          dense={true}
          outlined={false}
          color="warning"
          aria-label="cancel-reference"
          icon={<DynamicIcon iconKey="CloseError" />}
          propsTooltip={{ label: t('referenceInput.cancel'), simple: true }}
          tabIndex={-1}
          onMouseDown={noFocusSteal}
          onClick={() => { api.cancel(); }}
        />
      </>
    ) : (
      <ExhibitIconButton
        dense={true}
        outlined={false}
        // Formula grammar: enabled only where the selection can LAND (caret on a reference —
        // re-scope — or where an operand is expected); mid-token it spliced into random spots.
        // The default Mui-disabled grayscale is invisible on an already-neutral icon — dim it too.
        disabled={propDisabled || !api.canSelectCurrent}
        sx={{ '&.Mui-disabled': { opacity: 0.35 } }}
        aria-label="select-current-range"
        icon={<DynamicIcon iconKey="SelectRangeMode" />}
        propsTooltip={{ label: t('referenceInput.selectCurrent'), simple: true }}
        // Not a tab stop: a Tab out of the field commits and the engaged→idle flip swaps the ✓/✗ pair
        // back to THIS button mid-keystroke — without this, the Tab landed on it instead of the next
        // dialog field. Pointer affordance only, like the pair above.
        tabIndex={-1}
        onMouseDown={noFocusSteal}
        // Engage first when idle (captures the Escape baseline + arms picking), then adopt the
        // selection; already engaged (live mode) → just adopt.
        onClick={() => { if (!api.engaged) api.togglePoint(); api.selectCurrent(); }}
      />
    );
    return (
      <InputAdornment
        tabIndex={-1}
        // A DISABLED button swallows its own mouse events (no `onMouseDown` fires) — the guard on
        // the container keeps a click on it from blurring the field anyway.
        onMouseDown={noFocusSteal}
        sx={{
          display: 'flex',
          position: 'relative',
          flex: '0'
        }}
        position="end"
      >
      {buttons}
      </InputAdornment>
    )
  }, [hideAdornment, propDisabled, modal, api.engaged, api.dirty, api.canSelectCurrent, api.togglePoint, api.selectCurrent, api.commit, api.cancel, !!api.error]);

  return (
    <FormControl
      sx={{
        // No room is reserved above the field for the FLOATING label (which sits half a line above
        // the box): baking it in made every composed FormulaField sit low against its row siblings.
        // A host whose layout would clip the label adds its own clearance.
        minWidth: 135, // TODO - make this dynamic
        width: '100%',
        ...propSx
      }}
      size="small"
      // Own ref + the forwarded one: the FormControl (position: relative) is the overlay's containing
      // block, so the measured input box is placed relative to it.
      ref={(el: HTMLDivElement | null) => {
        parts.containerRef.current = el;
        if (typeof refForwarded === 'function') refForwarded(el);
        else if (refForwarded) (refForwarded as React.RefObject<HTMLDivElement | null>).current = el;
      }}
      className={clsx('sxl-formula-field', propClassName)}
      data-grammar={grammar}
      {...rest}
    >
      {isLabelAbove ? (
        <Box
          component="label"
          htmlFor={inputId}
          sx={{
            // The same box the helper line below the field occupies (see the TextField's sx) — the
            // symmetry is what centers the INPUT in this block, so a host aligning to the block
            // aligns to the field's text. Clipped rather than wrapped: two lines here would break it.
            lineHeight: LABEL_LINE_HEIGHT,
            marginBottom: LABEL_LINE_GAP,
            // Lined up with the INPUT's text, not the field's box — see the constant.
            paddingLeft: LABEL_LINE_INDENT,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            fontSize: '0.8rem',
            color: propDisabled ? 'text.disabled' : 'text.primary'
          }}
        >
          {label}
        </Box>
      ) : null}
      <TextField
        id={inputId}
        // An `'above'` label is ours; MUI must not also draw one (an empty notch in the outline).
        label={isLabelAbove ? undefined : label}
        placeholder={placeholder}
        disabled={propDisabled}
        error={hasError}
        // The hook stores a message KEY (text produced as data, far from render — the same rule as
        // disabledReasons); `t(nonKey)` returns the string unchanged, so plain text still shows.
        // The error owns the line when there is one, the host's guidance otherwise; a space keeps the
        // line RESERVED either way, so showing an error never shifts the layout. `showError: false`
        // gives that line back to the host: the outline still says "wrong", `onError` says what.
        // An explicit `helperText: null` opts OUT of the reservation entirely — MUI renders no
        // element for a nullish one, so the block ends at the input. `??` cannot make that
        // distinction (it treats null and undefined alike), which is why the default is applied by an
        // identity check against `undefined`.
        helperText={helperText}
        sx={{
          '& .MuiFormHelperText-root': {
            marginTop: LABEL_LINE_GAP,
            // Stated only in `'above'` mode, where the label over the field is given the SAME box and
            // neither height may be a magic number relative to the other. Elsewhere MUI's own ratio
            // stands — every existing field keeps the helper line it was laid out with.
            ...(isLabelAbove ? { lineHeight: LABEL_LINE_HEIGHT } : null)
          }
        }}
        slotProps={{
          input: {
            endAdornment
          },
          inputLabel: {
            shrink: true,
          },
          htmlInput: {
            className: classNameInput,
            spellCheck: false,
            autoComplete: "off",
            readOnly: propDisabled || api.inputProps.readOnly,
            name: formName,
            // The overlay (shared parts) paints the glyphs while active — the input's own go
            // transparent, the caret keeps the text color (the formula editor's trick).
            sx: {
              // 10/6 rather than MUI's symmetric 8.5/8.5 (`sizeSmall`): the house fields keep their
              // label ALWAYS shrunk, sitting on the top border, and the extra 2px is what stops the
              // text from reading as crowded up against it. `InputField` does the same.
              // With an `'above'` label — or none at all — there is no label on the border to clear,
              // and the same 2px then just parks the text low in its box — visible against anything
              // aligned to the box (the argument form's value column, a condition row's selects) as
              // a field whose text sits off-center.
              paddingTop: (theme: Theme) => theme.spacing(isLabelAbove || label == null ? 1 : 1.25),
              paddingBottom: (theme: Theme) => theme.spacing(isLabelAbove || label == null ? 1 : 0.75),
              ...(parts.overlayActive ? {
                color: 'transparent',
                caretColor: (theme: Theme) => theme.palette.text.primary
              } : null)
            },
            // Caret/selection moves re-project which reference/segment the next pick targets, and
            // feed the shared parts' caret tracking (paren-pair emphasis).
            onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => {
              api.inputProps.onSelect(e);
              parts.inputHandlers.onSelect(e);
            },
            onScroll: parts.inputHandlers.onScroll,
            onMouseMove: parts.inputHandlers.onMouseMove,
            onMouseLeave: parts.inputHandlers.onMouseLeave,
            onDragStart: parts.inputHandlers.onDragStart
          }
        }}
        value={api.inputProps.value}
        inputRef={(el: HTMLInputElement | null) => {
          parts.inputElRef.current = el;
          api.inputProps.ref(el);
          if (formHandler?.ref) formHandler.ref(el);
        }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          api.inputProps.onChange(e);
          // The caret moved with the keystroke, and `onSelect` does not fire until a later event —
          // so the render that follows THIS one would read the caret from before the character.
          // That is a flash of "invalid": with the caret one behind, `isInputExpectedAt` says no
          // operand is expected (a just-typed `=` looks like a complete, broken formula), the error
          // is presented, and the next `onSelect` takes it away again.
          parts.inputHandlers.onSelect(e);
          formHandler?.onChange(e);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (parts.handleKeyDown(e)) return; // autocomplete list nav / hint dismiss / F9
          api.inputProps.onKeyDown(e);
          if (!e.defaultPrevented) propOnKeyDown?.(e as React.KeyboardEvent<HTMLDivElement>);
        }}
        onPointerDown={parts.inputHandlers.onPointerDown}
        onMouseDown={api.inputProps.onMouseDown}
        onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
          api.inputProps.onFocus(e);
          propOnFocus?.(e as unknown as React.FocusEvent<HTMLDivElement>);
        }}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
          api.inputProps.onBlur(e);
          formHandler?.onBlur(e);
        }}
        onContextMenu={(e) => { e.stopPropagation(); }}
      />
      {parts.overlayElement}
      {parts.tipElement}
      {parts.hintElement}
    </FormControl>
  );
}));

FormulaField.displayName = "FormulaField";
