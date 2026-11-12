import { describe, it, expect, afterEach } from 'vitest';

import { createElement, Suspense, act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { lazyComponent, useLazyRetry } from '../../lazy';

/**
 * `React.lazy` remembers a rejected load for the life of the component, so a feature that failed
 * while offline stayed broken after reconnecting until the page was reloaded.
 */
describe('lazyComponent', () => {
  const mounted: { root: Root, container: HTMLElement }[] = [];

  afterEach(async () => {
    for (const { root, container } of mounted.splice(0)) {
      await act(async () => { root.unmount(); });
      container.remove();
    }
  });

  /** React throttles revealing content behind a Suspense fallback, so poll rather than wait a tick. */
  const waitFor = async (check: () => boolean): Promise<void> => {
    for (let i = 0; i < 100 && !check(); i++) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    }
  };

  const render = async (element: ReactElement): Promise<HTMLElement> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    await act(async () => {
      root.render(createElement(Suspense, { fallback: 'loading' }, element));
    });
    await waitFor(() => container.textContent !== 'loading');
    return container;
  };

  const Greeting = ({ name }: { name: string }): ReactElement => createElement('span', null, `hello ${name}`);

  const RetryButton = ({ error }: { error: unknown }): ReactElement => {
    const retry = useLazyRetry();
    return createElement('button', { onClick: () => retry?.() }, `failed: ${(error as Error).message}`);
  };

  it('renders the loaded component with its props', async () => {
    const Lazy = lazyComponent(async () => ({ default: Greeting }));
    const container = await render(createElement(Lazy, { name: 'a' }));
    expect(container.textContent).toBe('hello a');
  });

  it('renders the error in place, then the component once a retry succeeds', async () => {
    let online = false;
    let calls = 0;
    const Lazy = lazyComponent(async () => {
      calls++;
      if (!online) throw new Error('offline');
      return { default: Greeting };
    }, {
      renderError: ({ error }) => createElement(RetryButton, { error })
    });

    const container = await render(createElement(Lazy, { name: 'b' }));
    expect(container.textContent).toBe('failed: offline');

    online = true;
    await act(async () => { container.querySelector('button')!.click(); });
    await waitFor(() => container.textContent === 'hello b');
    expect(container.textContent).toBe('hello b');
    expect(calls).toBe(2);
  });

  it('loads again for a new mount after a failure, leaving the failed mount as is', async () => {
    let online = false;
    const Lazy = lazyComponent(async () => {
      if (!online) throw new Error('offline');
      return { default: Greeting };
    }, {
      renderError: () => 'failed'
    });

    const first = await render(createElement(Lazy, { name: 'c' }));
    expect(first.textContent).toBe('failed');

    online = true;
    const second = await render(createElement(Lazy, { name: 'd' }));
    expect(second.textContent).toBe('hello d');
    expect(first.textContent).toBe('failed');
  });

  it('does not reload a module that loaded', async () => {
    let calls = 0;
    const Lazy = lazyComponent(async () => {
      calls++;
      return { default: Greeting };
    });
    await render(createElement(Lazy, { name: 'e' }));
    const second = await render(createElement(Lazy, { name: 'f' }));
    expect(second.textContent).toBe('hello f');
    expect(calls).toBe(1);
  });
});
