import { describe, it, expect, vi } from 'vitest';

import { createElement, useCallback, useRef, type ReactElement, type ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { FloatStackProvider } from '../../float/FloatStackContext';
import { useFloatStack, type FloatReference } from '../../float/useFloatStack';

const frame = async (): Promise<void> => {
  await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
};

/**
 * Light-dismiss decides "was this click away from the float?". It must answer for the click AS
 * DISPATCHED, because React can re-render mid-dispatch: on a fast repeat click inside a popup, the
 * previous click's pending update flushes when the next discrete event arrives, the clicked node is
 * replaced, and a live-tree `contains(event.target)` then tests a detached node — concluding the user
 * clicked away and dismissing the popup they are clicking in.
 */
describe('useFloatStack light-dismiss — target detached mid-dispatch', () => {
  it('keeps the float open when the clicked node is replaced during the dispatch', async () => {
    const closed = vi.fn();
    let popupRef: FloatReference | null = null;

    const Popup = ({ anchor }: { anchor: HTMLElement | null }): ReactNode => {
      const renderPopupPanel = useCallback(
        (props: any) => createElement('div', { 'data-panel': true },
          createElement('button', { 'data-quick': true }, 'quick'), props.children), []);
      const float = useFloatStack({ label: 'popup', anchor, onClose: closed, renderPopupPanel });
      popupRef = float.reference;
      return float.component;
    };

    const Toolbar = (): ReactElement => {
      const ref = useRef<HTMLDivElement>(null);
      const toolbar = useFloatStack({ label: 'toolbar', anchor: ref.current, renderPopupPanel: null as any });
      return createElement('div', { ref, 'data-toolbar': true },
        createElement(FloatStackProvider, { value: toolbar.reference },
          createElement(Popup, { anchor: ref.current })));
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Toolbar)); });
    await frame();
    await act(async () => { popupRef!.open(0); });
    await frame();
    await frame();

    const button = document.querySelector('[data-quick]') as HTMLElement;
    expect(button, 'panel rendered').toBeTruthy();

    // Stand in for React's mid-dispatch flush: detach the clicked node while the event is still
    // travelling, before it reaches the document-level light-dismiss listener.
    const detach = (): void => { button.remove(); };
    button.parentElement!.addEventListener('mousedown', detach);

    await act(async () => {
      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    });
    await frame();

    expect(button.isConnected, 'the test detached the target').toBe(false);
    expect(closed, 'light-dismiss closed the float on its own re-render').not.toHaveBeenCalled();

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('still dismisses on a genuine outside click', async () => {
    const closed = vi.fn();
    let popupRef: FloatReference | null = null;

    const Popup = ({ anchor }: { anchor: HTMLElement | null }): ReactNode => {
      const renderPopupPanel = useCallback(
        (props: any) => createElement('div', { 'data-panel': true }, props.children), []);
      const float = useFloatStack({ label: 'popup', anchor, onClose: closed, renderPopupPanel });
      popupRef = float.reference;
      return float.component;
    };

    const Toolbar = (): ReactElement => {
      const ref = useRef<HTMLDivElement>(null);
      const toolbar = useFloatStack({ label: 'toolbar', anchor: ref.current, renderPopupPanel: null as any });
      return createElement('div', { ref, 'data-toolbar': true },
        createElement(FloatStackProvider, { value: toolbar.reference },
          createElement(Popup, { anchor: ref.current })));
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(Toolbar)); });
    await frame();
    await act(async () => { popupRef!.open(0); });
    await frame();
    await frame();

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    await act(async () => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    });
    await frame();

    expect(closed, 'an outside click must still dismiss').toHaveBeenCalled();

    outside.remove();
    await act(async () => { root.unmount(); });
    container.remove();
  });
});
