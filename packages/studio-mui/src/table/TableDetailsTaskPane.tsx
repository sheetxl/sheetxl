import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { type TaskPaneProps } from '@sheetxl/react';

import { type IWorksheet, type ITable, type IStyleCollection, type INamedCollection } from '@sheetxl/sdk';

import { useModelListener, useWorksheet } from '@sheetxl/react';

import { TableDetailsPanel } from './TableDetailsPanel';

export const TableDetailsTaskPane = (props: TaskPaneProps) => {
  const {
    model: workbook,
    entryKey,
    frame,
    ref,
    ...rest
  } = props;

  const sheet = useWorksheet();

  // One nonce drives recomputation of the selected table; every relevant signal bumps it.
  const [nonce, bump] = useReducer((s: number) => s + 1, 0);

  // The table containing the selection's active cell, or null.
  const cell = sheet?.getSelection()?.getCoords()?.cell;
  const selectedTable = useMemo<ITable | null>(() => {
    if (!sheet) return null;
    const items = sheet.getTables().getItems({ address: cell });
    return items.length > 0 ? items[0] : null;
  }, [sheet, cell, nonce]);

  // Table-level signals fire `onAnyChange` on the TABLE (not the sheet) — subscribe to the selected one.
  useEffect(() => {
    if (!selectedTable) return;
    const remover = selectedTable.addListeners({ onAnyChange: () => bump() }, OptionsListener);
    return () => { remover?.(); };
  }, [selectedTable]);

  useModelListener<IWorksheet, IWorksheet.IListeners>(sheet as IWorksheet, {
    onSelectionChange: () => bump(), // re-pick the table under the active cell
    onStyleChange: () => bump(), // for styles
    // onNamesChange: () => bump(), // for names
    onTablesChange: () => bump(),
    onAutoTableChange: () => bump(),
    onLayoutChange: () => bump(),
    onInvalidated: () => bump()
  }, OptionsModelListener);

  const getStyles = useCallback(() => sheet?.getStyles(), [sheet]);
  const getNames = useCallback(() => sheet?.getNames(), [sheet]);

  return (
    <TableDetailsPanel
      ref={ref}
      {...rest}
      table={selectedTable as ITable}
      getStyles={getStyles as () => IStyleCollection}
      getNames={getNames as () => INamedCollection}
      // frame={frame}
    />
  )
};

// Sheet listener: don't fire on mount (the first token is already fresh).
const OptionsModelListener = { transactional: false, ignoreModelChange: true };
// Raw table listener (no hook, so no mount-fire); non-transactional like the rest of the view layers.
const OptionsListener = { transactional: false };
