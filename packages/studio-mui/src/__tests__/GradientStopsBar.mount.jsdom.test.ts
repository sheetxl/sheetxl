import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { GradientStopsBar, type GradientStopValue } from '../fill/GradientStopsBar';

/**
 * Mount tests for the gradient stops bar: what each gesture hands back through `onChange` — the
 * stops in offset order, a new stop in the widest gap in the color the ramp shows there, and the
 * floor and ceiling on how many there are.
 */
describe('GradientStopsBar (mount)', () => {
  const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  const mount = async (
    stops: GradientStopValue[], props: { minStops?: number; maxStops?: number } = {}
  ): Promise<{ container: HTMLElement; changes: GradientStopValue[][]; handles: () => HTMLElement[]; addButton: () => HTMLElement }> => {
    const changes: GradientStopValue[][] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(GradientStopsBar, { stops, onChange: (next) => { changes.push(next); }, ...props }));
    });
    const handles = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('.sxl-gradient-stop'));
    const addButton = (): HTMLElement => {
      const bar = container.querySelector('.sxl-gradient-stops')!;
      // The add button: the one button that is not a handle nor in a handle's toolbar.
      return Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"]')).find((el) => !el.closest('.sxl-gradient-stop'))!;
    };
    return { container, changes, handles, addButton };
  };

  const key = async (el: HTMLElement, key: string, init: KeyboardEventInit = {}): Promise<void> => {
    await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });
  };

  it('renders a handle per stop and adds one in the widest gap, in the color between its neighbors', async () => {
    const { changes, handles, addButton } = await mount([
      { offset: 0, color: 'ffffff' }, { offset: 0.2, color: 'ffffff' }, { offset: 1, color: '000000' }
    ]);
    expect(handles()).toHaveLength(3);
    await act(async () => { addButton().click(); });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual([
      { offset: 0, color: 'ffffff' }, { offset: 0.2, color: 'ffffff' },
      { offset: 0.6, color: '808080' }, { offset: 1, color: '000000' }
    ]);
  });

  it('will not add past maxStops nor remove below minStops', async () => {
    const two = await mount([{ offset: 0, color: 'ffffff' }, { offset: 1, color: '000000' }], { maxStops: 2 });
    expect((two.addButton() as HTMLButtonElement).disabled || two.addButton().getAttribute('aria-disabled') === 'true').toBe(true);
    await key(two.handles()[0], 'Delete');
    expect(two.changes).toHaveLength(0);

    const three = await mount([{ offset: 0, color: 'ffffff' }, { offset: 0.5, color: 'ff0000' }, { offset: 1, color: '000000' }]);
    await key(three.handles()[1], 'Delete');
    expect(three.changes).toEqual([[{ offset: 0, color: 'ffffff' }, { offset: 1, color: '000000' }]]);
  });

  it('nudges a focused stop with the arrow keys and hands the stops back in offset order', async () => {
    const { changes, handles } = await mount([{ offset: 0.49, color: 'ffffff' }, { offset: 0.5, color: '000000' }]);
    await key(handles()[0], 'ArrowRight');
    expect(changes[0].map((stop) => stop.offset)).toEqual([0.5, 0.5]);
    await key(handles()[0], 'ArrowRight', { shiftKey: true });
    expect(changes[1]).toEqual([{ offset: 0.5, color: '000000' }, { offset: 0.59, color: 'ffffff' }]);
    await key(handles()[1], 'End');
    expect(changes[2].map((stop) => stop.offset)).toEqual([0.49, 1]);
  });
});
