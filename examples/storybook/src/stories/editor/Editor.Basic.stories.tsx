import React, { useCallback, useMemo, useRef, useState } from 'react';

import { type CellCoords } from '@sheetxl/utils';

import {
  Grid, SelectionLayer, EditorLayer, EditorStartLayer,
  DefaultSelection, DefaultEditable, DefaultCellRenderer,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

const cellIdentity = (rowIndex: number, colIndex: number): string => `${rowIndex}:${colIndex}`;

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

/**
 * The new always-mounted {@link EditorLayer} reduced to its essence: **two layers + an editable**.
 *
 * @remarks
 * The grid mounts `SelectionLayer` (writes the anchor) and `EditorLayer` (reads the anchor from
 * the same `DefaultEditable`). The editable holds the single current edit and, on `startEdit`, mints an
 * `EditSession` (clean + commit) via `createEdit` — or `null` if not editable. Here it's backed by a
 * values map; an `IWorksheet` in the real app.
 *
 * Try it:
 * - Click a cell, then **type** — starts on the first keystroke (no lost characters). **Arrows**
 *   move the active cell; **Enter/Tab** (with Shift) move after committing — all handled by the
 *   selection layer, not the editor.
 * - **F2** / **double-click** → edit mode (arrows move the caret). **Alt/Meta+Enter** → newline.
 * - **Escape** cancels; clicking another cell mid-edit commits.
 * - The **Edit active cell** button starts an edit imperatively (`editable.startEdit`).
 * - **B2** is read-only (`createEdit` returns `null`). **A1** is pre-filled to show overflow growth.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const [values, setValues] = useState<Record<string, string>>(() => ({
    [cellIdentity(0, 0)]: 'A long value that overflows several columns to the right',
    [cellIdentity(3, 1)]: 'Edit me'
  }));
  // The store is created once, so its model reads the latest values through a ref.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Stable selection + editable, composed once. The selection owns the anchor (writes); the editable
  // reads the same anchor and, on `startEdit`, mints the single current `EditSession` via `createEdit`
  // (null ⇒ not editable). The real app's `IEditable` is an `IWorksheet`-backed editable.
  // The selection is stable; navigation reads the latest grid dims through a ref (its bounds port).
  const dimsRef = useRef({ rowCount, columnCount });
  dimsRef.current = { rowCount, columnCount };
  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({
      rowStart: 0, colStart: 0,
      rowEnd: dimsRef.current.rowCount - 1, colEnd: dimsRef.current.columnCount - 1
    })
  }), []);
  const editable = useMemo(() => new DefaultEditable<string>(selection, (coords: CellCoords) => {
    if (coords.rowIndex === 1 && coords.colIndex === 1) return null; // B2 read-only
    return {
      clean: valuesRef.current[cellIdentity(coords.rowIndex, coords.colIndex)] ?? '',
      commit: (dirty: string) => {
        setValues((prev) => ({ ...prev, [cellIdentity(coords.rowIndex, coords.colIndex)]: dirty }));
      }
    };
  }), [selection]);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, range, ...cellRest } = cellProps;
    const value = values[cellIdentity(range!.rowStart, range!.colStart)] ?? '';
    return <DefaultCellRenderer key={key} {...cellRest} range={range} value={value} />;
  }, [values]);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ padding: '4px 6px' }}>
          <button onClick={() => editable.startEdit(editable.getAnchor().getCoords(), { mode: 'edit' })}>
            Edit active cell
          </button>
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          <EditorStartLayer key="editor-start" editable={editable} />
          <SelectionLayer key="selection" selection={selection} />
          <EditorLayer key="editor" editable={editable} />
        </Grid>
      </div>
    </div>
  );
};

export const EditorBasic = asStory(Template);
EditorBasic.args = {
  columnCount: 200,
  rowCount: 200
};

EditorBasic.storyName = 'Basic (always-mounted layer)';

const Story = {
  title: 'Editor',
  component: EditorBasic,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
