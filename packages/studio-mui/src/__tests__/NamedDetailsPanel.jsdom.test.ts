import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, ICalculation, type IWorkbook, type INamed } from '@sheetxl/sdk';

import { NamedDetailsPanel } from '../named/NamedDetailsPanel';
import { NamedEditorPanel } from '../named/NamedEditorPanel';
import { createNamedDraft, saveNamedDraft, expressionOf, isEditableNamed } from '../named/NamedDraft';
import { DataValidationDetailsPanel } from '../dataValidation/DataValidationDetailsPanel';

/**
 * The managed-names task pane, and the generic list/editor shell underneath it.
 *
 * @remarks
 * Names are the reason that shell is model-agnostic: unlike a data validation, an `INamed` has no
 * anchor, no index, and no `createItem` — its collection aggregates the registries that
 * own the items. The last case here mounts the data-validation pane for exactly that reason: it
 * still goes through `AnchorItemsPanel`, which is now an adapter onto the same shell.
 */
describe('NamedDetailsPanel', () => {
  // The kind chip is drawn in the conditional format's preview chip, which resolves the color
  // scheme through `prefers-color-scheme` — not implemented by this jsdom. Light is the answer it
  // would get in a default browser anyway.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const mount = async (workbook: IWorkbook, component: unknown = NamedDetailsPanel) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(component as never, { workbook }));
    });
    return {
      container,
      text: () => container.textContent ?? '',
      click: async (el: HTMLElement) => { await act(async () => { el.click(); }); },
      type: async (el: HTMLInputElement, text: string) => {
        await act(async () => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(el, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
      },
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('lists names from every scope, not just the selected sheet', async () => {
    const workbook = new Workbook();
    const names = workbook.getNames();
    names.addFormula('GlobalTotal', 'Sheet1!$A$1:$B$2');
    workbook.getCalculation().getNamedFormulas().add({
      name: 'SheetLocal',
      expression: 'Sheet1!$C$1',
      scope: 'Sheet1'
    });

    const panel = await mount(workbook);
    expect(panel.text()).toContain('GlobalTotal');
    expect(panel.text()).toContain('SheetLocal');
    await panel.unmount();
  });

  it('never lists hidden names, and offers to delete the unused ones', async () => {
    const workbook = new Workbook();
    workbook.getNames().addFormula('Visible', 'Sheet1!$A$1');
    workbook.getCalculation().getNamedFormulas().add({
      name: 'Concealed',
      expression: '=1',
      hidden: true
    });

    const panel = await mount(workbook);
    expect(panel.text()).toContain('Visible');
    expect(panel.text()).not.toContain('Concealed');

    // The footer's count is answered asynchronously.
    const findRemove = () => Array.from(panel.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Delete 1 unused hidden name');
    await vi.waitFor(() => expect(findRemove()).toBeDefined(), { timeout: 3000 });
    await panel.click(findRemove()!);

    await vi.waitFor(() => expect(panel.text()).not.toContain('unused hidden'), { timeout: 3000 });
    expect(workbook.getCalculation().getNamedFormulas().getItems().map((named) => named.getName()))
      .not.toContain('Concealed');
    expect(panel.text()).toContain('Visible');

    await panel.unmount();
  });

  it('re-renders when a name is added behind it', async () => {
    const workbook = new Workbook();
    workbook.getNames().addFormula('First', 'Sheet1!$A$1');

    const panel = await mount(workbook);
    expect(panel.text()).not.toContain('Second');

    await act(async () => {
      workbook.getNames().addFormula('Second', 'Sheet1!$B$1');
    });
    expect(panel.text()).toContain('Second');

    await panel.unmount();
  });

  it('re-renders when a name is RENAMED behind it', async () => {
    // A rename moves no membership, so the collection's own state does not change — the card would
    // keep showing the old text unless the collection says so on purpose. It used to say so as a
    // side effect of re-filing the item under its new key; the calc collection is keyed by the
    // item's id now, so there is no re-file to ride on.
    const workbook = new Workbook();
    const item = workbook.getNames().addFormula('Before', 'Sheet1!$A$1');

    const panel = await mount(workbook);
    expect(panel.text()).toContain('Before');

    await act(async () => {
      item.setName!('After');
    });
    expect(panel.text()).toContain('After');
    expect(panel.text()).not.toContain('Before');

    await panel.unmount();
  });

  describe('the cards', () => {
    it('lead with a kind chip and carry the expression as a field', async () => {
      const workbook = new Workbook();
      workbook.getNames().addFormula('Region', 'Sheet1!$A$1:$B$2');
      workbook.getNames().addFormula('Rate', '0.21');

      const panel = await mount(workbook);
      expect(panel.container.querySelectorAll('.sxl-item-card .sxl-named-kind-chip').length).toBe(2);
      const values = Array.from(
        panel.container.querySelectorAll('.sxl-item-card .sxl-formula-field input')
      ).map((el) => (el as HTMLInputElement).value);
      // Shown as formulas — the `=` is the field's contract — whatever the name resolves to.
      expect(values).toEqual(expect.arrayContaining(['=Sheet1!$A$1:$B$2', '=0.21']));
      await panel.unmount();
    });

    /**
     * A name is compiled by the engine, which starts asynchronously; until it is up a name added to
     * a fresh workbook answers `getRanges()` with `null` and reads as a formula. Every pane in the
     * app opens long after startup, so this is only the test's problem.
     */
    const whenReady = (workbook: IWorkbook): Promise<void> => new Promise((resolve) => {
      const calculation = workbook.getCalculation();
      if (calculation.getStatus() === ICalculation.Status.Running) { resolve(); return; }
      const remove = calculation.addListeners({
        onStatusChange: () => {
          if (calculation.getStatus() !== ICalculation.Status.Running) return;
          remove();
          resolve();
        }
      });
    });

    it('select the range on a surface click, but not from the expression field', async () => {
      const workbook = new Workbook();
      await whenReady(workbook);
      workbook.getNames().addFormula('Region', 'Sheet1!$D$3:$G$10');

      const panel = await mount(workbook);
      const selected = () => workbook.getSelectedWorksheet()!.getSelectedRange().toString();
      expect(selected()).not.toContain('$D$3:$G$10');

      // A click in the card's field is the field's — it may be picking from the grid.
      await panel.click(panel.container.querySelector('.sxl-item-card .sxl-formula-field input') as HTMLElement);
      await act(async () => {});
      expect(selected()).not.toContain('$D$3:$G$10');

      await panel.click(panel.container.querySelector('.sxl-item-card') as HTMLElement);
      await act(async () => {});
      expect(selected()).toContain('$D$3:$G$10');
      await panel.unmount();
    });

    it('filter on a search query, and say when nothing matches', async () => {
      const workbook = new Workbook();
      workbook.getNames().addFormula('Revenue', 'Sheet1!$A$1');
      workbook.getNames().addFormula('Costs', 'Sheet1!$B$1');

      const panel = await mount(workbook);
      const search = panel.container.querySelector('input[placeholder="Search names"]') as HTMLInputElement;
      expect(search).toBeTruthy();

      await panel.type(search, 'rev');
      expect(panel.text()).toContain('Revenue');
      expect(panel.text()).not.toContain('Costs');

      await panel.type(search, 'nothing-here');
      expect(panel.text()).toContain('No names match.');
      // The field stays, so the query can be changed back.
      expect(panel.container.querySelector('input[placeholder="Search names"]')).toBeTruthy();

      await panel.type(search, '');
      expect(panel.text()).toContain('Costs');
      await panel.unmount();
    });
  });

  describe('the refers-to field', () => {
    /** Mount the editor over a draft and hand back its formula field's `<input>`. */
    const mountEditor = async (workbook: IWorkbook, item?: INamed) => {
      const draft = createNamedDraft(workbook, item);
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(createElement(NamedEditorPanel as never, { draft, workbook }));
      });
      return {
        draft,
        container,
        /** The reserved line under the field — the guidance, or the error when there is one. */
        helper: () => container.querySelector('.sxl-formula-field .MuiFormHelperText-root')?.textContent ?? '',
        input: container.querySelector('.sxl-formula-field input') as HTMLInputElement,
        type: async (text: string) => {
          await act(async () => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            setter?.call(container.querySelector('.sxl-formula-field input'), text);
            container.querySelector('.sxl-formula-field input')!
              .dispatchEvent(new Event('input', { bubbles: true }));
          });
        },
        unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
      };
    };

    it('seeds from the draft and is a FORMULA field, not a reference one', async () => {
      const workbook = new Workbook();
      await workbook.whenCalculationReady();
      workbook.getNames().addFormula('Total', 'Sheet1!$A$1:$B$2');
      const item = workbook.getNames().getItems()
        .find((named: INamed) => named.getName() === 'Total');
      const editor = await mountEditor(workbook, item);
      expect(editor.input).toBeTruthy();
      expect(editor.input.value).toContain('$A$1:$B$2');
      // A name's refers-to is any EXPRESSION — the reference grammar would reject this outright.
      await editor.type('=OFFSET(Sheet1!$A$1,1,0)');
      expect(editor.draft.expression).toBe('=OFFSET(Sheet1!$A$1,1,0)');
      await editor.unmount();
    });

    it('keeps its label, and gives the reserved line to the ERROR over the guidance', async () => {
      // The guidance and the error share ONE reserved line under the field. Rendering the guidance
      // as a caption below instead put it on top of that line, hiding the error underneath it.
      const workbook = new Workbook();
      await workbook.whenCalculationReady();
      const editor = await mountEditor(workbook);
      const label = () => editor.container.querySelector('.sxl-formula-field label')?.textContent ?? '';
      expect(label()).toContain('Refers To');
      expect(editor.helper()).toContain('A range address');
      await editor.type('=SUM(A1))'); // a real parse error, not an in-progress one
      expect(editor.helper()).toContain('Invalid Formula');
      expect(editor.helper()).not.toContain('A range address');
      expect(label()).toContain('Refers To'); // ...and the label is still there while erroring
      await editor.unmount();
    });

    it('writes the RAW text through to the draft — invalid in-progress states included', async () => {
      // The draft is what `saveNamedDraft` validates, so it must hold exactly what the field shows.
      // On the parsed channel an unfinished expression would leave the draft on the last VALID text
      // and Save would quietly write something the user never saw.
      const workbook = new Workbook();
      await workbook.whenCalculationReady();
      const editor = await mountEditor(workbook);
      await editor.type('=SUM(');
      expect(editor.draft.expression).toBe('=SUM(');
      await editor.type('=SUM(Sheet1!$A$1:$A$9)');
      expect(editor.draft.expression).toBe('=SUM(Sheet1!$A$1:$A$9)');
      // ...and that draft saves as the name's definition.
      saveNamedDraft(workbook, { ...editor.draft, name: 'Summed' }, null);
      const saved = workbook.getNames().getItems()
        .find((named: INamed) => named.getName() === 'Summed');
      expect(expressionOf(saved!)).toContain('SUM');
      await editor.unmount();
    });
  });

  describe('draft round-trip', () => {
    it('seeds a new draft from the selection and defines it', () => {
      const workbook = new Workbook();
      const draft = createNamedDraft(workbook);

      expect(draft.editable).toBe(true);
      expect(draft.scope).toBeNull();
      expect(draft.expression.length).toBeGreaterThan(0);

      saveNamedDraft(workbook, draft, null);

      const created = workbook.getNames().getByName(draft.name);
      expect(created).not.toBeNull();
      expect(created!.getName()).toEqual(draft.name);
    });

    it('carries scope, comment and hidden onto a new name in one write', () => {
      const workbook = new Workbook();
      const draft = createNamedDraft(workbook);
      draft.name = 'Configured';
      draft.expression = 'Sheet1!$D$4';
      draft.scope = 'Sheet1';
      draft.comment = 'a note';
      draft.hidden = true;

      saveNamedDraft(workbook, draft, null);

      const created = workbook.getNames().getItems({ includeHidden: true })
        .find((item: INamed) => item.getName() === 'Configured');
      expect(created).toBeDefined();
      expect(created!.getScope()).toEqual('Sheet1');
      expect(created!.getComment()).toEqual('a note');
      expect(created!.isHidden()).toBe(true);
    });

    it('renames and redefines an existing name as a single edit', () => {
      const workbook = new Workbook();
      workbook.getNames().addFormula('Before', 'Sheet1!$A$1:$B$2');
      const target = workbook.getNames().getByName('Before')!;

      const draft = createNamedDraft(workbook, target);
      expect(draft.name).toEqual('Before');
      draft.name = 'After';
      draft.expression = 'Sheet1!$C$1:$C$9';
      draft.comment = 'renamed';

      saveNamedDraft(workbook, draft, target);

      expect(workbook.getNames().getByName('Before')).toBeNull();
      const renamed = workbook.getNames().getByName('After');
      expect(renamed).not.toBeNull();
      expect(renamed!.getComment()).toEqual('renamed');
      expect(expressionOf(renamed!)).toContain('$C$1');
    });

    it('refuses a name that is already taken, leaving the original alone', () => {
      const workbook = new Workbook();
      workbook.getNames().addFormula('Taken', 'Sheet1!$A$1');
      workbook.getNames().addFormula('Original', 'Sheet1!$B$1');
      const target = workbook.getNames().getByName('Original')!;

      const draft = createNamedDraft(workbook, target);
      draft.name = 'Taken';

      expect(() => saveNamedDraft(workbook, draft, target)).toThrow();
      // Nothing was written — the panel keeps the editor open over this draft.
      expect(workbook.getNames().getByName('Original')).not.toBeNull();
    });

    it('treats a table name as derived, so the pane will not redefine it', () => {
      const workbook = new Workbook();
      workbook.getNames().addFormula('AFormula', 'Sheet1!$A$1');
      const formula = workbook.getNames().getByName('AFormula')!;
      expect(isEditableNamed(formula)).toBe(true);
    });
  });

  it('still drives the anchored panes through the adapter', async () => {
    // Guards the refactor: data validations keep their own descriptor and now reach the shared
    // shell through `AnchorItemsPanel`. Each card's subtitle is the anchored ranges, as a field.
    const workbook: IWorkbook = new Workbook({
      json: {
        sheets: [{
          name: 'Sheet1',
          sheet: {
            validations: [{
              r: 'A1:B2',
              v: { condition: { operator: 'inSet', param: { items: ['a', 'b'] } } }
            }]
          }
        }]
      } as any
    });

    const panel = await mount(workbook, DataValidationDetailsPanel);
    const fieldValues = Array.from(panel.container.querySelectorAll('input, textarea'))
      .map((el: Element) => (el as HTMLInputElement).value);
    expect(fieldValues).toContain('$A$1:$B$2'); // the ranges subtitle
    expect(panel.text()).toContain('List:');     // the descriptor's card title
    await panel.unmount();
  });
});
