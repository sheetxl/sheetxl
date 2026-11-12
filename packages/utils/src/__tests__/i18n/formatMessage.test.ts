import { describe, it, expect } from 'vitest';

import { formatMessage } from '../../i18n/formatMessage';
import { createLanguagePackService, t } from '../../i18n/LanguagePackService';
import { type LanguagePack } from '../../i18n/Types';

describe('formatMessage — simple arguments (interpolate parity)', () => {
  it('passes plain text through untouched', () => {
    expect(formatMessage('Hide Sheet')).toBe('Hide Sheet');
    expect(formatMessage("Can't Undo")).toBe("Can't Undo"); // lone apostrophe is literal
  });

  it('substitutes {name} and leaves unknown params literal', () => {
    expect(formatMessage('Select {name}', { name: 'MyRange' })).toBe('Select MyRange');
    expect(formatMessage('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}');
    expect(formatMessage('Select {name}')).toBe('Select {name}');
  });

  it('honors ICU apostrophe escaping', () => {
    expect(formatMessage("don''t {x}", { x: 1 })).toBe("don't 1");
    expect(formatMessage("literal '{x}' here", { x: 1 })).toBe('literal {x} here');
  });
});

describe('formatMessage — plural', () => {
  const MSG = '{count, plural, =0{no rows} one{# row} other{# rows}}';

  it('selects =N exact, then category', () => {
    expect(formatMessage(MSG, { count: 0 })).toBe('no rows');
    expect(formatMessage(MSG, { count: 1 })).toBe('1 row');
    expect(formatMessage(MSG, { count: 5 })).toBe('5 rows');
  });

  it('uses the language plural rules (pl: few/many)', () => {
    const pl = '{count, plural, one{# plik} few{# pliki} many{# plików} other{# pliku}}';
    expect(formatMessage(pl, { count: 1 }, 'pl')).toBe('1 plik');
    expect(formatMessage(pl, { count: 3 }, 'pl')).toBe('3 pliki');
    expect(formatMessage(pl, { count: 5 }, 'pl')).toBe('5 plików');
    expect(formatMessage(pl, { count: 22 }, 'pl')).toBe('22 pliki');
  });

  it('applies offset to category selection and #', () => {
    const msg = '{count, plural, offset:1 =0{nobody} =1{just you} one{you and # other} other{you and # others}}';
    expect(formatMessage(msg, { count: 0 })).toBe('nobody');
    expect(formatMessage(msg, { count: 1 })).toBe('just you');
    expect(formatMessage(msg, { count: 2 })).toBe('you and 1 other');
    expect(formatMessage(msg, { count: 5 })).toBe('you and 4 others');
  });

  it('formats # with the language number format', () => {
    expect(formatMessage('{n, plural, other{# rows}}', { n: 12345 }, 'de')).toBe('12.345 rows');
    expect(formatMessage('{n, plural, other{# rows}}', { n: 12345 }, 'en')).toBe('12,345 rows');
  });

  it('falls back to other (with literal #) on a missing or non-numeric value', () => {
    expect(formatMessage(MSG, {})).toBe('# rows');
    expect(formatMessage(MSG, { count: 'abc' })).toBe('# rows');
  });

  it('supports selectordinal', () => {
    const msg = '{place, selectordinal, one{#st} two{#nd} few{#rd} other{#th}}';
    expect(formatMessage(msg, { place: 1 })).toBe('1st');
    expect(formatMessage(msg, { place: 2 })).toBe('2nd');
    expect(formatMessage(msg, { place: 3 })).toBe('3rd');
    expect(formatMessage(msg, { place: 11 })).toBe('11th');
  });
});

describe('formatMessage — select and nesting', () => {
  it('selects by string value with other fallback', () => {
    const msg = '{kind, select, row{Row} column{Column} other{Range}}';
    expect(formatMessage(msg, { kind: 'row' })).toBe('Row');
    expect(formatMessage(msg, { kind: 'column' })).toBe('Column');
    expect(formatMessage(msg, { kind: 'cell' })).toBe('Range');
  });

  it('nests arguments inside branches; # survives a nested select', () => {
    const msg = '{n, plural, one{Insert # {kind, select, row{row} other{column}}} other{Insert # {kind, select, row{rows} other{columns}}}}';
    expect(formatMessage(msg, { n: 1, kind: 'row' })).toBe('Insert 1 row');
    expect(formatMessage(msg, { n: 3, kind: 'col' })).toBe('Insert 3 columns');
  });
});

describe('formatMessage — malformed input degrades, never throws', () => {
  it('handles unterminated arguments', () => {
    expect(formatMessage('open {name', { name: 'x' })).toBe('open x');
    expect(formatMessage('{n, plural, other{# rows', { n: 2 })).toBe('2 rows');
  });

  it('treats out-of-subset argument types as simple arguments', () => {
    expect(formatMessage('{n, number}', { n: 5 })).toBe('5');
    expect(formatMessage('{d, date, short}', { d: 'today' })).toBe('today');
  });

  it('handles an unknown language tag via the en fallback rules', () => {
    expect(formatMessage('{n, plural, one{# row} other{# rows}}', { n: 1 }, 'zz-!!')).toBe('1 row');
  });
});

describe('translator integration', () => {
  it('lookup formats pack messages in the pack language', async () => {
    const svc = createLanguagePackService();
    const de: LanguagePack = {
      tag: 'de',
      messages: { 'rows.deleted': '{count, plural, one{# Zeile gelöscht} other{# Zeilen gelöscht}}' }
    };
    svc.register('de', de);
    await svc.setActive('de');
    expect(svc.lookup('rows.deleted', { count: 1 })).toBe('1 Zeile gelöscht');
    expect(svc.lookup('rows.deleted', { count: 1234 })).toBe('1.234 Zeilen gelöscht');
  });

  it('call-site t() renders the key when no pack supplies the message', () => {
    // `t` no longer takes English — it lives in the catalog (decision 9), so an unregistered key
    // renders as itself: visible and debuggable, never blank.
    expect(t('test.rows', { count: 2 })).toBe('test.rows');
  });
});
