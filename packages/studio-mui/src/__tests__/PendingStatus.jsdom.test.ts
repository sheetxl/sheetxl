import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { WorkbookProvider } from '@sheetxl/react';

import { PendingStatus } from '../statusBar';

/**
 * The status bar's async icon: shown while results are awaited, read on the calculation's
 * `onPendingChange`; pressing one cancels them, and it goes away.
 */
describe('PendingStatus', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let workbook: IWorkbook | null = null;
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    container?.remove();
    workbook?.close();
    root = null;
    container = null;
    workbook = null;
  });

  /** Past the icons' debounce. */
  const settle = async (): Promise<void> => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
  };

  it('shows an icon while results are awaited, and pressing it cancels them', async () => {
    workbook = new Workbook();
    await workbook.getCalculation().ready();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(WorkbookProvider as never, { workbook } as never, createElement(PendingStatus)));
    });
    const pending = (): HTMLElement | null => container!.querySelector('[aria-label="pending-results"]');
    expect(pending()).toBeNull();

    workbook.getRange('A1:A2').setValue('=DELAY(5000,ROW())');
    await workbook.getCalculation().ready();
    await settle();
    expect(pending()).not.toBeNull();

    await act(async () => { pending()!.click(); });
    await workbook.getCalculation().ready();
    await settle();
    expect(workbook.getCalculation().getPendingCount()).toBe(0);
    expect(pending()).toBeNull();
  });
});
