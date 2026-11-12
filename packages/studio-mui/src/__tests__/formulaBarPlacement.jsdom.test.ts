import { describe, it, expect, afterEach } from 'vitest';

import { createElement, Fragment, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { resolveFormulaBarPlacement, orderStudioChrome } from '../studio/formulaBarPlacement';

/**
 * Where the formula bar goes. The studio composes its chrome as one flex column, so placement is a
 * question of child order; which order is a question of the device type unless the host says.
 *
 * The primary input is passed in: the studio's tests resolve `@sheetxl/utils-react` to its built
 * bundle, which carries its own `detect-it`, so a module mock would not reach it. It is the primary
 * pointer rather than `deviceType` because a phone with an S Pen or a paired mouse reports `hybrid`
 * while its primary pointer is still a finger.
 */
describe('formula bar placement', () => {
  describe('resolves', () => {
    it('an explicit edge as itself, whatever the device', () => {
      expect(resolveFormulaBarPlacement('top', 'touch')).toBe('top');
      expect(resolveFormulaBarPlacement('bottom', 'mouse')).toBe('bottom');
    });

    it("'auto' to bottom when the primary pointer is a finger", () => {
      expect(resolveFormulaBarPlacement('auto', 'touch')).toBe('bottom');
      expect(resolveFormulaBarPlacement(undefined, 'touch')).toBe('bottom');
    });

    it("'auto' to top when the primary pointer is a mouse, trackpad or pen", () => {
      expect(resolveFormulaBarPlacement('auto', 'mouse')).toBe('top');
      expect(resolveFormulaBarPlacement(undefined, 'mouse')).toBe('top');
    });

    it("'auto' reads the device when none is given", () => {
      expect(['top', 'bottom']).toContain(resolveFormulaBarPlacement('auto'));
    });
  });

  describe('orders the chrome', () => {
    let root: Root | null = null;
    let container: HTMLDivElement | null = null;
    afterEach(async () => {
      await act(async () => { root?.unmount(); });
      container?.remove();
      root = null;
      container = null;
    });

    const parts = {
      toolbar: createElement('div', { key: 'toolbar', 'data-part': 'toolbar' }),
      formulaBar: createElement('div', { key: 'formulaBar', 'data-part': 'formulaBar' }),
      main: createElement('div', { key: 'main', 'data-part': 'main' }),
      statusBar: createElement('div', { key: 'statusBar', 'data-part': 'statusBar' })
    };

    const mount = async (placement: 'top' | 'bottom'): Promise<string[]> => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () => {
        root!.render(createElement(Fragment, null, ...orderStudioChrome(placement, parts)));
      });
      return Array.from(container.children).map((el) => el.getAttribute('data-part') ?? 'divider');
    };

    it("'top' puts the bar under the toolbar, above the grid", async () => {
      expect(await mount('top')).toEqual(['toolbar', 'formulaBar', 'main', 'statusBar']);
    });

    it("'bottom' puts the bar last, under the status bar, with the studio's divider between", async () => {
      expect(await mount('bottom')).toEqual(['toolbar', 'main', 'statusBar', 'divider', 'formulaBar']);
    });
  });
});
