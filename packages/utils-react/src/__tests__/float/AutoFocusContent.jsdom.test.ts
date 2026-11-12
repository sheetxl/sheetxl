import { describe, it, expect } from 'vitest';

import { createElement, useCallback, useRef, type ReactElement, type ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { FloatStackProvider } from '../../float/FloatStackContext';
import { useFloatStack, type FloatReference } from '../../float/useFloatStack';

const frame = async (): Promise<void> => {
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
};

/**
 * A float takes the focus when it opens so its keys work, unless something else took it first.
 * Content that focuses itself as it mounts (a checklist's search field, which forwards the arrows
 * and Space to its list) has it before the float's effect runs, and the float must leave it there.
 */
describe('useFloatStack autoFocus — content that focuses itself', () => {
  const mountAndOpen = async (panel: (props: any) => ReactNode): Promise<{ unmount: () => Promise<void> }> => {
    let popupRef: FloatReference | null = null;
    const Popup = ({ anchor }: { anchor: HTMLElement | null }): ReactNode => {
      const renderPopupPanel = useCallback(panel, []);
      const float = useFloatStack({ label: 'popup', anchor, renderPopupPanel });
      popupRef = float.reference;
      return float.component;
    };
    const Host = (): ReactElement => {
      const ref = useRef<HTMLDivElement>(null);
      const host = useFloatStack({ label: 'host', anchor: ref.current, renderPopupPanel: null as any });
      return createElement('div', { ref },
        createElement(FloatStackProvider, { value: host.reference },
          createElement(Popup, { anchor: ref.current })));
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Host)); });
    await frame();
    await act(async () => { popupRef!.open(0); });
    await frame();
    await frame();
    return {
      unmount: async (): Promise<void> => {
        await act(async () => { root.unmount(); });
        container.remove();
      }
    };
  };

  it('leaves the focus on a field that focused itself on mount', async () => {
    const { unmount } = await mountAndOpen((props: any) =>
      createElement('div', { 'data-panel': true },
        createElement('input', { 'data-field': true, autoFocus: true }), props.children));
    const field = document.querySelector('[data-field]') as HTMLElement;
    expect(field, 'panel rendered').toBeTruthy();
    expect(document.activeElement).toBe(field);
    await unmount();
  });

  it('takes the focus itself when nothing in it did', async () => {
    const { unmount } = await mountAndOpen((props: any) =>
      createElement('div', { 'data-panel': true }, createElement('button', null, 'quick'), props.children));
    const panel = document.querySelector('[data-panel]') as HTMLElement;
    expect(panel, 'panel rendered').toBeTruthy();
    const active = document.activeElement as HTMLElement;
    expect(active, 'the float focused its panel').not.toBe(document.body);
    expect(active.contains(panel) || panel.contains(active)).toBe(true);
    await unmount();
  });
});
