import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Workbook, type IColor } from '@sheetxl/sdk';

import { ColorPanel } from '../color';

/**
 * The picker's **Automatic** swatch — "no color of my own", which for a border is a real state and
 * not an absence: a stroke drawn without a color takes the theme's text color.
 *
 * The border panel had no `autoColor` to offer, so it substituted a literal Gray for the pen's
 * empty color. Every picker then opened showing a custom swatch nobody had chosen, and there was
 * no way back to the default once you had picked anything.
 */
describe('ColorPanel Automatic swatch', () => {
  beforeAll(() => {
    if (typeof window.matchMedia === 'function') return;
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false
    });
  });

  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  afterEach(async () => {
    if (root) await act(async () => { root!.unmount(); });
    container?.remove();
    root = null;
    container = null;
  });

  /** The border pen's auto color, from the same place the panel and the toolbar both read it. */
  const autoColorOf = async (): Promise<IColor> => {
    const workbook = new Workbook();
    await workbook.getCalculation().ready();
    return workbook.getSelectedWorksheet().getStyles().getNormal().getFont().getColor();
  };

  const render = async (props: Record<string, unknown>): Promise<HTMLDivElement> => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root!.render(createElement(ColorPanel as never, props as never)); });
    return container;
  };

  /** The Automatic row, found by its label rather than by position in the palette. */
  const automaticRow = (host: HTMLElement): HTMLElement | undefined =>
    Array.from(host.querySelectorAll('div[role="button"], .MuiListItemButton-root'))
      .find((el) => el.textContent?.trim() === 'Automatic') as HTMLElement | undefined;

  it('offers Automatic when an auto color is supplied', async () => {
    const host = await render({ autoColor: await autoColorOf(), selectedColor: null });
    expect(automaticRow(host)).toBeTruthy();
  });

  it('offers no Automatic without one — which is what the border panel used to render', async () => {
    const host = await render({ selectedColor: null });
    expect(automaticRow(host)).toBeUndefined();
  });

  it('reports Automatic as null, the pen’s own no-color state', async () => {
    const picked: (IColor | null)[] = [];
    const host = await render({
      autoColor: await autoColorOf(),
      selectedColor: null,
      onSelectColor: (color: IColor | null) => { picked.push(color); }
    });

    await act(async () => { automaticRow(host)!.click(); });

    // Not the auto color itself: `null` is what lets the panel write a stroke with no color, so the
    // border keeps following the theme instead of freezing at whatever the theme was that day.
    expect(picked).toEqual([null]);
  });
});
