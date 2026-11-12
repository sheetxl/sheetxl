import { type RemoveListener } from '../types';

/**
 * A BCP-47 language tag. e.g. `'en'`, `'de'`, `'pt-BR'`.
 */
export type LanguageTag = string;

/**
 * A flat map of message key → message.
 *
 * Keys are dotted and namespaced by whatever owns them; this package defines no namespace of its own
 * and interprets none. A package documents its own (`@sheetxl/utils-react` owns `cmd.*` for command
 * chrome, the SDK owns its model-layer namespaces) — several packages contribute to one language
 * without collision because the prefix says who wrote it.
 *
 * Messages are ICU-subset MessageFormat: `{param}` placeholders plus
 * `{count, plural, …}` / `{value, select, …}` — see `formatMessage`. Resolved via
 * {@link ITranslator.t}.
 */
export type MessageCatalog = Record<string, string>;

/**
 * A language pack — plain data, no runtime dependencies. English is *not* a pack:
 * the inline literals in the source are the `en` catalog, so a missing key (or a
 * missing pack) always falls back to the authored English.
 *
 * This base interface carries only the GENERIC plane (`tag` + `messages`). Domain
 * planes are added by the packages that own their types via **module augmentation** —
 * the SDK augments it with the spreadsheet-language fields (`functions`, `errors`,
 * `booleans`, `functionHelp` — see `@sheetxl/sdk`'s `SpreadsheetLanguagePack`), typed
 * against the real descriptor shapes it can see. One runtime object, no shape copies,
 * and this package never reaches above itself in the dependency graph.
 */
export interface LanguagePack {
  /** The BCP-47 tag this pack translates to. */
  tag: LanguageTag;
  /**
   * Call-site messages (command chrome, dialogs, and model-layer text such as the SDK's condition
   * titles) — the host-pack twin of a package's `locales/<tag>/messages.json` slice, and the
   * app-level override hook: it outranks every package slice in the lookup chain.
   */
  messages?: MessageCatalog;
}

/** A pack module (`import()` result) or the pack itself. */
export type LanguagePackModule<T extends LanguagePack = LanguagePack> =
  ({ readonly default: T } & Record<string, unknown>) | T;

/** Lazy pack loader — typically `() => import('@sheetxl/lang-de')`. */
export type LanguagePackLoader<T extends LanguagePack = LanguagePack> = () => Promise<LanguagePackModule<T>>;

/**
 * The translation boundary. Everything user-facing resolves through this interface;
 * nothing in the SDK/UI depends on an i18n framework — only on this surface.
 *
 * Fallback contract: a missing key falls back to the authored English literal at the
 * call site (via {@link ITranslator.lookup} returning `undefined`), never to a bare key.
 */
export interface ITranslator {
  /**
   * Resolve `key` in the active language, or `undefined` on a miss (the caller then
   * falls back to its inline English literal).
   */
  lookup(key: string, params?: Record<string, unknown>): string | undefined;
  /**
   * Resolve `key` in the active language. On a miss returns the key itself —
   * use {@link lookup} when the caller has a better (English) fallback.
   */
  t(key: string, params?: Record<string, unknown>): string;
  /** `true` if the active language (or its base) has a message for `key`. */
  has(key: string): boolean;
  /** The active BCP-47 language tag. */
  readonly language: LanguageTag;
  /** Listen for language changes. Returns a remover. */
  onChange(listener: (language: LanguageTag) => void): RemoveListener;
}
