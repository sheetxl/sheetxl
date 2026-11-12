import { describe, expect, it } from 'vitest';
import { createElement, createRef, forwardRef, act } from 'react';
import { createRoot } from 'react-dom/client';

import { useImperativeElement } from '../../hooks/useImperativeElement';

interface Extended { getAnswer: () => number }

const Probe = forwardRef<HTMLDivElement & Extended, object>((_props, refForwarded) => {
  const refLocal = useImperativeElement<HTMLDivElement & Extended, Extended>(refForwarded, () => ({
    getAnswer: () => 42
  }));
  return createElement('div', { ref: refLocal, 'data-testid': 'probe' });
});

const render = async (ref?: React.Ref<HTMLDivElement & Extended>): Promise<{ host: HTMLElement, unmount: () => Promise<void> }> => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(Probe, { ref })); });
  return { host, unmount: async () => { await act(async () => { root.unmount(); }); host.remove(); } };
};

/**
 * The attributes extend the DOM element itself, so code that holds the element (a callback ref, a
 * `querySelector`) can call them whether or not the caller passed a ref.
 */
describe('useImperativeElement', () => {
  it('extends the element when a ref is forwarded', async () => {
    const ref = createRef<HTMLDivElement & Extended>();
    const { host, unmount } = await render(ref);
    try {
      expect(ref.current?.getAnswer()).toBe(42);
      expect((host.querySelector('[data-testid="probe"]') as any).getAnswer()).toBe(42);
    } finally {
      await unmount();
    }
  });

  it('extends the element when no ref is forwarded', async () => {
    const { host, unmount } = await render();
    try {
      expect((host.querySelector('[data-testid="probe"]') as any).getAnswer?.()).toBe(42);
    } finally {
      await unmount();
    }
  });
});
