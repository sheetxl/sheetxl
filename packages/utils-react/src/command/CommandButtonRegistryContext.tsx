import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

import { DefaultLanguagePackService } from '@sheetxl/utils';

import { DefaultCommandButtonRegistry, type ICommandButtonRegistry } from './CommandButtonRegistry';
import { DefaultCommandRegistry } from './CommandRegistry';

/**
 * Provides an {@link ICommandButtonRegistry} to descendants. When no provider is present the shared
 * {@link DefaultCommandButtonRegistry} singleton is used (see {@link useCommandButtonRegistry}), so
 * this is purely additive - a host may wrap a subtree to override contributions without affecting
 * anyone still reaching for the singleton directly.
 */
export const CommandButtonRegistryContext = createContext<ICommandButtonRegistry | null>(null);

/**
 * Returns the {@link ICommandButtonRegistry} from context, falling back to the shared
 * {@link DefaultCommandButtonRegistry} singleton when no {@link CommandButtonRegistryProvider} is
 * mounted above.
 *
 * Subscribes to the language service: registered entries' `getLabel`/`getDescription` resolve
 * through it (see `CommandButtonRegistry`'s translate wrapper), so any component reading entry
 * chrome through this hook re-renders on a language switch — no per-consumer subscription
 * needed. (Command surfaces additionally refresh via `useCommands`' resolver version.)
 */
export function useCommandButtonRegistry(): ICommandButtonRegistry {
  // Two sources drive entry chrome: the language tag (flat-pack strings for non-command entries) AND
  // the command registry version — a command-mirroring entry reads the catalog-seeded command chrome,
  // which arrives ASYNCHRONOUSLY after a language switch (the pack is fetched). A language-tag-only
  // snapshot would render before the new locale's packs seed and never re-render.
  // A THIRD source: the button registry itself. Entries are usually registered once at init, but a
  // feature can contribute one **dynamically** (e.g. a contextual ribbon tab added while a table is
  // selected); surfaces that resolve members must re-render when that happens, so we snapshot its
  // version too.
  useSyncExternalStore(
    (onStoreChange) => {
      const removeLang = DefaultLanguagePackService.addChangeListener(onStoreChange);
      const removeRegistry = DefaultCommandRegistry.addListener({ onChange: onStoreChange });
      const removeButtons = DefaultCommandButtonRegistry.addListener({ onChange: onStoreChange });
      return () => { removeLang(); removeRegistry(); removeButtons(); };
    },
    () => `${DefaultLanguagePackService.getActive()}:${DefaultCommandRegistry.getVersion()}:${DefaultCommandButtonRegistry.getVersion()}`,
    () => `${DefaultLanguagePackService.getActive()}:${DefaultCommandRegistry.getVersion()}:${DefaultCommandButtonRegistry.getVersion()}`
  );
  return useContext(CommandButtonRegistryContext) ?? DefaultCommandButtonRegistry;
}

export interface CommandButtonRegistryProviderProps {
  /**
   * The registry to provide to descendants.
   *
   * @defaultValue the shared {@link DefaultCommandButtonRegistry} singleton.
   */
  registry?: ICommandButtonRegistry;
  children: ReactNode;
}

/**
 * Provides an {@link ICommandButtonRegistry} to descendants. Optional - descendants default to the
 * shared {@link DefaultCommandButtonRegistry} singleton when this is absent.
 */
export function CommandButtonRegistryProvider({
  registry = DefaultCommandButtonRegistry,
  children
}: CommandButtonRegistryProviderProps): ReactNode {
  return (
    <CommandButtonRegistryContext.Provider value={registry}>
      {children}
    </CommandButtonRegistryContext.Provider>
  );
}
