import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { Workbook } from '@sheetxl/sdk';

import { ThemeSelectButton } from '../theme/ThemeSelectButton';

/**
 * A theme in the themes gallery, mounted on a workbook's theme: its name, its colors as two sets of
 * chips (text and backgrounds, then the six accents) and its fonts.
 */
describe('ThemeSelectButton (mount)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('draws the theme\'s text and background colors, then its accents, each named', async () => {
    const workbook = new Workbook();
    const theme = workbook.getTheme();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(ThemeSelectButton, { docTheme: theme, onSelectTheme: () => {} })); });

    expect(container.textContent).toContain(theme.getName());
    const sets = Array.from(container.querySelectorAll('svg[data-variant="chips"]'));
    const names = sets.map(set => Array.from(set.querySelectorAll('rect title')).map(title => title.textContent));
    expect(names).toEqual([
      ['Primary Background', 'Primary Text', 'Secondary Background', 'Secondary Text'],
      ['Accent 1', 'Accent 2', 'Accent 3', 'Accent 4', 'Accent 5', 'Accent 6']
    ]);
    const fills = sets.map(set => Array.from(set.querySelectorAll('rect')).map(rect => rect.getAttribute('fill')));
    expect(fills[1]).toEqual([1, 2, 3, 4, 5, 6].map(n => theme.parseColor(`accent${n}`).toRGBA(false).toString()));
    expect(new Set(fills[1]).size).toBe(6);
    workbook.close();
  });
});
