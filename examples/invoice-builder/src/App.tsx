import { useState } from 'react';

import { LicenseManager, type ICellRange, type IWorksheet } from '@sheetxl/sdk';

import {
  CellInsertLayer, SheetLayers, WorksheetElement, WorkbookIO, useCell, useCellValue, useTable
} from '@sheetxl/react';

import {
  Cells, ItemsTable, createInvoice, itemInputs, toItemRows, toItems, type LineItem
} from './invoice';

import './App.css';

/**
 * Invoice builder example.
 *
 * The app owns the UI. The sheet is the engine and the live preview: the form fields are bound
 * to the input cells, the line items to a table, the formulas compute, and the total badge is bound
 * to the total cell. Input cells stay editable in the grid, and edits made there show up in the form.
 */

await LicenseManager.printBanner();

const toNumber = (text: string): number | null => (text.trim() === '' ? null : Number(text));

// A line item can also be added from the preview: hovering a row header beside the items table shows an
// insert button on the border nearest the pointer, from below the header row to above the totals row.
const resolveItemRow = (row: ICellRange): ICellRange | null => {
  // `row` is just below the border: outside the table below the totals row, the header above it.
  const table = row.getWorksheet().getTables().getItems({ name: ItemsTable, address: row })[0];
  if (!table || row.getCoords().rowStart === table.getRange().getCoords().rowStart) return null;
  return row.getIntersect(table.getRange());
};


function App() {
  const [pending, setPending] = useState(createInvoice);
  // The invoice is one sheet, so the preview is a sheet element: no tabs, no workbook around it.
  const [sheet, setSheet] = useState<IWorksheet | null>(null);

  const [customer, setCustomer] = useCellValue<string>(sheet, Cells.customer);
  const [discount, setDiscount] = useCellValue<number>(sheet, Cells.discount);
  const [tax, setTax] = useCellValue<number>(sheet, Cells.tax);
  const [total] = useCell(sheet, Cells.total);
  const itemsTable = useTable(sheet, ItemsTable);
  const items = itemsTable ? toItems(itemsTable.getDataRange().getValues()) : [];

  const setItems = (items: LineItem[]): void => {
    if (itemsTable) itemInputs(itemsTable).setValues(toItemRows(items), { textParser: false });
  };

  const updateItem = (index: number, patch: Partial<LineItem>): void => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const toPercent = (rate: number | null): number => +((rate ?? 0) * 100).toFixed(4);
  const toRate = (percent: string): number => (toNumber(percent) ?? 0) / 100;

  return (
    <div className="App">
      <form className="App-form" onSubmit={(e) => e.preventDefault()}>
        <header className="App-header">
          <h1>Invoice Builder</h1>
          <output className="App-total" aria-live="polite">
            Total: {total?.getText() ?? '…'}
          </output>
        </header>

        <label>
          Customer
          <input value={customer ?? ''} onChange={(e) => setCustomer(e.target.value)} />
        </label>

        <fieldset>
          <legend>Line items</legend>
          {items.map((item, index) => (
            <div className="App-item" key={index}>
              <input
                aria-label="Description"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
              />
              <input
                aria-label="Quantity"
                type="number" min="0"
                value={item.qty ?? ''}
                onChange={(e) => updateItem(index, { qty: toNumber(e.target.value) })}
              />
              <input
                aria-label="Unit price"
                type="number" min="0" step="0.01"
                value={item.price ?? ''}
                onChange={(e) => updateItem(index, { price: toNumber(e.target.value) })}
              />
              <button
                type="button" aria-label="Remove line item"
                disabled={items.length <= 1}
                onClick={() => itemsTable?.deleteRowsAt(index)}
              >×</button>
            </div>
          ))}
          <button type="button" onClick={() => itemsTable?.addRow()}>Add line item</button>
        </fieldset>

        <div className="App-rates">
          <label>
            Discount %
            <input
              type="number" min="0" max="100" step="0.01"
              value={toPercent(discount)}
              onChange={(e) => setDiscount(toRate(e.target.value))}
            />
          </label>
          <label>
            Tax rate %
            <input
              type="number" min="0" max="100" step="0.01"
              value={toPercent(tax)}
              onChange={(e) => setTax(toRate(e.target.value))}
            />
          </label>
        </div>

        <div className="App-actions">
          <button type="button" disabled={!sheet} onClick={() => WorkbookIO.write(sheet!.getWorkbook()!, 'invoice.xlsx')}>
            Export
          </button>
          <button type="button" onClick={() => setPending(createInvoice())}>Reset</button>
        </div>
      </form>

      <WorksheetElement
        className="App-preview"
        sheet={pending}
        onSheetChange={setSheet}
        colorScheme="light"
      >
        <SheetLayers surface={['rowHeaders', 'cells']}>
          <CellInsertLayer resolve={resolveItemRow} />
        </SheetLayers>
      </WorksheetElement>
    </div>
  );
}

export default App;
