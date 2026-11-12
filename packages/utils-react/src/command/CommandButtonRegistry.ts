import type React from 'react';

import { DefaultLanguagePackService, formatMessage } from '@sheetxl/utils';

import { type CommandButtonProps } from './Types';
import { DefaultCommandRegistry } from './CommandRegistry';

/**
 * The one thing the command-button registry deals in - a **button or a panel** (group). One shape,
 * whether it becomes a plain button, a split button, a popup, or a fully custom control.
 *
 * There is **one reference concept: `key`.** A registered entry *has* a `key` (its id); a member
 * *is* a `key` - a bare string, resolved **registry-first** against that same registry (a registered
 * entry if one exists, otherwise a plain command). The same shape also appears **keyless and inline**
 * as a member (`{ key, state, render, … }` = a reference + overrides, or a keyless nested panel). Keys
 * are a **single namespace**: an entry key must not shadow a command key, so a reference always means
 * exactly one thing. What an entry *becomes*:
 *
 * - `members` - a list; **its presence makes the entry a panel (group)** ({@link isCommandGroup}).
 * - `defaultKey` - a split button's quick action (the command its primary half runs).
 * - `render`  - a fully custom control (the escape hatch); omit for the default button / split / popup.
 */
export interface CommandButtonEntry<STATE=any, CONTEXT=any> {
  /**
   * The **one reference**. On a *registered* entry it is its id (how it is referenced / injected /
   * replaced; {@link ICommandButtonRegistry.register} requires it). On a *member* it is what to
   * resolve, registry-first (a registered entry, else a plain command) - so a bare-string member is
   * shorthand for `{ key }`.
   */
  readonly key?: string;

  /**
   * A split button's **quick action** - the command key its primary ("quick") half runs, next to the
   * `members` dropdown. A command-registry key (distinct from this entry's own `key`); omit for a
   * plain popup (head just opens the list).
   */
  readonly defaultKey?: string;

  /**
   * Render the entry's **label as visible content** on a toolbar button (in addition to any icon /
   * split-toggle checkmark), not just as its tooltip. Toolbar buttons are icon-only by default; set
   * this for the deliberate text buttons (e.g. `Gridlines`, `Workbook View`) and the icon+text ones
   * (e.g. `Text to Columns`). No effect on menu items, which always show their label.
   * @defaultValue false
   */
  readonly showLabel?: boolean;

  /**
   * The ordered list members - each a **key** (`string`, resolved registry-first), a **divider**
   * (`'-'` / `null`), or an **inline** entry. Its presence makes this entry a panel (group).
   */
  readonly members?: (string | '-' | null | CommandButtonEntry)[];

  /** Optional state passed to the resolved command on execute (parameterizes a reused command). */
  readonly state?: STATE;

  /**
   * Optional custom renderer - the **escape hatch**. **Omit** for the default control (a button, a
   * split button, or a popup, per the facets above). **Provide** to fully render it yourself - e.g. a
   * host renders the same command its own way (the studio opens the Monaco pane, a VSCode host a native
   * control), or a toggle group whose head reflects the active member. A **panel** entry's `render`
   * receives the entry's own key as `groupKey` (so it can resolve its members); a **leaf** entry's
   * `render` receives the resolved leaf button props. May render `null` internally to self-hide.
   */
  readonly render?: (props: CommandButtonProps<STATE, CONTEXT>, groupKey?: string) => React.ReactElement;

  /** Label (usually the button / menu text). `groupKey` = the panel it renders in (rarely needed). */
  readonly getLabel?: (groupKey?: string) => React.ReactElement | string;
  /** Description (usually the tooltip). */
  readonly getDescription?: (groupKey?: string) => React.ReactElement | string;
  /**
   * Icon. A string resolves via `DynamicIcon`. Return `null` to render **no** icon (a deliberate
   * blank); return `undefined` - or omit the getter - to let the resolved command supply its own.
   */
  readonly getIcon?: (groupKey?: string) => React.ReactElement | string | null | undefined;

  /**
   * Destinations this entry injects itself into, keyed by destination panel key - each value a
   * {@link Placement} describing *where* in that panel this entry lands. Woven into the destination by
   * {@link ICommandButtonRegistry.resolveMembers}.
   */
  readonly contributions?: Record<string, Placement>;
}


export interface ICommandButtonRegistry {
  /**
   * Registers an entry (requires a `key`). Replacing (`replace: true`) an entry with the same key
   * overwrites it.
   *
   * @remarks
   * In dev, warns when an entry key **shadows** the command it wraps (`key === defaultKey`) - entry
   * and command keys are one namespace, so name the panel apart (e.g. `${key}Options`). This is a
   * convention-only check: without visibility into the command registry it can only catch the command
   * an entry names via `defaultKey`, not an arbitrary command key. Suppressed when `replace` is true.
   * @param entry The entry (must have a `key`).
   * @param replace Whether to replace an existing entry with the same key. Default is false.
   * @returns A function that removes this registration. It does nothing once the key is unregistered
   * or registered again by someone else.
   */
  register(entry: CommandButtonEntry & { key: string }, replace?: boolean): () => void;

  /**
   * Unregister an item.
   * @param key The unique key for the item.
   */
  unregister(key: string): void;

  /**
   * Gets a registered item's **definition** by key (a plain dictionary lookup).
   * @param key The unique key for the item.
   * @returns The registered item or `null` if not found.
   */
  get(key: string): CommandButtonEntry | null;

  /**
   * Resolves a panel's final **member list**: its own `members` woven with every entry that injects
   * itself into the panel via `contributions`, ordered. Pure with respect to the current registry
   * snapshot. Returns `null` if the panel is not registered.
   *
   * @param groupKey The panel to resolve.
   */
  resolveMembers(groupKey: string): (string | '-' | null | CommandButtonEntry)[] | null;

  /**
   * Monotonic version, bumped on every {@link register} / {@link unregister}. Surfaces snapshot it
   * (with {@link addListener}) so a **dynamically** contributed entry — e.g. a contextual ribbon tab a
   * feature adds while its selection is active — re-resolves reactively, not just at init.
   */
  getVersion(): number;

  /**
   * Subscribe to register/unregister mutations. Returns an unsubscribe. Paired with {@link getVersion}
   * this drives `useCommandButtonRegistry`'s re-render on dynamic contributions.
   */
  addListener(listener: { onChange?(): void }): () => void;
}

/** The key an injection anchors against (`null` for dividers). */
const memberKey = (m: string | '-' | null | CommandButtonEntry): string | null => {
  if (!m || m === '-') return null;
  if (typeof m === 'string') return m.toLowerCase();
  return m.key?.toLowerCase() ?? null;
};

/**
 * Where one contributed {@link CommandButtonEntry} lands inside a destination panel - the value of a
 * single {@link CommandButtonEntry.contributions} entry, keyed there by the destination panel's key.
 *
 * An injection is positioned relative to an `anchor` (an existing member of the destination) or, with
 * no anchor, relative to the panel's edge. Which *side* of that anchor / edge, and the order among
 * injections that share it, both come from {@link order}. Woven into the destination's member list
 * by {@link ICommandButtonRegistry.resolveMembers}.
 */
export type Placement = {
  /**
   * The key of an existing member in the destination panel to position this injection next to; which
   * *side* is chosen by the sign of {@link order}. Case-insensitive. Omit to target the panel's edge
   * instead (again per `order`'s sign). An anchor not found in the panel falls back to that edge
   * (and warns in dev).
   */
  readonly anchor?: string;
  /**
   * Does double duty: its **sign** picks the side of the `anchor` (or edge) - negative = before /
   * start edge, positive (or `0`) = after / end edge - and its **magnitude** orders injections that
   * share the same anchor / edge. Defaults to `0`. Remaining ties break by registration order.
   */
  readonly order?: number;
  /**
   * Ask the surface to emit a separator adjacent to this injected item (`'before'` / `'after'` /
   * `'both'`). Leading, duplicate, and trailing separators are trimmed at render, so it reads as
   * "start a new group here".
   */
  readonly divider?: 'before' | 'after' | 'both';
};

/** Case-insensitive lookup of a placement for a destination key. */
const findPlacement = (
  points: Record<string, Placement> | undefined,
  destLower: string
): Placement | undefined => {
  if (!points) return undefined;
  for (const k in points) {
    if (k.toLowerCase() === destLower) return points[k];
  }
  return undefined;
};

/**
 * Wrap a registered entry's `getLabel`/`getDescription` so they resolve localized chrome. Entry keys and
 * command keys are ONE namespace, so resolution is two-tier:
 *
 * 1. **Command chrome** — if the key names a real command, its label/description come from the command
 *    registry, which the `CommandCatalogService` seeds with the ACTIVE locale's pack (and re-seeds on a
 *    language switch). This is where every command-mirroring button gets its translation.
 * 2. **Flat pack** (`cmd.<key>.label` / `.desc`, `label@<groupKey>` first) — for entries that are NOT
 *    commands (ribbon tabs, panels, groups); those strings live in the language pack.
 *
 * Miss on both ⇒ delegate to the authored function (the inline English IS the en catalog). Only authored
 * getters are wrapped — a pack cannot conjure chrome the entry never had.
 */
function translateEntry(entry: CommandButtonEntry & { key: string }): CommandButtonEntry & { key: string } {
  const { getLabel, getDescription, getIcon } = entry;
  const key = entry.key;
  const translated = { ...entry };
  // Getters are attached even when the entry authors NONE: the catalog is the source of truth for
  // English too (no inline-literal fallback layer), so a panel's chrome may live entirely in JSON.
  // Absence of text is signalled by the getter RETURNING undefined, not by the getter being missing.
  {
    // The getter may legitimately resolve nothing (no catalog, no authored literal) and return
    // undefined — every call site guards with `?? fallback`. Widen the cast's return past the entry
    // interface's `ReactElement | string` so the final `?? authored` needs no non-null assertion.
    (translated as { getLabel: (groupKey?: string) => React.ReactElement | string | undefined }).getLabel = (groupKey?) => {
      // `groupKey === key` is the entry resolving its own head (not a surface scope) — plain key.
      const surface = groupKey && groupKey !== key ? groupKey : undefined;
      // 1. Localized command chrome (catalog-seeded) when this entry mirrors a command.
      const def = DefaultCommandRegistry.findByKey(key)?.def;
      const fromCommand = (surface ? def?.groupLabels?.[surface] : undefined) ?? def?.label;
      // Parameterized (ICU-subset) labels — `{dark, select, …}`, `{n, plural, …}` — must be formatted
      // with the command's live `params`, exactly as the command's own `getLabel` does; otherwise the
      // entry path (e.g. a `quickCommand`'s display) renders the raw template.
      if (typeof fromCommand === 'string') {
        return def?.params
          ? formatMessage(fromCommand, def.params, DefaultLanguagePackService.getActive())
          : fromCommand;
      }
      // 2. Flat pack — non-command entries (ribbon tabs / panels / groups).
      const scoped = surface ? DefaultLanguagePackService.lookup(`cmd.${key}.label@${surface}`) : undefined;
      // 3. Authored literal, if the entry still carries one (deliberate exception).
      return scoped ?? DefaultLanguagePackService.lookup(`cmd.${key}.label`) ?? getLabel?.(groupKey);
    };

    (translated as { getDescription: (groupKey?: string) => React.ReactElement | string | undefined }).getDescription = (groupKey?) => {
      const surface = groupKey && groupKey !== key ? groupKey : undefined;
      const def = DefaultCommandRegistry.findByKey(key)?.def;
      const fromCommand = (surface ? def?.groupDescriptions?.[surface] : undefined) ?? def?.description;
      if (typeof fromCommand === 'string') {
        return def?.params
          ? formatMessage(fromCommand, def.params, DefaultLanguagePackService.getActive())
          : fromCommand;
      }
      const scoped = surface ? DefaultLanguagePackService.lookup(`cmd.${key}.desc@${surface}`) : undefined;
      return scoped ?? DefaultLanguagePackService.lookup(`cmd.${key}.desc`) ?? getDescription?.(groupKey);
    };

    // Icons don't translate, but they follow the same source-of-truth rule: a string glyph key is
    // DATA and belongs in the catalog (`icon` / `groupIcons` on the entry's record) — only composed
    // React-element icons stay authored in TS. Catalog icon wins; authored getter is the fallback.
    //
    // An entry that authors NO getter resolves to `undefined`, not `null`: an entry is not required to
    // specify an icon, and `null` is the deliberate "render a blank" signal that stops the surface from
    // falling back to the command the entry wraps (e.g. a leaf entry's `defaultKey`, whose icon may be
    // dynamic and is therefore only knowable from the command).
    (translated as { getIcon: CommandButtonEntry['getIcon'] }).getIcon = (groupKey?) => {
      const surface = groupKey && groupKey !== key ? groupKey : undefined;
      const def = DefaultCommandRegistry.findByKey(key)?.def;
      const fromCommand = (surface ? def?.groupIcons?.[surface] : undefined) ?? def?.icon;
      if (typeof fromCommand === 'string') return fromCommand;
      return getIcon ? getIcon(groupKey) : undefined;
    };
  }
  return translated;
}

class CommandButtonRegistry implements ICommandButtonRegistry {
  protected _items: Map<string, CommandButtonEntry> = new Map();
  protected _version = 0;
  protected _listeners = new Set<{ onChange?(): void }>();

  /** @inheritdoc ICommandButtonRegistry.getVersion */
  getVersion(): number { return this._version; }

  /** @inheritdoc ICommandButtonRegistry.addListener */
  addListener(listener: { onChange?(): void }): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  protected _notify(): void {
    this._version++;
    this._listeners.forEach((l) => l.onChange?.());
  }

  /** @inheritdoc ICommandButtonRegistry.register */
  register(entry: CommandButtonEntry & { key: string }, replace: boolean = false): () => void {
    const key = entry.key.toLowerCase();
    if (!replace && this._items.has(key)) {
      throw new Error(`Command item with key '${key}' is already registered.`);
    }
    // Dev-only shadow guard. Entry keys and command keys share one namespace, so an entry must not
    // shadow a command (or a bare-string member reference becomes ambiguous). The button registry
    // cannot (yet) see the command registry to verify this in general - that cross-registry coupling
    // is future work - so by convention we only catch the one command an entry provably references:
    // its own `defaultKey`. A panel whose `key` equals its `defaultKey` shadows the command it wraps;
    // name it apart (e.g. `${key}Options`). Skipped when `replace` is set (a deliberate override).
    if (__DEV__ && !replace && entry.defaultKey && key === entry.defaultKey.toLowerCase()) {
      console.warn(
        `Command button entry '${entry.key}' shadows the command it wraps ('${entry.defaultKey}'). ` +
        `Entry and command keys are one namespace - name the panel apart (e.g. '${entry.key}Options').`
      );
    }
    const registered = translateEntry(entry);
    this._items.set(key, registered);
    this._notify();
    return (): void => {
      if (this._items.get(key) !== registered) return;
      this._items.delete(key);
      this._notify();
    };
  }

  /** @inheritdoc ICommandButtonRegistry.unregister */
  unregister(key: string): void {
    key = key.toLowerCase();
    if (!this._items.has(key)) {
      throw new Error(`Command item with key '${key}' is not registered.`);
    }
    this._items.delete(key);
    this._notify();
  }

  /** @inheritdoc ICommandButtonRegistry.get */
  get(key: string): CommandButtonEntry | null {
    if (!key) return null;
    return this._items.get(key.toLowerCase()) ?? null;
  }

  /** @inheritdoc ICommandButtonRegistry.resolveMembers */
  resolveMembers(key: string): (string | '-' | null | CommandButtonEntry)[] | null {
    const keyLower = key?.toLowerCase();
    const entry =  keyLower ? this._items.get(keyLower) : null;
    if (!entry || !Array.isArray(entry.members)) return null;
    const explicit = entry.members;

    // Keys already placed explicitly. An explicit member is authoritative: it wins over the same
    // entry's self-contribution into this panel, which would otherwise inject a duplicate. (Explicit
    // placement is a deliberate override — e.g. a tab lists `formatTableStyle` at its own spot even
    // though `formatTableStyle` also contributes itself into that tab.)
    const explicitKeys = new Set<string>();
    for (const m of explicit) {
      const k = memberKey(m);
      if (k) explicitKeys.add(k);
    }

    // Entries that inject themselves into this panel (each resolves as a member), minus any already
    // placed explicitly.
    const injected: { key: string; placement: Placement; seq: number }[] = [];
    let seq = 0;
    for (const item of this._items.values()) {
      const itemKey = item.key;
      if (!itemKey || itemKey.toLowerCase() === keyLower) continue;
      if (explicitKeys.has(itemKey.toLowerCase())) continue; // explicit member wins; skip its contribution
      const placement = findPlacement(item.contributions, keyLower);
      if (placement) injected.push({ key: itemKey, placement, seq: seq++ });
    }
    // Pay-for-what-you-use: no injections → the array *is* the order, no weaving.
    if (injected.length === 0) return explicit;

    type Entry = { member: string | '-' | null | CommandButtonEntry; primary: number; secondary: number; seq: number; divider?: 'before' | 'after' | 'both' };
    const entries: Entry[] = explicit.map((m, i) => ({ member: m, primary: i, secondary: 0, seq: -1 }));
    for (const inj of injected) {
      const order = inj.placement.order ?? 0;
      let primary: number;
      if (inj.placement.anchor) {
        const anchorLower = inj.placement.anchor.toLowerCase();
        const idx = explicit.findIndex((m) => memberKey(m) === anchorLower);
        if (idx >= 0) {
          primary = idx;
        } else {
          if (__DEV__) console.warn(`Injection anchor '${inj.placement.anchor}' not found in group '${key}'.`);
          primary = order < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
        }
      } else {
        primary = order < 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      }
      // A bare-string member resolves registry-first, so the injected item renders as itself.
      entries.push({ member: inj.key, primary, secondary: order, seq: inj.seq, divider: inj.placement.divider });
    }
    entries.sort((a, b) => {
      if (a.primary !== b.primary) return a.primary < b.primary ? -1 : 1; // handles ±Infinity
      if (a.secondary !== b.secondary) return a.secondary - b.secondary;
      return a.seq - b.seq;
    });
    // Weave in the separators a contribution asked for. Over-emitting is safe: the surface trims
    // leading / duplicate / trailing dividers, so `divider: 'before'` reads as "start a new group".
    const result: (string | '-' | null | CommandButtonEntry)[] = [];
    for (const e of entries) {
      if (e.divider === 'before' || e.divider === 'both') result.push('-');
      result.push(e.member);
      if (e.divider === 'after' || e.divider === 'both') result.push('-');
    }
    return result;
  }
}

/**
 * Shared default command button registry.
 *
 * @remarks
 * Plugins register their toolbar/menu items here; host surfaces (ribbon toolbars, overflow palettes,
 * context menus) render them via {@link ICommandButtonRegistry.resolveMembers}.
 */
export const DefaultCommandButtonRegistry: ICommandButtonRegistry = new CommandButtonRegistry();
