import { describe, it, expect, beforeAll } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, ICondition, type IConditionalFormat, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider, type ItemsPaneArgs } from '@sheetxl/react';

import { ConditionalFormatDetailsPanel } from '../conditionalFormat/ConditionalFormatDetailsPanel';

/**
 * The receiving end of `activateTaskPane('conditionalFormatDetails', { args: { draft } })` — the
 * Home▸Conditional Formatting classic presets ("Greater Than…"). The preset writes NO rule: it
 * hands its properties over and the pane opens editing a new one, so Save is the commit.
 */
describe('ConditionalFormatDetailsPanel seeding (mount)', () => {

  // The rule preview resolves the color scheme through `prefers-color-scheme`, which this jsdom
  // does not implement. Light is the answer the preview would get in a default browser anyway.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  const GREATER_THAN_10: IConditionalFormat.Properties = {
    condition: {
      selector: ICondition.BuiltInSelectorNames.Number,
      operator: ICondition.BuiltInOperatorNames.GreaterThan,
      param: 10
    }
  } as IConditionalFormat.Properties;

  const newWorkbook = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    return workbook;
  };

  const mount = async (workbook: IWorkbook, args?: ItemsPaneArgs<IConditionalFormat.Properties>) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async (nextArgs?: ItemsPaneArgs<IConditionalFormat.Properties>): Promise<void> => {
      await act(async () => {
        root.render(createElement(WorkbookProvider as never, { workbook } as never,
          createElement(ConditionalFormatDetailsPanel as never, { workbook, args: nextArgs } as never)));
      });
    };
    await render(args);
    return {
      container,
      render,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  /** The editor is up ⇔ the panel is showing the save/cancel shell rather than the card list. */
  const isEditing = (container: HTMLElement): boolean =>
    container.querySelector('.sxl-conditional-format-details')?.classList.contains('editing') ?? false;

  const rules = (workbook: IWorkbook) =>
    workbook.getSelectedWorksheet().getConditionalFormats().getItems();

  it('opens the editor on a new rule carrying the seed, committing nothing', async () => {
    const workbook = await newWorkbook();
    const host = await mount(workbook, { draft: GREATER_THAN_10 });

    expect(isEditing(host.container)).toBe(true);
    // The whole point of a draft: the sheet is still clean until the user saves.
    expect(rules(workbook).length).toBe(0);
    // The seeded value reached the editor's param field.
    expect(host.container.querySelector('input[value="10"]')).toBeTruthy();

    await host.unmount();
  });

  it('opens on the list when nothing was seeded', async () => {
    const workbook = await newWorkbook();
    const host = await mount(workbook);

    expect(isEditing(host.container)).toBe(false);
    expect(rules(workbook).length).toBe(0);

    await host.unmount();
  });

  it('opens the editor on an unseeded new rule for `insert`, committing nothing', async () => {
    const workbook = await newWorkbook();
    // What "New Rule…" sends: no properties to seed, just "open on one" — the pane mints the rule
    // its own add button would.
    const host = await mount(workbook, { insert: true });

    expect(isEditing(host.container)).toBe(true);
    expect(rules(workbook).length).toBe(0);

    await host.unmount();
  });

  it('consumes a seed once — a re-render with the same args does not reopen it', async () => {
    const workbook = await newWorkbook();
    const args: ItemsPaneArgs<IConditionalFormat.Properties> = { draft: GREATER_THAN_10 };
    const host = await mount(workbook, args);
    expect(isEditing(host.container)).toBe(true);

    // Cancel, then re-render with the SAME payload — the delivery already happened, and a payload
    // that reopened the editor on every render would make the pane unusable.
    const cancel = Array.from(host.container.querySelectorAll('button'))
      .find((b) => /cancel/i.test(b.textContent ?? ''))!;
    expect(cancel).toBeTruthy();
    await act(async () => { cancel.click(); });
    expect(isEditing(host.container)).toBe(false);

    await host.render(args);
    expect(isEditing(host.container)).toBe(false);

    // A fresh payload (what a second press of the preset produces) does reopen it.
    await host.render({ draft: GREATER_THAN_10 });
    expect(isEditing(host.container)).toBe(true);

    await host.unmount();
  });
});
