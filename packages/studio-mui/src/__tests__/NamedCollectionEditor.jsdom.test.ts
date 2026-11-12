import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { TransactionUndoManager, Workbook, type IWorkbook } from '@sheetxl/sdk';

import { NamedCollectionEditor } from '../named/NamedCollectionEditor';

/**
 * The name box, and whether it hears the collection it renders.
 *
 * @remarks
 * Selecting the cells a name refers to makes the box show the NAME in place of the address, so a
 * rename has to reach it. It subscribes to `onCollectionChange` and re-reads on the event — but a
 * rename moves no membership, so nothing about the collection's own state changes and the event
 * only arrives because the collection announces it deliberately (`_markContentsChanged`). This
 * pins the whole path: rename → calc collection → aggregator → this component's text.
 *
 * The sibling half is `NamedDetailsPanel.jsdom.test.ts` ('re-renders when a name is RENAMED
 * behind it') — the same event, the other surface.
 */
describe('NamedCollectionEditor (the name box)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  const mount = async (workbook: IWorkbook) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(NamedCollectionEditor as never, {
        workbook,
        names: workbook.getNames()
      }));
    });
    return {
      text: () => container.textContent ?? '',
      /** The box renders its label into an input when editable, else as text. */
      value: () => {
        const input = container.querySelector('input') as HTMLInputElement | null;
        return input?.value ?? container.textContent ?? '';
      },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('shows the NEW name after a rename behind it', async () => {
    const workbook = new Workbook();
    const item = workbook.getNames().addFormula('Before', 'Sheet1!$A$1:$B$2');
    // Select exactly the cells the name refers to — that is what makes the box show the name.
    await workbook.getRange('Sheet1!A1:B2').select();
    await workbook.getCalculation().ready();

    const box = await mount(workbook);
    expect(box.value()).toContain('Before');

    await act(async () => {
      item.setName!('After');
    });

    expect(box.value()).toContain('After');
    expect(box.value()).not.toContain('Before');

    await box.unmount();
  });
  it('shows the NEW name after a TABLE is renamed behind it', async () => {
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    const table = sheet.getTables().add('A1:C4', { properties: { name: 'Before' } });
    // The box shows a table's name for its DATA range, which is what `INamed.getRanges` reports.
    await workbook.getRanges(table.getDataRange()).select();
    await workbook.getCalculation().ready();

    const box = await mount(workbook);
    expect(box.value()).toContain('Before');

    await act(async () => {
      table.setName('After');
    });

    expect(box.value()).toContain('After');
    expect(box.value()).not.toContain('Before');

    await box.unmount();
  });

  it('shows the OLD name again after the rename is undone', async () => {
    // A restore reaches the collection as `onInvalidated`, not `onCollectionChange`: a table's name
    // is read back off the table, so an undo of a rename moves no state the collection holds.
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    const table = sheet.getTables().add('A1:C4', { properties: { name: 'Before' } });
    await workbook.getRanges(table.getDataRange()).select();
    await workbook.getCalculation().ready();

    const undoManager = new TransactionUndoManager(workbook.getTransactions());
    const box = await mount(workbook);

    await act(async () => { table.setName('After'); });
    expect(box.value()).toContain('After');

    await act(async () => { await undoManager.undo(); });

    expect(box.value()).toContain('Before');
    expect(box.value()).not.toContain('After');

    await box.unmount();
  });
});
