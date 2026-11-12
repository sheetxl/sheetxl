import { describe, it, expect, vi } from 'vitest';

import { createLanguagePackService } from '../../i18n/LanguagePackService';
import { type LanguagePack } from '../../i18n/Types';

/**
 * Per-package UI message slices (I18N-DESIGN.md decision 6): several packages contribute call-site
 * (`t()`) strings to the SAME language without clobbering, and a host pack can override any of them.
 * Before this, `register(tag, pack)` was replace-not-merge and one flat `pack.messages` was the only source.
 */
describe('per-package message slices', () => {
  it('merges slices from several packages into one language', async () => {
    const svc = createLanguagePackService();
    svc.registerMessages('@sheetxl/utils-mui', 'de', { 'window.close': 'Schließen' });
    svc.registerMessages('@sheetxl/studio-mui', 'de', { 'statusBar.ready': 'Bereit' });
    await svc.setActive('de');
    // Both survive — neither registration clobbered the other.
    expect(svc.lookup('window.close')).toBe('Schließen');
    expect(svc.lookup('statusBar.ready')).toBe('Bereit');
  });

  it('re-registering one package replaces only that slice', async () => {
    const svc = createLanguagePackService();
    svc.registerMessages('a', 'de', { 'a.key': 'A1', 'a.gone': 'X' });
    svc.registerMessages('b', 'de', { 'b.key': 'B1' });
    await svc.setActive('de');
    svc.registerMessages('a', 'de', { 'a.key': 'A2' });
    expect(svc.lookup('a.key')).toBe('A2');
    expect(svc.lookup('a.gone')).toBeUndefined(); // replaced, not merged into itself
    expect(svc.lookup('b.key')).toBe('B1');       // untouched
  });

  it('the LAST registration wins a key collision between packages', async () => {
    // Module init runs dependencies first, so "registered later" means "further downstream": a UI
    // package can re-word a key its dependency (the SDK) also ships. First-wins was the old, silent
    // trap — the downstream copy simply never rendered.
    const svc = createLanguagePackService();
    svc.registerMessages('@sheetxl/sdk', 'de', { 'op.update': 'Aktualisieren', 'op.only': 'NurSdk' });
    svc.registerMessages('@sheetxl/studio-mui', 'de', { 'op.update': 'Bearbeiten' });
    await svc.setActive('de');
    expect(svc.lookup('op.update')).toBe('Bearbeiten'); // downstream override wins
    expect(svc.lookup('op.only')).toBe('NurSdk');       // non-colliding keys still merge
  });

  it('bundled defaults stay the floor: any slice beats them, and among defaults the last wins', async () => {
    const svc = createLanguagePackService();
    svc.registerDefaultMessages('@sheetxl/sdk', 'en', { 'k.shared': 'SdkDefault', 'k.floor': 'Floor' });
    svc.registerDefaultMessages('@sheetxl/studio-mui', 'en', { 'k.shared': 'StudioDefault' });
    svc.registerMessages('@sheetxl/sdk', 'en', { 'k.shared': 'Fetched' });
    await svc.setActive('en');
    expect(svc.lookup('k.shared')).toBe('Fetched');   // a fetched slice outranks EVERY bundled default
    expect(svc.lookup('k.floor')).toBe('Floor');      // the floor still fills gaps
    svc.registerMessages('@sheetxl/sdk', 'en', {});   // drop the fetched override
    expect(svc.lookup('k.shared')).toBe('StudioDefault'); // last-registered default wins among defaults
  });

  it('a host pack overrides a package slice (the app-level escape hatch)', async () => {
    const svc = createLanguagePackService();
    svc.registerMessages('@sheetxl/studio-mui', 'de', { 'statusBar.ready': 'Bereit', 'only.slice': 'S' });
    const host: LanguagePack = { tag: 'de', messages: { 'statusBar.ready': 'Startklar' } };
    svc.register('de', host);
    await svc.setActive('de');
    expect(svc.lookup('statusBar.ready')).toBe('Startklar'); // host wins
    expect(svc.lookup('only.slice')).toBe('S');              // slice still fills gaps
    // Host precedence is positional, not registration-order: a slice registered AFTER the host
    // still loses to it — last-wins applies among packages, never over the host.
    svc.registerMessages('@sheetxl/plugin', 'de', { 'statusBar.ready': 'Fertig' });
    expect(svc.lookup('statusBar.ready')).toBe('Startklar');
  });

  it('getPacks returns ascending precedence: base tag before exact, registration order, host last', async () => {
    // Consumers reduce with "later overrides earlier" (the SDK's plane merge), so position IS
    // precedence: a de-AT pack must land after de (the regional override wins), later-registered
    // packages after earlier ones, and the host after everything.
    const svc = createLanguagePackService();
    const base: LanguagePack = { tag: 'de', messages: {} };
    const early: LanguagePack = { tag: 'de-AT', messages: {} };
    const late: LanguagePack = { tag: 'de-AT', messages: {} };
    const host: LanguagePack = { tag: 'de-AT', messages: {} };
    svc.register('de-AT', host); // host registers FIRST — its precedence is positional, not temporal
    svc.registerPack('@sheetxl/formulas', 'de', base);
    svc.registerPack('@sheetxl/formulas', 'de-AT', early);
    svc.registerPack('@sheetxl/formulas-extended', 'de-AT', late);
    await svc.setActive('de-AT');
    expect(svc.getPacks('de-AT')).toEqual([base, early, late, host]);
  });

  it('loads lazy slices on activation, once', async () => {
    const svc = createLanguagePackService();
    const loader = vi.fn(async () => ({ 'x.key': 'X' }));
    svc.registerMessages('pkg', 'de', loader);
    expect(loader).not.toHaveBeenCalled();
    await svc.setActive('de');
    await svc.setActive('de');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(svc.lookup('x.key')).toBe('X');
  });

  it('a slice registered AFTER activation joins the live chain and notifies', async () => {
    // The real ordering: the app calls setActive() at startup, manifests resolve later.
    const svc = createLanguagePackService();
    await svc.setActive('de');
    const listener = vi.fn();
    svc.addChangeListener(listener);
    let resolveLoad: (v: any) => void;
    const pending = new Promise<any>((res) => { resolveLoad = res; });
    svc.registerMessages('late', 'de', () => pending);
    expect(svc.lookup('late.key')).toBeUndefined();
    resolveLoad!({ 'late.key': 'Spät' });
    // The load settles several microtasks later (loader → set catalog → rebuild chain → notify);
    // a macrotask boundary flushes them all, which is what a real render tick does.
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.lookup('late.key')).toBe('Spät');
    expect(listener).toHaveBeenCalledWith('de'); // consumers re-render
  });

  it('falls back from a regional tag to base-tag slices (de-AT → de)', async () => {
    const svc = createLanguagePackService();
    svc.registerMessages('pkg', 'de', { 'a': 'Basis', 'b': 'NurBasis' });
    svc.registerMessages('pkg', 'de-AT', { 'a': 'Regional' });
    await svc.setActive('de-AT');
    expect(svc.lookup('a')).toBe('Regional');
    expect(svc.lookup('b')).toBe('NurBasis');
  });

  it('prefetch loads slices without activating, and publishes for the active tag', async () => {
    const svc = createLanguagePackService();
    svc.registerMessages('pkg', 'de', async () => ({ 'k': 'V' }));
    await svc.prefetch('de');
    expect(svc.lookup('k')).toBeUndefined(); // 'de' is not active yet
    await svc.setActive('de');
    expect(svc.lookup('k')).toBe('V');
  });
});
