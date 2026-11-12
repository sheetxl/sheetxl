import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook, IRange, ICell, AutoFill, type ICellRange } from '@sheetxl/sdk';

import { WorkbookProvider, type CommandContext } from '@sheetxl/react';

import { FillMenu } from '../workbook/FillMenu';

/**
 * Mount tests for the fill menu. The react test pins what the context ANSWERS; these pin what the
 * menu does with those answers — which entries it lists, which it greys, and what each one runs.
 *
 * The context is stubbed: a case is one line of setup and the menu is tested against the contract
 * it is written to.
 */
describe('FillMenu (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  const NUMERIC = [
    AutoFill.Presets.Copy.id, AutoFill.Presets.Series.id,
    AutoFill.Presets.Linear.id, AutoFill.Presets.Growth.id,
    AutoFill.Presets.LinearTrend.id, AutoFill.Presets.GrowthTrend.id
  ];

  const open = async (offered: readonly string[] = NUMERIC): Promise<{
    filled: CommandContext.FillMenuOptions[];
    seriesOpened: () => number;
    closed: () => number;
  }> => {
    const workbook = new Workbook();
    await workbook.whenCalculationReady();
    const sheet = workbook.getSelectedWorksheet();
    const filled: CommandContext.FillMenuOptions[] = [];
    let seriesOpened = 0;
    let closed = 0;
    const menu: CommandContext.FillMenu = {
      template: sheet.getRange('A1') as ICellRange,
      destination: sheet.getRange('A1:A6') as ICellRange,
      direction: IRange.Direction.Down,
      offered,
      fill: async (options: CommandContext.FillMenuOptions): Promise<void> => { filled.push(options); },
      series: (): void => { seriesOpened++; }
    };
    const floatReference: any = { close: () => { closed++; return null; } };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(WorkbookProvider as never, { workbook } as never,
        createElement(FillMenu as never, { workbook, menu, floatReference } as never)));
    });
    return { filled, seriesOpened: () => seriesOpened, closed: () => closed };
  };

  const entry = (key: string): HTMLElement => {
    const element = document.querySelector(`.sxl-fillMenu-entry[data-entry="${key}"]`) as HTMLElement;
    expect(element).toBeTruthy();
    return element;
  };

  const isEnabled = (key: string): boolean => entry(key).getAttribute('aria-disabled') !== 'true';

  /** A menu item chooses on mouse-UP, like the other Exhibit menus. */
  const choose = async (key: string): Promise<void> => {
    await act(async () => {
      entry(key).dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
  };

  describe('the entries', () => {
    it('lists Excel\'s menu, in its order, without Flash Fill', async () => {
      await open();
      const keys = Array.from(document.querySelectorAll('.sxl-fillMenu-entry'))
        .map((element) => (element as HTMLElement).dataset.entry);
      expect(keys).toEqual([
        'copy', 'series', 'formatsOnly', 'valuesOnly',
        'linear', 'growth',
        'date.days', 'date.weekdays', 'date.months', 'date.monthEnd', 'date.years',
        'linear.trend', 'growth.trend',
        'seriesDialog'
      ]);
      expect(document.body.textContent).not.toContain('Flash Fill');
    });

    it('greys what the template does not offer, and never the four everyday fills', async () => {
      await open(NUMERIC);
      expect(isEnabled('linear')).toBe(true);
      expect(isEnabled('linear.trend')).toBe(true);
      expect(isEnabled('date.days')).toBe(false);
      expect(isEnabled('date.months')).toBe(false);
      expect(isEnabled('copy')).toBe(true);
      expect(isEnabled('formatsOnly')).toBe(true);
      expect(isEnabled('valuesOnly')).toBe(true);
    });

    it('greys Series… only where nothing at all is offered', async () => {
      await open([]);
      expect(isEnabled('seriesDialog')).toBe(false);
      expect(isEnabled('series')).toBe(false);
      expect(isEnabled('copy')).toBe(true);
    });
  });

  describe('what a choice runs', () => {
    it('Copy Cells and Fill Series name their presets, and close the menu', async () => {
      const { filled, closed } = await open();
      await choose('copy');
      expect(filled).toEqual([{ presetId: AutoFill.Presets.Copy.id }]);
      expect(closed()).toBe(1);
    });

    it('Fill Formatting Only reads no series; Fill Without Formatting reads the default one', async () => {
      const { filled } = await open();
      await choose('formatsOnly');
      await choose('valuesOnly');
      expect(filled).toEqual([
        { type: ICell.Content.Formats },
        { presetId: AutoFill.Presets.Series.id, type: ICell.Content.Values }
      ]);
    });

    it('a date entry names its preset', async () => {
      const { filled } = await open([AutoFill.Presets.Copy.id, AutoFill.Presets.DateWeekdays.id]);
      await choose('date.weekdays');
      expect(filled).toEqual([{ presetId: AutoFill.Presets.DateWeekdays.id }]);
    });

    it('a greyed entry runs nothing', async () => {
      const { filled } = await open(NUMERIC);
      await choose('date.days');
      expect(filled).toEqual([]);
    });

    it('Series… opens the dialog', async () => {
      const { filled, seriesOpened } = await open();
      await choose('seriesDialog');
      expect(seriesOpened()).toBe(1);
      expect(filled).toEqual([]);
    });
  });
});
