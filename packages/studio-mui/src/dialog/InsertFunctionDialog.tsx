import { useState, useMemo, useRef, memo } from 'react';

import { type IFunction } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { OptionsDialog, optionIdentity, type InputDialogProps } from '@sheetxl/utils-mui';

import { useReferenceMode, useWorkbook, type CommandContext } from '@sheetxl/react';

import {
  InsertFunctionWizard, InsertFunctionOption, optionsForPage, type InsertFunctionPage
} from '../function';

/**
 * What the dialog delivers: the chosen FUNCTION when it was inserted from page 1 (the host seeds
 * `=NAME(` and the user fills it in the cell), or the assembled call TEXT when its arguments were
 * filled in here.
 */
export type InsertFunctionResult = IFunction | string;

export interface InsertFunctionDialogProps
  extends InputDialogProps<InsertFunctionResult, CommandContext.FormulaFunction> {};

/**
 * Excel's **Insert Function** dialog (`shift+F3`): pick a function, then fill its arguments.
 *
 * @remarks
 * A SHELL — the window, the title and the action row. Both pages are widgets
 * ({@link InsertFunctionWizard}), so the same pair can be hosted elsewhere; everything this file adds
 * is what a dialog is for.
 *
 * Page 1's default action is **Next**, with **Insert** alongside for anyone who already knows the
 * function and would rather fill it in the cell. Page 2 inserts the assembled call.
 */
export const InsertFunctionDialog = memo<InsertFunctionDialogProps>((props: InsertFunctionDialogProps) => {
  const {
    initialValue = null,
    context,
    onOption,
    onDone,
    onInput,
    options: propOptions,
    defaultOption: propDefaultOption,
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();
  const workbook = useWorkbook();

  const [page, setPage] = useState<InsertFunctionPage>('search');
  const [selected, setSelected] = useState<IFunction | null>(
    typeof initialValue === 'string' ? null : initialValue
  );
  /** Page 2's assembled call. Held here because Insert is the DIALOG's button, not the panel's. */
  const [call, setCall] = useState<string | null>(null);

  const options = useMemo<OptionInput[]>(() => {
    return propOptions ?? optionsForPage(page, t);
  }, [propOptions, page, t]);
  const defaultOption = propDefaultOption ?? options[0];
  /**
   * The default's IDENTITY (`'Next'`), not the rich option (`{ id: 'Next', label }`) — what
   * `OptionsDialog` hands `onOption`, and therefore the only form {@link handleOnOption} compares
   * against. Forwarding the rich option made every `option === Next` below answer `false`, so the
   * list's double-click fell past the page turn and INSERTED instead.
   */
  const defaultOptionId = optionIdentity(defaultOption);

  // The anchor for page 2's argument fields and its result: the cell the call is being inserted into.
  // A bare `A1` typed into an argument means "relative to here", exactly as it would in the cell.
  // Captured ONCE, at open: picking suspends the dialog's modality, so the sheet selection moves
  // while the dialog is up — and re-anchoring mid-pick would re-address the text the user is aiming.
  const [home] = useState(() => {
    const cell = workbook?.getSelectedWorksheet()?.getSelectedCell();
    return cell ? { ...cell.getCoords(), scope: cell.getWorksheet().getName() } : undefined;
  });

  // Excel's "RefEdit" behavior: while a field is ENGAGED, the dialog suspends its modality so
  // grid/header clicks reach the sheet; letting go of the field (Enter/Escape/blur) restores it.
  //
  // Engagement — is a field driving the bus at all — NOT `mode === 'point'`. A formula field re-arms
  // per keystroke off the caret's context (`A` is a name, `A1` is a reference, `A1:` is neither), so
  // point-mode flickers on and off while a reference is being typed, and modality with it: the
  // backdrop blinking over the sheet on every character. What the dialog needs to know is that the
  // user is editing a reference-capable field, which is exactly what an `activeInput` says.
  const referenceMode = useReferenceMode();
  const picking = !!referenceMode.getMode()?.activeInput;

  /**
   * Whether the outcome that closed this dialog put the keyboard somewhere ITSELF — page 1's Insert
   * seeds `=NAME(` and leaves the user in the cell's editor, finishing the call.
   *
   * @remarks
   * A ref, not state: the window asks as it exits, which is after the last render it is guaranteed to
   * have done. Only page 1 sets it. Cancel restores (back to the grid, where the user was), and so
   * does page 2 — its call is WRITTEN, not opened for editing, so there is no new focus owner and the
   * grid is again exactly where the user should land.
   */
  const refFocusMoved = useRef<boolean>(false);

  const handleOnOption = useCallbackRef((option: OptionInput, isCancel: boolean, isDefault: boolean) => {
    // Page moves are NOT outcomes: they must not reach the host's `onOption`/`onDone`, which is what
    // closes the dialog and resolves its promise.
    if (!isCancel && option === InsertFunctionOption.Next) { setPage('arguments'); return; }
    if (!isCancel && option === InsertFunctionOption.Back) { setPage('search'); return; }
    if (!isCancel && selected) {
      // From page 2 the whole call is what gets inserted; from page 1 it is the function, which the
      // host seeds as `=NAME(` with the caret between the parens — an unfinished call, so the host
      // hands the keyboard to the editor and this window must not take it back.
      const isCall = page === 'arguments' && !!call;
      refFocusMoved.current = !isCall;
      onInput?.(isCall ? call! : selected);
    }
    onOption?.(option, isCancel, isDefault);
    onDone?.();
  }, [page, call, selected, onInput, onOption, onDone]);

  // Next and Insert are only meaningful with a function — an empty search must not leave a live
  // default button pointing at nothing. Back always goes back (a page a validator can refuse to
  // leave is a trap), and Cancel is never validated by the dialog at all.
  const onValidateInputOption = useCallbackRef(async (option?: OptionInput): Promise<boolean> => {
    if (option === InsertFunctionOption.Back) return true;
    return !!selected;
  }, [selected]);

  /**
   * Take the default action from somewhere that is NOT a dialog button (the list's double-click).
   *
   * @remarks
   * Through the validator, not around it: `OptionsDialog` runs `onValidateOption` for its own
   * buttons, so a shortcut that called `onOption` directly would be the one path that skips it.
   */
  const activateDefault = useCallbackRef(async (): Promise<void> => {
    if (await onValidateInputOption(defaultOptionId) !== true) return;
    handleOnOption(defaultOptionId, false, true);
  }, [onValidateInputOption, defaultOptionId, handleOnOption]);

  return (
    <OptionsDialog
      // ONE title for both pages. The window is the same window — retitling it mid-flow reads as a
      // second dialog having opened, which is not what Next did. (A sub-heading INSIDE the page is
      // the way to name the step, if it ever needs naming.)
      title={t('insertFunction.dialogTitle')}
      options={options}
      onOption={handleOnOption}
      onValidateOption={onValidateInputOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      suspendModal={picking}
      // Read as the window exits — see `refFocusMoved`.
      restoreFocus={() => !refFocusMoved.current}
      sx={{
        // ONE width for both pages, so Next/Back never resizes the window under the pointer. The
        // HEIGHT is the wizard's: it sizes to the taller of its two pages, and both fill it.
        width: '460px',
        // …up to what the screen actually has. The window is `position: absolute` in a container of
        // no height, so a percentage cap resolves against nothing — the viewport unit is what can be
        // stated here. Without it a short window (a laptop with the browser chrome up, a taskpane) got
        // a dialog whose action row was below the bottom of the screen, which is where Insert is.
        maxHeight: 'calc(100dvh - 16px)',
        // The cap only means something if it can be PASSED DOWN: each of these is a flex parent that
        // may shrink and lets its child do the same, from the paper to the wizard, which hands the
        // difference to the showing page's one scrolling region. Anything in the chain left at its
        // default (`min-height: auto`, a block box) refuses to shrink and the content simply overflows
        // the capped window instead. The title and the action row keep their size — they are the two
        // things that must not be what gives.
        display: 'flex',
        flexDirection: 'column',
        '& > .MuiDialogTitle-root': { flexShrink: 0 },
        '& > form': { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 },
        '& .MuiDialogContent-root': {
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0
        },
        // `OptionsDialog`'s own content column, the single child of the content area.
        '& .MuiDialogContent-root > *': { flex: '1 1 auto', minHeight: 0 },
        '& .MuiDialogActions-root': { flexShrink: 0 },
        ...propSx
      }}
      {...rest}
    >
      <InsertFunctionWizard
        className="insert-function-wizard"
        context={context}
        page={page}
        selected={selected}
        onChangeSelected={setSelected}
        onActivate={() => { void activateDefault(); }}
        onChangeCall={setCall}
        workbook={workbook}
        home={home}
      />
    </OptionsDialog>
  );
});

InsertFunctionDialog.displayName = 'InsertFunctionDialog';

export default InsertFunctionDialog;
