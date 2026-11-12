import { type LanguageTag } from '@sheetxl/utils';

import { type IKeyStroke, type KeyModifiers } from '../types';

import { type ICommandDefinition } from './ICommandDefinition';

/** Canonical modifier order for serializing a shortcut string (VSCode convention). */
const MODIFIER_ORDER: readonly KeyModifiers[] = ['ctrl', 'shift', 'alt', 'meta'];
const MODIFIER_SET = new Set<string>(MODIFIER_ORDER);

/**
 * Parse a compact VSCode-style shortcut string (`'ctrl+shift+h'`, `'alt+='`, `'ctrl+Semicolon'`)
 * into an {@link IKeyStroke}. Modifiers are the `+`-joined leading tokens (case-insensitive
 * `ctrl|shift|alt|meta`); the LAST token is the key, kept verbatim (our key tokens — `Semicolon`,
 * `F9`, `"` — are not remapped). An unknown leading token is treated as part of the key defensively.
 */
export function parseShortcutString(str: string): IKeyStroke {
  const parts = str.split('+');
  const key = parts[parts.length - 1];
  const modifiers: KeyModifiers[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const m = parts[i].toLowerCase();
    if (MODIFIER_SET.has(m)) modifiers.push(m as KeyModifiers);
  }
  return modifiers.length ? { key, modifiers } : { key };
}

/**
 * Serialize an {@link IKeyStroke} to the compact string form, modifiers in {@link MODIFIER_ORDER}.
 * Inverse of {@link parseShortcutString}. (Used by the migration codemod / any writer.)
 */
export function serializeShortcut(stroke: IKeyStroke): string {
  const mods = (stroke.modifiers ?? [])
    .slice()
    .sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...mods, stroke.key].join('+');
}

/**
 * The JSON-serializable **chrome** for one command — the literal subset of
 * {@link ICommandDefinition} (everything except callbacks/state/context, which stay in the
 * `…Dynamic` TS half). This is the per-command record inside a {@link CommandCatalog}, the
 * source of truth for a command's presentation (I18N-DESIGN.md decision 8).
 *
 * Field names are the compact catalog form; {@link chromeToPartial} maps them onto the
 * `ICommandDefinition` names (`desc → description`, `group → groupLabels`). Only literal
 * values live here — a dynamic (function) label such as `selectNamed`'s stays in the dynamic
 * contribution and wins at resolve time (functions always beat the catalog).
 */
export interface ChromeRecord {
  /** Command label. May contain `{param}` placeholders once the parameterized path is wired. */
  label?: string;
  /** Command description. */
  description?: string;
  /**
   * Per-surface label overrides keyed by groupKey (the flat-pack `cmd.<key>.label@<groupKey>` variants) —
   * e.g. `{ view: 'Row Gridlines', gridlinesOptions: 'Rows' }`. Same field/shape as
   * {@link ICommandDefinition.groupLabels}.
   */
  groupLabels?: Record<string, string>;
  /**
   * Per-surface description overrides keyed by groupKey — the `description` twin of
   * {@link groupLabels}. Same field/shape as {@link ICommandDefinition.groupDescriptions}.
   */
  groupDescriptions?: Record<string, string>;
  /** Icon glyph key (string only — React-element icons stay dynamic/TS). */
  icon?: string;
  /**
   * Per-surface icon overrides keyed by groupKey. Legitimate but **bad hygiene** across scopes
   * (I18N-DESIGN.md decision 8): an icon should normally be identical everywhere a command appears.
   */
  groupIcons?: Record<string, string>;
  /**
   * Keyboard shortcut(s), compact VSCode-style: `'ctrl+shift+h'`, `'alt+='`. An array is a list
   * of alternative bindings. Parsed to {@link IKeyStroke} at load via {@link parseShortcutString}.
   *
   * `null` means **explicitly unbound in this locale** (the usual convention: `undefined` = take
   * the default, `null` = exclude it). A locale pack inherits English shortcuts by *absence*, so
   * `null` is the only way for a locale to drop one — needed when a localized mnemonic claims a
   * chord English gives to some other command (de Bold takes `ctrl+shift+F`, so de
   * `formatCellsFont` must give it up). See `config/i18n-catalog-build.mjs`.
   */
  shortcut?: string | string[] | null;
  /** Accumulated metadata tags (e.g. `'mutator'`, `'quickAction'`). */
  tags?: string[];
  /**
   * Other scopes that BORROW this command (in addition to the file's owner {@link CommandCatalog.scope}).
   * A command lives in its owner's file; `borrow` seeds it into the listed scopes too — e.g. the insert
   * commands are editor-owned with `borrow: ['sheet']`; undo is sheet-owned with `borrow: ['workbook']`.
   * Routing metadata only — not part of the command chrome.
   */
  borrow?: string[];
  /**
   * **Default message parameters** for parameterized (ICU-subset) `label`/`groupLabels`/
   * `description` messages — e.g. `{ "count": 1, "mode": "none" }` for
   * `"{count, plural, one{Insert Row} other{Insert # Rows}}"`. Seeded into the definition so
   * pre-mount surfaces (shortcut dialog, command palette) render the sensible default; a dynamic
   * contributor overrides with live values (`ICommandDefinition.params`). Copied from English by
   * the build (never translated) — messages localize, parameter defaults don't.
   */
  params?: Record<string, unknown>;
}

/**
 * A per-`(scope, language)` command catalog — externalized, structured command chrome.
 * Shipped as `<name>.cmd.<tag>.json` (English default `<name>.cmd.en.json`,
 * locales `<name>.cmd.de.json`), one file per owning scope (a source). Each shipped locale file is a
 * COMPLETE pack (the dev-pipeline copies untranslated fields from the default), loaded at runtime via
 * fetch — see {@link fetchCatalog}.
 *
 * `scope` is the {@link CommandRegistry} **name** these commands seed onto (`'sheet'`, `'workbook'`,
 * `'selection'`, `'movable'`, `'editor'`, `'app'`, `'scriptEditor'`, …) — the same name a
 * {@link CommandScope} carries. Because each scope seeds under its own registry name and carries its
 * own localized strings, per-scope localization falls out of the scope-chain fold. Commands can also be
 * BORROWED into other scopes via {@link ChromeRecord.borrow}.
 */
export interface CommandCatalog {
  /** Optional pointer to the envelope JSON Schema (editor validation). */
  $schema?: string;
  /** The registry scope name these commands OWN (seed onto). */
  scope: string;
  /** Human-readable, localizable display name for {@link scope} (e.g. the shortcut-keys dialog grouping). */
  label?: string;
  /** BCP-47 language tag; `'en'` is the default. */
  tag: LanguageTag;
  /** Envelope format version, for forward-compatible migrations. */
  version: number;
  /** commandKey → chrome. */
  commands: Record<string, ChromeRecord>;
}

/** A catalog module (`import()` result) or the catalog itself. */
export type CommandCatalogModule =
  ({ readonly default: CommandCatalog } & Record<string, unknown>) | CommandCatalog;

/**
 * A package's `locales/manifest.json` — the build-emitted index the loader reads to register every
 * available locale's packs. `locales` lists the available BCP-47 tags (`en` always first); `catalogs`
 * maps each catalog file to the {@link CommandCatalog.scope} it owns + its source id.
 */
export interface CommandCatalogManifest {
  locales: string[];
  catalogs: { file: string; scope: string; sourceId: string }[];
}

/**
 * Narrow a fetched/parsed catalog payload to {@link CommandCatalog}. The single documented cast
 * boundary — the data is generated by the codemod and schema-validated, so it is trusted here.
 */
export function asCommandCatalog(json: unknown): CommandCatalog {
  return json as CommandCatalog;
}

/**
 * Fetch a catalog JSON by URL (the runtime-fetch model — packs ship as data files in `dist`, not
 * inlined into the code bundle, so command strings stay out of the JS and user-supplied packs can be
 * pointed at their own URL). Typically wrapped in a lazy loader:
 * `register(domain, tag, () => fetchCatalog(new URL('./sheet.cmd.json', import.meta.url)))`.
 */
export async function fetchCatalog(url: string | URL): Promise<CommandCatalog> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch command catalog '${String(url)}': ${res.status} ${res.statusText}`);
  return asCommandCatalog(await res.json());
}

/** Lazy catalog loader — typically `() => import('.../sheet.cmd.de.json')`. */
export type CommandCatalogLoader = () => Promise<CommandCatalogModule>;

/**
 * Convert a {@link ChromeRecord} to the `Omit<ICommandDefinition, 'key'>` partial the registry
 * seeds: rename `desc → description` / `group → groupLabels`, drop `undefined` fields, and parse the
 * compact `shortcut` string(s) into {@link IKeyStroke}(s). `params` seeds the message-parameter
 * DEFAULTS (dynamic contributors override with live values).
 *
 * This is the boundary between JSON-imported catalogs and the typed command model.
 */
export function chromeToPartial(rec: ChromeRecord): Omit<ICommandDefinition, 'key'> {
  const partial: Omit<ICommandDefinition, 'key'> = {};
  if (rec.label !== undefined) partial.label = rec.label;
  if (rec.description !== undefined) partial.description = rec.description;
  if (rec.groupLabels !== undefined) partial.groupLabels = rec.groupLabels;
  if (rec.groupDescriptions !== undefined) partial.groupDescriptions = rec.groupDescriptions;
  if (rec.icon !== undefined) partial.icon = rec.icon;
  if (rec.groupIcons !== undefined) partial.groupIcons = rec.groupIcons;
  // `null` = explicitly unbound in this locale ⇒ contribute NO shortcut (not a parsed one).
  if (rec.shortcut !== undefined && rec.shortcut !== null) {
    partial.shortcut = Array.isArray(rec.shortcut)
      ? rec.shortcut.map(parseShortcutString)
      : parseShortcutString(rec.shortcut);
  }
  if (rec.tags !== undefined) partial.tags = rec.tags;
  if (rec.params !== undefined) partial.params = rec.params;
  return partial;
}

/**
 * Merge a default (English) chrome record with a locale-override record, per field. Used by the
 * **build/dev pipeline** that emits COMPLETE per-locale packs (English filled where untranslated —
 * I18N-DESIGN.md decision #1), NOT at runtime: the runtime seeds one already-complete pack, no merge.
 * A locale override typically carries only `label`/`desc`/`group`, so unspecified fields fall through
 * to the default; `group` is merged per groupKey.
 */
export function mergeChrome(base: ChromeRecord | undefined, override: ChromeRecord | undefined): ChromeRecord {
  if (!override) return base ?? {};
  if (!base) return override;
  return {
    ...base,
    ...override,
    // Per-surface maps merge per groupKey (an override may translate only some surfaces).
    groupLabels: (base.groupLabels || override.groupLabels)
      ? { ...base.groupLabels, ...override.groupLabels }
      : undefined,
    groupDescriptions: (base.groupDescriptions || override.groupDescriptions)
      ? { ...base.groupDescriptions, ...override.groupDescriptions }
      : undefined,
    groupIcons: (base.groupIcons || override.groupIcons)
      ? { ...base.groupIcons, ...override.groupIcons }
      : undefined,
  };
}
