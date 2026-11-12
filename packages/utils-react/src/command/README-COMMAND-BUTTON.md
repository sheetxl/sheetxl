# Commands, Items, Groups & Surfaces

This is the API for describing **what commands exist**, **how they are grouped**, and **where they
appear** in the UI — toolbars, popups, menus, and context menus.

The model is small and recursive:

| Concept | What it is |
| --- | --- |
| **Command** | A single action — a `key`, a label, an icon, and an `execute()`. Defined elsewhere (the command registry). |
| **Entry** (`CommandButtonEntry`) | The one thing you deal in: a **button or a panel** (group). Optionally a `command` (its primary action), `members` (which make it a panel), and/or a custom `render`. **Registered** entries have a `key`; the *same shape* appears **keyless and inline** as a member of a panel's list. |
| **Member** | An element of a panel's `members` list — just a **key** (`string`, resolved registry-first), a **divider** (`'-'`/`null`), or an **inline entry**. Not a separate type. Membership is always **explicit** — a command appears in a panel only because it is listed (or it injected itself). |
| **Surface** | *Renders* a panel's members. Which widget it uses (toolbar row, split button, popup, menu) is chosen by the container — the entry is the **data**, the widget is the **presentation**. The same entry can render as a toolbar split button in one place and a submenu in another. |
| **Registry** | Where registered entries live. Reachable as a shared singleton or through React context. |

> **Status.** This document describes the intended (target) API. Pieces are landing incrementally;
> where today's code differs (e.g. a field name), treat this as the shape you should code *towards*.

---

## One shape

There is **no separate "button" vs "group" (or "item" vs "member") type**. Everything is a
**`CommandButtonEntry`** — one shape, whether it becomes a plain button, a split button, a popup, or a
fully custom control. A **registered** entry has a `key`; the *same shape* appears **keyless and inline**
as a member of a panel's `members` list. What an entry *becomes* is decided by which optional facets it
carries:

```ts
interface CommandButtonEntry {
  key?: string;                      // the ONE reference — an id when registered, a lookup when a member

  members?: (string | '-' | null | CommandButtonEntry)[];   // a list ⇒ this entry is a panel (group)
  defaultKey?: string;               // a split button's quick action (the command its primary runs)
  render?(props, groupKey?): React.ReactElement;            // a fully custom control (the escape hatch)

  // presentation — all optional:
  getLabel?(context?, groupKey?): React.ReactElement | string;
  getIcon?(context?, groupKey?): React.ReactElement | string | null;
  getDescription?(context?, groupKey?): React.ReactElement | string;

  // injection — optional (see "Inject into a panel"):
  contributions?: Record<string, { priority?: number; anchor?: string }>;
}
```

| The entry has | It renders as |
| --- | --- |
| a key → a command | a button that runs that command |
| `{ defaultKey, members }` | a **split** button — the primary runs `defaultKey`, the dropdown shows `members` |
| `{ members }` | a popup — the head just opens the list (no primary action) |
| `{ render }` | a fully custom control |
| `{ render, members }` | a custom head over a popup (e.g. a toggle group whose head reflects the active toggle) |

The only structural question is **"does it have `members`?"** — that is what makes an entry a panel
(`isCommandGroup(entry)`). **There is one reference concept — `key`.** An entry key and a command key
live in **one namespace**: an entry key must not shadow a command key, so a bare-string reference means
exactly one thing (a registered entry if it exists, else a command). That's why a split panel is named
apart from its command — e.g. the panel `dataTextToColumnsOptions` wraps the `dataTextToColumns`
command — and `defaultKey` (a command key) is a separate slot from the entry's own `key`.

## Define an item

Most items are just a `key`, some presentation, and an ordered list of `members`. A command appears
in the list because the item names it — the command itself declares nothing about where it is shown.

```ts
import { DefaultCommandButtonRegistry } from '@sheetxl/utils-react';

DefaultCommandButtonRegistry.register({
  key: 'insertImage',
  command: 'insertImageFromFile',   // the primary action of the split button
  getIcon: () => 'InsertImage',
  getDescription: () => 'Insert a picture to complement your data.',   // tooltip
  members: [
    'insertImageFromFile',
    'insertImageFromURL'
  ]
});
```

An item's own icon / label / description come from the optional `getIcon` / `getLabel` /
`getDescription(context?, groupKey?)` getters (the same shape members use). Each **member** resolves the
same way: a plain command member has the command resolve its own label/icon against the **group key**
(`command.getLabel('insertImage')`), so the same command reads differently per group; a `{ command }`
member may override with its own getters.

## Render an item

Point a surface at an item by key. By default the **caller does not choose the widget** — the
container decides. So the same registered item renders as a toolbar split button on a toolbar and as a
submenu item inside a menu:

```tsx
import { CommandGroup } from '@sheetxl/utils-mui';

<CommandGroup groupKey="insertImageOptions" />
```

- On a **toolbar** → a split button (quick action + dropdown).
- Inside a **menu** (e.g. a context menu) → a menu item whose submenu is the members list.

Its own popped content (file / URL) is always a menu; only the *trigger* changes with the container.

## Members

A member is a **key**, a **divider**, or an **inline entry** — and a key is always a `key`:

```ts
'insertImageFromFile'                        // a key → resolved registry-first (here: a command)
'-'                                          // a divider (or null)
'hideUnhide'                                 // a key → a registered panel -> nested submenu
{ key: 'gotoUrlGithub', getLabel: () => 'GitHub' }        // a key + a label override
{ key: 'dataTextToColumns', getLabel: () => 'Tab', state: '\t' }   // a key + state (parameterized)
```

Every reference is a **`key`**, resolved **registry-first**: a registered entry if one exists under
that key (a panel *or* a button), otherwise a plain command. Because entry keys and command keys share
**one namespace** (no shadowing), that resolution is deterministic — the same string always means the
same thing. An object member is just that key **plus overrides**; a *keyless* object is an inline
definition (a nested panel over its own `members`, or a custom `render`).

### Per-member presentation, state & render

An object member is a `key` reference carrying any of these overrides:

- **`getLabel` / `getIcon` / `getDescription(context?, groupKey?)`** — override how it reads *in this
  panel*. Omit them and the command resolves its own against the panel key. `getIcon` may return `null`
  to render no icon. (`groupKey` is a trailing optional — rarely needed.)
- **`state`** — passed to the command on execute, so one command can appear several times parameterized
  differently (Text-to-Columns: `dataTextToColumns` with `','` / `'\t'` / `';'` / `' '`).
- **`render(props, groupKey?)`** — a custom control for *this* entry (the same `render` signature a
  registered entry uses). Replaces the default button. It lives in the panel definition, so call sites
  stay declarative.

```ts
DefaultCommandButtonRegistry.register({
  key: 'dataTextToColumnsOptions',   // the panel's id — distinct from the command it wraps
  defaultKey: 'dataTextToColumns',   // the quick button runs the command
  getLabel: () => 'Text to Columns',
  members: [
    // each member is a key → the `dataTextToColumns` command (no entry by that name), plus overrides
    { key: 'dataTextToColumns', getLabel: () => 'Comma', state: ',' },
    { key: 'dataTextToColumns', getLabel: () => 'Tab',   state: '\t' },
    // ...
    { key: 'dataTextToColumns', getLabel: () => 'Custom',
      render: (props) => <DelimiterInput {...props} maxLength={1} /> }
  ]
});
```

### Nested panels

A member key can point at another registered **panel** (an entry that has `members`) — it renders as a
submenu. No special form; a panel is referenced by its key like anything else:

```ts
DefaultCommandButtonRegistry.register({
  key: 'cellsFormat',
  getIcon: () => 'CellsFormat',
  getLabel: () => 'Format Cells',
  members: [
    'resizeRows',
    'autoFitRows',
    '-',
    'resizeColumns',
    'autoFitColumns',
    '-',
    'hideUnhide'   // a key to a registered panel -> nested submenu
  ]
});
```

## Custom control (`render`)

The defaults (button / split button / popup) cover most items. When you need a control they don't —
one whose *head* is dynamic, or a bespoke input — give the **item** a `render`. It is the same escape
hatch a member's `render` provides, one level up: omit it for the default, provide it to take over.

A canonical case is a **toggle group** — a set of mutually-exclusive toggles whose head reflects
whichever one is active. `render` computes that from the members' live state and hands it to the
default group renderer:

```tsx
DefaultCommandButtonRegistry.register({
  key: 'underline',
  getLabel: () => 'Underline',
  members: [
    'formatUnderlinedToggle',
    'formatUnderlinedDoubleToggle',
    'formatUnderlinedAccountingToggle',
    'formatUnderlinedAccountingDoubleToggle'
  ],
  // `projectAs: 'quick'` -> the active toggle becomes the split button's primary command;
  // `projectAs: 'icon'`  -> the active toggle's icon becomes the head (which only opens the popup).
  render: (props, groupKey) => <ToggleGroupButton {...props} groupKey={groupKey} projectAs="quick" />
});
```

Because `render` receives the item's own `groupKey`, a custom renderer can resolve its members and
still delegate to the standard renderer — so `render` composes with `members` rather than replacing
the popup.

## Inject into a group (plugins)

The **other** way a member gets into a group: an item declares that it wants to be placed into a
destination group it doesn't own. This is how a plugin adds functionality to a surface it didn't
define — e.g. adding a button to the Home toolbar — using the *same* `register` call, no separate
contribution API. Groups **and** plain buttons can inject themselves.

```ts
DefaultCommandButtonRegistry.register({
  key: 'runScript',
  render: (props) => <RunScriptButton {...props} />,
  contributions: {
    homeToolbar: { anchor: 'paste', priority: 1 }   // place after the 'paste' member
  }
});
```

> Most commands never do this. They appear **only** where an item's `members` list names them.
> Injection is the opt-in for the few that want to auto-place into a shared surface.

## Ordering

Within a group, the final order is resolved like this:

1. **Explicit `members`** keep their **array position** — for a plain list with no injections, that's
   all there is (the array *is* the order; nothing else runs).
2. **Injected** items are woven in by their `contributions` placement (`{ priority?, anchor? }`) — a
   number line with the anchor (or the group edge) at `0`:
   - **`anchor`** — a member key to place relative to. Omit it to anchor the group's **edge**.
   - **`priority`** — sign picks the side (**negative** → before the anchor / at the start edge;
     **positive** → after / at the end edge); magnitude orders injections that share the same anchor.

```ts
contributions: { dataToolbar: { priority: -1 } }              // start edge, before explicit members
contributions: { homeToolbar: { anchor: 'paste', priority: 1 } }   // just after 'paste'
```

Rules of thumb:

- Anchors resolve to the **first** matching member (deterministic; duplicate keys are allowed —
  unusual but not invalid).
- A **missing** anchor falls back to the edge implied by `priority`'s sign and warns in dev.

## Use a custom registry (advanced)

Everything above uses the shared `DefaultCommandButtonRegistry` singleton. To scope a different set
of items to part of the tree, provide your own registry — descendants pick it up via context, and
anything without a provider falls back to the singleton.

```tsx
import {
  CommandButtonRegistryProvider, useCommandButtonRegistry
} from '@sheetxl/utils-react';

<CommandButtonRegistryProvider registry={myRegistry}>
  {/* <CommandGroup> and surfaces here resolve against myRegistry */}
</CommandButtonRegistryProvider>

// inside a component:
const registry = useCommandButtonRegistry(); // context registry, or the singleton
```

---

## Looking ahead

This registry will soon be wrapped again by a **generic plugin registry** — the single entry point
for clients who want to inject functionality into SheetXL (commands, items, task panes, icons, and
more) through one consistent API. The items and contributions described here are a building block of
that larger surface. Nothing to change today; it's why the model is kept declarative and
data-first.
