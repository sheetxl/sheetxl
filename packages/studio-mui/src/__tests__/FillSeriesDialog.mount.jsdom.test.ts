import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, IRange, AutoFill, type ICellRange } from '@sheetxl/sdk';

import { WorkbookProvider, type CommandContext } from '@sheetxl/react';

import { FillSeriesDialog } from '../dialog/FillSeriesDialog';

/**
 * Mount tests for the Series dialog. The command test pins what the context ANSWERS; these pin what
 * the dialog does with those answers — which types it greys, which fields a type earns, and what it
 * emits.
 *
 * The context is stubbed rather than built from a sheet, so a case is one line of setup and the
 * dialog is tested against the contract it is written to rather than against the command.
 */
describe('FillSeriesDialog (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /* `Copy` applies wherever there is a value, so every realistic `offered` answer carries it. */
  const NUMERIC = [
    AutoFill.Presets.Copy.id, AutoFill.Presets.Series.id,
    AutoFill.Presets.Linear.id, AutoFill.Presets.Growth.id
  ];
  const DATES = [
    AutoFill.Presets.Copy.id, AutoFill.Presets.Series.id,
    AutoFill.Presets.DateDays.id, AutoFill.Presets.DateWeekdays.id
  ];

  interface StubOptions {
    offered?: readonly string[];
    /** What `offered` answers for a Right fill, when it differs. */
    offeredAcross?: readonly string[];
    presetId?: string;
    /** Cell texts the preview projects, in order. */
    preview?: readonly string[];
    /** The addresses `resolve` reports; `null` for a direction with no room. */
    ranges?: CommandContext.FillSeriesRanges | null;
    /** How deep the template is, when it is not the whole preview. */
    templateSize?: number;
  }

  const open = async (stub: StubOptions = {}): Promise<{
    emitted: (CommandContext.FillSeriesOptions | undefined)[];
    previewed: CommandContext.FillSeriesOptions[];
  }> => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const range: ICellRange = workbook.getSelectedWorksheet().getRange('A1:A6');
    const offered = stub.offered ?? NUMERIC;
    const emitted: (CommandContext.FillSeriesOptions | undefined)[] = [];
    const previewed: CommandContext.FillSeriesOptions[] = [];

    const texts = stub.preview ?? [];
    const ranges = stub.ranges === undefined
      ? {
          template: 'A1', destination: 'A1:A6',
          templateSize: stub.templateSize ?? 1, size: texts.length
        }
      : stub.ranges;
    const context: CommandContext.FillSeries = {
      range,
      direction: IRange.Direction.Down,
      offered: (direction: IRange.Direction): readonly string[] =>
        direction === IRange.Direction.Right ? (stub.offeredAcross ?? offered) : offered,
      resolve: (direction: IRange.Direction): CommandContext.FillSeriesRanges | null =>
        direction === IRange.Direction.Right
          ? ((stub.offeredAcross ?? offered).length === 0 ? null : ranges)
          : ranges,
      preview: (options: CommandContext.FillSeriesOptions): ICellRange | null => {
        previewed.push(options);
        if (texts.length === 0) return null;
        // Only what the strip reads is stubbed: the coords it walks, and a text per cell.
        return {
          getCoords: () => ({ rowStart: 0, rowEnd: texts.length - 1, colStart: 0, colEnd: 0 }),
          getCell: ({ rowIndex }: { rowIndex: number }) => ({ getText: () => texts[rowIndex] ?? '' })
        } as unknown as ICellRange;
      }
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(FillSeriesDialog as never, {
          open: true,
          initialValue: {
            presetId: stub.presetId ?? AutoFill.Presets.Linear.id,
            direction: IRange.Direction.Down
          },
          context: () => context,
          onInput: (value?: CommandContext.FillSeriesOptions) => { emitted.push(value); }
        } as never)));
    });
    return { emitted, previewed };
  };

  const click = async (element: Element | null): Promise<void> => {
    expect(element).toBeTruthy();
    await act(async () => { (element as HTMLElement).click(); });
  };

  /** Drive a MUI Select the way the browser does — it opens on MOUSEDOWN, not click. */
  const openTypeMenu = async (): Promise<void> => {
    const combobox = document.querySelector('.sxl-fillSeries-type [role="combobox"]') as HTMLElement;
    expect(combobox).toBeTruthy();
    await act(async () => {
      combobox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
  };

  const pickType = async (value: string): Promise<void> => {
    await openTypeMenu();
    const option = document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement;
    expect(option).toBeTruthy();
    await act(async () => { option.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  /** Every listed type, and whether the menu offers it. */
  const listedTypes = async (): Promise<Record<string, boolean>> => {
    await openTypeMenu();
    const listed: Record<string, boolean> = {};
    for (const option of Array.from(document.querySelectorAll('[role="option"]'))) {
      const value = (option as HTMLElement).dataset.value!;
      listed[value] = option.getAttribute('aria-disabled') !== 'true';
    }
    await act(async () => { document.body.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    return listed;
  };

  const fillButton = (): HTMLButtonElement => {
    const buttons = Array.from(document.querySelectorAll('button.defaultOption'));
    return buttons[buttons.length - 1] as HTMLButtonElement;
  };

  const submit = async (): Promise<void> => {
    await click(fillButton());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
  };

  const type = (selector: string, text: string): Promise<void> => act(async () => {
    const input = document.querySelector(`${selector} input`) as HTMLInputElement;
    expect(input).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /** The values row, or the standin when there is nothing to show. */
  const previewText = (): string =>
    (document.querySelector('.sxl-fillSeries-preview')
      ?? document.querySelector('.sxl-fillSeries-previewNone'))?.textContent?.trim() ?? '';

  const rangesText = (): string =>
    document.querySelector('.sxl-fillSeries-ranges')?.textContent?.trim() ?? '';

  describe('the type list', () => {
    it('lists every type and greys the ones the selection can not use', async () => {
      await open({ offered: NUMERIC });
      const listed = await listedTypes();
      // the DATE types are listed rather than hidden, so the dropdown does not change shape
      expect(listed[AutoFill.Presets.Linear.id]).toBe(true);
      expect(listed[AutoFill.Presets.Growth.id]).toBe(true);
      expect(listed[AutoFill.Presets.DateMonths.id]).toBe(false);
      expect(listed[AutoFill.Presets.DateWeekdays.id]).toBe(false);
    });

    it('lists Copy — repeating the template is a fill this dialog can offer', async () => {
      await open({ offered: NUMERIC });
      expect((await listedTypes())[AutoFill.Presets.Copy.id]).toBe(true);
    });

    it('never lists the trend presets — the Trend checkbox carries them instead', async () => {
      await open();
      const listed = await listedTypes();
      expect(listed[AutoFill.Presets.LinearTrend.id]).toBeUndefined();
      expect(listed[AutoFill.Presets.GrowthTrend.id]).toBeUndefined();
    });

    /* A heading reads as enabled while the entries under it are greyed, which says the opposite of
       what is true. A rule between the runs carries the grouping without claiming anything. */
    it('separates the runs with a rule, not with headings', async () => {
      await open({ offered: NUMERIC });
      await openTypeMenu();
      expect(document.querySelectorAll('.MuiListSubheader-root')).toHaveLength(0);
      expect(document.querySelectorAll('li.MuiDivider-root').length).toBeGreaterThan(0);
    });
  });

  describe('the fields a type earns', () => {
    it('offers step, stop and trend for a linear series', async () => {
      await open({ presetId: AutoFill.Presets.Linear.id });
      expect(document.querySelector('.sxl-fillSeries-trend')).toBeTruthy();
      expect(document.querySelector('.sxl-fillSeries-step')).toBeTruthy();
      expect(document.querySelector('.sxl-fillSeries-stop')).toBeTruthy();
    });

    it('offers no trend for a date series — Excel offers it on numbers only', async () => {
      await open({ offered: DATES, presetId: AutoFill.Presets.DateDays.id });
      expect(document.querySelector('.sxl-fillSeries-trend')).toBeNull();
      expect(document.querySelector('.sxl-fillSeries-step')).toBeTruthy();
      expect(document.querySelector('.sxl-fillSeries-stop')).toBeTruthy();
    });

    it('offers no field at all for the detected fill', async () => {
      await open({ presetId: AutoFill.Presets.Series.id });
      expect(document.querySelector('.sxl-fillSeries-trend')).toBeNull();
      expect(document.querySelector('.sxl-fillSeries-step')).toBeNull();
      expect(document.querySelector('.sxl-fillSeries-stop')).toBeNull();
    });

    /* Excel leaves both fields live under Trend and then pays them no attention. Hiding them says
       what is actually true, and the command drops the values to match. */
    it('takes the step and stop away while Trend is checked', async () => {
      await open({ presetId: AutoFill.Presets.Linear.id });
      await type('.sxl-fillSeries-step', '5');
      await click(document.querySelector('.sxl-fillSeries-trend input'));
      expect(document.querySelector('.sxl-fillSeries-step')).toBeNull();
      expect(document.querySelector('.sxl-fillSeries-stop')).toBeNull();

      await click(document.querySelector('.sxl-fillSeries-trend input'));
      expect(document.querySelector('.sxl-fillSeries-step')).toBeTruthy();
      // ... and the step it was given is still there, not lost to the round trip
      expect((document.querySelector('.sxl-fillSeries-step input') as HTMLInputElement).value).toBe('5');
    });

    it('drops a trend that the newly chosen type can not do', async () => {
      const { emitted } = await open({ offered: [...NUMERIC, AutoFill.Presets.DateDays.id] });
      await click(document.querySelector('.sxl-fillSeries-trend input'));
      await pickType(AutoFill.Presets.DateDays.id);
      await submit();
      expect(emitted[0]?.trend).toBeUndefined();
    });
  });

  describe('direction', () => {
    /* One cell deep that way is nowhere to fill. Offering the choice and then greying every type
       and the action with it says the same thing far less clearly. */
    it('does not offer a direction with no room to fill', async () => {
      await open({ offered: NUMERIC, offeredAcross: [] });
      const across = document.querySelector('.sxl-fillSeries-direction input[value="right"]') as HTMLInputElement;
      const down = document.querySelector('.sxl-fillSeries-direction input[value="down"]') as HTMLInputElement;
      expect(across.disabled).toBe(true);
      expect(down.disabled).toBe(false);
      // ... and the dialog is still perfectly able to fill the direction it does have
      expect(fillButton().disabled).toBe(false);
    });

    it('re-asks which types apply, and keeps a choice the new direction can honor', async () => {
      const { emitted } = await open({
        offered: NUMERIC,
        offeredAcross: [AutoFill.Presets.Series.id, AutoFill.Presets.Linear.id],
        presetId: AutoFill.Presets.Linear.id
      });
      await click(document.querySelector('.sxl-fillSeries-direction input[value="right"]'));
      await submit();
      expect(emitted[0]?.direction).toBe(IRange.Direction.Right);
      expect(emitted[0]?.presetId).toBe(AutoFill.Presets.Linear.id);
    });

    it('falls back to a type the new direction CAN honor', async () => {
      const { emitted } = await open({
        offered: NUMERIC,
        offeredAcross: [AutoFill.Presets.Series.id],
        presetId: AutoFill.Presets.Growth.id
      });
      await click(document.querySelector('.sxl-fillSeries-direction input[value="right"]'));
      await submit();
      // Growth does not apply across, so the dialog moves rather than sitting on a greyed choice
      expect(emitted[0]?.presetId).toBe(AutoFill.Presets.Series.id);
    });
  });

  describe('the ranges it reports', () => {
    it('heads each column with the address whose values sit under it', async () => {
      await open({
        ranges: { template: 'A1:A3', destination: 'A1:A8', templateSize: 3, size: 8 }
      });
      // one row: the template address, the rule and its arrowhead, the destination address
      /* One row of three elements, so the gaps between them are CSS rather than text. */
      expect(rangesText()).toBe('A1:A3\u2192A1:A8');
    });

    it('follows the direction', async () => {
      await open({
        offered: NUMERIC, offeredAcross: NUMERIC,
        ranges: { template: 'A1:A3', destination: 'A1:A8', templateSize: 3, size: 8 }
      });
      await click(document.querySelector('.sxl-fillSeries-direction input[value="right"]'));
      /* One row of three elements, so the gaps between them are CSS rather than text. */
      expect(rangesText()).toBe('A1:A3\u2192A1:A8');
    });
  });

  describe('blank fields', () => {
    /* Blank does not mean zero. The step is read off the selection; the stop is unbounded. Two
       different nothings, so two different placeholders. */
    it('says what a blank step and a blank stop mean', async () => {
      await open({ presetId: AutoFill.Presets.Linear.id });
      expect((document.querySelector('.sxl-fillSeries-step input') as HTMLInputElement).placeholder)
        .toBe('Auto');
      expect((document.querySelector('.sxl-fillSeries-stop input') as HTMLInputElement).placeholder)
        .toBe('None');
    });
  });

  describe('preview', () => {
    /* Only what the fill WRITES: the template's values are on the sheet behind the dialog, and the
       header's address already names them. */
    it('shows the whole fill where it fits, with nothing elided', async () => {
      await open({ preview: ['1', '2', '3', '4', '5'], templateSize: 3 });
      expect(previewText()).toBe('1, 2, 3, 4, 5');
    });

    it('elides the middle when the fill runs past the line, keeping the LAST value', async () => {
      const long = Array.from({ length: 40 }, (_v, i: number): string => String((i + 1) * 3));
      await open({ preview: long, templateSize: 1 });
      const shown = previewText();
      expect(shown.startsWith('3, 6, 9, 12')).toBe(true);
      // the last value is what a long fill is judged by, so it is never the part that goes
      expect(shown.endsWith('… 120')).toBe(true);
    });

    it('shows a lone value once', async () => {
      await open({ preview: ['7'], templateSize: 1 });
      expect(previewText()).toBe('7');
    });

    it('marks a cell the fill leaves empty — which is where a stop bites', async () => {
      await open({ preview: ['1', '3', '5', '', ''], templateSize: 1 });
      expect(previewText()).toBe('1, 3, 5, –, –');
    });

    it('re-asks as the settings change, with what the fill would actually run', async () => {
      const { previewed } = await open({ preview: ['1'] });
      const before = previewed.length;
      await type('.sxl-fillSeries-step', '4');
      expect(previewed.length).toBeGreaterThan(before);
      expect(previewed[previewed.length - 1].stepValue).toBe(4);
    });

    it('says so when there is nothing to show', async () => {
      await open({ preview: [] });
      expect(previewText()).toBe('Nothing to fill');
    });
  });

  describe('what it emits', () => {
    it('carries the type, direction and fields', async () => {
      const { emitted } = await open({ presetId: AutoFill.Presets.Linear.id });
      await type('.sxl-fillSeries-step', '2');
      await type('.sxl-fillSeries-stop', '9');
      await submit();
      expect(emitted).toEqual([{
        presetId: AutoFill.Presets.Linear.id,
        direction: IRange.Direction.Down,
        trend: undefined,
        stepValue: 2,
        stopValue: 9
      }]);
    });

    it('keeps a step of zero, which is a real step and not an empty field', async () => {
      const { emitted } = await open();
      await type('.sxl-fillSeries-step', '0');
      await submit();
      expect(emitted[0]?.stepValue).toBe(0);
    });

    it('emits nothing when cancelled', async () => {
      const { emitted } = await open();
      const cancel = Array.from(document.querySelectorAll('button'))
        .find((button: HTMLButtonElement): boolean => button.textContent?.trim() === 'Cancel');
      await click(cancel ?? null);
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
      expect(emitted).toEqual([undefined]);
    });

    it('refuses to fill while no type applies', async () => {
      await open({ offered: [] });
      expect(fillButton().disabled).toBe(true);
    });
  });
});
