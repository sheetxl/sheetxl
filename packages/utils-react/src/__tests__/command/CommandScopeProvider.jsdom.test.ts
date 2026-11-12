import { describe, it, expect } from 'vitest';

import { createElement, act, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { CommandScope } from '../../command/CommandScope';
import { CommandScopeProvider, useCommandScope } from '../../command/CommandScopeContext';

/**
 * `CommandScopeProvider` is **"a scope and its element"**, in two forms: `spec` CREATES a child of the
 * ambient scope (a feature contributing commands), `scope` PROVIDES an already-built one (chrome that
 * renders outside the scope's element but belongs to it). Either way `elementRef` — or the ref handed to
 * function children — names the element that bounds the scope's region.
 */
describe('CommandScopeProvider (scope + element)', () => {
  const render = async (node: React.ReactNode): Promise<{ container: HTMLDivElement; unmount: () => Promise<void> }> => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(node); });
    // The element attach retries on rAF (the provider mounts above what it names) — let a frame pass.
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    return {
      container,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('spec form: creates a child, provides it, and bounds it to the element', async () => {
    const app = new CommandScope('app');
    let seen: CommandScope | null = null;
    const Probe = (): null => { seen = useCommandScope(); return null; };

    const Host = (): React.ReactElement => {
      const ref = useRef<HTMLDivElement>(null);
      return createElement(CommandScopeProvider,
        { spec: { scopeName: 'sheet' }, elementRef: ref },
        createElement('div', { ref, 'data-testid': 'sheet' }, createElement(Probe))
      );
    };

    const { container, unmount } = await render(
      createElement(CommandScopeProvider, { scope: app }, createElement(Host))
    );

    const sheetEl = container.querySelector('[data-testid="sheet"]')!;
    const outside = document.createElement('input');
    document.body.appendChild(outside);

    expect(seen).not.toBeNull();
    expect(seen!.key).toBe('sheet');
    expect(seen!.getParent()).toBe(app);          // created off the AMBIENT scope
    expect(seen!.contains(sheetEl)).toBe(true);   // bounded to its element...
    expect(seen!.contains(outside)).toBe(false);  // ...so a key born elsewhere can't reach its commands

    outside.remove();
    await unmount();
  });

  it('scope form: provides an existing scope untouched, and can extend its region', async () => {
    // The status-bar case: chrome rendered OUTSIDE the workbook element that nonetheless belongs to it.
    // The scope is not created or disposed here — only provided, and its region extended.
    const app = new CommandScope('app');
    const workbook = app.createChild('workbook');
    const workbookEl = document.createElement('div');
    document.body.appendChild(workbookEl);
    const rmMain = workbook.attachBounds(workbookEl);

    let seen: CommandScope | null = null;
    const Probe = (): null => { seen = useCommandScope(); return null; };

    const Host = (): React.ReactElement => {
      const ref = useRef<HTMLDivElement>(null);
      return createElement(CommandScopeProvider,
        { scope: workbook, elementRef: ref },
        createElement('div', { ref, 'data-testid': 'status' }, createElement(Probe))
      );
    };
    const { container, unmount } = await render(createElement(Host));

    const statusEl = container.querySelector('[data-testid="status"]')!;
    expect(seen).toBe(workbook);                    // provided as-is, no child created
    expect(workbook.contains(statusEl)).toBe(true); // the region now spans both containers
    expect(workbook.contains(workbookEl)).toBe(true);

    await unmount();
    expect(workbook.contains(statusEl)).toBe(false); // the chrome's piece detaches with it...
    expect(workbook.contains(workbookEl)).toBe(true); // ...leaving the owner's intact
    expect(workbook.getParent()).toBe(app);           // and the scope itself is NOT disposed

    rmMain();
    workbookEl.remove();
  });

  it('function children receive the element ref — no ref declaration at the call site', async () => {
    const app = new CommandScope('app');
    let created: CommandScope | null = null;
    const { container, unmount } = await render(
      createElement(CommandScopeProvider, {
        scope: app,
        children: (ref: React.RefObject<any>) => createElement('div', { ref, 'data-testid': 'named' })
      })
    );
    created = app;
    const el = container.querySelector('[data-testid="named"]')!;
    expect(created.contains(el)).toBe(true);

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    expect(created.contains(outside)).toBe(false);

    outside.remove();
    await unmount();
  });

  it('names nothing when no element was promised — an unbounded scope stays unrestricted', async () => {
    // No `elementRef`, no function children ⇒ provide only. The scope must stay element-less
    // (unrestricted), NOT sit waiting on a ref that will never arrive.
    const app = new CommandScope('app');
    const scope = app.createChild('workbook');
    const { unmount } = await render(
      createElement(CommandScopeProvider, { scope }, createElement('div', null, 'chrome'))
    );
    const anywhere = document.createElement('input');
    document.body.appendChild(anywhere);
    expect(scope.contains(anywhere)).toBe(true); // element-less ⇒ unrestricted, as documented

    anywhere.remove();
    await unmount();
  });
});
