import { describe, it, expect } from 'vitest';

import { createTheme } from '@mui/material';

import { toTemplateCatalog } from '../template/useTemplateCatalog';
import { matchesTemplateQuery } from '../template/TemplateSearchField';
import { resolveCategoryColor } from '../template/categoryColor';

const BASE = 'https://unpkg.com/@sheetxl/templates-workbook/dist';

/**
 * Mapping a template catalog's resource index to what the gallery shows. Display comes from the
 * folder and file name unless the catalog says otherwise; identity is always the path.
 */
describe('toTemplateCatalog', () => {
  it('keeps the catalog category order and resolves asset URLs against the base', () => {
    const { categories, entries } = toTemplateCatalog({
      kind: 'templates',
      package: 'templates-workbook',
      meta: {
        schema: 1,
        categories: [{ id: 'lifestyle', title: 'Lifestyle' }, { id: 'finance', title: 'Money', description: 'Budgets', color: '#2e7d32' }]
      },
      entries: [
        {
          path: 'finance/invoice.xlsx', title: 'Invoice', tags: ['billing', 3],
          thumbnail: 'finance/invoice.webp', thumbnailDark: 'finance/invoice.dark.webp'
        },
        { path: 'lifestyle/yearly-calendar.xlsx' }
      ]
    }, BASE);
    expect(categories.map((c) => [c.id, c.title, c.color])).toEqual([['lifestyle', 'Lifestyle', undefined], ['finance', 'Money', '#2e7d32']]);
    expect(entries[0]).toMatchObject({
      id: 'finance/invoice.xlsx',
      title: 'Invoice',
      category: 'finance',
      tags: ['billing'],
      thumbnailUrl: `${BASE}/templates-workbook/finance/invoice.webp`,
      thumbnailDarkUrl: `${BASE}/templates-workbook/finance/invoice.dark.webp`,
      sourceUrl: `${BASE}/templates-workbook/finance/invoice.xlsx`
    });
    expect(entries[1]).toMatchObject({
      title: 'Yearly Calendar', category: 'lifestyle', thumbnailUrl: undefined, thumbnailDarkUrl: undefined
    });
  });

  it('derives a category missing from meta from its folder, and skips non-templates', () => {
    const { categories, entries } = toTemplateCatalog({
      kind: 'templates',
      package: 'templates-workbook',
      meta: { schema: 1 },
      entries: [
        { path: 'project-management/task_list.xlsx' },
        { path: 'project-management/sales-history.sxl' },
        { path: 'project-management/raw-orders.csv' },
        { path: 'project-management/task_list.json' },
        { path: 'project-management/task_list.txt' },
        { path: 'stray.xlsx' },
        { path: 'a/b/deep.xlsx' }
      ]
    }, BASE);
    expect(categories).toEqual([{ id: 'project-management', title: 'Project Management' }]);
    expect(entries.map((e) => e.title)).toEqual(['Task List', 'Sales History', 'Raw Orders']);
  });
});

describe('matchesTemplateQuery', () => {
  const entry = {
    id: 'finance/loan.xlsx', title: 'Loan Calculator', category: 'finance',
    description: 'Amortization schedule', tags: ['mortgage'], sourceUrl: 'x'
  };
  const category = { id: 'finance', title: 'Finance' };

  it('matches title, description, tags and category title, ignoring case and padding', () => {
    for (const query of ['loan', 'AMORT', 'mortgage', ' finance ', '']) {
      expect(matchesTemplateQuery(entry, query, category), query).toBe(true);
    }
    expect(matchesTemplateQuery(entry, 'budget', category)).toBe(false);
  });

  it('does not match the category id when the category is unknown', () => {
    expect(matchesTemplateQuery(entry, 'finance')).toBe(false);
  });
});

describe('resolveCategoryColor', () => {
  const light = createTheme({ palette: { mode: 'light' } });
  const dark = createTheme({ palette: { mode: 'dark' } });

  it('uses the color as given for light, inverted for dark, each with a text color that reads on it', () => {
    const category = { id: 'finance', title: 'Finance', color: '#2e7d32' };
    const onLight = resolveCategoryColor(category, light)!;
    const onDark = resolveCategoryColor(category, dark)!;
    expect(onLight.fill).toBe('rgb(46,125,50)');
    expect(onLight.text).toBe(light.palette.getContrastText('rgb(46,125,50)'));
    expect(onLight.text).toBe('#fff');
    // Inverted to a mid green, which reads with dark text.
    expect(onDark.fill).toBe('rgb(93,170,97)');
    expect(onDark.text).toBe('rgba(0, 0, 0, 0.87)');
  });

  it('is null without a color, or with one that does not parse', () => {
    expect(resolveCategoryColor({ id: 'a', title: 'A' }, light)).toBeNull();
    expect(resolveCategoryColor(undefined, light)).toBeNull();
    expect(resolveCategoryColor({ id: 'a', title: 'A', color: 'not a color' }, light)).toBeNull();
  });
});
