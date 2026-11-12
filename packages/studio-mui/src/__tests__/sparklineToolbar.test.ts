import { afterEach, describe, expect, it } from 'vitest';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { CommandScope, DefaultCommandButtonRegistry } from '@sheetxl/utils-react';

import { registerSheetCommandGroups } from '../command/SheetCommandGroups';
import { contributeSparklineCommands } from '../../../react/src/sparkline/SparklineCommands';

/**
 * The studio's sparkline color pickers join the react-owned Sparkline tab by contribution: Sparkline
 * Color and Marker Color before the Axis menu, Axis Color inside it after Show Axis.
 */
describe('sparkline tab colors', () => {
  const roots: CommandScope[] = [];
  const workbooks: IWorkbook[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) root.dispose();
    for (const workbook of workbooks.splice(0)) workbook.close();
  });

  const keysOf = (members: readonly unknown[] | null): string[] =>
    (members ?? []).map(m => typeof m === 'string' ? m : (m as { key?: string } | null)?.key ?? '?');

  it('weaves the pickers into the tab and its Axis menu', async () => {
    registerSheetCommandGroups();
    const workbook = new Workbook();
    workbooks.push(workbook);
    await workbook.getCalculation().ready();
    const sheet = workbook.getSelectedWorksheet();
    sheet.getRange('F2:F4').setSparkline('A2:E4');
    await sheet.getRange('F2').select();
    const root = new CommandScope('root');
    roots.push(root);
    root.createChild('sparkline', contributeSparklineCommands, { sheet });

    const tab = keysOf(DefaultCommandButtonRegistry.resolveMembers('sparklineToolbar'));
    const at = (key: string): number => tab.indexOf(key);
    expect(at('sparklineColorSeries')).toBeGreaterThan(at('sparklineShowOptions'));
    expect(at('sparklineMarkerColorOptions')).toBe(at('sparklineColorSeries') + 1);
    expect(tab[at('sparklineMarkerColorOptions') + 1]).toBe('-');
    expect(at('sparklineAxisOptions')).toBeGreaterThan(at('sparklineMarkerColorOptions'));

    expect(keysOf(DefaultCommandButtonRegistry.resolveMembers('sparklineMarkerColorOptions'))).toEqual([
      'sparklineColorNegative', 'sparklineColorMarkers', 'sparklineColorHigh',
      'sparklineColorLow', 'sparklineColorFirst', 'sparklineColorLast'
    ]);
    const axis = keysOf(DefaultCommandButtonRegistry.resolveMembers('sparklineAxisOptions'));
    expect(axis.slice(0, 3)).toEqual(['sparklineAxisToggle', 'sparklineColorAxis', 'sparklineRightToLeftToggle']);

    // The cell context menu's Sparklines submenu.
    expect(keysOf(DefaultCommandButtonRegistry.resolveMembers('sparklineOptions'))).toEqual([
      'sparklineEditData', '-', 'sparklineClear', 'sparklineClearGroups'
    ]);
  });
});
