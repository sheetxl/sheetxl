import type React from 'react';
import {
  memo, forwardRef, useEffect, useImperativeHandle, useMemo, useRef
} from 'react';

import clsx from 'clsx';

import { useFormContext, type RegisterOptions } from 'react-hook-form';

import { type Theme } from '@mui/material';
import { FormControl, type FormControlProps } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { TextField } from '@mui/material';

import { DynamicIcon, useTranslator, useTextSelectionDrag } from '@sheetxl/utils-react';
import { ExhibitIconButton } from '@sheetxl/utils-mui';

import { useInputField, type InputFieldApi, type EditDoneArgs } from '@sheetxl/react';

/** Keep a left-click on an adornment button from blurring the field (the formula bar's trick). */
const noFocusSteal = (e: React.MouseEvent<HTMLElement>): void => { if (e.button === 0) e.preventDefault(); };

export interface InputFieldProps extends FormControlProps {
  /**
   * The committed value. The display text re-derives whenever it changes.
   */
  value?: string;
  /**
   * Live notification of the value change — fires on every VALID text state.
   *
   * A PREVIEW channel: hosts that mutate the model per change (renaming a table) should act on
   * {@link onDone} instead and treat this as optional live feedback.
   */
  onChangeInput?: (value: string) => void;
  /**
   * The raw TEXT channel: every display-text change the user causes — INVALID states included, and
   * regardless of {@link changeOn}. For hosts that persist authored text and validate it later;
   * {@link onChangeInput} would leave them holding the last VALID text while the field shows
   * something else. An outside {@link value} change does not fire it.
   */
  onChangeText?: (text: string) => void;
  /**
   * The COMMIT channel: fires once with the final text when the edit finishes — a done key
   * (Enter/Tab/Escape), the adornment ✓/✗, `apiRef.current.commit()`, or blur to another field.
   * `args.reason` distinguishes accept from cancel (a cancel delivers the reverted session baseline).
   * Not fired on an accept while the text is invalid — the error stays shown instead.
   */
  onDone?: (value: string, args: EditDoneArgs) => void;
  /**
   * `'done'` suppresses the live {@link onChangeInput} notifications entirely (validation still runs —
   * error state stays live — but the host hears only {@link onDone}), makes Enter the field's own
   * commit point rather than a key the host form gets to see, and shows the ✓/✗ while the text differs
   * from the committed value.
   * Default `'live'`.
   */
  changeOn?: 'live' | 'done';
  /**
   * Validate the text — THROW to reject it. The message (an SDK validation error carries a message
   * key) is shown as the field's error and blocks every accept path until it clears.
   */
  onValidate?: (text: string) => void;
  /**
   * The headless field API, for host-driven commit points the blur heuristic can't see — a dialog's
   * OK handler calls `apiRef.current?.commit()` (Cancel: `.cancel()`).
   */
  apiRef?: React.Ref<InputFieldApi>;
  /**
   * A default value — shown as the placeholder.
   */
  defaultInput?: string;
  /**
   * If provided will register with react-hook-form.
   *
   * @remarks
   * We don't support changing the formName once rendered.
   * @see {@link https://react-hook-form.com}
   */
  formName?: string;
  /**
   * React-hook-form options.
   * @remarks
   * This is only used if formName is provided.
   */
  formOptions?: RegisterOptions;
  /** Field label. Default `"Name"`. */
  label?: string;
  /**
   * Guidance shown under the field while it is VALID. The error takes that line when there is one —
   * the field reserves it either way, so the layout never shifts.
   *
   * @remarks
   * `null` (explicitly — not `undefined`, which takes the reserved default) COLLAPSES the line: the
   * field's block ends at the input, so it centers against the buttons beside it in a toolbar-like
   * row. An error then claims a line as it appears — for a field with no {@link onValidate}, or one
   * whose host accepts the shift. The same contract as `FormulaField`'s `helperText`.
   */
  helperText?: React.ReactNode | null;
  /**
   * Show the validation error on the field's helper line. Default `true`.
   *
   * @remarks
   * `false` keeps the error outline but leaves the message to the host — for a host that collects it
   * through {@link onChangeError} and shows it somewhere of its own. The same contract as
   * `FormulaField`'s `showError`.
   */
  showError?: boolean;
  /**
   * The validation error CHANGED — the message key, or `null` when the text became valid again.
   * Translate at display (`t(key)` passes a non-key through unchanged).
   */
  onChangeError?: (error: string | null) => void;
  /** Hide the adornment cluster (the ✓/✗ pair shown while editing in `'done'` mode). */
  hideAdornment?: boolean;
  /**
   * Attributes for the INNER `<input>` — `type`, `min`/`max`/`step`, `inputMode`, a class of the
   * host's own. Merged over the field's defaults (spell-check and autocomplete off).
   */
  propsInput?: React.InputHTMLAttributes<HTMLInputElement>;
  /**
   * Underlying reference to the input element.
   */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * The **text field**, MUI tier — a form-shaped (TextField) validated text input, and `FormulaField`'s
 * plain-value sibling: the same edit contract (see {@link InputFieldProps.changeOn}), the same
 * two-level Escape, the same modal ✓/✗ adornments, the same `apiRef` commit points — differing only in
 * that its value is TEXT (validated by {@link InputFieldProps.onValidate}) rather than a parsed
 * formula, and that it never touches the reference-mode bus.
 *
 * @remarks
 * A THIN chrome wrapper: the behavior lives in the headless `useInputField` (`@sheetxl/react`), which
 * shares its whole commit state machine (`useEditCommit`) with the formula field — the two cannot
 * drift. This file is only the MUI field + adornments + react-hook-form wiring.
 */
export const InputField = memo(forwardRef<HTMLDivElement, InputFieldProps>(
  (props: InputFieldProps, refForwarded) => {
  const {
    disabled: propDisabled,
    className: propClassName,
    sx: propSx,
    defaultInput,
    value,
    formName,
    formOptions,
    onChangeInput,
    onChangeText,
    onDone,
    changeOn,
    onValidate,
    apiRef,
    label: propLabel,
    helperText: propHelperText,
    showError = true,
    onChangeError,
    hideAdornment,
    propsInput,
    onKeyDown: propOnKeyDown,
    onFocus: propOnFocus,
    ...rest
  } = props;
  const t = useTranslator();
  // The chrome around the field is `user-select: none`, which a browser reads as a veto on a drag-select
  // the moment the pointer leaves the field. Suspended for the length of the press.
  const textDrag = useTextSelectionDrag();
  const label = propLabel ?? t('namedInput.label');
  const formContext = useFormContext<any>(); // TODO - make this a generic type
  const formHandler = (formName && formContext) ? formContext.register(formName, formOptions) : null;

  const api = useInputField({
    value: value ?? '',
    onChange: onChangeInput,
    onChangeText,
    onDone,
    changeOn,
    onValidate,
    disabled: propDisabled
  });
  useImperativeHandle(apiRef, () => api, [api]);

  // Mirror the validation state into react-hook-form (when registered) — on TRANSITIONS only, with the
  // context read through a ref. Both are load-bearing: RHF's `FormProvider` mints a NEW context object
  // every provider render, and `clearErrors`/`setError` always emit a form-state change — so a context
  // dep plus an unconditional call is a render↔effect loop with any dialog that reads `formState`
  // (OptionsDialog does). An initial no-error mount writes nothing at all.
  const formContextRef = useRef(formContext);
  formContextRef.current = formContext;
  const onErrorRef = useRef(onChangeError);
  onErrorRef.current = onChangeError;
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (api.error === prevErrorRef.current) return;
    prevErrorRef.current = api.error;
    onErrorRef.current?.(api.error);
    if (!formName) return;
    const ctx = formContextRef.current;
    if (!ctx) return;
    if (api.error) ctx.setError(formName, { message: t(api.error) });
    else ctx.clearErrors(formName);
  }, [api.error, formName]);

  // The ✓/✗ pair is a `'done'`-mode affordance, shown while the text differs from the committed value:
  // ✓ commits (disabled while the text is invalid), ✗ cancels back to the session baseline. In `'live'`
  // every valid change has already gone out, so the pair never shows. While hidden it stays MOUNTED —
  // the slot keeps its width, so the first keystroke doesn't shove the text sideways. ✓ sits
  // FIRST, closest to the input (Excel's order for a trailing pair) — the same order `FormulaField`
  // uses. `onMouseDown` preventDefault (the formula bar's trick) keeps a click from blurring the field.
  const modal = changeOn === 'done';
  const isShown = api.engaged && api.dirty;
  const endAdornment = useMemo(() => {
    if (hideAdornment || !modal) return undefined;
    return (
      <InputAdornment
        tabIndex={-1}
        // A DISABLED button swallows its own mouse events (no `onMouseDown` fires) — the guard on
        // the container keeps a click on it from blurring the field anyway.
        onMouseDown={noFocusSteal}
        aria-hidden={!isShown}
        sx={{
          display: 'flex',
          position: 'relative',
          flex: '0',
          ...(isShown ? null : { visibility: 'hidden', pointerEvents: 'none' })
        }}
        position="end"
      >
        <ExhibitIconButton
          dense={true}
          outlined={false}
          color="primary"
          aria-label="commit-input"
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
          aria-label="cancel-input"
          icon={<DynamicIcon iconKey="CloseError" />}
          propsTooltip={{ label: t('referenceInput.cancel'), simple: true }}
          tabIndex={-1}
          onMouseDown={noFocusSteal}
          onClick={() => { api.cancel(); }}
        />
      </InputAdornment>
    );
  }, [hideAdornment, modal, isShown, api.commit, api.cancel, !!api.error]);

  return (
    <FormControl
      sx={{
        // No room is reserved above the field for the FLOATING label — the same metrics as
        // `FormulaField`, which is the point: the two are placed as siblings (name + range) and have
        // to sit on one line. Baking it in here put every InputField a step below the formula field
        // beside it. A host whose layout would clip the label adds its own clearance.
        minWidth: 135, // TODO - make this dynamic
        width: '100%',
        ...propSx
      }}
      size="small"
      ref={refForwarded}
      className={clsx('sxl-input-field', propClassName)}
      {...rest}
    >
      <TextField
        label={label}
        placeholder={defaultInput}
        disabled={propDisabled}
        error={!!api.error}
        // The hook stores a message KEY (text produced as data, far from render — the same rule as
        // disabledReasons); `t(nonKey)` returns the string unchanged, so plain text still shows.
        // A space keeps the line RESERVED (fixed height) when the host gave no text; an explicit
        // `null` opts out of the reservation — MUI renders no element for it. `??` cannot make that
        // distinction, hence the identity check against `undefined`.
        helperText={api.error && showError ? t(api.error) : (propHelperText === undefined ? " " : propHelperText)}
        sx={{
          '& .MuiFormHelperText-root': {
            marginTop: (theme: Theme) => theme.spacing(0.5),
          }
        }}
        slotProps={{
          input: {
            endAdornment
          },
          inputLabel: {
            shrink: true
          },
          htmlInput: {
            spellCheck: false,
            autoComplete: "off",
            onPointerDown: textDrag.onPointerDown,
            onDragStart: textDrag.onDragStart,
            ...propsInput,
            className: clsx('autoFocus', propsInput?.className),
            name: formName,
            readOnly: propDisabled,
            sx: {
              paddingTop: (theme: Theme) => theme.spacing(1.25),
              paddingBottom: (theme: Theme) => theme.spacing(0.75)
            }
          }
        }}
        value={api.inputProps.value}
        inputRef={(el: HTMLInputElement | null) => {
          api.inputProps.ref(el);
          if (formHandler?.ref) formHandler.ref(el);
        }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          api.inputProps.onChange(e);
          formHandler?.onChange(e);
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          api.inputProps.onKeyDown(e);
          if (!e.defaultPrevented) propOnKeyDown?.(e as React.KeyboardEvent<HTMLDivElement>);
        }}
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
    </FormControl>
  );
}));

InputField.displayName = "InputField";
