import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeStyle, ensureThemeLayerOrder } from '../../theme/ThemeStyle';
import { SXL_THEME_LAYER_ORDER } from '../../theme/buildThemeCSS';

/**
 * Cascade-layer order is fixed by where each layer name first appears in document order. A host sheet
 * already in `<head>` that writes `@layer sxl-overrides { … }` would otherwise rank its overrides lowest,
 * so the order statement must sit before every other sheet in the root a theme sheet renders into.
 */
describe('ThemeStyle layer order', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('puts the order statement first in <head>, ahead of a host sheet already there', async () => {
    const host = document.createElement('style');
    host.textContent = '@layer sxl-overrides { :root { --sxl-color-base-100: navy; } }';
    document.head.appendChild(host);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(ThemeStyle, { css: '@layer sxl-defaults{}' })); });

    const first = document.head.firstElementChild as HTMLStyleElement;
    expect(first).not.toBe(host);
    expect(first.textContent).toBe(SXL_THEME_LAYER_ORDER);
    expect(container.querySelector('style')!.textContent).toBe('@layer sxl-defaults{}');
    await act(async () => { root.unmount(); });
  });

  it('declares the order once per root, however many theme sheets render', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement('div', null,
        createElement(ThemeStyle, { css: 'a{}' }),
        createElement(ThemeStyle, { css: 'b{}' })));
    });
    ensureThemeLayerOrder();
    const statements = [...document.querySelectorAll('style')].filter((s) => s.textContent === SXL_THEME_LAYER_ORDER);
    expect(statements).toHaveLength(1);
    await act(async () => { root.unmount(); });
  });

  it('declares the order inside a shadow root, not in the document', async () => {
    const shadowHost = document.createElement('div');
    document.body.appendChild(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    const host = document.createElement('style');
    host.textContent = '@layer sxl-overrides {}';
    shadow.appendChild(host);
    const container = document.createElement('div');
    shadow.appendChild(container);

    const root = createRoot(container);
    await act(async () => { root.render(createElement(ThemeStyle, { css: 'a{}' })); });

    expect((shadow.firstElementChild as HTMLStyleElement).textContent).toBe(SXL_THEME_LAYER_ORDER);
    expect(document.head.querySelector('style')).toBeNull();
    await act(async () => { root.unmount(); });
  });
});
