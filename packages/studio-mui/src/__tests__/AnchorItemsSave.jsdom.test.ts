import { describe, it, expect, afterEach, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type IWorksheet, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import {
  AnchorItemsPanel, toItemsDescriptor, type AnchorItem, type AnchorItemsDescriptor
} from '../anchorItems';
import { ConditionalFormatItemsDescriptor } from '../conditionalFormat/ConditionalFormatDetailsPanel';
import { DataValidationItemsDescriptor } from '../dataValidation/DataValidationDetailsPanel';
import { ProtectedRangeItemsDescriptor } from '../protectedRange/ProtectedRangeDetailsPanel';

const cases: [string, AnchorItemsDescriptor<any>, (sheet: IWorksheet) => AnchorItem][] = [
  ['conditional format', ConditionalFormatItemsDescriptor, (sheet) => sheet.getConditionalFormats().add('A1:A5')],
  ['data validation', DataValidationItemsDescriptor, (sheet) => sheet.getDataValidations().add('A1:A5')],
  ['protected range', ProtectedRangeItemsDescriptor, (sheet) => sheet.getProtectedRanges().add('A1:A5')]
];

/**
 * Saving an edit of an existing anchored item. The editor works on a detached draft, and no item's
 * `update()` carries the anchor, so a range edited in the editor reaches the real item only
 * through the panel's save.
 */
describe('AnchorItemsPanel save', () => {

  for (const [name, descriptor, add] of cases) {
    it(`carries a range edited in the editor onto the ${name}`, async () => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const target = add(workbook.getSelectedWorksheet());
      const items = toItemsDescriptor(descriptor);

      const draft = items.createDraft!(workbook, target);
      draft.setRanges(['C1:C3', 'E1']);
      await items.beforeSave?.(draft);
      items.save!(workbook, draft, target);

      expect(target.getRanges().toString()).toBe('$C$1:$C$3,$E$1');
    });
  }

});

/**
 * The editor's "Apply to" commits on done, and Save is a button: it takes focus without any of the
 * field's own commit points, so the text the field still holds has to be committed by the save.
 */
describe('AnchorItemsPanel save from the editor', () => {

  // The editors' preview chips resolve the color scheme through `prefers-color-scheme`, which this
  // jsdom does not implement.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  /** The panel, opened editing `target`. */
  const mountEditing = async (workbook: IWorkbook, descriptor: AnchorItemsDescriptor<any>, target: AnchorItem) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(AnchorItemsPanel as never, { workbook, descriptor, args: { edit: target } } as never)));
    });
    const editor = (): HTMLElement | null => container.querySelector('.sxl-items-editor');
    return {
      editor,
      /** Types into the "Apply to" field and leaves the text there, uncommitted. */
      typeRange: async (text: string): Promise<void> => {
        const input = editor()!.querySelector('.sxl-formula-field[data-grammar="reference"] input') as HTMLInputElement;
        await act(async () => { input.focus(); });
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, text);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      },
      save: async (): Promise<void> => {
        const buttons = Array.from(editor()!.querySelectorAll('button.MuiButton-contained')) as HTMLElement[];
        await act(async () => { buttons[buttons.length - 1].click(); });
      },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  for (const [name, descriptor, add] of cases) {
    it(`saves a range still being typed onto the ${name}`, async () => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const target = add(workbook.getSelectedWorksheet());
      const panel = await mountEditing(workbook, descriptor, target);
      expect(panel.editor()).toBeTruthy();

      await panel.typeRange('C1:C3');
      await panel.save();

      expect(target.getRanges().toString()).toBe('$C$1:$C$3');
      expect(panel.editor()).toBeNull();
      await panel.unmount();
    });

    it(`refuses to save the ${name} over a range that does not parse`, async () => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const target = add(workbook.getSelectedWorksheet());
      const panel = await mountEditing(workbook, descriptor, target);

      await panel.typeRange('C1:C3+');
      await panel.save();

      expect(target.getRanges().toString()).toBe('$A$1:$A$5');
      expect(panel.editor()).toBeTruthy(); // left open on the text to fix
      await panel.unmount();
    });

    it(`refuses to save the ${name} over a cleared range`, async () => {
      const workbook: IWorkbook = new Workbook();
      await workbook.getCalculation().ready();
      const target = add(workbook.getSelectedWorksheet());
      const panel = await mountEditing(workbook, descriptor, target);

      await panel.typeRange('');
      // An item always occupies ranges, so there is nothing to commit: the field's own ✓ is off too.
      const commit = panel.editor()!.querySelector('[role="button"][aria-label="commit-reference"]');
      expect(commit?.getAttribute('aria-disabled')).toBe('true');
      await panel.save();

      expect(target.getRanges().toString()).toBe('$A$1:$A$5');
      expect(panel.editor()).toBeTruthy();
      expect(panel.editor()!.textContent).toContain('Reference is required');
      await panel.unmount();
    });
  }

});
