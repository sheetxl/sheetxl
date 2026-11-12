import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Box } from '@mui/material';

import {
  ITextFrame, IFill, type IWorkbook, type IWorksheet, type ICell, type IRangeSelection
} from '@sheetxl/sdk';

import { useCallbackRef, useOptionalBoundSyncExternalStore, type CommandScopeSpec } from '@sheetxl/utils-react';

import { EditorDiv } from '@sheetxl/grid-react';

import {
  useModelListener, createSheetCellInput, contributeEditorCommands, placeholderFromCell, type SheetEditable
} from '@sheetxl/react';

/** The logical editor id both formula bar hosts park on the session (see `EditSession.setActiveEditorId`). */
export const FORMULA_BAR_EDITOR_ID = 'formula-bar';

export interface FormulaBarSessionOptions {
  /** The workbook whose active cell the bar follows. */
  workbook: IWorkbook;
  /** The shared cell editor; the bar is display-only without one. */
  editable: SheetEditable | undefined;
  /** A host-level disable, on top of cell protection and a read-only workbook. */
  disabled?: boolean;
  /**
   * The line rhythm the host's editor box snaps to, in px. Handed to the input so a rendered line
   * and a host row are the same height.
   */
  lineHeight: number;
  /** The virtual keyboard a touch host asks for. */
  inputMode?: React.TextareaHTMLAttributes<HTMLTextAreaElement>['inputMode'];
  /** The action label of the virtual keyboard's Enter key. */
  enterKeyHint?: React.TextareaHTMLAttributes<HTMLTextAreaElement>['enterKeyHint'];
  /** Which side of the caret the function hint opens on; `'above'` for a bar at the bottom. */
  hintPlacement?: 'below' | 'above';
}

export interface FormulaBarSession {
  /**
   * The selected worksheet, or `null` while the active tab is a sheet of another kind. The bar is
   * then disabled and shows no cell.
   */
  sheet: IWorksheet | null;
  /** The active cell's coordinates on {@link FormulaBarSession.sheet}. */
  activeCoords: ICell.Coords;
  /** The bar cannot start an edit: the host said so, the cell is protected or the workbook is read-only. */
  disabled: boolean;
  /** The live edit session, or `null` while idle. */
  session: ReturnType<SheetEditable['getSession']>;
  /** Whether an edit session is live. */
  isEditing: boolean;
  /** Cancel the live session. Does not move focus. */
  cancel: () => void;
  /** Commit the live session. Does not move focus. */
  commit: () => void;
  /**
   * The `formula:editor` command scope, for the host's `CommandScopeProvider`. `null` without an
   * editable.
   */
  editorSpec: CommandScopeSpec | null;
  /**
   * The editor element: the shared `EditorDiv` + cell input bound to the active cell and restyled as
   * chrome text. The host places it in its own box. `null` without an editable.
   */
  cellEditor: React.ReactElement | null;
}

/**
 * Everything a formula bar host shares with the other hosts: which cell the bar shows, whether it
 * may edit, the live session on the shared editable, and the editor element itself.
 *
 * @remarks
 * A formula bar host is a box around the same input the in-grid editor renders, driving the same
 * `SheetEditable`, so typing in either place is one edit. The hosts differ in chrome (a name box, a
 * resize grip, how the ✕ / ✓ / fx buttons sit), not in behavior; this hook is the behavior.
 *
 * Ending a session from here does not return focus to the grid. That spans the bar and the grid,
 * which only the studio owns (see the editable-session focus-restore effect in EagerStudio).
 */
export const useFormulaBarSession = (options: FormulaBarSessionOptions): FormulaBarSession => {
  const { workbook, editable, disabled: propDisabled, lineHeight, inputMode, enterKeyHint, hintPlacement } = options;

  const [sheet, setSelectedSheet] = useState<IWorksheet | null>(workbook.getSelectedWorksheet());
  const [activeCoords, setActiveCoords] = useState<ICell.Coords>(sheet?.getSelectedCell().getCoords() as ICell.Coords);
  // Bumped when the active cell's CONTENT changes under a selection that did not move; a dep of
  // every read of that cell below. See the listener beneath the selection listener.
  const [dataRevision, setDataRevision] = useState<number>(0);
  // Seed from the actual active cell so a cell that's ALREADY protected on mount reads as read-only from
  // the first paint (not only after the first selection change); kept live by the listeners below.
  const [cellDisabled, setCellDisabled] = useState<boolean>(() => sheet ? !sheet.getSelectedCell().isEditAllowed() : false);

  // A write-protected (read-only) workbook makes the whole bar read-only, independent of cell protection —
  // read-only is immutable once set (no listener needed). Combined with `cellDisabled` (the protected
  // anchor cell) this drives the editor's `readOnly` below, which also keeps focus off `startEdit` (that
  // THROWS on a read-only workbook — see `createSheetCreateEdit`).
  const readOnlyWorkbook = workbook.getProtection().isReadOnly();

  const disabled = !!propDisabled || cellDisabled || readOnlyWorkbook || !sheet;

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    // A tab of another kind leaves the bar with no sheet, rather than on the worksheet before it.
    onSheetsChange: (source: IWorkbook) => {
      const sheetSelected = source.getSelectedWorksheet();
      if (sheetSelected) setActiveCoords(sheetSelected.getSelectedCell().getCoords());
      setSelectedSheet(sheetSelected);
    },
    onViewChange(source: IWorkbook): void {
      const sheetSelected = source.getSelectedWorksheet();
      if (sheetSelected) setActiveCoords(sheetSelected.getSelectedCell().getCoords());
      setSelectedSheet(sheetSelected);
    },
    onInvalidated(source: IWorkbook): void {
      const sheetSelected = source.getSelectedWorksheet();
      if (sheetSelected) {
        setActiveCoords({
          ...sheetSelected.getSelectedCell().getCoords()
        });
      }
      setSelectedSheet(sheetSelected);
    }
  });

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(sheet?.getSelection(), {
    onChange: () => {
      if (!sheet) return;
      const selectedCell = sheet.getSelectedCell();
      setCellDisabled(!selectedCell.isEditAllowed());
      setActiveCoords(selectedCell.getCoords());
    },
  });

  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet, {
    onProtectionChange(): void {
      if (sheet) setCellDisabled(!sheet.getSelectedCell().isEditAllowed());
    }
  });

  /* The bar reads the active cell lazily (`spillPlaceholder` and `idleClean` below), so it needs to
   * be told when that cell's CONTENT changes. Nothing above covers it: the workbook's notifications
   * fire only for a commit that wrote the WORKBOOK's own state record, and a cell edit writes the
   * sheet's, while the selection listener is silent when the selection does not actually move
   * (`IRangeSelection.updateCoords` returns early on equal coords). A write that leaves the
   * selection where it is - pasting onto the selected cell, a script `setValue`, a fill that lands
   * back on itself - therefore left the bar showing the old value.
   *
   * A listener on the ACTIVE CELL rather than a sheet-wide `onDataChange`, so a change anywhere
   * else costs no render. Registering one is not a document change (it amends the current commit
   * and adds no undo step), so re-registering as the selection moves is cheap by design.
   */
  useEffect(() => {
    if (!sheet || sheet.isDeleted()) return;
    return sheet.getRange(activeCoords).addListener(() => {
      setDataRevision((prev: number) => prev + 1);
    });
  }, [sheet, activeCoords]);

  // The formula bar drives the SAME shared `editable` the grid uses — live two-way sync, no bus.
  const session = useOptionalBoundSyncExternalStore(editable, (e) => e.getSession());
  const isEditing = !!session;

  const cancel = useCallbackRef((): void => {
    editable?.cancel();
  }, [editable]);
  const commit = useCallbackRef((): void => {
    editable?.commit();
  }, [editable]);

  // The cell-aware input, bound to the sheet (for the normal-style fill fallback). (Not to be
  // confused with the standalone `FormulaInput` widget — the bar is SESSION-backed: it renders the
  // shared `IEditable` edit through `EditorDiv`, the same input the in-grid editor uses.)
  const SheetCellInput = useMemo(
    () => (sheet ? createSheetCellInput({ selection: sheet.getSelection(), fillNone: true }) : null),
    [sheet]
  );

  // The formula bar's editor command scope: a `formula:editor` leaf (registry name `editor`, so it resolves the
  // F4 / `toggleEditorFocus` chrome) — a plain child of the bar's ambient (sheet) scope, the out-of-grid peer of
  // the inline editor's pane-stack `layer:editor`. Contributed the SAME way as the inline editor — declaratively
  // via `<CommandScopeProvider spec …>` in the host, which owns the create-child + contribute + dispose, runs
  // `contributeEditorCommands` GATED on the live session (idle ⇒ no F4 → cedes to redo), and — via `regionRef` —
  // records the bar's element in the tree's region index so the studio focus tracker anchors here when the bar
  // is focused ("just a leaf of the studio tree", no `appTracker`). Memoize `data` — a new object re-runs it.
  const editorData = useMemo(
    () => (editable && sheet ? { editable, sheet, active: !!session } : null),
    [editable, sheet, session]
  );
  const editorSpec = useMemo<CommandScopeSpec | null>(
    () => (editorData
      ? { scopeName: { key: 'formula:editor', name: 'editor' }, contributor: { dynamic: contributeEditorCommands }, data: editorData }
      : null),
    [editorData]
  );

  // Excel's greyed ghost formula for a spilled-INTO cell. Read from the REAL active cell (not the
  // `mapClean` temp cell) so it never depends on `createCell` preserving the spill state, and
  // suppressed once a session is live — an edit's `dirty` starts empty, which would otherwise flash the
  // ghost over the cell the user just started typing in.
  const spillPlaceholder = useMemo(() => {
    if (isEditing || !sheet) return null;
    return placeholderFromCell(sheet.getRange(activeCoords).getCell());
  }, [sheet, activeCoords, isEditing, dataRevision]);

  const cellEditor = useMemo(() => {
    if (!editable || !sheet || !SheetCellInput) return null;
    return (
      <Box sx={{ display: 'flex', flex: '1 1 100%', flexDirection: 'row', gap: 4 }}>
        <EditorDiv
          editable={editable}
          // A protected anchor cell or a write-protected workbook makes the bar a display-only field: the
          // value shows (and can be selected/copied) but focus never starts an edit and the textarea is
          // `readOnly`. Threaded to both the host (focus gate) and the input (the textarea) via `EditorDiv`.
          readOnly={disabled}
          // Identifies the bar as its own editor, so an in-cell editor returning from a sheet switch can see
          // the user's active editor was the formula bar and not steal focus back.
          editorId={FORMULA_BAR_EDITOR_ID}
          idleClean={() => sheet.getRange(activeCoords).getCell()}
          mapClean={(c) => c ? () => {
            return c().createCell({
              style: {
                font: {
                  size: 11,
                  // Authored as the automatic color (not `null`, which would EXCLUDE it). The bar's RENDERED
                  // color is actually forced to `inherit` (the chrome text color) in `SheetCellInput` since
                  // the bar is chrome, not the grid — so this only documents the authored intent.
                  color: 'auto',
                  style: null, // auto
                  weight: null // auto
                },
                alignment: {
                  // The bar is a flat presentation: left, top — regardless of the cell's own alignment
                  // (which the shared input would otherwise apply). `Visible` clears the cell's own Wrap
                  // too, so the bar's wrapping is decided ONLY by the box-less host rule (the bar can't
                  // grow sideways, so it always wraps — see `cellWrap` in `SheetCellInput`) and a cell
                  // flagged Wrap doesn't read differently in the bar than one that isn't.
                  horizontal: ITextFrame.HorizontalAlignment.Left,
                  vertical: ITextFrame.VerticalAlignment.Top,
                  overflow: ITextFrame.Overflow.Visible
                },
                fill: { type: IFill.Type.None } // the bar is transparent — the Paper bg shows through
              }
            }) ;
          }: null}
          renderEditor={(p) => (
            <SheetCellInput
              {...p}
              editable={editable}
              placeholder={spillPlaceholder}
              // The bar wraps, so its height is a count of LINES — the host snaps to `lineHeight` and the
              // expander counts in it. Hand the input the same rhythm so a rendered line and a snapped row
              // are the same thing; left to the browser's `normal` they drift by a few px and every
              // expanded row ends on a sliver of the next.
              lineHeight={lineHeight}
              inputMode={inputMode}
              enterKeyHint={enterKeyHint}
              hintPlacement={hintPlacement}
            />
          )}
          style={{
            display: 'flex',
            flex: '1 1 100%'
          }}
        />
      </Box>
    );
  }, [editable, SheetCellInput, sheet, activeCoords, dataRevision, spillPlaceholder, disabled, lineHeight, inputMode, enterKeyHint, hintPlacement]);

  return { sheet, activeCoords, disabled, session, isEditing, cancel, commit, editorSpec, cellEditor };
};
