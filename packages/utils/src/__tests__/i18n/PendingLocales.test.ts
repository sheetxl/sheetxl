import { describe, it, expect } from 'vitest';

import { createLanguagePackService } from '../../i18n/LanguagePackService';
import { trackLocaleRegistration, whenLocalesRegistered } from '../../i18n/_pendingLocales';

/**
 * The reveal gate must cover registrations that are still IN FLIGHT, not just the slices that happen
 * to exist when it is called.
 *
 * A package registers its slice by reading manifests over the network, so registration is async. If
 * `setActive`/`prefetch` only awaited the slices already present, a host could await one, open the
 * gate, render — and a package whose manifest read had not landed yet would resolve its strings to
 * raw KEYS until the fetch completed. That is the flash the gate exists to prevent, and the host
 * cannot close it itself, because it has nothing to await.
 */
describe('pending locale registrations', () => {
  it('setActive waits for a registration that is still in flight', async () => {
    const svc = createLanguagePackService();

    // A package whose manifest read lands a tick later, then registers its slice.
    let landed = false;
    trackLocaleRegistration((async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      svc.registerMessages('@sheetxl/sdk', 'de', {
        'condition.operator.textEmail.title': 'Ist E-Mail'
      });
      landed = true;
    })());

    await svc.setActive('de');

    // Without the gate covering in-flight registrations this returns before the manifest lands, and
    // the key-only string renders its key instead of the translation.
    expect(landed).toBe(true);
    expect(svc.lookup('condition.operator.textEmail.title')).toBe('Ist E-Mail');
  });

  it('a rejected registration still settles the gate', async () => {
    // No locale server (Node/CLI) must degrade, never hang: the gate opens and strings fall back.
    trackLocaleRegistration(Promise.reject(new Error('no locale base')));
    await expect(whenLocalesRegistered()).resolves.toBeUndefined();
  });
});
