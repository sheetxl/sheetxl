/**
 * Persistence key for the user's UI-language preference.
 *
 * @remarks
 * Owned via `usePersistentState` against the surrounding `PersistentStateProvider` (Studio, or a
 * standalone host) — the mirror of `ThemeStateKey` in `@sheetxl/react`. A host that wants to read
 * or seed it (e.g. the VS Code extension, whose store bridges to the extension host's state) does
 * so with the same key, or by supplying its own provider/store. The value is a BCP 47 tag; absent
 * means "no preference" and the pack service default stands.
 */
export const LanguageStateKey = {
  /** The user's UI-language override (`null` = no preference). */
  Active: 'language',
} as const;
