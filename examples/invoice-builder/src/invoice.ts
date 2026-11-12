import { Workbook, type ICellRange, type ITable, type IWorksheet, type Scalar } from '@sheetxl/sdk';

import logoUrl from './assets/logo.png';

/**
 * The invoice template: where the inputs live, and the formulas that compute from them.
 *
 * The line items are a table, so adding one inserts a row and everything below it moves down. The
 * app writes only the input cells. Everything else is locked by sheet protection, so the formulas
 * can't be overwritten from the grid or from code.
 */

export interface LineItem {
  description: string;
  qty: number | null;
  price: number | null;
}

export interface InvoiceForm {
  customer: string;
  items: LineItem[];
  /** Fraction, so `0.1` is 10%. */
  discount: number;
  /** Fraction, so `0.08` is 8%. */
  tax: number;
}

/** The line items table. */
export const ItemsTable = 'Items';

/**
 * Where the inputs and the total start. The ones below the items move down as items are added; the
 * cell hooks follow them.
 */
export const Cells = {
  customer: 'A4',
  discount: 'C11',
  tax: 'C12',
  total: 'D13'
} as const;

export const DEFAULT_FORM: InvoiceForm = {
  customer: 'Acme Corporation',
  items: [
    { description: 'Design consultation (hours)', qty: 6, price: 120 },
    { description: 'Spreadsheet integration', qty: 1, price: 2400 },
    { description: 'Support plan (months)', qty: 3, price: 150 }
  ],
  discount: 0.1,
  tax: 0.0825
};

const Currency = '$#,##0.00';
const Accent = '#1F4E79';

const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Reads the line items out of the table's rows. */
export const toItems = (rows: Scalar[][]): LineItem[] =>
  rows.map(([description, qty, price]) => ({ description: String(description ?? ''), qty: asNumber(qty), price: asNumber(price) }));

export const toItemRows = (items: LineItem[]): (string | number | null)[][] =>
  items.map(item => [item.description, item.qty, item.price]);

/** The table's input cells: Description, Qty and Unit price, for every row. Amount is a formula. */
export const itemInputs = (table: ITable): ICellRange => {
  const body = table.getDataRange();
  const { rowStart, colStart, rowEnd } = body.getCoords();
  return body.getRangeAt(rowStart, colStart, rowEnd, colStart + 2);
};

/**
 * Creates the invoice sheet. It still belongs to a workbook, which is what exporting writes.
 */
export async function createInvoice(): Promise<IWorksheet> {
  const form = DEFAULT_FORM;
  // we create a workbook instead of a direct sheet to enable export as workbook.
  const workbook = new Workbook();
  const sheet = workbook.getWorksheet();
  sheet.setName('Invoice');

  sheet.getRange('A1:D6').setValues([
    [null, null, null, 'INVOICE'],
    [null, null, 'Invoice #', 'INV-1001'],
    ['Bill to', null, 'Date', '=TODAY()'],
    [],
    [],
    ['Description', 'Qty', 'Unit price', 'Amount']
  ]);
  sheet.getRange(Cells.customer).setValue(form.customer, { textParser: false });

  sheet.getRange('A7:C9').setValues(toItemRows(form.items), { textParser: false });
  sheet.getRange('D7:D9').setFormula('=IF(B7="","",B7*C7)');
  // Made from the filled rows, Amount is a calculated column: rows added later get its formula.
  const table = sheet.getRange('A6:D9').addTable(true);
  table.setName(ItemsTable);
  table.setShowTotals(true);
  table.getColumnByName('Description')!.setTotalsRowLabel('Subtotal');
  table.getColumnByName('Amount')!.setTotalsRowFormula(109);
  table.setHiddenButtons(true);
  table.setHiddenDecorations(true);

  sheet.getRange('B11:D13').setValues([
    ['Discount', form.discount, '=-D10*C11'],
    ['Tax', form.tax, '=(D10+D11)*C12'],
    ['Total', null, '=SUM(D10:D12)']
  ]);

  sheet.getRange('A:A').getColumnHeaders().setSize(260);
  sheet.getRange('B:B').getColumnHeaders().setSize(80);
  sheet.getRange('C:D').getColumnHeaders().setSize(110);

  sheet.getRange('1:1').getRowHeaders().setSize(60);
  sheet.getRange('D1').getStyle().update({
    font: { size: 20, weight: 700, color: Accent }, alignment: { horizontal: 'right', vertical: 'center' }
  });
  sheet.getRange('A3').getStyle().update({ font: { weight: 700 } });
  sheet.getRange('C2:C3').getStyle().update({ alignment: { horizontal: 'right' }, font: { color: '#666666' } });
  sheet.getRange('D2:D3').getStyle().update({ alignment: { horizontal: 'right' } });
  sheet.getRange('D3').setNumberFormat('mmm d, yyyy');
  sheet.getRange('B6:D6').getStyle().update({ alignment: { horizontal: 'right' } });
  sheet.getRange('C7:D13').setNumberFormat(Currency);
  sheet.getRange('C11:C12').setNumberFormat('0.00%');
  sheet.getRange('B13:D13').getStyle().update({
    font: { weight: 700, size: 13 },
    borders: { top: { style: 'medium', color: Accent } }
  });

  await sheet.getMovables().addPicture(
    { source: { fetch: logoUrl }, name: 'logo.png' },
    { name: 'Logo', bounds: { x: 4, y: 6, width: 220, height: 48 } }
  );

  for (const address of [Cells.customer, 'A7:C9', Cells.discount, Cells.tax]) {
    sheet.getRange(address).getStyle().getProtection().setAlwaysUnlocked(true);
  }
  sheet.getView().setShowRowGridlines(false).setShowColumnGridlines(false);
  // The sheet ends where the invoice does, and grows with it as items are added.
  sheet.setEntireSize({ width: 4, height: 'fit' });
  // Adding and removing items inserts and deletes rows.
  await sheet.getProtection().lock({ insertRows: true, deleteRows: true });
  return sheet;
}
