import { describe, it, expect } from 'vitest';

import { createShortcutSearch, type ShortcutSearchFields } from '../dialog/_ShortcutSearch';

/**
 * Shortcut panel search.
 *
 * Real word-prefix matches are all a query sees when it has any; typo tolerance only fills an
 * otherwise empty result, so "group" never surfaces "Background" through "groun(d)".
 */
describe('shortcut search', () => {
  const row = (label: string, description = '', scope = 'sheet'): ShortcutSearchFields => (
    { label, description, scope, scopeLabel: scope }
  );
  const rows = [
    row('Toggle Sheet Background', 'Add or remove the picture that is tiled behind the sheet\'s cells.'),
    row('Group Rows', 'Group the selected rows so they can be collapsed and expanded together.'),
    row('Auto Outline', 'Group the rows and columns from the sheet\'s formulas.'),
    row('AutoSum', 'Add up the cells above or to the left.'),
    row('Delete Sheet Background', 'Remove the sheet\'s background picture.'),
    row('Bold', 'Make the text bold.', 'format'),
  ];
  const search = createShortcutSearch(rows);
  const labels = (query: string): string[] => search(query).map((r) => r.label);

  it('matches whole words and word prefixes, never letters inside a word', () => {
    expect(labels('group')).toEqual(['Group Rows', 'Auto Outline']);
    expect(labels('grou')).toEqual(['Group Rows', 'Auto Outline']);
    expect(labels('round')).toEqual([]);
  });

  it('ranks label hits above description hits', () => {
    expect(labels('group')[0]).toBe('Group Rows');
  });

  it('splits camel-case labels into words', () => {
    expect(labels('sum')).toEqual(['AutoSum']);
  });

  it('requires every query word', () => {
    expect(labels('delete background')).toEqual(['Delete Sheet Background']);
    expect(labels('sheet bold')).toEqual([]);
  });

  it('searches the scope', () => {
    expect(labels('format')).toEqual(['Bold']);
  });

  it('forgives a typo when nothing matches outright', () => {
    expect(labels('gropu')).toEqual(['Group Rows']);
    expect(labels('backgrund')).toEqual(['Toggle Sheet Background', 'Delete Sheet Background']);
  });

  it('does not forgive a trailing character the word lacks', () => {
    expect(labels('group2')).toEqual([]);
    expect(labels('bolx')).toEqual([]);
  });

  it('forgives a trailing vowel', () => {
    expect(labels('groupe')).toEqual(['Group Rows']);
  });

  it('does not fuzz short words', () => {
    expect(labels('bld')).toEqual([]);
  });

  it('returns everything for an empty query', () => {
    expect(search('  ')).toHaveLength(rows.length);
  });
});
