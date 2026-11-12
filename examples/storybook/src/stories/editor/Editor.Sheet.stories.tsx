import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { Workbook, type IWorksheet } from '@sheetxl/sdk';

import {
  Grid, SelectionLayer, EditorLayer, EditorStartLayer,
  DefaultSelection, DefaultEditable, DefaultCellRenderer,
  type CellRendererProps, type IGrid
} from '@sheetxl/grid-react';

import { createSheetCreateEdit, createSheetCellInput, resolveCellBackground } from '@sheetxl/react';

import { asStory } from '../../components';

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

/**
 * The new always-mounted {@link EditorLayer} driven by a **real `IWorksheet`** — the P3a slice that proves
 * the SDK seam in isolation (no `WorksheetElement`, no `useEditMode` bus yet).
 *
 * @remarks
 * - The editable's `createEdit` is `createSheetCreateEdit(sheet)`: `clean` = a live cell getter,
 *   `commit` = `range.setValue(text, { autoFit })`, `null` = not editable (`isEditAllowed`).
 * - The input is `createSheetCellInput({ sheet })` — cell-aware: it shows the **formula** (`=…`) or the
 *   **formatted** text, paints the **cell fill**, and uses the **cell font + alignment**.
 *
 * Try it:
 * - **C3 / D3** hold formulas — start editing to see the `=…` edit string; commit to see the result.
 * - Numbers right-align, text left-aligns (cell alignment); a `%`-cell shows its formatted text.
 * - Type / **F2** / **double-click** to edit; **Enter/Tab** commit + navigate; **Esc** cancels.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  // A real, headless sheet — seeded once. (No Workbook chrome; just the model + a Grid.)
  const sheet = useMemo<IWorksheet>(() => {
    const workbook = new Workbook();
    const s = workbook.getSelectedWorksheet()!;
    s.getRange('A1').setValue('A long value that overflows several columns to the right');
    s.getRange('B4').setValue('Edit me');
    s.getRange('B6').setValue(1234.5);
    s.getRange('C3').setValue('=1+2');
    s.getRange('D3').setValue('=C3*10');
    return s;
  }, []);

  // Repaint on any cell change (e.g. after a commit): bump for a re-render AND invalidate the grid's
  // cell cache. The tiled CellLayer caches rendered cells by content token / pane identity, so an
  // external model write must bust it (the real WorksheetElement does this via its self-subscribing layer).
  const gridRef = useRef<IGrid>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => sheet.getEntireRange().addListener(() => { bump(); gridRef.current?.invalidate(); }), [sheet]);

  // Stable selection + editable, composed once. The editable edits THROUGH the sheet; the selection is
  // a dumb store whose navigation reads the latest grid dims through a ref (its bounds port).
  const dimsRef = useRef({ rowCount, columnCount });
  dimsRef.current = { rowCount, columnCount };
  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({
      rowStart: 0, colStart: 0,
      rowEnd: dimsRef.current.rowCount - 1, colEnd: dimsRef.current.columnCount - 1
    })
  }), []);
  const editable = useMemo(() => new DefaultEditable(selection, createSheetCreateEdit(sheet)), [selection, sheet]);

  // The cell-aware input, bound to the sheet (for the normal-style fill fallback). Rendered as a
  // component element so its hooks stay isolated.
  // Drive navigation through the SAME selection the grid renders (the DefaultSelection) — so a
  // committed Enter/Tab moves the visible selection. (WorksheetElement passes `sheet.getSelection()`.)
  const SheetCellEditor = useMemo(() => createSheetCellInput({ selection }), [selection]);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    const text = sheet.getRange({ rowIndex: range!.rowStart, colIndex: range!.colStart })
      .getCell().getText({ hideStringPrefix: true });
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value={text} />;
  }, [sheet]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ padding: '4px 6px' }}>
          <button onClick={() => editable.startEdit(editable.getAnchor().getCoords(), { mode: 'edit' })}>
            Edit active cell
          </button>
        </div>
        <Grid
          ref={gridRef}
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          <EditorStartLayer key="editor-start" editable={editable} />
          <SelectionLayer key="selection" selection={selection} />
          <EditorLayer
            key="editor"
            editable={editable}
            // The box paints the cell's grid background (cell→normal→body); the input paints only the
            // cell's own fill. Here the sheet has no fills, so resolve to white.
            background={(coords) => resolveCellBackground(sheet.getRange(coords).getCell(), sheet, false, '#ffffff')}
            renderEditor={(inputProps) => <SheetCellEditor {...inputProps} />}
          />
        </Grid>
      </div>
    </div>
  );
};

export const EditorSheet = asStory(Template);
EditorSheet.args = {
  columnCount: 200,
  rowCount: 200
};

EditorSheet.storyName = 'Sheet (IWorksheet-backed)';

const Story = {
  title: 'Editor',
  component: EditorSheet,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
