import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { emphasize } from '@mui/material';
import { Box } from '@mui/material';
import { Chip } from '@mui/material';
import { TextField } from '@mui/material';
import { Checkbox } from '@mui/material';
import { Tooltip } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { Typography } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { IconButton } from '@mui/material';

import { TimerUtils, CommonUtils } from '@sheetxl/utils';
import {
  KeyCodes, KeyModifiers, DynamicIcon, ReactUtils, useTranslator,
  keyStrokeToCanonical, keyEventCanonicals, type IKeyStroke
} from '@sheetxl/utils-react';

import { createShortcutSearch } from './_ShortcutSearch';

/**
 * The minimal read-only view of a command the shortcut table needs (label, icon, description, shortcut).
 * Kept small on purpose so the panel stays decoupled from the full command type.
 */
export interface ShortcutKeysCommand {
  getLabel(): string;
  getIcon(): any;
  getDescription(): string;
  getShortcut(): any;
  /** The command's home **scope** name (registry name) — the stable grouping/filter key. */
  getScope?(): string;
  /** The scope's localized display name (falls back to the scope key). Shown in the section header. */
  getScopeLabel?(): string;
}
/** Supplies the commands the shortcut table lists. */
export interface ShortcutKeysCommandSource {
  getAllCommands(): { command: ShortcutKeysCommand; groupKey: string }[];
}

export interface ShortcutKeysPanelProps {
  commands: ShortcutKeysCommandSource;
  [key: string]: any;
}

/** One rendered line: a command paired with a single one of its key bindings (bindings are expanded). */
interface ShortcutRow {
  id: string;
  label: string;
  icon: any;
  /** Stable scope key (grouping/filter/sort). */
  scope: string;
  /** Localized scope display name (section header). */
  scopeLabel: string;
  description: string;
  shortcut: IKeyStroke | null;
  /** Canonical match string for the binding, so capture mode compares exactly like the dispatcher. */
  canonical: string | null;
}

/** Collapse the double-newlines authors use for tooltip spacing into single wraps for the dense list. */
const collapseBlankLines = (str: string): string => str.replace(/\n\n+/g, '\n').trim();

/** Render an icon that may be a string key, an element, or absent (kept for row alignment). */
const renderIcon = (icon: any): React.ReactNode => {
  if (!icon || typeof icon === 'string') return <DynamicIcon iconKey={icon} />;
  return icon;
};

/** Build a display keystroke from a live keyboard event (capture mode). */
const strokeFromEvent = (e: KeyboardEvent): IKeyStroke => {
  const modifiers: any[] = [];
  if (e.ctrlKey) modifiers.push('ctrl');
  if (e.altKey) modifiers.push('alt');
  if (e.shiftKey) modifiers.push('shift');
  if (e.metaKey) modifiers.push('meta');
  const code = e.code;
  let key = e.key;
  if (code) {
    if (code.startsWith('Key') && code.length > 3) key = code.slice(3);        // KeyZ -> Z
    else if (code.startsWith('Digit') && code.length > 5) key = code.slice(5); // Digit1 -> 1
    else key = code;                                                           // ArrowRight, Slash, Enter…
  }
  return { key, modifiers };
};

/** The bare modifier keys we ignore until a real key is pressed alongside them. */
const MODIFIER_ONLY = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/**
 * Split a canonical shortcut string (from `keyStrokeToCanonical` / `keyEventCanonicals`) into its
 * key and its modifier set. The prefix is always emitted in `mod`→`alt`→`shift` order, so stripping
 * those known tokens leaves the key verbatim — robust even when the key itself is `+`.
 */
const parseCanonical = (canonical: string): { key: string; mods: Set<string> } => {
  let rest = canonical;
  const mods = new Set<string>();
  for (const m of ['mod', 'alt', 'shift']) {
    if (rest.startsWith(`${m}+`)) { mods.add(m); rest = rest.slice(m.length + 1); }
  }
  return { key: rest, mods };
};

/**
 * The match target for a live keystroke: the candidate key token(s) (from `e.code` and `e.key`) plus
 * the held modifiers. Matching is **inclusive** (see the capture effect): a binding matches when its
 * key is one of these and the pressed modifiers are a *subset* of the binding's — so `Ctrl+S` also
 * surfaces `Ctrl+Alt+S`, mirroring how a text query matches supersets.
 */
const matchFromEvent = (e: KeyboardEvent): { keys: Set<string>; mods: Set<string> } => {
  const parsed = [...keyEventCanonicals(e)].map(parseCanonical);
  return {
    keys: new Set(parsed.map((p) => p.key)),
    mods: parsed[0]?.mods ?? new Set<string>(), // modifiers are identical across the candidates
  };
};

const IS_MAC = CommonUtils.getPlatform() === CommonUtils.OSType.MacOS
  || CommonUtils.getPlatform() === CommonUtils.OSType.IOS;

/** Stable display order for modifier keycaps. */
const MODIFIER_ORDER: KeyModifiers[] = [KeyModifiers.Ctrl, KeyModifiers.Alt, KeyModifiers.Shift, KeyModifiers.Meta];

const modifierLabel = (m: KeyModifiers): string => {
  switch (m) {
    case KeyModifiers.Ctrl: return IS_MAC ? 'Cmd' : 'Ctrl';
    case KeyModifiers.Alt: return 'Alt';
    case KeyModifiers.Shift: return 'Shift';
    case KeyModifiers.Meta: return 'Meta';
    default: return m;
  }
};

const orderedModifiers = (mods: Iterable<KeyModifiers>): KeyModifiers[] => {
  const set = new Set(mods);
  return MODIFIER_ORDER.filter((m) => set.has(m));
};

/** The modifiers currently held down on a live keyboard event, in display order. */
const modifiersFromEvent = (e: KeyboardEvent): KeyModifiers[] => {
  const mods: KeyModifiers[] = [];
  if (e.ctrlKey) mods.push(KeyModifiers.Ctrl);
  if (e.altKey) mods.push(KeyModifiers.Alt);
  if (e.shiftKey) mods.push(KeyModifiers.Shift);
  if (e.metaKey) mods.push(KeyModifiers.Meta);
  return mods;
};

/**
 * A single keyboard key rendered as a `<kbd>`-style keycap — the standard convention (GitHub, VSCode,
 * Linear): small, muted, a soft border with a slightly heavier bottom edge for depth. Panel-local on
 * purpose: the shared tooltip renderer styles its caps for a dark tooltip surface, where the borders
 * would vanish against this light panel.
 */
const KeyCap = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <Box
    component="kbd"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '20px',
      height: '20px',
      paddingX: '5px',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      fontSize: '0.7rem',
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      borderRadius: '5px',
      color: (theme: Theme) => theme.palette.text.secondary,
      backgroundColor: (theme: Theme) => emphasize(theme.palette.background.paper, 0.07),
      border: (theme: Theme) => `solid 1px ${theme.palette.divider}`,
      borderBottomWidth: '2px',
    }}
  >
    {children}
  </Box>
);

/** The muted `+` that joins keycaps (and dangles after a modifier while a combo is still being pressed). */
const Plus = (): React.ReactElement => (
  <Box component="span" sx={{ fontSize: '0.7rem', color: (theme: Theme) => theme.palette.text.disabled }}>
    +
  </Box>
);

/**
 * A row of keycaps joined by `+`. `dangling` appends a trailing `+` — used in capture mode while the
 * user is still holding modifiers and hasn't pressed the final key yet (e.g. `Ctrl` `+` `Shift` `+`).
 */
const KeyCapRow = ({ labels, dangling = false }: { labels: string[]; dangling?: boolean }): React.ReactElement => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
    {labels.map((label, i) => (
      <React.Fragment key={i}>
        {i > 0 && <Plus />}
        <KeyCap>{label}</KeyCap>
      </React.Fragment>
    ))}
    {dangling && <Plus />}
  </Box>
);

/** Render one keystroke as `Ctrl` `+` `Z` keycaps (the panel expands multi-binding commands to one row each). */
const ShortcutKeys = ({ stroke }: { stroke: IKeyStroke }): React.ReactElement | null => {
  if (!stroke?.key) return null;
  const labels = orderedModifiers(stroke.modifiers ?? []).map(modifierLabel);
  labels.push(ReactUtils.toPrettyKeyCode(stroke.key));
  return <KeyCapRow labels={labels} />;
};

export function ShortcutKeysPanel(props: ShortcutKeysPanelProps): React.ReactElement {
  const {
    commands,
    sx: sxProp,
    ...rest
  } = props;

  const t = useTranslator();

  // Flipped semantics: default shows *all* commands; checking filters down to only ones with bindings.
  const [onlyKeybinds, setOnlyKeybinds] = useState<boolean>(false);
  const [searchInputText, setSearchInputText] = useState<string>('');
  const [activeScope, setActiveScope] = useState<string | null>(null);

  // Capture mode: instead of typing, press a shortcut and see which command(s) own it.
  const [captureMode, setCaptureMode] = useState<boolean>(false);
  const [capturedStroke, setCapturedStroke] = useState<IKeyStroke | null>(null);
  const [capturedMatch, setCapturedMatch] = useState<{ keys: Set<string>; mods: Set<string> } | null>(null);
  // Modifiers currently held before a final key commits — drives the live `Ctrl` `+` … preview.
  const [pendingMods, setPendingMods] = useState<KeyModifiers[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const availableRows = useMemo<ShortcutRow[]>(() => {
    let commandArray = commands.getAllCommands();
    if (onlyKeybinds) {
      commandArray = commandArray.filter((record) => record.command.getShortcut());
    }

    // Sort by scope (the command's home name), then label within a scope.
    commandArray = [...commandArray].sort((a, b) => {
      const scopeA = a.command.getScope?.() ?? a.groupKey;
      const scopeB = b.command.getScope?.() ?? b.groupKey;
      const byScope = scopeA.localeCompare(scopeB);
      return byScope !== 0 ? byScope : a.command.getLabel().localeCompare(b.command.getLabel());
    });

    // Expand: one row per binding (a command with several bindings lists each on its own line).
    // The same command can be registered under several registry keys within a scope, which yields
    // identical rows — dedupe on (scope, label, binding) so "Scroll to Active Cell" isn't listed twice
    // (and so React keys stay unique).
    const rows: ShortcutRow[] = [];
    const seen = new Set<string>();
    for (const record of commandArray) {
      const command = record.command;
      const scope = command.getScope?.() ?? record.groupKey;
      const base = {
        label: command.getLabel(),
        icon: command.getIcon(),
        scope,
        scopeLabel: command.getScopeLabel?.() ?? scope,
        description: collapseBlankLines(command.getDescription()),
      };
      const shortcut = command.getShortcut();
      const strokes: (IKeyStroke | null)[] = Array.isArray(shortcut)
        ? (shortcut.length ? shortcut : [null])
        : [shortcut ?? null];
      for (const stroke of strokes) {
        const canonical = stroke ? keyStrokeToCanonical(stroke) : null;
        const signature = `${scope}\u0000${base.label}\u0000${canonical ?? ''}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        rows.push({
          ...base,
          id: signature,
          shortcut: stroke,
          canonical,
        });
      }
    }
    return rows;
  }, [onlyKeybinds, commands]);

  // The distinct scopes present (for the "active scope" affordance / clearing).
  const scopedRows = useMemo<ShortcutRow[]>(() => {
    if (!activeScope) return availableRows;
    return availableRows.filter((r) => r.scope === activeScope);
  }, [availableRows, activeScope]);

  // Text mode search over label, scope, and description.
  const searchRows = useMemo(() => createShortcutSearch(scopedRows), [scopedRows]);

  const [rows, setRows] = useState<ShortcutRow[]>(availableRows);

  useEffect(() => {
    // Capture mode: match the pressed keystroke against contributed bindings (instant, no debounce).
    // Inclusive: same key, and the pressed modifiers are a subset of the binding's (so Ctrl+S also
    // surfaces Ctrl+Alt+S), mirroring how a text query matches supersets.
    if (captureMode) {
      if (!capturedMatch) { setRows(scopedRows); return; }
      setRows(scopedRows.filter((r) => {
        if (!r.canonical) return false;
        const parts = parseCanonical(r.canonical);
        if (!capturedMatch.keys.has(parts.key)) return false;
        for (const m of capturedMatch.mods) { if (!parts.mods.has(m)) return false; }
        return true;
      }));
      return;
    }
    const run = TimerUtils.debounce(() => {
      setRows(searchRows(searchInputText));
    }, 90);
    run();
  }, [captureMode, capturedMatch, searchRows, searchInputText, scopedRows]);

  // Group the filtered rows by scope for sticky section headers. Uses a Map keyed by scope so a
  // scope yields exactly one group even when search returns rows in relevance order (not scope
  // order) — consecutive-run grouping would otherwise emit duplicate scopes (and duplicate keys).
  const groups = useMemo(() => {
    const byScope = new Map<string, ShortcutRow[]>();
    for (const row of rows) {
      let group = byScope.get(row.scope);
      if (!group) { group = []; byScope.set(row.scope, group); }
      group.push(row);
    }
    return Array.from(byScope, ([scope, groupRows]) => ({ scope, scopeLabel: groupRows[0].scopeLabel, rows: groupRows }));
  }, [rows]);

  // The active scope's localized label (for the filter chip).
  const activeScopeLabel = useMemo(
    () => availableRows.find((r) => r.scope === activeScope)?.scopeLabel ?? activeScope,
    [availableRows, activeScope]
  );

  const hasQuery = captureMode ? !!capturedStroke : searchInputText.length > 0;
  const isShowNoResults = hasQuery && rows.length === 0;

  // Keep focus on the input whenever the mode flips (so the caret — and thus "type here" — is obvious).
  useEffect(() => {
    inputRef.current?.focus();
  }, [captureMode]);

  const enterCaptureMode = useCallback((on: boolean) => {
    setCaptureMode(on);
    setSearchInputText('');
    setCapturedStroke(null);
    setCapturedMatch(null);
    setPendingMods(null);
  }, []);

  const onCaptureKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') return; // let focus traverse out of the recorder
    if (e.which === KeyCodes.Escape) {
      // First Escape clears a captured/pending combo; a second (nothing to clear) exits capture mode.
      if (capturedStroke || pendingMods) {
        setCapturedStroke(null); setCapturedMatch(null); setPendingMods(null);
      } else {
        enterCaptureMode(false);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // Nothing types into the field while recording; every key is a recorded stroke.
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Backspace') {
      // Backspace clears the captured combo (like the ✕) and stays in record mode.
      setCapturedStroke(null); setCapturedMatch(null); setPendingMods(null);
      return;
    }
    const native = e.nativeEvent;
    if (MODIFIER_ONLY.has(e.key)) {
      // Only modifiers held so far — show them live with a dangling `+`, awaiting the final key.
      setCapturedStroke(null); setCapturedMatch(null);
      setPendingMods(modifiersFromEvent(native));
      return;
    }
    setPendingMods(null);
    setCapturedStroke(strokeFromEvent(native));
    setCapturedMatch(matchFromEvent(native));
  }, [capturedStroke, pendingMods, enterCaptureMode]);

  const onCaptureKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (capturedStroke) return; // a full combo is committed; leave it shown
    const mods = modifiersFromEvent(e.nativeEvent);
    setPendingMods(mods.length ? mods : null); // shrink/clear the live preview as modifiers are released
  }, [capturedStroke]);

  const toggleScope = useCallback((scope: string) => {
    setActiveScope((cur) => (cur === scope ? null : scope));
  }, []);

  // The lone end-adornment ✕: clears the typed query (search) or the captured combo (record).
  const onClear = useCallback(() => {
    if (captureMode) {
      setCapturedStroke(null); setCapturedMatch(null); setPendingMods(null);
    } else {
      setSearchInputText('');
    }
    inputRef.current?.focus();
  }, [captureMode]);

  const inputBackground = (theme: Theme) => theme.palette.action.hover;

  const hasClearable = captureMode
    ? !!(capturedStroke || (pendingMods && pendingMods.length > 0))
    : searchInputText.length > 0;

  // Persistent mode toggle — lives OUTSIDE the input (not an adornment) so it's always visible and
  // one click away, and so the adornment only ever holds the ✕. Lit while recording.
  const captureToggle = (
    <Tooltip title={captureMode ? 'Search by name (ESC)' : `Search by shortcut (${IS_MAC ? 'Cmd' : 'Ctrl'}+K)`}>
      <IconButton
        aria-label="toggle shortcut capture"
        color={captureMode ? 'primary' : 'default'}
        onClick={() => enterCaptureMode(!captureMode)}
        sx={{
          flexShrink: 0,
          border: (theme: Theme) =>
            `solid 1px ${captureMode ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
        }}
      >
        <DynamicIcon iconKey="Keyboard" />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box
      style={{ height: 460, width: '100%', display: 'flex', flexDirection: 'column' }}
      // Anchor the theme font so plain <span>/<div> content (scope headers, shortcut key chips)
      // inherits it instead of falling back to the UA default.
      sx={[{ fontFamily: (theme: Theme) => theme.typography.fontFamily }, ...(Array.isArray(sxProp) ? sxProp : [sxProp])]}
      {...rest}
    >
      {/* Toolbar: search / capture, capture toggle, and the (flipped) key-binding filter. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          marginBottom: (theme: Theme) => theme.spacing(1.5),
        }}
      >
        {/* One field for both modes. In capture mode it stays a real (focused) input — so the native
            caret makes "type here" obvious and the border/alignment are identical — but every key is
            intercepted (nothing types), the value is pinned empty, and held keys render as live keycaps. */}
        <TextField
          inputRef={inputRef}
          slotProps={{
            input: {
              sx: { backgroundColor: inputBackground },
              startAdornment: (captureMode && (capturedStroke || (pendingMods && pendingMods.length > 0))) ? (
                <InputAdornment position="start" sx={{ marginRight: '6px' }}>
                  {capturedStroke
                    ? <ShortcutKeys stroke={capturedStroke} />
                    : <KeyCapRow labels={orderedModifiers(pendingMods!).map(modifierLabel)} dangling />}
                </InputAdornment>
              ) : undefined,
              endAdornment: hasClearable ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={captureMode ? 'clear shortcut' : 'clear search'}
                    onClick={onClear}
                    edge="end"
                    size="small"
                  >
                    <DynamicIcon iconKey="Close" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
            htmlInput: {
              className: 'input',
              autoFocus: true,
              spellCheck: false,
              placeholder: captureMode
                ? (capturedStroke || (pendingMods && pendingMods.length > 0) ? '' : 'Press a shortcut… (Esc to exit)')
                : 'Type to search commands, scopes, or descriptions',
              autoComplete: 'off',
              'aria-label': captureMode ? 'Press a shortcut to find its command' : 'Search commands',
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1),
                paddingBottom: (theme: Theme) => theme.spacing(1),
                // Tint the caret so the recorder reads as an active input awaiting keys.
                caretColor: (theme: Theme) => (captureMode ? theme.palette.primary.main : undefined),
              },
            },
          }}
          sx={{
            flex: '1 1 auto',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme: Theme) =>
                isShowNoResults
                  ? `${theme.palette.error.main} !important`
                  : (captureMode ? `${theme.palette.primary.main} !important` : undefined),
            },
          }}
          value={captureMode ? '' : searchInputText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (!captureMode) setSearchInputText(e.target.value);
          }}
          onKeyDown={captureMode ? onCaptureKeyDown : (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Ctrl/Cmd+K jumps straight into record mode (also shown in the toggle's tooltip).
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
              enterCaptureMode(true);
              e.stopPropagation();
              e.preventDefault();
              return;
            }
            if (e.which === KeyCodes.Escape && searchInputText.length > 0) {
              setSearchInputText('');
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          onKeyUp={captureMode ? onCaptureKeyUp : undefined}
          onContextMenu={(e) => e.stopPropagation()}
        />
        {captureToggle}
        <FormControlLabel
          sx={{ flexShrink: 0, marginRight: 0 }}
          control={
            <Checkbox
              checked={onlyKeybinds}
              onChange={() => setOnlyKeybinds(!onlyKeybinds)}
            />
          }
          label={t('shortcutKeys.onlyKeyBindings')}
          labelPlacement="start"
        />
      </Box>

      {/* Active scope filter chip (set by clicking a scope header). */}
      {activeScope && (
        <Box sx={{ display: 'flex', marginBottom: 1 }}>
          <Chip
            size="small"
            label={t('shortcutKeys.scopeFilter', { scope: activeScopeLabel })}
            onDelete={() => setActiveScope(null)}
          />
        </Box>
      )}

      {/* The list. No virtualization: the catalog is small and native flow lets descriptions wrap.
          Outer div owns the (translucent) border + radius; inner div owns the scroll — so scrolling
          content is clipped inside the border and never peeks through its semi-transparent 1px. */}
      <Box
        sx={{
          flex: '1 1 100%',
          minHeight: 0,
          borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
          border: (theme: Theme) => `solid ${theme.palette.divider} 1px`,
          overflow: 'visible', // making hidden was creating a 1px bleed above sticky header
        }}
      >
        <Box sx={{ height: '100%', overflow: 'auto' }}>
        {groups.length === 0 ? (
          <Box
            sx={{
              padding: 3,
              textAlign: 'center',
              color: (theme: Theme) =>
                isShowNoResults ? theme.palette.error.main : theme.palette.text.secondary,
            }}
          >
            {hasQuery ? t('shortcutKeys.noMatches') : t('shortcutKeys.none')}
          </Box>
        ) : (
          groups.map((group) => (
            <Box key={group.scope}>
              <Box
                onClick={() => toggleScope(group.scope)}
                sx={{
                  position: 'sticky',
                  // Stick 1px higher than the viewport top and pad it back — kills the subpixel gap
                  // that lets the (hover-highlighted) row underneath peek above the header.
                  top: '-1px',
                  zIndex: 2, // above the rows, which are unpositioned (z-auto)
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  paddingX: 1.5,
                  paddingTop: '5px',
                  paddingBottom: '4px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  // Must be a SOLID fill (not the alpha action.hover) — rows scroll underneath, and a
                  // translucent header lets them show through. Distinct from the rows so it reads as a band.
                  backgroundColor: (theme: Theme) => emphasize(theme.palette.background.paper, 0.04),
                  // Paint that same solid a couple px above too, so nothing shows through the seam.
                  boxShadow: (theme: Theme) => `0 -2px 0 0 ${emphasize(theme.palette.background.paper, 0.04)}`,
                  borderBottom: (theme: Theme) => `solid 1px ${theme.palette.divider}`,
                  color: (theme: Theme) =>
                    activeScope === group.scope ? theme.palette.primary.main : theme.palette.text.secondary,
                  '&:hover': {
                    color: (theme: Theme) => theme.palette.text.primary,
                    backgroundColor: (theme: Theme) => emphasize(theme.palette.background.paper, 0.09),
                  },
                }}
              >
                <span>{group.scopeLabel}</span>
                <Typography component="span" sx={{ fontSize: 'inherit', opacity: 0.7 }}>
                  {group.rows.length}
                </Typography>
              </Box>
              {group.rows.map((row) => (
                <Box
                  key={row.id}
                  sx={{
                    paddingX: 1.5,
                    paddingY: 0.75,
                    borderBottom: (theme: Theme) => `solid 1px ${theme.palette.divider}`,
                    '&:hover': {
                      backgroundColor: (theme: Theme) => theme.palette.action.hover,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        width: 'var(--icon-size, 20px)',
                        height: 'var(--icon-size, 20px)',
                        // Match toolbar icon tint (the theme's icon token, falling back to action.active)
                        // rather than inheriting full-strength body text color.
                        color: (theme: Theme) => (theme.palette.text as any).icon ?? theme.palette.action.active,
                      }}
                    >
                      {renderIcon(row.icon)}
                    </Box>
                    <Typography sx={{ flex: '1 1 auto', fontWeight: 500 }}>
                      {row.label}
                    </Typography>
                    {row.shortcut && (
                      <Box sx={{ flexShrink: 0 }}><ShortcutKeys stroke={row.shortcut} /></Box>
                    )}
                  </Box>
                  {row.description && (
                    <Typography
                      component="div"
                      sx={{
                        marginTop: '2px',
                        marginLeft: 'calc(var(--icon-size, 20px) + 8px)',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-line',
                        color: (theme: Theme) => theme.palette.text.secondary,
                      }}
                    >
                      {row.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          ))
        )}
        </Box>
      </Box>

      {/* Footer count. */}
      <Box
        sx={{
          display: 'flex',
          flexShrink: 0,
          paddingLeft: (theme: Theme) => theme.spacing(1),
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingRight: (theme: Theme) => theme.spacing(1),
          userSelect: 'none',
          justifyContent: 'flex-end',
        }}
      >
        <Typography
          noWrap
          component="div"
          sx={{
            color: (theme: Theme) =>
              isShowNoResults ? theme.palette.error.main : theme.palette.text.secondary,
          }}
        >
          {hasQuery
            ? t('shortcutKeys.countFound', { count: rows.length })
            : t('shortcutKeys.count', { count: rows.length })}
        </Typography>
      </Box>
    </Box>
  );
}
