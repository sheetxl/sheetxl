import { describe, it, expect } from 'vitest';

import { DefaultLanguagePackService } from '@sheetxl/utils';

import { CommandRegistry } from '../../command/CommandRegistry';
import { createCommandCatalogService } from '../../command/CommandCatalogService';
import { type CommandCatalog } from '../../command/CommandCatalog';

/**
 * The command-catalog **bundled `en` floor** (I18N zero-config, command plane): a package inlines its
 * `en` catalogs and registers them under a `\0default` sourceId, EAGERLY and first, so they seed the
 * least-specific registry layer. A fetched override / plugin catalog (a normal sourceId), seeded later,
 * pushes a more-specific layer and wins per command — Layer semantics, falling out of push order.
 *
 * Mirrors `registerFromManifest`, which registers the bundled catalog before kicking off the fetch.
 */
const catalogOf = (tag: string, commands: CommandCatalog['commands']): CommandCatalog =>
  ({ scope: 'sheet', tag, version: 1, commands });

const flush = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

describe('command-catalog bundled en floor', () => {
  it('resolves the floor in en, and a fetched override wins per command while gaps stay floored', async () => {
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      await DefaultLanguagePackService.setActive('en');
      // Bundled floor FIRST (as registerFromManifest does) — lowest precedence.
      svc.register('sheet', 'en', catalogOf('en', {
        hideSheet: { label: 'Hide Sheet' },
        showSheet: { label: 'Show Sheet' }
      }), { sourceId: 'sheet\0default' });
      // A fetched/override catalog (normal source) redefines ONE command, omits the other.
      svc.register('sheet', 'en', catalogOf('en', {
        hideSheet: { label: 'Custom Hide' }
      }), { sourceId: 'sheet' });
      await flush();

      const def = (key: string) => registry.resolveDefinition('sheet', key)!;
      expect(def('hideSheet').label).toBe('Custom Hide'); // override wins
      expect(def('showSheet').label).toBe('Show Sheet');  // floor fills the gap
    } finally {
      svc.dispose();
    }
  });

  it('does NOT leak the en floor into a translated (de) session', async () => {
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      svc.register('sheet', 'en', catalogOf('en', { hideSheet: { label: 'Hide Sheet' } }),
        { sourceId: 'sheet\0default' });
      await DefaultLanguagePackService.setActive('de'); // no de catalog registered here
      await flush();
      // English is a language, not a fallback: the command is unseeded, not shown in bundled English.
      expect(registry.resolveDefinition('sheet', 'hideSheet')).toBeUndefined();
    } finally {
      await DefaultLanguagePackService.setActive('en'); // restore the singleton for other suites
      svc.dispose();
    }
  });
});
