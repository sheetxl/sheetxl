import { describe, it, expect } from 'vitest';

import { createElement, act, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, type ICalculation, type ICellRanges } from '@sheetxl/sdk';

import { getReferenceMode } from '@sheetxl/react';

import { OptionsDialog } from '@sheetxl/utils-mui';

import { FormulaField } from '../form';
import { TableNewDialog } from '../dialog/TableNewDialog';

/**
 * Mount/interaction smoke tests for the MUI FormulaField — guards against update-depth loops (a
 * dialog opening with this field must not recurse) and locks the value→text round-trip (no
 * double-qualified `Sheet1!Sheet1!` addresses). Most cases exercise the `'reference'` grammar (the
 * dialogs' shape); the `'formula'` default gets its own smoke test at the end.
 */
describe('FormulaField (mount)', () => {
  const mount = async (props: Record<string, unknown>): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(FormulaField as never, { grammar: 'reference', ...props })); });
    return {
      container,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('mounts with a null value (new-table dialog shape) without update loops', async () => {
    const { container, unmount } = await mount({ value: null });
    expect(container.querySelector('input')).toBeTruthy();
    await unmount();
  });

  it('mounts with a WORKBOOK-scoped ranges value and shows it sheet-qualified exactly once', async () => {
    const workbook = new Workbook();
    const ranges = workbook.getRanges('Sheet1!G6:H12');
    const { container, unmount } = await mount({ value: ranges, workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input?.value).toBe('Sheet1!G6:H12');
    expect(input?.value.match(/Sheet1!/g)?.length ?? 0).toBe(1); // qualified once, never doubled
    await unmount();
  });

  it('mounts with the insert-table command shape (SHEET-scoped, getFixed) without update loops', async () => {
    // Exactly what `upsertTable` passes the dialog: the selection's FIXED ($-flagged) ranges.
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('B2:D5').select();
    const ranges = sheet.getSelectedRanges().getFixed(true);
    const { container, unmount } = await mount({ value: ranges, workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    // BARE, because the value is sheet-scoped — the ranges' own address, taken as given. (`$` flags
    // survive for the same reason: nothing here rebuilds the address from numeric coords.)
    expect(input?.value).toBe('$B$2:$D$5');
    await unmount();
  });

  // ── The anchor: `home` + `allowCrossSheet` (the single-sheet input contract) ────────────────────

  /** Type `text` into the field (engaging it), then read back its value + error text. */
  const typeInto = async (input: HTMLInputElement, text: string): Promise<void> => {
    await act(async () => { input.focus(); });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('CONFINED field rejects a typed cross-sheet reference', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getWorksheets().add({ name: 'Second' });
    let latest: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      value: 'B2:D5', workbook, allowCrossSheet: false, home: { scope: 'Sheet1' },
      onChangeInput: (v: ICalculation.IFormula | null) => { latest = v; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, 'Second!A1:B2');
    // The text stands (the user is mid-edit) but it is not a VALUE — no change fires, and the field
    // shows the error. A confined field must never hand its host an off-sheet range.
    expect(latest).toBeUndefined();
    expect(container.textContent).toContain('same sheet');
    // ...and a same-sheet edit is accepted normally.
    await typeInto(input, 'A1:B2');
    expect((latest as unknown as ICalculation.IFormula | null)?.getReferences()?.toString()).toBe('Sheet1!A1:B2');
    await unmount();
  });

  it('UNCONFINED field (the default) accepts a cross-sheet reference', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getWorksheets().add({ name: 'Second' });
    let latest: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      value: null, workbook, onChangeInput: (v: ICalculation.IFormula | null) => { latest = v; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, 'Second!A1:B2');
    expect((latest as unknown as ICalculation.IFormula | null)?.getReferences()?.toString()).toBe('Second!A1:B2');
    await unmount();
  });

  it('bare text resolves against `home`, not the SELECTED sheet', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const second = workbook.getWorksheets().add({ name: 'Second' });
    await second.select(); // the user is looking at another tab than the field's anchor
    let latest: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      value: null, workbook, allowCrossSheet: false, home: { scope: 'Sheet1' },
      onChangeInput: (v: ICalculation.IFormula | null) => { latest = v; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, 'A1:B2');
    // Anchored: `A1:B2` means Sheet1 because that is the field's home. Without the anchor this read
    // `Second!A1:B2` — the same text meaning different cells depending on the visible tab.
    expect((latest as unknown as ICalculation.IFormula | null)?.getReferences()?.toString()).toBe('Sheet1!A1:B2');
    await unmount();
  });

  it('publishes its confinement on the reference bus (what gates the grid panes)', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getWorksheets().add({ name: 'Second' });
    const confined = await mount({
      value: null, workbook, allowMulti: false, allowCrossSheet: false, home: { scope: 'Sheet1' }
    });
    await act(async () => { (confined.container.querySelector('input') as HTMLInputElement).focus(); });
    // `SheetReferenceLayer` reads exactly these two: `scope` locks every other pane out of the
    // gesture, `allowMulti` gates the Ctrl+click append.
    expect(getReferenceMode()?.scope).toBe('Sheet1');
    expect(getReferenceMode()?.allowMulti).toBe(false);
    await confined.unmount();

    const open = await mount({ value: null, workbook });
    await act(async () => { (open.container.querySelector('input') as HTMLInputElement).focus(); });
    expect(getReferenceMode()?.scope).toBeUndefined(); // unconfined: every sheet is pickable
    await open.unmount();
  });

  it('an anchored field DISPLAYS its home sheet bare and only cross-sheet qualified', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getWorksheets().add({ name: 'Second' });
    // A workbook-scoped (qualified) value, but the field is anchored to that same sheet: it displays
    // bare, so a committed value round-trips to the text the picker writes.
    const home = { scope: 'Sheet1' };
    const onHome = await mount({ value: workbook.getRanges('Sheet1!G6:H12'), workbook, home });
    expect((onHome.container.querySelector('input') as HTMLInputElement).value).toBe('G6:H12');
    await onHome.unmount();

    const offHome = await mount({ value: workbook.getRanges('Second!G6:H12'), workbook, home });
    expect((offHome.container.querySelector('input') as HTMLInputElement).value).toBe('Second!G6:H12');
    await offHome.unmount();
  });

  it('OptionsDialog with a PLAIN input opens without loops (dialog-shell baseline)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(OptionsDialog as never, { open: true, title: 'x', options: ['Ok'] },
        createElement('input', { defaultValue: 'plain' })));
    });
    expect(container.querySelector('input') ?? document.querySelector('input')).toBeTruthy();
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('OptionsDialog with a FormulaField opens without loops', async () => {
    const workbook = new Workbook();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(OptionsDialog as never, { open: true, title: 'x', options: ['Ok'] },
        createElement(FormulaField as never, { grammar: 'reference', value: null, workbook })));
    });
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('CommandContext.resolveRanges accepts the always-scoped display text', () => {
    // The field serializes ALWAYS sheet-qualified; hosts that convert field text back to ranges
    // (e.g. through `CommandContext.resolveRanges`) must round-trip a qualified address. (The field
    // itself now parses natively — its deprecated `resolve` hook was removed.)
    const workbook = new Workbook();
    const resolveRanges = (address: any) => workbook.getRanges(address).getFixed(true);
    const parsed = resolveRanges('Sheet1!B2:D5');
    expect(parsed.getCount()).toBe(1);
    expect(parsed.at(0).getCoords()).toMatchObject({ rowStart: 1, colStart: 1, rowEnd: 4, colEnd: 3 });
    // Quoted (space-bearing) sheet names must round-trip too — the field always quotes via the SDK.
    workbook.addWorksheet('My Sheet');
    const quotedDirect = workbook.getRanges(`'My Sheet'!B2:D5`);
    expect(quotedDirect.at(0).getWorksheet().getName()).toBe('My Sheet');
    const quoted = resolveRanges(`'My Sheet'!B2:D5`);
    expect(quoted.getCount()).toBe(1);
    expect(quoted.at(0).getWorksheet().getName()).toBe('My Sheet');
  });

  it('TableNewDialog opens without update loops', async () => {
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('B2:D5').select();
    const ranges = sheet.getSelectedRanges().getFixed(true);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(TableNewDialog as never, {
        open: true,
        initialValue: { ranges, hasHeader: false },
        context: () => ({
          getNames: () => sheet.getNames(),
          resolveRanges: (address: any) => workbook.getRanges(address).getFixed(true),
          table: () => null, styles: () => null
        }),
        onInput: () => {}
      }));
    });
    // The dialog PORTALS its content to the body — query the document, not the render container.
    const input = document.querySelector('.sxl-formula-field input') as HTMLInputElement;
    expect(input).toBeTruthy();
    // BARE: `upsertTable` hands the dialog SHEET-scoped ranges, and a table lives on one sheet — the
    // same form `TableDetailsPanel` shows for an existing table's range. Absolute markers preserved.
    expect(input.value).toBe('$B$2:$D$5');
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('round-trips a TABLE range (TableDetailsPanel shape) without an error state', async () => {
    const workbook = new Workbook();
    const sheet = workbook.getSelectedWorksheet();
    const table = sheet.getTables().add(sheet.getRange('A3:D9'), { hasHeader: true });
    // The panel's exact value shape: the table's own address text, absolute, bare (unqualified —
    // the panel's table lives on the displayed sheet). The field's own parse must round-trip it.
    const value = table.getRange().getFixed(true).toString();
    const { container, unmount } = await mount({ value, workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    const shown = input.value;
    // A table's range is absolute — the display keeps its `$` markers (Excel's Create-Table shape).
    expect(shown).toContain('$A$3:$D$9');
    // Simulate the user touching the text (any change runs the live parse): re-enter the SAME text.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, shown);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The display text must be re-parsable by the field's own (native) parse — no error.
    const helper = container.querySelector('.MuiFormHelperText-root');
    expect(helper?.textContent ?? '').not.toContain('Invalid');
    expect(container.querySelector('.Mui-error')).toBeFalsy();
    await unmount();
  });

  it('keeps F4 absolute markers through a CONTROLLED value round-trip (NamedReferenceDialog shape)', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady(); // F4's `$`-cycle tokenizes a temporary formula — needs a ready calc
    const initial = workbook.getRanges('A1');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // A host that echoes onChangeInput straight back into `value` — exactly what the named-range /
    // table dialogs do. Before the serialize fix this made F4 appear dead: F4 rewrote the text to
    // `$A$1`, the echo re-derived the value, and the display re-stripped it back to `A1`.
    const Controlled = () => {
      const [value, setValue] = useState<ICalculation.IFormula | ICellRanges | string | null>(() => initial);
      return createElement(FormulaField as never, { grammar: 'reference', value, workbook, onChangeInput: setValue });
    };
    await act(async () => { root.render(createElement(Controlled)); });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Sheet1!A1');
    // Focus (engage) + park the caret on the reference, then press F4.
    await act(async () => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', bubbles: true }));
    });
    // Absolute now — and it STAYS absolute after the controlled echo re-derives the display text.
    expect(input.value).toBe('Sheet1!$A$1');
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('an UNANCHORED field writes a pick made on ANOTHER sheet fully qualified', async () => {
    // The named-range dialog's shape: no `home`, so there is no bare form — every reference the picker
    // writes has to name its sheet, whichever pane the gesture landed on.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getWorksheets().add({ name: 'Second' });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const Controlled = () => {
      const [value, setValue] = useState<ICalculation.IFormula | ICellRanges | string | null>(
        () => workbook.getRanges('Sheet1!$B$2:$D$5')
      );
      return createElement(FormulaField as never, {
        grammar: 'reference', value, workbook, onChangeInput: setValue, pickAs: 'absolute', allowMulti: true
      });
    };
    await act(async () => { root.render(createElement(Controlled)); });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Sheet1!$B$2:$D$5');
    await act(async () => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); });
    const sel = getReferenceMode()!.selection!;
    // Exactly what a grid draw on the `Second` pane produces: `RangesPickerLayer` re-scopes the ACTIVE
    // range in place and `SheetReferenceLayer`'s `scopeDrawnRanges` stamps the drawing pane's sheet.
    await act(async () => {
      const cur = sel.getCoords();
      sel.updateCoords({
        ...cur,
        ranges: [{ rowStart: 0, colStart: 0, rowEnd: 0, colEnd: 0, scope: 'Second' }],
        rangeIndex: 0
      } as never);
    });
    // The caret parks a frame after the write-back (the controlled value swap lands first).
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    expect(input.value).toBe('Second!$A$1');
    await act(async () => { root.unmount(); });
    container.remove();
  });

  // ArrowDown with `which`/`keyCode` stamped — the point-nav keymap reads them.
  const arrowDown = (): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'which', { value: 40 });
    Object.defineProperty(ev, 'keyCode', { value: 40 });
    return ev;
  };

  it('LIVE mode: arrows PICK for the whole engagement — no F2 required', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const { container, unmount } = await mount({ value: 'Sheet1!B2', workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    // Armed from focus: ArrowDown re-scopes the reference one cell down, straight away.
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('Sheet1!B3');
    // Still armed after the pick — the next arrow keeps picking (arm on focus, gone on blur).
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('Sheet1!B4');
    await unmount();
  });

  it("DONE mode: armed on focus; TYPING drops to caret-edit; a pick re-arms", async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const onDone = (): void => {};
    const { container, unmount } = await mount({ value: 'Sheet1!B2', workbook, changeOn: 'done', onDone });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    // Armed on focus — no F2 required here either.
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('Sheet1!B3');
    // Typing = the field is being edited as TEXT → arrows become caret keys.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, 'Sheet1!C1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('Sheet1!C1'); // unchanged — the arrow moved the caret, not the pick
    await unmount();
  });

  it('select-current adornment copies the sheet RANGE SELECTION into the field', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getSelectedWorksheet().getRange('C3:D7').select();
    const { container, unmount } = await mount({ value: null, workbook });
    const btn = container.querySelector('[aria-label="select-current-range"]') as HTMLElement;
    expect(btn).toBeTruthy();
    await act(async () => { btn.click(); });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Sheet1!C3:D7');
    await unmount();
  });

  // ── The leading `=` display rule (`'formula'` grammar) ─────────────────────────────────────────

  /** Mount a formula-grammar field on `value` and read back the text it displays. */
  const formulaText = async (workbook: unknown, value: unknown, props = {}): Promise<string> => {
    const { container, unmount } = await mount({ grammar: 'formula', value, workbook, ...props });
    const shown = (container.querySelector('input') as HTMLInputElement).value;
    await unmount();
    return shown;
  };

  it('a FORMULA-grammar field ALWAYS displays the `=`, whatever shape the value came in as', async () => {
    // The `=` belongs to the FIELD, not to the value — a reference is simply the commonest formula.
    // It used to depend on which shape the host passed (an `IFormula` gained one, an equivalent
    // `string` did not), which is what made the prefix look arbitrary.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    expect(await formulaText(workbook, 'Sheet1!$A$1:$B$2')).toBe('=Sheet1!$A$1:$B$2');
    expect(await formulaText(workbook, '=Sheet1!$A$1')).toBe('=Sheet1!$A$1'); // not doubled
    expect(await formulaText(workbook, 'SUM(A1:A9)')).toBe('=SUM(A1:A9)');
    expect(await formulaText(workbook, '42')).toBe('=42');
    // A ranges value — the same field, the same `=`, `$` flags intact.
    expect(await formulaText(workbook, workbook.getRanges('Sheet1!G6:H12'))).toBe('=Sheet1!G6:H12');
    // ...while a REFERENCE-grammar field never shows one (a typed `=` is invalid there).
    const ref = await mount({ value: 'Sheet1!$A$1:$B$2', workbook });
    expect((ref.container.querySelector('input') as HTMLInputElement).value).toBe('Sheet1!$A$1:$B$2');
    await ref.unmount();
  });

  it("`equals: 'required'` makes a missing `=` an ERROR (a name's refers-to)", async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const { container, unmount } = await mount({
      grammar: 'formula', value: 'Sheet1!$A$1', workbook, equals: 'required'
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('=Sheet1!$A$1');
    await typeInto(input, 'Sheet1!$A$1'); // the user deletes the `=`
    expect(container.querySelector('.Mui-error')).toBeTruthy();
    expect(container.textContent).toContain("must start with '='");
    await unmount();
  });

  // ── `pickAs` — what a fresh pick lands as ──────────────────────────────────────────────────────

  it('a pick lands RELATIVE by default and ABSOLUTE under `pickAs`', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getSelectedWorksheet().getRange('C3:D7').select();

    const relative = await mount({ value: null, workbook }); // the cell editor's default
    await act(async () => {
      (relative.container.querySelector('[aria-label="select-current-range"]') as HTMLElement).click();
    });
    expect((relative.container.querySelector('input') as HTMLInputElement).value).toBe('Sheet1!C3:D7');
    await relative.unmount();

    // A defined name / a table's range: the region is FIXED, not relative to whoever reads it.
    const absolute = await mount({ value: null, workbook, pickAs: 'absolute' });
    await act(async () => {
      (absolute.container.querySelector('[aria-label="select-current-range"]') as HTMLElement).click();
    });
    expect((absolute.container.querySelector('input') as HTMLInputElement).value).toBe('Sheet1!$C$3:$D$7');
    await absolute.unmount();
  });

  it('RE-SCOPING an existing reference keeps ITS `$` flags, `pickAs` notwithstanding', async () => {
    // A pick moves where a reference POINTS; it does not restyle it. Partial fixability especially
    // has no other way to survive a drag.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    for (const [before, after] of [
      ['Sheet1!$B$2', 'Sheet1!$B$3'],  // fully fixed stays fully fixed...
      ['Sheet1!B2', 'Sheet1!B3'],      // ...relative stays relative (against `pickAs: 'absolute'`)
      ['Sheet1!$B2', 'Sheet1!$B3'],    // ...and a PARTIAL one keeps exactly its own flags
      ['Sheet1!B$2', 'Sheet1!B$3']
    ]) {
      const { container, unmount } = await mount({ value: before, workbook, pickAs: 'absolute' });
      const input = container.querySelector('input') as HTMLInputElement;
      await act(async () => { input.focus(); });
      await act(async () => { input.dispatchEvent(arrowDown()); }); // re-scope one cell down
      expect(input.value).toBe(after);
      await unmount();
    }
  });

  it('a pick of a spill\'s extent writes `#` only under `pickSpills`', async () => {
    const workbook = new Workbook();
    workbook.getRange('Sheet1!D2').setValue('=SEQUENCE(3,2)'); // D2:E4
    await workbook.whenCalculationReady();
    workbook.getSelectedWorksheet().getRange('D2:E4').select();

    const pickWith = async (props: Record<string, unknown>): Promise<string> => {
      const { container, unmount } = await mount({ value: null, workbook, ...props });
      await act(async () => {
        (container.querySelector('[aria-label="select-current-range"]') as HTMLElement).click();
      });
      const text = (container.querySelector('input') as HTMLInputElement).value;
      await unmount();
      return text;
    };
    expect(await pickWith({})).toBe('Sheet1!D2:E4'); // Excel's fields
    expect(await pickWith({ pickSpills: true })).toBe('Sheet1!D2#');
    expect(await pickWith({ pickSpills: true, pickAs: 'absolute' })).toBe('Sheet1!$D$2#');

    // Not the whole extent: an address, flag or not.
    workbook.getSelectedWorksheet().getRange('D2:E3').select();
    expect(await pickWith({ pickSpills: true })).toBe('Sheet1!D2:E3');
  });

  it('`pickAs` is a default, not a constraint — typed text stands as typed', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    let latest: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      value: null, workbook, pickAs: 'absolute',
      onChangeInput: (v: ICalculation.IFormula | null) => { latest = v; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, 'Sheet1!C3:D7'); // relative, by hand
    expect(input.value).toBe('Sheet1!C3:D7'); // untouched
    expect((latest as unknown as ICalculation.IFormula | null)?.getReferences()?.toString())
      .toBe('Sheet1!C3:D7');
    await unmount();
  });

  it('select-current works for a plain CELL selection (empty coords.ranges)', async () => {
    // A plain grid CLICK-selection carries only its anchor `cell` — `coords.ranges` is EMPTY (the
    // range is implied). Reading raw coords made the adornment a silent no-op for the most common
    // selection there is; it must go through `getSelectedRanges()`, which materializes the implied
    // range. (Reproduced live in the Table Details pane.)
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getSelection().updateCoords({ cell: { rowIndex: 3, colIndex: 2 }, ranges: [], rangeIndex: -1 });
    const { container, unmount } = await mount({ value: null, workbook });
    const btn = container.querySelector('[aria-label="select-current-range"]') as HTMLElement;
    await act(async () => { btn.click(); });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Sheet1!C4');
    await unmount();
  });

  it('an UNANCHORED FORMULA field qualifies a pick — the visible tab is not its home', async () => {
    // `NamedEditorPanel`'s wiring (the Name Manager's "refers to"): formula grammar, NO `home`, `=`
    // required, absolute picks, raw text written to the draft. A name is read from wherever it is
    // USED, so a bare `$C$14:$D$18` in its expression names no sheet at all once the field is gone —
    // even a pick made on the very sheet that happens to be showing has to carry its name.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let draft = '';
    await act(async () => {
      root.render(createElement(FormulaField as never, {
        value: '=Sheet1!$H$8:$J$16', workbook, equals: 'required', pickAs: 'absolute',
        onChangeText: (text: string) => { draft = text; }
      }));
    });
    const input = container.querySelector('input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { input.focus(); });
    await act(async () => {
      const next = `${input.value}+`; // an operand is expected now → point mode arms, insert-armed
      setter.call(input, next);
      input.setSelectionRange(next.length, next.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(getReferenceMode()?.mode).toBe('point');
    // The grid drag: insert-armed (`rangeIndex < 0`), so `RangesPickerLayer` APPENDS the drawn range
    // and `SheetReferenceLayer`'s `scopeDrawnRanges` stamps the drawing pane's sheet onto it.
    const sel = getReferenceMode()!.selection!;
    await act(async () => {
      const cur = sel.getCoords();
      sel.updateCoords({
        ...cur,
        ranges: [...(cur.ranges ?? []), { rowStart: 13, colStart: 2, rowEnd: 17, colEnd: 3, scope: 'Sheet1' }],
        rangeIndex: (cur.ranges ?? []).length
      } as never);
    });
    // The caret parks a frame after the write-back (the controlled value swap lands first).
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
    expect(input.value).toBe('=Sheet1!$H$8:$J$16+Sheet1!$C$14:$D$18');
    expect(draft).toBe('=Sheet1!$H$8:$J$16+Sheet1!$C$14:$D$18');
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it("FORMULA grammar (the default): a full expression mounts, displays as typed, and parses clean", async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(FormulaField as never, { value: '=SUM(A1:B2)*2', workbook }));
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input?.value).toBe('=SUM(A1:B2)*2');
    expect(container.querySelector('.Mui-error')).toBeFalsy();
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('FORMULA grammar: tokens light up when the calculation becomes READY — no text change needed', async () => {
    // The storybook shape: the field mounts with a seeded value BEFORE the calc engine has loaded
    // (`createFormula` throws "Calculation is starting"), so the first parse yields no
    // tokens. Readiness alone must re-parse — nothing else changes.
    const workbook = new Workbook();
    const apiRef: { current: { tokens: readonly unknown[] | null } | null } = { current: null };
    const { unmount } = await mount({ grammar: 'formula', value: '=SUM(B2)*2', workbook, apiRef });
    await act(async () => { await workbook.whenCalculationReady(); });
    expect(apiRef.current?.tokens?.length ?? 0).toBeGreaterThan(0);
    await unmount();
  });

  it('FORMULA grammar: select-current is caret-gated — disabled mid-token, RE-SCOPES on a reference', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getSelectedWorksheet().getRange('C3:D7').select();
    // ANCHORED (the Insert Function argument field's shape) so the landing reads bare — this is about
    // WHERE a pick lands, not how it is addressed. An unanchored field qualifies instead; see
    // 'an UNANCHORED FORMULA field qualifies a pick'.
    const { container, unmount } = await mount({
      grammar: 'formula', value: '=SUM(B2)', workbook, home: { scope: 'Sheet1' }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    // `ExhibitIconButton` renders `IconButton component="div"` — no `<button>`, no `.disabled`
    // property; the disabled state is the `Mui-disabled` class on the aria-labeled root.
    const btn = (): HTMLElement =>
      container.querySelector('[aria-label="select-current-range"]') as HTMLElement;
    const btnDisabled = (): boolean => btn().classList.contains('Mui-disabled');
    await act(async () => { input.focus(); });
    const caretTo = async (at: number): Promise<void> => {
      await act(async () => {
        input.setSelectionRange(at, at);
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
      });
    };
    // Caret inside `SUM`: no landing — the action must be DISABLED (it used to splice mid-token).
    await caretTo(2);
    expect(btnDisabled()).toBe(true);
    // Caret on the reference: enabled, and the click REPLACES `B2` (the grid-pick landing).
    await caretTo(7);
    expect(btnDisabled()).toBe(false);
    await act(async () => { btn().click(); });
    expect(input.value).toBe('=SUM(C3:D7)');
    await unmount();
  });

  it('FORMULA grammar: a SHOW-only engagement releases on blur — the highlight follows the active editor', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const apiRef: { current: { engaged: boolean; pointArmed: boolean } | null } = { current: null };
    const { container, unmount } = await mount({ grammar: 'formula', value: '=SUM(B2)', workbook, apiRef });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    // Caret on the function name: engaged (references displayed) but NOT armed — show mode.
    await act(async () => {
      input.setSelectionRange(2, 2);
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
    });
    expect(apiRef.current?.engaged).toBe(true);
    expect(apiRef.current?.pointArmed).toBe(false);
    // Click away (focus to nothing focusable): the viewing session ends — no lingering grid ranges.
    await act(async () => { input.blur(); });
    expect(apiRef.current?.engaged).toBe(false);
    await unmount();
  });

  it('FORMULA grammar: the CARET decides arming — a function name is caret work, a reference re-scopes', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    // Anchored, for the same reason as the select-current case above: the assertion is about WHICH
    // reference the arrow moves, so the bare landing keeps it readable.
    const { container, unmount } = await mount({
      grammar: 'formula', value: '=SUM(B2)', workbook, home: { scope: 'Sheet1' }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    // Move the caret the way a user does — the trailing keyup is what fires React's `onSelect`
    // (jsdom's bare `setSelectionRange` doesn't reach the select plugin).
    const caretTo = async (at: number): Promise<void> => {
      await act(async () => {
        input.setSelectionRange(at, at);
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'End', bubbles: true }));
      });
    };
    // Caret inside `SUM` — no operand expected, not a reference: the arrow must NOT pick.
    await caretTo(2);
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('=SUM(B2)');
    // Caret at the reference's edge: the arrow RE-SCOPES it (the cell editor's model).
    await caretTo(7);
    await act(async () => { input.dispatchEvent(arrowDown()); });
    expect(input.value).toBe('=SUM(B3)');
    await unmount();
  });

  it('FORMULA grammar: typing `=SU` offers the function dropdown; Enter accepts to `=SUM(`', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const { container, unmount } = await mount({ grammar: 'formula', value: null, workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, '=SU');
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // The shared hints hook derived matches and the float portaled the list to the body (the float
    // opens through a rAF/timer tick — give it a beat to settle).
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.body.textContent).toContain('SUMIF');
    // Enter accepts the highlighted row (the list is alphabetical — SUBSTITUTE tops the `SU`
    // matches) — spliced as `NAME(`, caret parked inside the paren.
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(enter, 'which', { value: 13 });
    Object.defineProperty(enter, 'keyCode', { value: 13 });
    await act(async () => { input.dispatchEvent(enter); });
    expect(input.value).toBe('=SUBSTITUTE(');
    await unmount();
  });

  it('FORMULA grammar: completing a NAME takes one Tab, and the NEXT Tab commits', async () => {
    // Excel's two-tab contract: the first Tab closes the list on the completed name, the second is
    // the commit. A completed name still prefix-matches ITSELF, so re-deriving the list from the
    // accepted text re-opened it and ate that second Tab — visible only when the accept CHANGED the
    // text (`=na` → `=Name`), which is why a fully-typed name needed two tabs and a partial three.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    workbook.getNames().addFormula('MyName', '=Sheet1!$D$1');
    let done: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      grammar: 'formula', value: null, workbook,
      onDone: (value: ICalculation.IFormula | null) => { done = value; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, '=myn');
      input.setSelectionRange(4, 4);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.body.textContent).toContain('MyName');

    const tab = (): KeyboardEvent => {
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'which', { value: 9 });
      Object.defineProperty(ev, 'keyCode', { value: 9 });
      return ev;
    };
    // Tab 1 — accepts the row (a name goes in bare, caret at its end) and consumes the key.
    const first = tab();
    await act(async () => { input.dispatchEvent(first); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(input.value).toBe('=MyName');
    expect(first.defaultPrevented).toBe(true);
    expect(done).toBeUndefined();
    // Tab 2 — the list is gone, so this one reaches the field and commits.
    await act(async () => { input.dispatchEvent(tab()); });
    expect(done).not.toBeUndefined();
    await unmount();
  });

  it('text AutoCorrect repairs is no error, and commits as the repair', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    let done: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      grammar: 'formula', value: null, workbook,
      onDone: (value: ICalculation.IFormula | null) => { done = value; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, '=SUM(1,2');
    expect(container.querySelector('.Mui-error')).toBeNull();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    Object.defineProperty(tab, 'which', { value: 9 });
    Object.defineProperty(tab, 'keyCode', { value: 9 });
    await act(async () => { input.dispatchEvent(tab); });
    expect(input.value).toBe('=SUM(1,2)');
    expect((done as ICalculation.IFormula | null | undefined)?.getExpression()).toBe('SUM(1,2)');
    await unmount();
  });

  it('text with no safe repair is still an error', async () => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const { container, unmount } = await mount({ grammar: 'formula', value: null, workbook, onDone: () => {} });
    const input = container.querySelector('input') as HTMLInputElement;
    await typeInto(input, '=SUM(1,,)+)');
    await act(async () => { input.blur(); });
    expect(container.querySelector('.Mui-error')).toBeTruthy();
    expect(input.value).toBe('=SUM(1,,)+)');
    await unmount();
  });

  it('the keys the INPUT owns never escape it (the same rule as InputField)', async () => {
    // `Delete` typed here must delete a character, not run the sheet's `clearContents` — the app
    // dispatches shortcuts from an ancestor seam and the sheet scope is origin-unrestricted. Consumed
    // with `stopPropagation` only; the native edit still happens.
    const workbook = new Workbook();
    const { container, unmount } = await mount({ value: workbook.getRanges('A1:B3'), workbook });
    const input = container.querySelector('input') as HTMLInputElement;
    const escaped: string[] = [];
    const listener = (e: Event): void => { escaped.push((e as KeyboardEvent).key); };
    document.addEventListener('keydown', listener);
    await act(async () => { input.focus(); });
    for (const key of ['Delete', 'Backspace', 'Home', 'End']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      await act(async () => { input.dispatchEvent(ev); });
      expect(ev.defaultPrevented, key).toBe(false);
    }
    expect(escaped).toEqual([]);
    document.removeEventListener('keydown', listener);
    await unmount();
  });

  it('an ABOVE label names the input, and the error can be routed out of the field', async () => {
    // The argument-form shape: the label is a line of its own above the field (so a host can center
    // something beside the block and land on the field's text), and the message goes to the host —
    // the field keeps the outline, and its helper line stays RESERVED so the block stays symmetric.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const errors: (string | null)[] = [];
    const { container, unmount } = await mount({
      grammar: 'formula', value: null, workbook,
      labelPlacement: 'above', label: 'number1', showError: false,
      onChangeError: (error: string | null) => { errors.push(error); }
    });

    const input = container.querySelector('input') as HTMLInputElement;
    const label = container.querySelector('label') as HTMLLabelElement;
    expect(label?.textContent).toBe('number1');
    // Associated by id — `FormulaField` owns the input's, so the host cannot supply an `htmlFor`.
    expect(label.htmlFor).toBe(input.id);
    expect(input.id).toBeTruthy();

    await typeInto(input, '1)');
    // The message reached the host...
    expect(errors.filter(Boolean)).toHaveLength(1);
    // ...the field still reads as wrong...
    expect(container.querySelector('.Mui-error')).toBeTruthy();
    // ...and the helper line is RESERVED but silent — MUI renders a blank line as a zero-width
    // space, so what is asserted is that no message reached it.
    const helper = container.querySelector('.MuiFormHelperText-root');
    expect(helper).toBeTruthy();
    expect(helper?.textContent ?? '').not.toMatch(/\p{Letter}/u);
    await unmount();
  });

  it('`helperText: null` COLLAPSES the line — `undefined` still reserves it', async () => {
    // The two are the same value to `??`, which is why the collapse is decided by an identity check
    // against `undefined`. A form of many fields (the argument panel) pays ~24px per field for a line
    // it has routed its messages out of, and nothing can ever land in.
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const collapsed = await mount({
      grammar: 'formula', value: null, workbook,
      labelPlacement: 'above', label: 'number1', showError: false, helperText: null
    });
    expect(collapsed.container.querySelector('.MuiFormHelperText-root')).toBeNull();
    // An error the field was told not to show cannot bring the line back either — the block's height
    // is what the host aligned to.
    await typeInto(collapsed.container.querySelector('input') as HTMLInputElement, '1)');
    expect(collapsed.container.querySelector('.Mui-error')).toBeTruthy();
    expect(collapsed.container.querySelector('.MuiFormHelperText-root')).toBeNull();
    await collapsed.unmount();

    const reserved = await mount({ grammar: 'formula', value: null, workbook });
    expect(reserved.container.querySelector('.MuiFormHelperText-root')).toBeTruthy();
    await reserved.unmount();
  });

  it('survives focus (engage) + typing without update loops or spurious changes', async () => {
    const workbook = new Workbook();
    const ranges = workbook.getRanges('A1:B3');
    let latest: ICalculation.IFormula | null | undefined = undefined;
    const { container, unmount } = await mount({
      value: ranges, workbook, onChangeInput: (v: ICalculation.IFormula | null) => { latest = v; }
    });
    const input = container.querySelector('input') as HTMLInputElement;
    await act(async () => { input.focus(); });
    expect(document.activeElement).toBe(input);
    expect(latest).toBeUndefined(); // no spurious change from mount/focus alone
    await unmount();
  });
});
