import { describe, it, expect, vi } from 'vitest';

import { createLanguagePackService, interpolate } from '../../i18n/LanguagePackService';
import { type LanguagePack } from '../../i18n/Types';

const DE: LanguagePack = {
  tag: 'de',
  messages: {
    'dlg.hideSheet.title': 'Blatt ausblenden',
    'dlg.hideSheet.title@compact': 'Ausblenden',
    'greeting': 'Hallo {name}'
  }
};

const DE_AT: LanguagePack = {
  tag: 'de-AT',
  messages: { 'dlg.hideSheet.title': 'Blatt verstecken' }
};

describe('LanguagePackService', () => {
  it('starts in English with no lookups (inline literals are the en catalog)', () => {
    const svc = createLanguagePackService();
    expect(svc.getActive()).toBe('en');
    expect(svc.language).toBe('en');
    expect(svc.lookup('dlg.hideSheet.title')).toBeUndefined();
    expect(svc.has('dlg.hideSheet.title')).toBe(false);
    expect(svc.t('dlg.hideSheet.title')).toBe('dlg.hideSheet.title'); // t falls back to key
  });

  it('activates an eagerly registered pack', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    await svc.setActive('de');
    expect(svc.lookup('dlg.hideSheet.title')).toBe('Blatt ausblenden');
    expect(svc.has('dlg.hideSheet.title')).toBe(true);
    expect(svc.lookup('dlg.notTranslated.title')).toBeUndefined(); // miss → caller's English
  });

  it('loads a lazy pack exactly once on activation', async () => {
    const svc = createLanguagePackService();
    const loader = vi.fn(async () => ({ default: DE }));
    svc.register('de', loader);
    expect(loader).not.toHaveBeenCalled(); // nothing loads until activated
    await svc.setActive('de');
    await svc.setActive('de');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(svc.lookup('dlg.hideSheet.title')).toBe('Blatt ausblenden');
  });

  it('falls back from a regional tag to its base pack (de-AT → de)', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    svc.register('de-AT', DE_AT);
    await svc.setActive('de-AT');
    expect(svc.getActive()).toBe('de-AT');
    // exact pack wins…
    expect(svc.lookup('dlg.hideSheet.title')).toBe('Blatt verstecken');
    // …base pack fills the gaps
    expect(svc.lookup('dlg.hideSheet.title@compact')).toBe('Ausblenden');
  });

  it('activates an unregistered regional tag via its base pack alone', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    await svc.setActive('de-CH');
    expect(svc.lookup('dlg.hideSheet.title')).toBe('Blatt ausblenden');
  });

  it('is lenient: an unknown tag activates with pure English fallback', async () => {
    const svc = createLanguagePackService();
    await svc.setActive('fr');
    expect(svc.getActive()).toBe('fr');
    expect(svc.lookup('anything')).toBeUndefined();
  });

  it('fires change listeners and supports removal', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    const listener = vi.fn();
    const remove = svc.addChangeListener(listener);
    await svc.setActive('de');
    expect(listener).toHaveBeenCalledWith('de');
    remove();
    await svc.setActive('en');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('switching back to en restores literal fallback', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    await svc.setActive('de');
    await svc.setActive('en');
    expect(svc.lookup('dlg.hideSheet.title')).toBeUndefined();
  });

  it('lists available languages (en always present)', () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    expect(svc.getAvailable()).toEqual(['en', 'de']);
  });

  it('interpolates {params} and leaves unknown params literal', async () => {
    const svc = createLanguagePackService();
    svc.register('de', DE);
    await svc.setActive('de');
    expect(svc.lookup('greeting', { name: 'Welt' })).toBe('Hallo Welt');
    expect(svc.lookup('greeting')).toBe('Hallo {name}');
    expect(interpolate('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}');
  });

  describe('bundled default (en floor)', () => {
    it('resolves eagerly with nothing else registered (zero-config)', () => {
      const svc = createLanguagePackService();
      svc.registerDefaultMessages('@pkg/a', 'en', { 'undo.x': 'Undo', 'redo.y': 'Redo' });
      // No setActive needed: the active tag is already 'en', so an eager default joins the live chain.
      expect(svc.lookup('undo.x')).toBe('Undo');
      expect(svc.has('redo.y')).toBe(true);
      expect(svc.getAvailable()).toEqual(['en']);
    });

    it('a fetched en override wins per-key; the floor fills the gaps (additive)', () => {
      const svc = createLanguagePackService();
      svc.registerDefaultMessages('@pkg/a', 'en', { 'undo.x': 'Undo', 'redo.y': 'Redo' });
      // Same package's fetched/override slice (normal tier) — overrides one key, omits the other.
      svc.registerMessages('@pkg/a', 'en', { 'undo.x': 'Custom Undo' });
      expect(svc.lookup('undo.x')).toBe('Custom Undo'); // override wins
      expect(svc.lookup('redo.y')).toBe('Redo');        // floor fills the gap
    });

    it('the host pack still outranks a fetched override and the floor', () => {
      const svc = createLanguagePackService();
      svc.registerDefaultMessages('@pkg/a', 'en', { 'undo.x': 'Undo' });
      svc.registerMessages('@pkg/a', 'en', { 'undo.x': 'Custom Undo' });
      svc.register('en', { tag: 'en', messages: { 'undo.x': 'Host Undo' } });
      expect(svc.lookup('undo.x')).toBe('Host Undo');
    });

    it('a plugin adds its own keys alongside the floor (both merge)', () => {
      const svc = createLanguagePackService();
      svc.registerDefaultMessages('@pkg/a', 'en', { 'a.key': 'A' });
      svc.registerDefaultMessages('@plugin/b', 'en', { 'b.key': 'B' }); // independent plugin, own keys
      expect(svc.lookup('a.key')).toBe('A');
      expect(svc.lookup('b.key')).toBe('B');
    });

    it('does NOT leak the en floor into a translated (de) session', async () => {
      const svc = createLanguagePackService();
      svc.registerDefaultMessages('@pkg/a', 'en', { 'only.en': 'English only' });
      svc.registerMessages('@pkg/a', 'de', { 'translated': 'Übersetzt' });
      await svc.setActive('de');
      // English-is-not-a-fallback: an untranslated key renders as a key, not the bundled English.
      expect(svc.lookup('only.en')).toBeUndefined();
      expect(svc.lookup('translated')).toBe('Übersetzt');
    });
  });
});
