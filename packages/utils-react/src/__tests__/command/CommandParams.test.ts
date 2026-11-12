import { describe, it, expect, afterEach } from 'vitest';

import { DefaultLanguagePackService } from '@sheetxl/utils';

import { type ICommandDefinition } from '../../command/ICommandDefinition';
import { reduceDefinitions } from '../../command/reduceDefinitions';
import { createResolvedCommand } from '../../command/createResolvedCommand';
import { chromeToPartial } from '../../command/CommandCatalog';

/**
 * Parameterized (ICU-subset) command messages: the catalog authors the localized MESSAGE
 * (+ parameter defaults via `ChromeRecord.params`); a dynamic contributor overrides `params`
 * with live values; `getLabel`/`getDescription` format via `formatMessage` in the active
 * language. (I18N-DESIGN.md Part 6 — "Parameterized messages".)
 */
function resolve(key: string, defs: ICommandDefinition[]) {
  return createResolvedCommand(reduceDefinitions(key, defs));
}

const CATALOG_SEED: ICommandDefinition = {
  key: 'insertRows',
  ...chromeToPartial({
    label: '{mode, select, copy{Insert Copied Rows} cut{Insert Cut Rows} other{{count, plural, one{Insert Row} other{Insert # Rows}}}}',
    groupLabels: { insertCellsOptions: '{mode, select, copy{Copied Rows} cut{Cut Rows} other{{count, plural, one{Row} other{# Rows}}}}' },
    params: { count: 1, mode: 'none' }
  })
};

afterEach(async () => {
  await DefaultLanguagePackService.setActive('en');
});

describe('parameterized command labels (catalog message + dynamic params)', () => {
  it('formats with the catalog parameter defaults (pre-mount surfaces)', () => {
    const cmd = resolve('insertRows', [CATALOG_SEED]);
    expect(cmd.getLabel()).toBe('Insert Row');
    expect(cmd.getLabel('insertCellsOptions')).toBe('Row');
  });

  it('a dynamic contribution overrides params (count / clipboard mode)', () => {
    const dynamic: ICommandDefinition = { key: 'insertRows', params: { count: 3, mode: 'none' }, callback: () => {} };
    const cmd = resolve('insertRows', [CATALOG_SEED, dynamic]);
    expect(cmd.getLabel()).toBe('Insert 3 Rows');
    expect(cmd.getLabel('insertCellsOptions')).toBe('3 Rows');

    const copied = resolve('insertRows', [CATALOG_SEED, { key: 'insertRows', params: { count: 3, mode: 'copy' } }]);
    expect(copied.getLabel()).toBe('Insert Copied Rows');
  });

  it('formats a localized message with the active language (de # grouping)', async () => {
    DefaultLanguagePackService.register('de', { tag: 'de', messages: {} });
    await DefaultLanguagePackService.setActive('de');
    // A de catalog seed (what CommandCatalogService would have seeded for the active pack).
    const de: ICommandDefinition = {
      key: 'deleteRows',
      label: '{count, plural, one{Zeile löschen} other{# Zeilen löschen}}',
      params: { count: 1234 }
    };
    expect(resolve('deleteRows', [de]).getLabel()).toBe('1.234 Zeilen löschen');
  });

  it('a plain (non-parameterized) label is untouched even when params exist', () => {
    const cmd = resolve('x', [{ key: 'x', label: 'Plain', params: { count: 2 } }]);
    expect(cmd.getLabel()).toBe('Plain');
  });
});
