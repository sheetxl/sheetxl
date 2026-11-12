import { useSyncExternalStore } from 'react';

import { DefaultLanguagePackService, type LanguageTag } from '@sheetxl/utils';

/**
 * The active UI language (BCP-47 tag), as a subscription — the component re-renders on a
 * language switch.
 *
 * Use this when you need the **tag itself** (an `Intl` formatter, `<html lang>`, a locale-keyed
 * asset). For call-site (`t()`) strings use {@link useTranslator} instead: calling this hook for
 * its subscription alone and discarding the tag is the pattern that made a missed subscription
 * invisible (see `useTranslator`'s note). Command surfaces re-render through resolution
 * (`useCommands` re-emits) and need neither hook.
 */
export function useLanguage(): LanguageTag {
  return useSyncExternalStore(
    (onStoreChange) => DefaultLanguagePackService.addChangeListener(onStoreChange),
    () => DefaultLanguagePackService.getActive(),
    () => DefaultLanguagePackService.getActive()
  );
}
