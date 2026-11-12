import type React from 'react';
import { memo, forwardRef, useEffect, useRef, useState } from 'react';

import { clsx } from 'clsx';
import { type Theme } from '@mui/material';
import { Paper, Box } from '@mui/material';

import { RangeAxis } from '@sheetxl/utils';
import { IFont } from '@sheetxl/sdk';

import {
  useCommands, CommandScopeProvider, useImperativeElement, DynamicIcon, useTranslator, useCallbackRef, KeyCodes,
  ReactUtils, useVirtualKeyboard, isVirtualKeyboardUp, exitEditMode, KeyboardAccessory, useCommandScope,
  useCommandElement
} from '@sheetxl/utils-react';

import { ExhibitIconButton, type ExhibitIconButtonProps } from '@sheetxl/utils-mui';

import { editStringFromCell, placeholderFromCell } from '@sheetxl/react';

import {
  type FormulaBarProps, type IFormulaBarElement, type FormulaBarAttributes
} from './IFormulaBar';
import { useFormulaBarSession, FORMULA_BAR_EDITOR_ID } from './useFormulaBarSession';
import { MobileInputToolbar, type MobileInputMode } from './MobileInputToolbar';

/** Lines the editor shows when expanded. */
const LINES_EXPANDED = 5;

/** The height of one editor line, in px. The expanded editor is a count of these. */
const LINE_HEIGHT = 20;

/** The cross-fade between the bar in place and the bar on the keyboard, in ms. */
const FADE_MS = 150;

/**
 * An input-mode swap blurs and refocuses the field so the platform re-reads the mode. A keyboard that
 * dips within this long after one is the swap's, not the user closing it.
 */
const MODE_SWAP_MS = 800;

/**
 * The field border, the token every field-shaped control reads. See the note on the desktop bar's
 * `FIELD_BORDER_COLOR`.
 */
const FIELD_BORDER_COLOR = 'var(--sxl-color-input-border, light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2)))';

/**
 * A dense button's height: the theme's icon box (`--icon-size`, 1.75rem under `pointer: coarse`) in
 * its 2px padding and 1px border. The field is this tall, so the row is the toolbar's.
 */
const BUTTON_HEIGHT = 'calc(var(--icon-size, 1.25rem) + 6px)';

/**
 * The toolbar's button (the default, dense `ExhibitIconButton`, sized by the theme's `--icon-size`)
 * without its border. `onMouseDown` is swallowed so a tap does not move focus out of the textarea:
 * the keyboard stays where it is, and the studio's focus-restore listener still sees a session end
 * with focus inside the bar.
 */
const BarButton: React.FC<ExhibitIconButtonProps> = (props) => {
  const { sx, ...rest } = props;
  return (
    <ExhibitIconButton
      outlined={false}
      sx={{
        border: 'none !important',
        '&.Mui-focusVisible': { border: 'none' },
        '&:hover:not([disabled])': { border: 'none' },
        ...sx
      }}
      onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
      {...rest}
    />
  );
};

/**
 * Bounds the bar's command scope to the part of it riding the keyboard: a portal is outside the bar's
 * element, but a key born there is still the bar's.
 */
const AccessoryBounds: React.FC<{ elementRef: React.RefObject<HTMLDivElement | null> }> = ({ elementRef }) => {
  useCommandElement(useCommandScope(), elementRef);
  return null;
};

export interface MobileFormulaBarProps extends FormulaBarProps {
  /**
   * If cancel and commit buttons are shown on the input toolbar. The studio's status bar shows both
   * during an edit, so a host without that status bar can turn these on.
   */
  showCancelCommit?: boolean;
}

/**
 * The formula bar for a touch-only device: the same input the in-grid editor renders, in a box
 * built for the bottom of a phone screen, with a row of entry buttons under it.
 *
 * @remarks
 * The bar is `fx` and the editor, with the expand chevron inside the field at its right edge.
 * Under it, the {@link MobileInputToolbar}: the letters, numbers and date inputs, Tab, Enter, and
 * (with {@link MobileFormulaBarProps.showCancelCommit}) cancel / commit. There is no name box and no
 * Calculate Now button; the commands behind them stay reachable elsewhere.
 *
 * **On the keyboard.** With `floatOnKeyboard` (the default) the bar edits on top of the virtual
 * keyboard, as a phone app's does. The bar in place shows the active cell, read only; the editor is a
 * second copy of the bar in a {@link KeyboardAccessory} that rides the keyboard while the field has
 * focus or the sheet is in keyboard mode. A tap on the bar in place focuses that field (the keyboard
 * rises only for a focus inside a tap); its buttons act on it. As the copy on the keyboard shows, the
 * bar in place fades out and keeps its room, so the bar looks to have moved and the sheet's tabs stay
 * put. The keyboard going away (the back gesture, the hide key) returns focus to the bar in place.
 * Neither copy ever resizes the studio or scrolls the page. Without `floatOnKeyboard` the field is in
 * place, and expanding grows it upward into the grid.
 *
 * It drives the same shared {@link SheetEditable} as the grid through {@link useFormulaBarSession}:
 * a tap on the field starts the edit on the active cell, and a tap on a cell while editing inserts a
 * reference, exactly as the desktop bar does. Enter and Tab (the toolbar's, the keyboard's) commit
 * and move the active cell, leaving the bar idle.
 *
 * The virtual keyboard is the sheet's (see `useVirtualKeyboard`): the bar asks for its keyboard
 * type, its letters and numbers buttons set it, and the bar registers itself as the editor a key typed
 * into the grid opens in while the keyboard is up. In keyboard mode, focus that returns to the grid
 * after an entry lands on the grid's typing input, so the keyboard stays for the next cell. Cancel and
 * commit are the edit's ways out (`exitEditMode`), which end keyboard mode, so the keyboard goes down.
 */
export const MobileFormulaBar = memo(
  forwardRef<IFormulaBarElement, MobileFormulaBarProps>((props, refForwarded) => {
  const {
    className: propClassName,
    style: propStyle,
    workbook: propWorkbook,
    editable: propEditable,
    disabled: propDisabled,
    showCancelCommit,
    floatOnKeyboard = true,
    // Not rendered by this host; accepted so the studio can hand both hosts the same props.
    showNamedCollectionEditor: _showNamedCollectionEditor,
    propsNamedCollectionEditor: _propsNamedCollectionEditor,
    renderNamedCollectionEditor: _renderNamedCollectionEditor,
    showCalculateNow: _showCalculateNow,
    placement: _placement,
    ...rest
  } = props;

  // `workbook` is always injected by the studio renderer — the bar is non-functional without it — so
  // although the public prop is optional, treat it as required (runtime-guaranteed by the caller).
  const workbook = propWorkbook!;

  const keyboard = useVirtualKeyboard();
  const inputMode = keyboard.getInputMode();
  useEffect(() => keyboard.registerEditor(FORMULA_BAR_EDITOR_ID), [keyboard]);

  const {
    sheet, activeCoords, disabled, isEditing, cancel, commit, editorSpec, cellEditor
  } = useFormulaBarSession({
    workbook, editable: propEditable, disabled: propDisabled, lineHeight: LINE_HEIGHT,
    inputMode, enterKeyHint: 'enter', hintPlacement: 'above'
  });

  const [insertFunctionCommand] = useCommands(['insertFunctionDialog']);

  const t = useTranslator();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const linesVisible = expanded ? LINES_EXPANDED : 1;

  // The copy on the keyboard: it floats while its field has focus or the sheet is in keyboard mode
  // (typing into the grid opens the edit here). `accessoryShown` is it having settled on the keyboard.
  const refAccessory = useRef<HTMLDivElement>(null);
  const [focusInAccessory, setFocusInAccessory] = useState<boolean>(false);
  const [accessoryShown, setAccessoryShown] = useState<boolean>(false);
  const floating = floatOnKeyboard && (keyboard.isActive() || focusInAccessory);

  const refEditable = useRef(propEditable);
  refEditable.current = propEditable;
  const refLocal = useImperativeElement<IFormulaBarElement, FormulaBarAttributes>(refForwarded, () => ({
    isFormulaBarElement: () => true,
    getNamedCollectionEditorElement: () => null,
    getEditable: () => refEditable.current ?? null,
    isFocusWithin: (): boolean => {
      const active = document.activeElement;
      if (!active) return false;
      return !!refLocal.current?.contains(active) || !!refAccessory.current?.contains(active);
    }
  }), []);

  // The bar in place, for the copy on the keyboard to take its theme from.
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setAnchor(refLocal.current); }, [refLocal]);

  const textarea = (): HTMLTextAreaElement | null =>
    (floatOnKeyboard ? refAccessory.current : refLocal.current)?.querySelector('textarea') ?? null;

  const refModeSwapAt = useRef<number>(-Infinity);

  // Each input button opens its input. The keyboard rises only for a focus inside the user's
  // gesture, so this runs in the handler: the mode is written to the element ahead of the render
  // (Android swaps the keyboard on the attribute; iOS reads it on focus), then the field is focused,
  // through a blur when it already had focus so the platform re-reads the mode, or raises a keyboard
  // that was lowered without a blur.
  const onInputMode = useCallbackRef((mode: MobileInputMode): void => {
    keyboard.setInputMode(mode);
    const ta = textarea();
    if (!ta) return;
    const changed = ta.inputMode !== mode;
    ta.inputMode = mode;
    if (document.activeElement === ta) {
      if (changed || !isVirtualKeyboardUp()) {
        refModeSwapAt.current = performance.now();
        ta.blur();
        ta.focus({ preventScroll: true });
      }
      return;
    }
    ta.focus({ preventScroll: true });
  }, [keyboard]);

  // A tap on the bar in place opens the field on the keyboard, inside the tap.
  const onOpenEditor = useCallbackRef((): void => {
    if (disabled) return;
    textarea()?.focus({ preventScroll: true });
  }, [disabled]);

  // The keyboard went away with the field still focused: the bar in place takes focus back, so the
  // copy on the keyboard goes too. Focus elsewhere (the grid's typing input) is the sheet's own.
  const onKeyboardClose = useCallbackRef((): void => {
    if (performance.now() - refModeSwapAt.current < MODE_SWAP_MS) return;
    const active = document.activeElement;
    if (!active || !refAccessory.current?.contains(active)) return;
    refLocal.current?.focus({ preventScroll: true });
  }, []);

  // The date input: a native date picker whose pick is typed into the field as the workbook's
  // locale writes a date, so the entry parser reads it back as one. Hidden; `showPicker()` needs
  // the gesture, as the keyboard does.
  const refDate = useRef<HTMLInputElement>(null);
  const onDate = useCallbackRef((): void => {
    const input = refDate.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  }, []);
  const onDatePicked = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value; // yyyy-mm-dd, or '' when cleared
    e.target.value = '';
    const editable = propEditable;
    const ta = textarea();
    if (!value || !editable || !ta) return;
    const [y, m, d] = value.split('-').map(Number);
    const text = new Date(y, m - 1, d).toLocaleDateString(workbook.getLocale() ?? undefined);
    if (!editable.getSession()) {
      // A fresh entry: the date is the cell's whole content, seeded on the session (the field has not
      // re-rendered for the session yet, so typing into it would be lost).
      if (!editable.startEdit(editable.getAnchor().getCoords(), { mode: 'enter', autoFocus: false, dirty: text })) return;
      editable.getSession()?.setActiveEditorId(FORMULA_BAR_EDITOR_ID);
      ta.focus({ preventScroll: true });
      return;
    }
    // Mid-edit: typed at the caret, so the browser's undo stack has it.
    ta.focus({ preventScroll: true });
    ReactUtils.replaceRangeText(ta, ta.selectionStart, ta.selectionEnd, text);
  }, [propEditable, workbook]);

  // Commit and move the active cell; the bar goes idle. A refused commit keeps the session and the
  // cell where they are. Idle, it is just the move.
  const leave = useCallbackRef((axis: RangeAxis): void => {
    const editable = propEditable;
    if (!editable) return;
    const committed = editable.getSession() ? editable.commit() : true;
    const move = (ok: boolean): void => {
      if (ok) sheet?.getSelection().traverse(axis);
    };
    if (committed === true || committed === false) {
      move(committed);
      return;
    }
    committed.then(move);
  }, [propEditable, sheet]);

  // Cancel and commit are the edit's ways out, as the status bar's ✕ / ✓ are: the user is done
  // typing (keyboard mode ends), where Enter and Tab move on.
  const onCancel = useCallbackRef((): void => exitEditMode({ key: 'edit', cancel, done: commit }, 'cancel'), [cancel, commit]);
  const onCommit = useCallbackRef((): void => exitEditMode({ key: 'edit', cancel, done: commit }, 'done'), [cancel, commit]);
  const onTab = useCallbackRef((): void => leave(RangeAxis.Row), [leave]);
  const onEnter = useCallbackRef((): void => leave(RangeAxis.Column), [leave]);

  // The keyboard's Enter and Tab behave as the toolbar's, not as the desktop keymap's (which ends
  // the entry). Captured above the input so it never sees them.
  const onKeyDownCapture = useCallbackRef((e: React.KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.which !== KeyCodes.Enter && e.which !== KeyCodes.Tab) return;
    if (e.target !== textarea()) return;
    e.preventDefault();
    e.stopPropagation();
    leave(e.which === KeyCodes.Tab ? RangeAxis.Row : RangeAxis.Column);
  }, [leave]);

  // The bar in place while the field rides the keyboard: the active cell as the field shows it idle.
  let displayField: React.ReactNode = null;
  if (floatOnKeyboard) {
    const cell = sheet && !sheet.isDeleted() ? sheet.getRange(activeCoords).getCell() : null;
    const text = cell ? editStringFromCell(cell) : '';
    const ghost = cell && !text ? placeholderFromCell(cell) : null;
    displayField = (
      <Box
        className="formula-bar-display"
        sx={{
          lineHeight: `${LINE_HEIGHT}px`,
          whiteSpace: expanded ? 'pre-wrap' : 'pre',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          color: (theme: Theme) => (disabled || ghost ? theme.palette.text.disabled : theme.palette.text.primary)
        }}
      >
        {text || ghost}
      </Box>
    );
  }

  // The bar's content. The bar in place (`display`) and the copy on the keyboard (`editor`) are the
  // same layout, so the one looks to move to the other.
  const renderBar = (variant: 'editor' | 'display'): React.ReactElement => {
    const isDisplay = variant === 'display';
    return (
      <>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '4px' }}>
          <BarButton
            disabled={!insertFunctionCommand || insertFunctionCommand.disabled()}
            aria-label="commit-formula-function"
            icon={<DynamicIcon iconKey="Function" style={{ transform: 'scale(0.85)' }}/>}
            propsTooltip={{ label: insertFunctionCommand?.getLabel() ?? t('formulaBar.insertFunction'), simple: true }}
            onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
              if (e.button !== 0) return;
              insertFunctionCommand?.execute();
              e.preventDefault();
            }}
          />
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flex: '1 1 100%',
              minWidth: 0,
              position: 'relative',
              fontFamily: (theme: Theme) => theme.typography.fontFamily,
              fontSize: 11 * IFont.getDeviceScale(),
              alignItems: 'stretch',
              // One line sits in a row the height of the buttons beside it; extra lines stack above.
              minHeight: BUTTON_HEIGHT,
              boxSizing: 'border-box',
              padding: '0px',
              paddingLeft: (theme: Theme) => theme.spacing(1),
              boxShadow: 'none',
              borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
              backgroundColor: 'var(--sxl-color-input, var(--sxl-color-base-100))',
              border: (theme: Theme) => `solid ${(!disabled ? FIELD_BORDER_COLOR : theme.palette.action.disabled)} 1px`,
              '& textarea': {
                color: (theme: Theme) => (disabled ? `${theme.palette.text.disabled} !important` : theme.palette.text.primary)
              }
            }}
            onFocus={isDisplay ? undefined : () => setIsFocused(true)}
            onBlur={isDisplay ? undefined : () => setIsFocused(false)}
          >
            <Box
              className="formula-editor"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 100%',
                minWidth: 0,
                justifyContent: 'center',
                alignSelf: 'center',
                overflow: 'hidden',
                cursor: isDisplay && !disabled ? 'text' : undefined
              }}
              style={{ height: `${linesVisible * LINE_HEIGHT}px` }}
              onClick={isDisplay ? onOpenEditor : undefined}
            >
              {isDisplay ? displayField : cellEditor}
            </Box>
            {/* The chevron lives inside the field, at the end of its bottom line, where the thumb is. */}
            <BarButton
              aria-label="toggle-expand-formula-edit"
              icon={<DynamicIcon iconKey={expanded ? 'ExpandMore' : 'ExpandLess'} />}
              propsTooltip={{ label: expanded ? t('formulaBar.collapse') : t('formulaBar.expand'), simple: true }}
              sx={{ alignSelf: 'flex-end' }}
              onClick={() => setExpanded((prev) => !prev)}
            />
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '2px',
                willChange: 'opacity',
                transition: 'opacity 60ms ease-in',
                opacity: !isDisplay && isFocused ? 1 : 0,
                borderBottomWidth: '2px',
                borderBottomStyle: 'solid',
                borderBottomColor: (theme: Theme) => theme.palette.primary.main,
                borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`
              }}
            />
          </Paper>
        </Box>
        {isDisplay ? null : (
          <input
            ref={refDate}
            type="date"
            aria-hidden="true"
            tabIndex={-1}
            onChange={onDatePicked}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          />
        )}
        <MobileInputToolbar
          isEditing={isEditing}
          disabled={disabled}
          keyboardShown={keyboard.isActive()}
          inputMode={inputMode}
          showCancelCommit={showCancelCommit}
          onInputMode={onInputMode}
          onDate={onDate}
          onTab={onTab}
          onEnter={onEnter}
          onCancel={onCancel}
          onCommit={onCommit}
        />
      </>
    );
  };

  const barStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    gap: '4px'
  };

  return (
    // The `formula:editor` leaf, the same way the desktop bar declares it; see FormulaBar.tsx.
    <CommandScopeProvider spec={editorSpec} elementRef={refLocal} region>
      <div
        {...rest}
        ref={refLocal}
        className={clsx('formula-bar', 'formula-bar-mobile', propClassName)}
        // Focusable, so focus has a place in the studio when the keyboard goes away.
        tabIndex={floatOnKeyboard ? -1 : undefined}
        style={{
          ...barStyle,
          outline: 'none',
          ...propStyle
        }}
        onKeyDownCapture={floatOnKeyboard ? undefined : onKeyDownCapture}
      >
        {floatOnKeyboard ? (
          // Keeps its room while the copy rides the keyboard, faded out as that one shows.
          <div
            style={{
              ...barStyle,
              opacity: accessoryShown ? 0 : 1,
              transition: `opacity ${FADE_MS}ms ease-out`,
              pointerEvents: accessoryShown ? 'none' : undefined
            }}
          >
            {renderBar('display')}
          </div>
        ) : renderBar('editor')}
      </div>
      {floatOnKeyboard ? (
        <>
          <AccessoryBounds elementRef={refAccessory} />
          <KeyboardAccessory
            ref={refAccessory}
            floating={floating}
            anchor={anchor}
            onShownChange={setAccessoryShown}
            onKeyboardClose={onKeyboardClose}
          >
            <div
              className={clsx('formula-bar', 'formula-bar-mobile', 'formula-bar-keyboard')}
              style={{
                ...barStyle,
                padding: '4px 8px',
                backgroundColor: 'var(--sxl-color-base-200)',
                borderTop: `solid 1px ${FIELD_BORDER_COLOR}`
              }}
              onFocus={() => setFocusInAccessory(true)}
              onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInAccessory(false);
              }}
              onKeyDownCapture={onKeyDownCapture}
            >
              {renderBar('editor')}
            </div>
          </KeyboardAccessory>
        </>
      ) : null}
    </CommandScopeProvider>
  );
  })
);

MobileFormulaBar.displayName = 'MobileFormulaBar';
