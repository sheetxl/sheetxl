import type React from 'react';
import { useState, useMemo, useEffect, useRef, useId, memo } from 'react';

import { type Theme } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { InputAdornment, MenuItem, TextField } from '@mui/material';

import { type IFunction, type IFunctionCollection } from '@sheetxl/sdk';

import { DOMUtils } from '@sheetxl/utils';

import { DynamicIcon, KeyCodes, useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import {
  FunctionSignature, FunctionPreviewContent, NamedItemLabel, createFunctionHint, createFunctionDescriptor,
  useWorkbook, type CommandContext, type FunctionDescriptor
} from '@sheetxl/react';

import { FUNCTION_SEARCH_PANE_HEIGHT } from './paneMetrics';

/**
 * The dropdown value meaning "don't filter".
 *
 * @remarks
 * A `*` rather than the empty string, even though the SDK's own "no filter" IS the empty string: MUI
 * reads an empty `value` as "nothing selected" and leaves the floating label sitting ON the field
 * instead of shrinking above it — the label and the selected text then overlap. {@link categoryOf}
 * maps it back to undefined at the API boundary.
 */
const CATEGORY_ALL = '*';

/** The dropdown value → what the search API takes (`undefined` for every category). */
const categoryOf = (value: string): string | undefined => (value === CATEGORY_ALL ? undefined : value);

/**
 * How long the search box waits after the last keystroke before searching. A search reads
 * descriptors, so this is the difference between one pass and one per character.
 */
const SEARCH_DEBOUNCE_MS = 150;

/** Rows kept for a text search — far more than fits the list, few enough to stay instant. */
const SEARCH_LIMIT = 100;

export interface FunctionSearchPanelProps {
  /** The catalog: category list, per-category listing and ranked text search. */
  context?: () => CommandContext.FormulaFunction | null | undefined;
  /** The chosen function. CONTROLLED — the host needs it (to insert it, or to fill its arguments). */
  selected: IFunction | null;
  /** The selection changed: a click, an arrow key, or a new query landing on its own top row. */
  onChangeSelected: (fn: IFunction | null) => void;
  /** "That one" — a double-click on a row. The host takes its default action. */
  onActivate?: () => void;
  /** Take focus (the search box) on mount. @defaultValue `false` */
  autoFocus?: boolean;
  /** Class(es) for the panel root. */
  className?: string;
}

/**
 * **Pick a function** — search or browse by category, and read what the chosen one does.
 *
 * @remarks
 * A WIDGET (see {@link FunctionArgumentsPanel} for why both halves of the Insert Function dialog are
 * shaped this way): it renders no buttons and does not close anything. The catalog is the SDK's,
 * through {@link CommandContext.FormulaFunction} — so custom (workbook-defined) functions appear
 * beside the built-ins, no category table is maintained here, and deprecated/hidden functions are
 * filtered out by the SDK.
 *
 * The summary + signature come from the SAME components the in-cell editor shows while typing
 * ({@link FunctionSignature} / {@link FunctionPreviewContent}), so a function reads identically
 * wherever it is met. Here the per-argument prose is suppressed (`showParameters={false}`): this page
 * answers "which function", not "what do I pass it".
 */
export const FunctionSearchPanel = memo<FunctionSearchPanelProps>((props: FunctionSearchPanelProps) => {
  const {
    context,
    selected,
    onChangeSelected,
    onActivate,
    autoFocus = false,
    className
  } = props;

  const t = useTranslator();
  const workbook = useWorkbook();

  const [categories, setCategories] = useState<IFunctionCollection.Category[]>([]);
  const [category, setCategory] = useState<string>(CATEGORY_ALL);
  /** What the user has typed; {@link searchText} is its debounced shadow — only that one searches. */
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [functions, setFunctions] = useState<IFunction[]>([]);
  const [descriptor, setDescriptor] = useState<FunctionDescriptor | null>(null);

  const categoryFilter = categoryOf(category);

  const refList = useRef<HTMLDivElement>(null);
  const refSearch = useRef<HTMLInputElement>(null);
  /**
   * Row id prefix. The list is a single tab stop that owns a moving selection (`aria-activedescendant`),
   * not a set of focusable rows — so the selected row has to be NAMEABLE by id for a screen reader to
   * follow it, and two panels on one page must not name the same ids.
   */
  const idRows = useId();
  const idOfRow = (name: string): string => `${idRows}${name}`;

  useEffect(() => {
    const timer = setTimeout(() => setSearchText(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // `autoFocusSel` fires on the DIALOG's mount; coming BACK to this page is a later mount of just
  // this panel, and the search box is where the keyboard belongs either time.
  useEffect(() => {
    if (autoFocus) refSearch.current?.focus();
  }, [autoFocus]);

  // The category strip, from what is actually registered. An empty category cannot appear (the SDK
  // reports only populated ones), so no "Cube" that opens onto nothing.
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const found = await context?.()?.getCategories() ?? [];
      if (!cancelled) setCategories(found);
    };
    void load();
    return () => { cancelled = true; };
  }, [context]);

  // The list. The category is a FILTER, not an alternative to searching: it narrows the text results
  // too (Excel searches across every category and leaves the dropdown showing something the results
  // contradict — a category the user picked should keep meaning what it says).
  const changeSelected = useCallbackRef(onChangeSelected, [onChangeSelected]);
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const formulaContext = context?.();
      if (!formulaContext) return;
      const found = searchText
        ? await formulaContext.searchByText(searchText, { category: categoryFilter, limit: SEARCH_LIMIT })
        : await formulaContext.searchByCategory(categoryFilter);
      if (cancelled) return; // a newer query is already in flight — never clobber it
      setFunctions(found);
      // A new query always lands on its own top row — including the query that CLEARS the search,
      // which is why the previous selection is not carried over even when it survives into the new
      // results. Otherwise clearing a search for `pv` leaves PV described below a list that has
      // moved on, and the hint reads as the answer to a question no longer being asked.
      changeSelected(found[0] ?? null);
    };
    void load();
    return () => { cancelled = true; };
  }, [context, categoryFilter, searchText, changeSelected]);

  // The selected function's own text, resolved lazily (and ignored if the selection moved on).
  useEffect(() => {
    if (!selected) { setDescriptor(null); return undefined; }
    let cancelled = false;
    const name = selected.getName();
    selected.getDescriptor()
      .then((resolved) => { if (!cancelled) setDescriptor(createFunctionDescriptor(name, resolved)); })
      .catch(() => { if (!cancelled) setDescriptor(null); });
    return () => { cancelled = true; };
  }, [selected]);

  // The SELECTED row expands with its summary, as the autocomplete's does — and only by a click or a
  // key. Hover tints a row but never selects it: an expanding row shifts the rows below it, and a
  // selection that followed the pointer would chase that shift from row to row.
  const selectedSummary = selected && descriptor?.name === selected.getName() ? descriptor.summary : null;

  const hint = useMemo(() => {
    if (!selected) return null;
    // No argument is emphasized: this page is about choosing a function, not filling one in.
    return createFunctionHint(selected, { locale: workbook?.getLocale() });
  }, [selected, workbook]);

  /** Move the selection to a row INDEX, clamped — the one mover the keys below go through. */
  const selectAt = useCallbackRef((index: number): void => {
    if (functions.length === 0) return;
    changeSelected(functions[Math.min(functions.length - 1, Math.max(0, index))]);
  }, [functions, changeSelected]);

  /** Move the selection by `delta` rows, clamped — the list's arrow-key navigation. */
  const moveSelection = useCallbackRef((delta: number): void => {
    const current = selected ? functions.indexOf(selected) : -1;
    selectAt(current + delta);
  }, [functions, selected, selectAt]);

  const handleOnKeyDown = useCallbackRef((e: React.KeyboardEvent): void => {
    if (e.isDefaultPrevented()) return;
    // Arrow keys drive the list from ANYWHERE in the panel — including the search box, so a query can
    // be typed and then arrowed into without leaving the keyboard. They are dead keys in a
    // single-line field anyway, so nothing is stolen. Enter is left alone: it submits the form, which
    // is the dialog's default option.
    //
    // Home/End are NOT taken from the search box: there they mean "caret to the start of my query",
    // which is what a user editing text expects — the list claims them only once it has the focus.
    const isList = refList.current?.contains(e.target as Node) ?? false;
    switch (e.keyCode) {
      case KeyCodes.Down: moveSelection(1); break;
      case KeyCodes.Up: moveSelection(-1); break;
      case KeyCodes.PageDown: moveSelection(10); break;
      case KeyCodes.PageUp: moveSelection(-10); break;
      case KeyCodes.Home: if (!isList) return; selectAt(0); break;
      case KeyCodes.End: if (!isList) return; selectAt(functions.length - 1); break;
      default: return;
    }
    e.preventDefault();
  }, [moveSelection, selectAt, functions]);

  // Keep the selected row in view when the keyboard (not the mouse) moved it.
  useEffect(() => {
    if (!selected) return;
    const list = refList.current;
    const row = list?.querySelector<HTMLElement>('[data-selected="true"]');
    if (list && row) DOMUtils.scrollIntoContainer(list, row);
  }, [selected]);

  const rows = useMemo(() => {
    return functions.map((fn) => {
      const name = fn.getName();
      const isSelected = fn === selected;
      return (
        <Box
          key={name}
          id={idOfRow(name)}
          component="div"
          role="option"
          aria-selected={isSelected}
          data-selected={isSelected}
          onMouseDown={(e: React.MouseEvent) => {
            // Selecting a row must not pull focus out of the search box mid-query.
            if (e.button === 0) e.preventDefault();
          }}
          onClick={() => changeSelected(fn)}
          // Double-click is the list's "that one" — the host's default action, no trip to the button.
          onDoubleClick={() => { onActivate?.(); }}
          sx={{
            paddingBlock: '1px',
            cursor: 'default',
            fontSize: '0.8rem',
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            '& .named-item-name': {
              fontFamily: 'var(--sxl-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)'
            },
            backgroundColor: isSelected ? 'action.selected' : undefined,
            '&:hover': {
              backgroundColor: isSelected ? 'action.selected' : 'action.hover'
            }
          }}
        >
          <NamedItemLabel
            item={{ name, kind: fn.isLambda() ? 'lambda' : 'function' }}
            summary={isSelected ? selectedSummary : null}
            wrapSummary
          />
        </Box>
      );
    });
  }, [functions, selected, selectedSummary, changeSelected, onActivate]);

  return (
    <Box
      className={className}
      // The list's key handling lives on the CONTENT, not on the window: `InternalWindow` owns its
      // own keydown (Escape) and does not forward one, so a bubbling handler here is what reaches
      // every field inside.
      onKeyDown={handleOnKeyDown}
      sx={{
        // Declared, not summed from the content (the list's content is the whole catalog) — but a
        // PREFERENCE, not a pin: `flex` makes it a basis, so a host that is taller (the wizard, which
        // sizes to the taller of its two pages) or shorter (a short window) gets a panel that fills or
        // compresses instead of one that overflows. The function list below is what absorbs it.
        height: `${FUNCTION_SEARCH_PANE_HEIGHT}px`,
        flex: '1 1 auto',
        minHeight: 0,
        boxSizing: 'border-box',
        // The search box's floating label sits ABOVE the field — without this it is clipped by
        // whatever the panel is mounted in.
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        display: 'flex',
        flexDirection: 'column',
        rowGap: (theme: Theme) => theme.spacing(2)
      }}
    >
      <TextField
        size="small"
        fullWidth
        // No placeholder: the label already says what the field is, and a second sentence underneath
        // it ("type what you want to do") only reads as a search engine's invitation to describe a
        // problem — which is not what this searches.
        label={t('insertFunction.searchLabel')}
        value={searchInput}
        inputRef={refSearch}
        onChange={(e) => setSearchInput(e.target.value)}
        // Neither field is the column's give — see the list's `flex` below.
        sx={{ flexShrink: 0 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <DynamicIcon iconKey="Find" />
              </InputAdornment>
            ),
            // Only while there is something to clear — a permanent ✗ over an empty field reads as
            // a control that does nothing.
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <ExhibitIconButton
                  aria-label={t('insertFunction.clearSearch')}
                  propsTooltip={{ label: t('insertFunction.clearSearch') }}
                  // Clearing must not cost the field its focus — the next thing typed is usually
                  // another query.
                  onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button === 0) e.preventDefault(); }}
                  onClick={() => setSearchInput('')}
                  // `Close` (a bare X), not `Cancel` (a filled disc) — the house style for a
                  // clear-this-field affordance, and what the shortcut-keys search uses.
                  icon={<DynamicIcon iconKey="Close" />}
                  size="small"
                />
              </InputAdornment>
            ) : undefined
          },
          // The class belongs on the `<input>`, not the wrapper — `autoFocusSel` focuses whatever
          // it matches, and a focused div is a silently dead first keystroke.
          htmlInput: {
            className: 'autoFocus',
            spellCheck: false,
            autoComplete: 'off'
          }
        }}
      />
      <TextField
        select
        size="small"
        fullWidth
        label={t('insertFunction.categoryLabel')}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        // The label always floats: this field is never "empty" (it falls back to All), and letting
        // MUI decide leaves the label sitting on top of the selected text.
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ flexShrink: 0 }}
      >
        <MenuItem value={CATEGORY_ALL}>{t('insertFunction.categoryAll')}</MenuItem>
        {categories.map((item) => (
          // The category name is the SDK's identity AND, until the labels localize, its display
          // text; a category we have no translation for still reads as itself.
          <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>
        ))}
      </TextField>

      <Box
        ref={refList}
        role="listbox"
        // Named so it can be told apart from the category dropdown's own menu, which is also a
        // `listbox` of `option`s once it is open.
        className="function-list"
        aria-label={t('insertFunction.listLabel')}
        // ONE tab stop that owns a moving selection — the listbox pattern — not a row per stop:
        // tabbing through 700 functions to reach the hint below is not navigation. The rows stay
        // unfocusable and the selected one is named here instead.
        tabIndex={0}
        aria-activedescendant={selected ? idOfRow(selected.getName()) : undefined}
        // Arriving by Tab on an unselected list (a search that matched nothing keeps the list empty,
        // but a cleared one does not) starts at the top, so the first arrow key moves rather than
        // merely selects.
        onFocus={() => { if (!selected) selectAt(0); }}
        sx={{
          // The give: what the fields, hint, gaps and padding leave of the pane height (~120px in
          // the wizard, which renders this page at the argument page's taller preference), and
          // whatever a taller (or shorter) host adds or takes.
          //
          // Basis ZERO, not `auto`. `auto` means "my content", and this list's content is the whole
          // catalog — ~15000px of rows. The column's bases then total far more than its declared
          // height, and flexbox resolves that by shrinking EVERY shrinkable sibling in proportion to
          // its basis: the hint below lost ~120 of its 124px, the fields above most of theirs. It
          // looked intermittent only because a search narrow enough not to overflow left everything
          // at its stated size. A scrolling region must never contribute its content to the sum.
          flex: '1 1 0',
          minHeight: '80px',
          overflowY: 'auto',
          // The rows' offset parent, for `scrollIntoContainer`.
          position: 'relative',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '4px',
          // A tab stop has to SHOW that it has the keyboard. The row highlight cannot say it — it is
          // there whether the list is focused or not — so the ring goes on the list itself, as the
          // focused text fields above it get from MUI.
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '-1px'
          },
          // While the list has the keyboard, its selected row reads as the ACTIVE one — the same
          // stronger fill the grid gives a focused selection, rather than the resting grey that
          // means "this is what the hint below is describing".
          '&:focus-within [data-selected="true"], &:focus [data-selected="true"]': {
            backgroundColor: 'action.selected',
            boxShadow: (theme: Theme) => `inset 2px 0 0 ${theme.palette.primary.main}`
          }
        }}
      >
        {rows.length > 0 ? rows : (
          <Typography
            sx={{ padding: '8px', color: 'text.secondary', fontSize: '0.85rem' }}
          >
            {t('insertFunction.noResults')}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          // Fixed height so the dialog doesn't resize as the selection moves between a one-line
          // summary and a wrapped three-line one. Sized for a wrapped two-line signature over a
          // three-line summary — the long-signature, long-summary case (PV, SUMIFS) rather than
          // the median one, so scrolling here is the exception.
          //
          // A `height` in a flex column is only a BASIS — flex-shrink defaults to 1, so it is a
          // starting bid, not a size. `flexShrink: 0` is what makes it the declaration it reads as.
          height: '5.5rem',
          flexShrink: 0,
          overflowY: 'auto',
          // Stated, not inherited: this content is plain DOM (not `Typography`), and the dialog's
          // own surface does not set a family for it to pick up.
          fontFamily: (theme: Theme) => theme.typography.fontFamily,
          fontSize: '0.8rem',
          lineHeight: '16px'
        }}
      >
        {hint ? (<>
          {/* Indented to match `FunctionPreviewContent`'s own horizontal padding, so the signature
              and the summary under it share a left edge. Wrapped, not scrolled: a long signature
              (`PV(rate, nper, pmt, [fv], [type])`) uses the second line rather than putting a
              scrollbar under a fixed-width panel. */}
          <Box sx={{ padding: '0 10px' }}>
            <FunctionSignature hint={hint} wrap />
          </Box>
          <FunctionPreviewContent hint={hint} descriptor={descriptor} showParameters={false} />
        </>) : null}
      </Box>
    </Box>
  );
});

FunctionSearchPanel.displayName = 'FunctionSearchPanel';

export default FunctionSearchPanel;
