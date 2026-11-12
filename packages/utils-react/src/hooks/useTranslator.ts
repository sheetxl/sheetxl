import { useMemo, useSyncExternalStore } from 'react';

import { DefaultLanguagePackService } from '@sheetxl/utils';

/**
 * The call-site translate function: `t(key, params?)`.
 *
 * The English is NOT a parameter — it lives only in the package's `locales/en/messages.json`
 * (I18N-DESIGN.md decision 9), and a pack overlays by key. A miss renders the key: visible and
 * debuggable, never blank.
 */
export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>
) => string;

/**
 * The **React** binding for call-site (`t()`) strings — subscribes to the active language and
 * returns a `t` bound to it.
 *
 * Use this instead of importing `t` from `@sheetxl/utils` inside a component. The module-level
 * `t` reads a singleton, so React cannot know its value changed on a language switch: a component
 * calling it had to *separately* remember to subscribe (a bare `useLanguage()`), and forgetting
 * was invisible — the string simply froze at whatever language was active when the component
 * mounted. (That is not hypothetical: the Name Box tooltip shipped exactly that way.) Taking `t`
 * from this hook makes the subscription inseparable from the use — the same reason
 * react-i18next hands you `t` from `useTranslation()` rather than exporting it.
 *
 * The returned function's **identity changes when the language changes**, so it is the natural
 * memo dependency for anything that bakes a translated string:
 *
 * ```tsx
 * const t = useTranslator();
 * const items = useMemo(() => [{ label: t('formulaBar.cancel') }], [t]);
 * ```
 *
 * The module-level `t` remains exported for **non-React** contexts (and is what this delegates to).
 */
export function useTranslator(): TranslateFn {
  // Subscribe to the service REVISION, not the language tag: a tag-only snapshot (`useLanguage`) is
  // unchanged when a package's catalog lands for the language already in use, so `useSyncExternalStore`
  // would `Object.is`-bail and the string stays frozen on the key it first missed (the initial-load
  // race). The revision advances on every notify — switch AND late load — so this re-renders on both.
  const revision = useSyncExternalStore(
    (onStoreChange) => DefaultLanguagePackService.addChangeListener(onStoreChange),
    () => DefaultLanguagePackService.getRevision(),
    () => DefaultLanguagePackService.getRevision()
  );
  // Re-created per revision so consumers can depend on `t` identity instead of threading the tag.
  return useMemo<TranslateFn>(() => (key, params) => {
    return DefaultLanguagePackService.lookup(key, params) ?? key;
  }, [revision]);
}
