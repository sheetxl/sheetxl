import { describe, it, expect, afterEach, beforeEach } from 'vitest';

import { DefaultLanguagePackService } from '@sheetxl/utils';

import { type ICommandDefinition } from '../../command/ICommandDefinition';
import { reduceDefinitions } from '../../command/reduceDefinitions';
import { createResolvedCommand } from '../../command/createResolvedCommand';
import { CommandRegistry, DefaultCommandRegistry } from '../../command/CommandRegistry';
import { CommandScope } from '../../command/CommandScope';
import { DefaultCommandButtonRegistry } from '../../command/CommandButtonRegistry';
import { createCommandCatalogService } from '../../command/CommandCatalogService';
import { type CommandCatalog } from '../../command/CommandCatalog';

/**
 * Command chrome localization is **single-mechanism**: `CommandCatalogService` seeds the ACTIVE
 * locale's catalog into the registry (re-seeding on a language switch), so `getLabel`/
 * `getDescription` return already-localized values with NO translator overlay on the resolve path.
 *
 * (This file previously asserted the retired overlay — `getLabel` consulting the language service
 * by `cmd.<key>.label` convention. That layer is gone; a German session loads German, it does not
 * translate English at read time. The flat-pack lookup survives only for command-BUTTON entries
 * that are not commands — the second describe below.)
 */
function resolve(key: string, defs: ICommandDefinition[]) {
  return createResolvedCommand(reduceDefinitions(key, defs));
}

const DEFS: ICommandDefinition[] = [{
  key: 'hideSheet',
  label: 'Hide Sheet',
  groupLabels: { sheet: 'Hide' },
  description: 'Hide the sheet from appearing in the tabs.',
  callback: () => {}
}];

/** A minimal one-command catalog for `scope`, in `tag`. */
const catalogOf = (tag: string, label: string, scoped: string): CommandCatalog => ({
  scope: 'sheet', tag, version: 1,
  commands: { hideSheet: { label, groupLabels: { sheet: scoped } } }
});

/** Let the catalog service's async re-seed (language listener → prefetch → seed) settle. */
const flush = (): Promise<void> => new Promise((r) => { setTimeout(r, 0); });

beforeEach(async () => {
  DefaultLanguagePackService.register('xx', {
    tag: 'xx',
    messages: {
      'cmd.hideSheet.label': 'XX-Label',
      'cmd.hideSheet.label@sheet': 'XX-Scoped',
      'cmd.hideSheet.desc': 'XX-Desc',
      'cmd.testClearOptions.label': 'XX-Group',
      'cmd.testClearOptions.label@homeToolbar': 'XX-Group-Scoped',
      'cmd.testClearOptions.desc': 'XX-Group-Desc'
    }
  });
  await DefaultLanguagePackService.setActive('xx');
});

afterEach(async () => {
  // The service is a singleton — restore English so other suites see literal fallback.
  await DefaultLanguagePackService.setActive('en');
});

describe('command chrome localization (catalog-seeded, no resolve-time overlay)', () => {
  it('resolves the ACTIVE locale catalog, and a language switch re-seeds', async () => {
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      svc.register('sheet', 'en', catalogOf('en', 'Hide Sheet', 'Hide'));
      svc.register('sheet', 'de', catalogOf('de', 'Blatt ausblenden', 'Ausblenden'));

      // Explicit: `beforeEach` activates `xx`, which has no catalog here. English is NOT an implicit
      // fallback any more (see the test below), so activate it to assert against it.
      await DefaultLanguagePackService.setActive('en');
      await flush();

      const seeded = () => registry.resolveDefinition('sheet', 'hideSheet')!;
      expect(seeded().label).toBe('Hide Sheet');
      expect(seeded().groupLabels!.sheet).toBe('Hide');

      await DefaultLanguagePackService.setActive('de');
      await flush(); // the service re-seeds asynchronously off the language listener
      expect(seeded().label).toBe('Blatt ausblenden');
      expect(seeded().groupLabels!.sheet).toBe('Ausblenden');

      // Re-seeding REPLACES the layer (stable contributor identity) — it must not stack.
      await DefaultLanguagePackService.setActive('en');
      await flush();
      expect(seeded().label).toBe('Hide Sheet');
    } finally {
      svc.dispose();
    }
  });

  it('an active locale with no catalog seeds NOTHING — English is not an implicit fallback', async () => {
    // English is a language, not a fallback. Backfilling it made a partial translation look finished
    // and hid exactly the gaps a translator needs to see; an unseeded command renders its KEY instead.
    // A locale that genuinely wants English behind it declares `inherit: ["en"]`, resolved at load.
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      svc.register('sheet', 'en', catalogOf('en', 'Hide Sheet', 'Hide'));
      await DefaultLanguagePackService.setActive('xx'); // registered as a pack, but has no catalog
      await flush();
      expect(registry.resolveDefinition('sheet', 'hideSheet')).toBeUndefined();
    } finally {
      svc.dispose();
    }
  });

  it('a regional tag falls back to its BASE tag (de-AT -> de) — truncation, not a language choice', async () => {
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      svc.register('sheet', 'de', catalogOf('de', 'Blatt ausblenden', 'Ausblenden'));
      await DefaultLanguagePackService.setActive('de-AT');
      await flush();
      expect(registry.resolveDefinition('sheet', 'hideSheet')!.label).toBe('Blatt ausblenden');
    } finally {
      svc.dispose();
    }
  });

  it('getLabel returns registry chrome verbatim — the active pack is already localized', () => {
    // No lookup happens at resolve time: whatever the registry holds IS the display value.
    const cmd = resolve('hideSheet', DEFS);
    expect(cmd.getLabel()).toBe('Hide Sheet');
    expect(cmd.getLabel('sheet')).toBe('Hide');
    expect(cmd.getDescription()).toBe('Hide the sheet from appearing in the tabs.');
  });

  it('a scoped (groupKey) label falls back to the plain label, never a mismatched form', () => {
    const cmd = resolve('addSheet', [
      { key: 'addSheet', label: 'Insert Sheet', groupLabels: { sheet: 'Insert' }, callback: () => {} }
    ]);
    expect(cmd.getLabel()).toBe('Insert Sheet');
    expect(cmd.getLabel('sheet')).toBe('Insert');
    expect(cmd.getLabel('unknownSurface')).toBe('Insert Sheet');
  });

  it('dynamic (function) labels always win over the catalog', () => {
    const cmd = resolve('hideSheet', [{
      key: 'hideSheet',
      label: (() => 'From Model') as any,
      callback: () => {}
    }]);
    expect(cmd.getLabel()).toBe('From Model');
  });

  it('a re-seed notifies registry listeners (bound scopes re-resolve)', async () => {
    // The chain that actually carries a language switch to the UI: language service →
    // catalog service re-seeds → registry bumps. The registry itself does NOT subscribe to
    // the language service (it has nothing to re-derive without a catalog).
    const registry = new CommandRegistry();
    const svc = createCommandCatalogService(registry);
    try {
      svc.register('sheet', 'en', catalogOf('en', 'Hide Sheet', 'Hide'));
      svc.register('sheet', 'de', catalogOf('de', 'Blatt ausblenden', 'Ausblenden'));
      let changes = 0;
      registry.addListener({ onChange: () => { changes++; } });
      await DefaultLanguagePackService.setActive('de');
      await flush();
      expect(changes).toBeGreaterThan(0);
    } finally {
      svc.dispose();
    }
  });

  it('connect() resurrects a disposed root scope so registry changes still propagate', () => {
    // The StrictMode cycle: the provider's cleanup disposes the useMemo'd root (severing the
    // registry subscription) but the instance survives; the remount effect must reconnect it,
    // or every registry-originated change (catalog seeds, plugin statics) goes silent.
    const registry = new CommandRegistry();
    const root = new CommandScope('app', null, { registry });
    root.dispose();                        // StrictMode cleanup
    const vDeaf = root.getVersion();
    registry.register('app', 'probe', { label: 'X' });
    expect(root.getVersion()).toBe(vDeaf);  // deaf — registry change unheard
    root.connect();                        // remount effect
    const vAlive = root.getVersion();
    expect(vAlive).toBeGreaterThan(vDeaf);  // connect bumps (may have missed changes)
    registry.register('app', 'probe2', { label: 'Y' });
    expect(root.getVersion()).toBeGreaterThan(vAlive); // registry reaches the scope again
    root.dispose();
  });
});

describe('command-button entry translation (panels/groups)', () => {
  // Registered entries (panels like `clearOptions`) share the command key namespace, so the
  // same `cmd.<key>.*` convention covers them — the wrapper installs at register().
  it('a registered entry translates getLabel/getDescription; own-key groupKey is not a scope', () => {
    DefaultCommandButtonRegistry.register({
      key: 'testClearOptions',
      getLabel: () => 'Clear',
      getDescription: () => 'Clear everything.',
      members: ['clearAll', 'clearFormats']
    }, true);
    const entry = DefaultCommandButtonRegistry.get('testClearOptions')!;
    expect(entry.getLabel!()).toBe('XX-Group');
    // CommandGroup passes the entry's OWN key as groupKey when resolving its head — plain key.
    expect(entry.getLabel!('testClearOptions')).toBe('XX-Group');
    // A real surface scope resolves the scoped variant first…
    expect(entry.getLabel!('homeToolbar')).toBe('XX-Group-Scoped');
    // …and an unknown scope falls back to the plain translation.
    expect(entry.getLabel!('otherPanel')).toBe('XX-Group');
    expect(entry.getDescription!()).toBe('XX-Group-Desc');
    DefaultCommandButtonRegistry.unregister('testClearOptions');
  });

  it('an untranslated entry delegates to its authored getters; absent text returns undefined', () => {
    DefaultCommandButtonRegistry.register({
      key: 'testUntranslated',
      getLabel: () => 'Authored',
      members: []
    }, true);
    const entry = DefaultCommandButtonRegistry.get('testUntranslated')!;
    expect(entry.getLabel!()).toBe('Authored');
    // Getters are ALWAYS attached now — an entry may carry no inline literal at all and take its
    // chrome (English included) from the catalog. "No text" is the getter returning undefined,
    // not the getter being missing.
    expect(entry.getDescription).toBeTypeOf('function');
    expect(entry.getDescription!()).toBeUndefined();
    DefaultCommandButtonRegistry.unregister('testUntranslated');
  });

  it('an entry with NO authored getters still resolves chrome from the catalog', () => {
    // The "JSON even for English" case: a panel whose label/description live only in a catalog.
    // `translateEntry` reads the shared DefaultCommandRegistry, so seed that (and clean it up).
    const CONTRIBUTOR = 'test-catalog-only';
    DefaultCommandRegistry.register('ui', 'testCatalogOnly',
      { label: 'From Catalog', description: 'Catalog description.' }, CONTRIBUTOR);
    try {
      DefaultCommandButtonRegistry.register({ key: 'testCatalogOnly', members: [] }, true);
      const entry = DefaultCommandButtonRegistry.get('testCatalogOnly')!;
      expect(entry.getLabel!()).toBe('From Catalog');
      expect(entry.getDescription!()).toBe('Catalog description.');
      DefaultCommandButtonRegistry.unregister('testCatalogOnly');
    } finally {
      DefaultCommandRegistry.removeCommand('ui', 'testCatalogOnly', CONTRIBUTOR);
    }
  });

  it('an entry mirroring a command formats a parameterized (ICU-select) label via the command params', () => {
    // Regression: the entry path (e.g. a `quickCommand`'s display) returned the RAW
    // `{dark, select, …}` template because it skipped `formatMessage` — unlike the command's own
    // getLabel. It must format with the command's live `params`, label and description alike.
    const CONTRIBUTOR = 'test-param-label';
    DefaultCommandRegistry.register('ui', 'testParamLabel', {
      label: '{dark, select, true{Dark Mode} other{Light Mode}}',
      description: '{dark, select, true{Now dark} other{Now light}}',
      params: { dark: true }
    }, CONTRIBUTOR);
    try {
      DefaultCommandButtonRegistry.register({ key: 'testParamLabel', members: [] }, true);
      const entry = DefaultCommandButtonRegistry.get('testParamLabel')!;
      expect(entry.getLabel!()).toBe('Dark Mode');
      expect(entry.getDescription!()).toBe('Now dark');
      DefaultCommandButtonRegistry.unregister('testParamLabel');
    } finally {
      DefaultCommandRegistry.removeCommand('ui', 'testParamLabel', CONTRIBUTOR);
    }
  });

  it('reverts to authored English when the language switches back', async () => {
    DefaultCommandButtonRegistry.register({
      key: 'testClearOptions',
      getLabel: () => 'Clear',
      members: []
    }, true);
    await DefaultLanguagePackService.setActive('en');
    const entry = DefaultCommandButtonRegistry.get('testClearOptions')!;
    expect(entry.getLabel!()).toBe('Clear');
    DefaultCommandButtonRegistry.unregister('testClearOptions');
  });
});
