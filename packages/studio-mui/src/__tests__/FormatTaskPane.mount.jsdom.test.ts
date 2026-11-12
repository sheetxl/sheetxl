import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, IFill, type IWorkbook } from '@sheetxl/sdk';

import { PersistentStateProvider, InMemoryStore, type PersistenceStore } from '@sheetxl/utils-react';

import { WorkbookProvider } from '@sheetxl/react';

import { FormatTaskPane, type FormatPaneArgs } from '../format';

/**
 * The format pane end to end: mounted on a real workbook, driven the way a user drives it, and
 * asserted against the MODEL rather than the DOM wherever a control writes something.
 *
 * The pane applies live, so "did the control work" and "did the cell change" are the same question
 * — which is what these check.
 */
describe('FormatTaskPane (mount)', () => {
  // The preview resolves the GRID's color scheme through `prefers-color-scheme`, which this jsdom
  // does not implement. Light is the answer a default browser would give anyway.
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  afterEach(() => { document.body.innerHTML = ''; });

  const newWorkbook = async (): Promise<IWorkbook> => {
    const workbook: IWorkbook = new Workbook();
    await workbook.getCalculation().ready();
    return workbook;
  };

  /**
   * The pane remembers its tab in the persistence store, so each mount gets its OWN store by
   * default — without a provider every test would share the module-level one, and the tab a test
   * left the pane on would decide which tab the next test opens on. Pass a store to share it (which
   * is how the "reopens on the tab" test gets two mounts to remember across each other).
   */
  const mount = async (
    workbook: IWorkbook,
    store: PersistenceStore = new InMemoryStore(),
    initialArgs?: FormatPaneArgs
  ): Promise<{
    container: HTMLDivElement;
    activate: (args?: FormatPaneArgs) => Promise<void>;
    unmount: () => Promise<void>;
  }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async (args?: FormatPaneArgs): Promise<void> => {
      await act(async () => {
        root.render(createElement(PersistentStateProvider as never, { store, debounceMs: 0 } as never,
          createElement(WorkbookProvider as never, { workbook } as never,
            createElement(FormatTaskPane as never, { entryKey: 'formatCells', model: workbook, args } as never))));
      });
    };
    await render(initialArgs);
    return {
      container,
      /**
       * Re-activate the pane the way `activateTaskPane` does — a FRESH `args` object each time,
       * which is the signal the pane treats as an event rather than as state.
       */
      activate: render,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  /** Let a popup that positions itself on the next frame finish opening. */
  const frame = async (): Promise<void> => {
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
  };

  /** Click one of the pane's tabs by its visible label. */
  const selectTab = async (container: HTMLElement, label: string): Promise<void> => {
    const tab = Array.from(container.querySelectorAll('[role="tab"]'))
      .find((el) => el.textContent?.trim() === label) as HTMLElement;
    expect(tab, `tab '${label}'`).toBeTruthy();
    await act(async () => { tab.click(); });
  };

  /**
   * Pick an option in a MUI Select (mousedown opens the portal menu, then click the item).
   *
   * An option is named by its own line rather than by the row's text: the number-format categories
   * carry a live sample under the name, so the whole row reads 'Percentage50.00%'.
   */
  const optionName = (item: Element): string => {
    const name = item.querySelector('.MuiTypography-root:not(.MuiTypography-caption)');
    return (name ?? item).textContent?.trim() ?? '';
  };

  const selectOption = async (combo: HTMLElement, option: string): Promise<void> => {
    await act(async () => { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    const items = Array.from(document.querySelectorAll('li'));
    const item = items.find((li) => optionName(li) === option) as HTMLElement;
    expect(item, `option '${option}' (saw: ${items.map(optionName).join(', ')})`).toBeTruthy();
    await act(async () => { item.click(); });
  };

  /**
   * Pick a number-format category. The category field is the ribbon's popup rather than a MUI
   * Select, so it has no combobox role: it is found by the category it shows, opens on mouse-DOWN,
   * and its items choose on mouse-UP like the other Exhibit menus.
   */
  const selectCategory = async (container: HTMLElement, current: string, option: string): Promise<void> => {
    const field = Array.from(container.querySelectorAll('.sxl-number-format-panel .popupIconButton'))
      .find((el) => el.textContent?.trim() === current);
    expect(field, `category field showing '${current}'`).toBeTruthy();
    const button = field!.querySelector('.bordered') as HTMLElement;
    await act(async () => { button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); });
    await frame();
    await frame();

    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const item = items.find((el) => optionName(el) === option) as HTMLElement;
    expect(item, `category '${option}' (saw: ${items.map(optionName).join(', ')})`).toBeTruthy();
    await act(async () => { item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); });
  };

  it('renders all five tabs and switches between them', async () => {
    const workbook = await newWorkbook();
    const { container, unmount } = await mount(workbook);

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'))
      .map((el) => el.textContent?.trim());
    expect(tabs).toEqual(['Number', 'Alignment', 'Font', 'Border', 'Fill']);

    // Nothing persisted yet, so the pane falls back to Number. Ctrl+1 asks for no tab at all (see
    // the reopen test below); Ctrl+Shift+F is the one chord that names one, and it names Font.
    expect(container.textContent).toContain('Category');

    await selectTab(container, 'Fill');
    expect(container.textContent).toContain('Fill Type');
    expect(container.textContent).not.toContain('Category');

    await unmount();
  });

  it('reopens on the tab it was left on', async () => {
    const workbook = await newWorkbook();
    const store = new InMemoryStore();

    const first = await mount(workbook, store);
    await selectTab(first.container, 'Fill');
    await first.unmount();

    // The menus (Cells > Format, the cell context menu) activate the pane with no tab at all, and
    // land where the user left it rather than resetting to Number every time.
    const second = await mount(workbook, store);
    expect(second.container.textContent).toContain('Fill Type');
    expect(second.container.textContent).not.toContain('Category');

    await second.unmount();
  });

  it('moves to the tab a chord names, even while showing another one', async () => {
    const workbook = await newWorkbook();
    const { container, activate, unmount } = await mount(workbook);

    // Ctrl+1 and Ctrl+Shift+F NAME a tab rather than resuming — Excel has no generic "open the
    // format pane", so a chord is only ever a way to ask for a particular one. Pressing it with the
    // pane already open on some other tab has to move to the one asked for.
    await selectTab(container, 'Border');
    expect(container.textContent).toContain('Click an edge to draw or clear it');

    await activate({ tab: 'number' });
    expect(container.textContent).toContain('Category');

    await activate({ tab: 'font' });
    expect(container.textContent).toContain('Accounting Underline');
    expect(container.textContent).not.toContain('Category');

    // Every activation is its own event, including one naming the tab it named last time — so the
    // same chord pressed again after a manual tab switch still lands.
    await selectTab(container, 'Border');
    await activate({ tab: 'font' });
    expect(container.textContent).toContain('Accounting Underline');

    // The menus activate with no tab at all, and must NOT drag the user off the tab they are on.
    await selectTab(container, 'Fill');
    await activate({ tab: undefined });
    expect(container.textContent).toContain('Fill Type');

    await unmount();
  });

  it('honors the tab a COLD open asks for, over the stored one', async () => {
    const workbook = await newWorkbook();
    const store = new InMemoryStore();

    // Leave the pane on Border and close it, so the store holds Border.
    const first = await mount(workbook, store);
    await selectTab(first.container, 'Border');
    await first.unmount();

    /* "More Number Formats…" (and Ctrl+1) open the pane COLD with an explicit tab — a mount, not a
       re-activation. The stored tab hydrates asynchronously and resolves AFTER this mount's args
       effect has already asked for Number, so it must not win. This is the case that actually
       broke: re-activating an open pane worked, which is what made it look intermittent. */
    const second = await mount(workbook, store, { tab: 'number' });
    expect(second.container.textContent).toContain('Category');

    await second.unmount();
  });

  it('previews a number when the anchor cell holds text', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1').setValue('some text');
    const { container, unmount } = await mount(workbook);

    // The shared preview needs a number for the Number tab to have anything to format, so a text
    // cell previews the sample value instead. The cell itself is untouched.
    const preview = container.querySelector('.sxl-static-cell') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('1234.56');
    expect(sheet.getRange('A1').getValue()).toBe('some text');

    await unmount();
  });

  it('previews the anchor cell itself when it holds a number', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1').setValue(42);
    const { container, unmount } = await mount(workbook);

    const preview = container.querySelector('.sxl-static-cell') as HTMLElement;
    expect(preview.textContent).toContain('42');

    await unmount();
  });

  it('applies a number format from the Number tab', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('A1').setValue(0.5);
    const { container, unmount } = await mount(workbook);

    await selectCategory(container, 'General', 'Percentage');

    expect(sheet.getRange('A1').getStyle().getNumberFormat()).toBe('0.00%');

    await unmount();
  });

  /** The Fill tab's section captions, in order — the labels above each group of controls. */
  const fillSectionLabels = (container: HTMLElement): (string | undefined)[] =>
    Array.from(container.querySelectorAll('.sxl-format-fill-panel .MuiTypography-caption'))
      .map((el) => el.textContent?.trim());

  it('keeps No Fill on the color picker instead of the type dropdown', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Fill');
    const fillType = container.querySelector('[role="combobox"]') as HTMLElement;

    // An unfilled cell is Solid-with-No-Fill as far as the pane is concerned: coloring a cell is
    // the common case, and it should not cost a trip through the type dropdown first.
    expect(sheet.getRange('A1').getStyle().getFill().getType()).toBe(IFill.Type.None);
    expect(fillType.textContent?.trim()).toBe('Solid');
    expect(fillSectionLabels(container)).toEqual(['Background']);

    await act(async () => { fillType.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    const options = Array.from(document.querySelectorAll('[role="option"]'))
      .map((el) => el.textContent?.trim());
    expect(options).toEqual(['Solid', 'Pattern', 'Gradient']);

    // Re-picking the type the pane already shows leaves the cell alone rather than inventing a fill.
    await act(async () => {
      (document.querySelector('[role="option"]') as HTMLElement).click();
    });
    expect(sheet.getRange('A1').getStyle().getFill().getType()).toBe(IFill.Type.None);

    await unmount();
  });

  it('switches the cell to a pattern fill from the Fill tab', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Fill');
    const fillType = container.querySelector('[role="combobox"]') as HTMLElement;
    await selectOption(fillType, 'Pattern');

    const fill = sheet.getRange('A1').getStyle().getFill();
    expect(fill.getType()).toBe(IFill.Type.Pattern);
    expect((fill as IFill.IPattern).getPatternType()).toBe(IFill.BuiltInSheetPattern.Gray125);

    // The pattern controls appear only once the fill IS a pattern. Their captions drop the
    // "Pattern" prefix — the type dropdown right above them already says which fill this is.
    expect(fillSectionLabels(container)).toEqual(['Style', 'Foreground', 'Background']);

    await unmount();
  });

  it('switches the cell to a gradient fill with two stops', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Fill');
    await selectOption(container.querySelector('[role="combobox"]') as HTMLElement, 'Gradient');

    const fill = sheet.getRange('A1').getStyle().getFill() as IFill.IGradient;
    expect(fill.getType()).toBe(IFill.Type.Gradient);
    const stops = fill.getStops();
    expect(stops.length).toBe(2);
    // Offsets are the 0..1 fractions `toCSSGradient` consumes — a gradient authored in percent
    // would render as a single flat color.
    expect(stops[0].getOffset()).toBe(0);
    expect(stops[1].getOffset()).toBe(1);

    await unmount();
  });

  it('draws and clears one border edge from the Border tab diagram', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Border');
    // The diagram's edges carry the same names the border popup uses ('border.top' → "Top Borders").
    const top = container.querySelector('button[aria-label="Top Borders"]') as HTMLElement;
    expect(top).toBeTruthy();
    expect(top.getAttribute('aria-pressed')).toBe('false');

    await act(async () => { top.click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getTop().getStyle()).toBe('thin');

    // Clicking a drawn edge clears it.
    const topAgain = container.querySelector('button[aria-label="Top Borders"]') as HTMLElement;
    expect(topAgain.getAttribute('aria-pressed')).toBe('true');
    await act(async () => { topAgain.click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getTop().isNone()).toBe(true);

    await unmount();
  });

  it('draws an inner rule, and offers it only when the selection has an inside', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Border');

    // A single cell has no inside, so the inner targets are not in the diagram AT ALL — a target
    // that can do nothing is not information, and offering one is what made the inner rules feel
    // broken. The diagram collapses to the one cell the selection actually is.
    const insideH = () => container.querySelector('button[aria-label="Inside Horizontal Borders"]') as HTMLButtonElement;
    const insideV = () => container.querySelector('button[aria-label="Inside Vertical Borders"]') as HTMLButtonElement;
    expect(insideH()).toBeNull();
    expect(insideV()).toBeNull();
    // …and the outer edges are still there, on the single cell.
    expect(container.querySelector('button[aria-label="Top Borders"]')).toBeTruthy();

    // One row, two columns: the vertical rule appears, the horizontal one still cannot.
    await act(async () => { await sheet.getRange('A1:B1').select(); });
    expect(insideH()).toBeNull();
    expect(insideV()).toBeTruthy();

    await act(async () => { await sheet.getRange('A1:B2').select(); });
    expect(insideH()).toBeTruthy();
    expect(insideH().disabled).toBe(false);

    // The 2x2 diagram exists precisely so this rule has somewhere to show — and it reads back from
    // the cell the rule is drawn on.
    await act(async () => { insideH().click(); });
    expect(sheet.getRange('A1:B2').getStyle().getBorders().getHorizontal()?.getStyle()).toBe('thin');

    // …and clicking again CLEARS it. `getProperties()` never carries the inner rules, so reading
    // the toggle's state from there left this permanently off and every click re-drew the line.
    expect(insideH().getAttribute('aria-pressed')).toBe('true');
    await act(async () => { insideH().click(); });
    expect(sheet.getRange('A1:B2').getStyle().getBorders().getHorizontal()?.isNone()).toBe(true);

    await unmount();
  });

  it('offers four presets and a button per edge, off only when they would draw nothing', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Border');

    // The panel's buttons are icon buttons whose accessible name sits on the tooltip wrapper — a
    // div, so these selectors cannot collide with the diagram's own `button[aria-label]` targets.
    const button = (label: string) =>
      container.querySelector(`div[aria-label="${label}"] [role="button"]`) as HTMLElement;
    const isOff = (label: string) => button(label).getAttribute('aria-disabled') === 'true';
    const isPressed = (label: string) => button(label).classList.contains('Mui-selected');

    // Every button is present on every selection shape — nothing is hidden, so the panel never
    // reflows and a button never moves out from under the pointer. On a single cell the two
    // inner rules have nowhere to run, so they and the 'Inside' preset are off.
    for (const label of [
      'All Borders', 'Outside Borders', 'Inner Borders', 'No Borders',
      'Left Borders', 'Top Borders', 'Right Borders', 'Bottom Borders',
      'Inside Horizontal Borders', 'Inside Vertical Borders'
    ]) {
      expect(button(label), label).toBeTruthy();
    }
    expect(isOff('No Borders')).toBe(false);
    expect(isOff('Outside Borders')).toBe(false);
    // 'All' stays on: with no inside it draws the outline, which is still an edit. Only a button
    // that would write nothing at all goes off.
    expect(isOff('All Borders')).toBe(false);
    expect(isOff('Inner Borders')).toBe(true);
    expect(isOff('Inside Horizontal Borders')).toBe(true);
    expect(isOff('Inside Vertical Borders')).toBe(true);
    for (const label of ['Left Borders', 'Top Borders', 'Right Borders', 'Bottom Borders']) {
      expect(isOff(label), label).toBe(false);
    }

    // An edge button is the same click as the diagram's own line: draw, then clear, and it reads
    // as pressed in between.
    expect(isPressed('Left Borders')).toBe(false);
    await act(async () => { button('Left Borders').click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getLeft().getStyle()).toBe('thin');
    expect(sheet.getRange('A1').getStyle().getBorders().getRight().isNone()).toBe(true);
    expect(isPressed('Left Borders')).toBe(true);
    await act(async () => { button('Left Borders').click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getLeft().isNone()).toBe(true);

    // 'Outline' is the four outer edges in one click — and only those.
    await act(async () => { button('Outside Borders').click(); });
    const outlined = sheet.getRange('A1').getStyle().getBorders();
    expect(outlined.getLeft().getStyle()).toBe('thin');
    expect(outlined.getTop().getStyle()).toBe('thin');
    expect(outlined.getRight().getStyle()).toBe('thin');
    expect(outlined.getBottom().getStyle()).toBe('thin');

    // 'None' clears the lot.
    await act(async () => { button('No Borders').click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getTop().isNone()).toBe(true);

    // 'All' on a single cell is the outline — it draws the edges the selection HAS rather than
    // writing inner rules that land nowhere.
    await act(async () => { button('All Borders').click(); });
    expect(sheet.getRange('A1').getStyle().getBorders().getBottom().getStyle()).toBe('thin');
    await act(async () => { button('No Borders').click(); });

    // One row: there IS an inside now, so 'Inside' is live and draws the one rule it has — the
    // same edit as the button beside it, which is a duplicate rather than a trap.
    await act(async () => { await sheet.getRange('A1:C1').select(); });
    expect(isOff('Inner Borders')).toBe(false);
    expect(isOff('Inside Vertical Borders')).toBe(false);
    expect(isOff('Inside Horizontal Borders')).toBe(true);
    await act(async () => { button('Inner Borders').click(); });
    expect(sheet.getRange('A1:C1').getStyle().getBorders().getVertical()?.getStyle()).toBe('thin');
    expect(sheet.getRange('A1:C1').getStyle().getBorders().getTop().isNone()).toBe(true);

    // …and the mirror image for one column.
    await act(async () => { await sheet.getRange('A3:A5').select(); });
    expect(isOff('Inner Borders')).toBe(false);
    expect(isOff('Inside Horizontal Borders')).toBe(false);
    expect(isOff('Inside Vertical Borders')).toBe(true);

    // Both axes: every button is live, and 'All' finally means all six.
    await act(async () => { await sheet.getRange('C3:D4').select(); });
    expect(isOff('All Borders')).toBe(false);
    await act(async () => { button('All Borders').click(); });
    const all = sheet.getRange('C3:D4').getStyle().getBorders();
    expect(all.getHorizontal()?.getStyle()).toBe('thin');
    expect(all.getVertical()?.getStyle()).toBe('thin');
    expect(all.getTop().getStyle()).toBe('thin');
    await act(async () => { button('No Borders').click(); });

    expect(isOff('Inner Borders')).toBe(false);
    expect(isOff('Inside Horizontal Borders')).toBe(false);
    expect(isOff('Inside Vertical Borders')).toBe(false);

    await unmount();
  });

  it('keeps the inner toggle honest after a border is written at another scope', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Border');
    await act(async () => { await sheet.getRange('B2:E6').select(); });

    const insideH = () => container.querySelector('button[aria-label="Inside Horizontal Borders"]') as HTMLButtonElement;
    const drawn = (addr: string): boolean =>
      !sheet.getRange(addr).getCell().getStyle(true).getBorders().getTop().isNone();

    await act(async () => { insideH().click(); });
    expect(drawn('B3')).toBe(true);

    // A border written at ANY other scope splits the authoring blocks, and the inner RULE
    // (`getHorizontal`) stops answering for the selection from then on — permanently, and for every
    // imported workbook from the start, since xlsx stores borders per cell. The toggle reads what is
    // DRAWN instead, so the lines on screen and the button agree.
    await act(async () => { sheet.getRange('C4').getStyle().getBorders().setTop('1px solid'); });
    expect(sheet.getRange('B2:E6').getStyle().getBorders().getHorizontal()).toBeNull();
    expect(insideH().getAttribute('aria-pressed')).toBe('true');

    // …so the next click still clears, rather than redrawing a line that is already there.
    await act(async () => { insideH().click(); });
    expect(drawn('B3')).toBe(false);
    expect(drawn('E6')).toBe(false);
    expect(insideH().getAttribute('aria-pressed')).toBe('false');

    await unmount();
  });

  it('restyles an edge that does not match the pen, and only clears one that does', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    // Mounted over an unbordered A1, so the pen is the default: thin, no color of its own.
    await selectTab(container, 'Border');
    await act(async () => { await sheet.getRange('A1:B2').select(); });

    const top = () => container.querySelector('button[aria-label="Top Borders"]') as HTMLButtonElement;
    const stroke = () => sheet.getRange('A1').getCell().getStyle(true).getBorders().getTop();

    await act(async () => {
      sheet.getRange('A1:B2').getStyle().update({
        borders: { top: { style: 'thin', color: '#FF0000' } }
      } as never);
    });
    expect(top().getAttribute('aria-pressed')).toBe('true');

    // A line is there, but not the pen's line. The click sets it TO the pen rather than taking it
    // off — the only way to recolor an edge in one gesture. It has to REPLACE: a stroke delta
    // merges, so a pen with no color cannot lift a color off by itself.
    await act(async () => { top().click(); });
    expect(stroke().getStyle()).toBe('thin');
    expect(stroke().getProperties().color).toBeUndefined();

    // Now it does match, so the same click clears.
    await act(async () => { top().click(); });
    expect(stroke().isNone()).toBe(true);

    // Same rule on a difference of STYLE rather than color.
    await act(async () => {
      sheet.getRange('A1:B2').getStyle().update({ borders: { top: { style: 'medium' } } } as never);
    });
    await act(async () => { top().click(); });
    expect(stroke().getStyle()).toBe('thin');
    await act(async () => { top().click(); });
    expect(stroke().isNone()).toBe(true);

    await unmount();
  });

  it('reads the block bottom edge from its bottom-right cell, not the anchor', async () => {
    const workbook = await newWorkbook();
    const sheet = workbook.getSelectedWorksheet();
    const { container, unmount } = await mount(workbook);

    await selectTab(container, 'Border');
    await act(async () => { await sheet.getRange('A1:B2').select(); });

    // A range's style object is cell-shaped: its own `getBottom()` answers for the anchor (A1),
    // whose bottom edge is the INNER rule. Drawing the block's bottom and reading it back off the
    // anchor reports nothing — which is what made the bottom and right edges feel unclickable.
    const bottom = () => container.querySelector('button[aria-label="Bottom Borders"]') as HTMLButtonElement;
    await act(async () => { bottom().click(); });
    expect(sheet.getRange('A2').getStyle().getBorders().getBottom().getStyle()).toBe('thin');
    expect(bottom().getAttribute('aria-pressed')).toBe('true');

    // So the toggle can actually turn it back off.
    await act(async () => { bottom().click(); });
    expect(sheet.getRange('A2').getStyle().getBorders().getBottom().isNone()).toBe(true);
    expect(bottom().getAttribute('aria-pressed')).toBe('false');

    await unmount();
  });
});
