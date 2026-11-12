import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Box, FormHelperText, Typography, type SxProps, type Theme } from '@mui/material';

import {
  FormulaText, getLocaleProfile, ICondition,
  type ICalculation, type IDataValidation, type IFilter, type Scalar
} from '@sheetxl/sdk';

import { messageKey } from '@sheetxl/utils';

import { useTranslator } from '@sheetxl/utils-react';
import { useWorksheet, ValueChecklist, type ValueChecklistItem, type ValueChecklistProps } from '@sheetxl/react';
import { PickList, ListSearch, filterByText, type PickListItem } from '@sheetxl/grid-react';

import { FormulaField } from '../form';

import { useFormulaOption, activeCellOf, FormulaFrameContext } from './useFormulaOption';

/**
 * Reads a population a set may be chosen from, as {@link IFilter.getItems} does: under the
 * Display selector by the text the cells show, under none by value.
 */
export type MembershipItemsProvider = (options: { selector: string | null }) => Promise<IFilter.Items>;

export interface MembershipOptionProps {
  /** The set: `items`, `source`, `additions`, `subtractions` and `dateGroups`. */
  option: ICondition.InSetOption | null;
  /** Receives the set as edited. A host that gives `getItems` also receives it once they load. */
  onOptionChange: (option: ICondition.InSetOption) => void;
  /**
   * The condition's selector: how the members read the cell. Display reads the text a cell
   * shows, which is what a spreadsheet's list holds; none reads the value.
   */
  selector?: ICondition.ISelector | null;
  /**
   * Receives the reading the author chooses with "By value": the Display selector's name, or
   * `null` for the value. The set is re-read under it; the checks carry over.
   */
  onSelectorChange?: (selector: string | null) => void;
  /**
   * The population the set is a snapshot of (a filter's column). With it the members are that
   * population's values, each checked or not; without it the author builds the set in one field:
   * a typed list, or a source.
   */
  getItems?: MembershipItemsProvider;
  /**
   * The condition's Ignore Blank. On, a blank is never judged, so the (Blank) row has nothing
   * to say and is not listed; the set's `blank` is kept as it was for when the flag is cleared.
   */
  ignoreBlank?: boolean;
  /** If true, makes the editor read-only. */
  readOnly?: boolean;
  sx?: SxProps<Theme>;
  /**
   * What the host passes to the list: its rows' look, or (a test) its scroll state. An authored
   * set's preview takes `itemHeight` and `viewport` of these.
   */
  propsChecklist?: Partial<Pick<ValueChecklistProps, 'itemHeight' | 'renderItem' | 'renderCheckbox' | 'viewport' | 'onApply' | 'onClose'>> & {
    /**
     * Whether every value of the population is checked (`values`), and whether its blank is
     * (`blanks`: true too when it has none). A filter with nothing left out has nothing to say,
     * which is its host's to act on.
     */
    onWholeChange?: (values: boolean, blanks: boolean) => void;
  };
}

/** The check key of the `(Blank)` row. */
const BLANK_KEY = '\0blank';

/** Whether a value is a string of only U+0020 spaces, and not empty. */
const isSpaces = (value: Scalar): value is string => typeof value === 'string' && value.length > 0 && /^ +$/.test(value);

/**
 * The rows' labels, with what would otherwise be invisible made visible:
 * by value a string of only spaces is "(Space ×n)", and a leading or trailing space is
 * shown as `␣` only when two rows would otherwise read alike (`a` and `a `).
 */
const labelItems = (items: readonly IFilter.Item[], byDisplay: boolean, t: (key: string, params?: Record<string, unknown>) => string): string[] => {
  const trimmedCounts = new Map<string, number>();
  for (const item of items) {
    const trimmed = item.text.trim();
    trimmedCounts.set(trimmed, (trimmedCounts.get(trimmed) ?? 0) + 1);
  }
  return items.map((item: IFilter.Item): string => {
    if (!byDisplay && isSpaces(item.value)) return t('checklist.spaces', { count: item.value.length });
    const text = item.text;
    const trimmed = text.trim();
    if (text === trimmed || (trimmedCounts.get(trimmed) ?? 0) < 2) return text;
    return text.replace(/^ +| +$/g, (spaces: string): string => '␣'.repeat(spaces.length));
  });
};

/** A value's identity: its type and, for text, its case-folded form (as a set's items match). */
const keyOfValue = (value: Scalar): string => {
  if (typeof value === 'string') return 's:' + value.toLowerCase();
  return typeof value + ':' + String(value);
};

/** The check key of an item: its text by display (one row per text), its value's key by value. */
const keyOfItem = (item: IFilter.Item, byDisplay: boolean): string => byDisplay ? item.text : keyOfValue(item.value);

/** The index of the last date item: the end of the tree's first level, or `-1` with no tree. */
const dateEndOf = (dates: readonly IFilter.DateLevel[] | undefined): number => {
  const runs = dates?.[0]?.runs;
  return runs && runs.length > 0 ? runs[runs.length - 1].max : -1;
};

/**
 * What a checked set means of the date tree, coarsest first: a node with every item checked is
 * one group item at its level; one partly checked is walked into; one with none is left out. A
 * leaf partly checked (the same date under two number formats is two items on one day) has no
 * finer level to walk, so its checked items are listed as items.
 */
const checkedDateGroups = (
  items: readonly IFilter.Item[],
  dates: readonly IFilter.DateLevel[] | undefined,
  isChecked: (index: number) => boolean
): { groups: ICondition.DateGroupItem[]; leafItems: number[] } => {
  const groups: ICondition.DateGroupItem[] = [];
  const leafItems: number[] = [];
  if (!dates || dates.length === 0) return { groups, leafItems };
  const walk = (levelIndex: number, min: number, max: number): void => {
    const runs = dates[levelIndex].runs;
    for (let i=0; i<runs.length; i++) {
      const run = runs[i];
      if (run.max < min) continue;
      if (run.min > max) break;
      let some = false;
      let all = true;
      for (let k=run.min; k<=run.max; k++) {
        if (isChecked(k)) some = true; else all = false;
      }
      if (all && run.value) groups.push(run.value);
      else if (some && levelIndex + 1 < dates.length) walk(levelIndex + 1, run.min, run.max);
      else if (some) for (let k=run.min; k<=run.max; k++) if (isChecked(k)) leafItems.push(k);
    }
  };
  walk(0, 0, dateEndOf(dates));
  return { groups, leafItems };
};

/**
 * The snapshot a checked set is: dates as group items, the rest as texts (Display) or values,
 * and the blank as `blank` when its row is checked.
 */
const toSnapshot = (
  read: IFilter.Items,
  checked: ReadonlySet<string>,
  byDisplay: boolean
): ICondition.InSetOption => {
  const items = read.items;
  const isChecked = (index: number): boolean => checked.has(keyOfItem(items[index], byDisplay));
  const { groups, leafItems } = checkedDateGroups(items, read.dates, isChecked);
  const listed: Scalar[] = [];
  const add = (index: number): void => { listed.push(byDisplay ? items[index].text : items[index].value); };
  for (let i=0; i<leafItems.length; i++) add(leafItems[i]);
  for (let i=dateEndOf(read.dates) + 1; i<items.length; i++) if (isChecked(i)) add(i);
  const option: ICondition.InSetOption = { items: listed };
  if (groups.length > 0) option.dateGroups = groups;
  if (read.hasBlanks && checked.has(BLANK_KEY)) option.blank = true;
  return option;
};

const DISPLAY = ICondition.BuiltInSelectorNames.Display;

/**
 * The members of a population (a filter's column), each checked or not, with a "By value" flag
 * that is the condition's selector: Display, or none.
 *
 * @remarks
 * Each row is checked as the filter's levels pass it, so a stored condition reopens with the
 * right checks and a new one opens with everything checked. The set is said back once the items
 * arrive and on every change, so an Apply with nothing touched writes the list as shown.
 * Switching the reading re-reads the population and carries the checks over by value.
 */
const SnapshotMembership = memo<MembershipOptionProps & { getItems: MembershipItemsProvider }>((props) => {
  const { onOptionChange, getItems, selector, onSelectorChange, ignoreBlank = false, readOnly, sx, propsChecklist } = props;
  const { onWholeChange, ...propsList } = propsChecklist ?? {};

  const t = useTranslator();
  const byDisplay = selector?.getName() === DISPLAY;
  const [read, setRead] = useState<IFilter.Items | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  // The checks kept across a mode switch: by value, and by text for what a display row folded
  // (the number 1 and the text `'1` are one row by display, two by value), and the blank's.
  const refCarry = useRef<{ values: Set<string>; texts: Set<string>; blank: boolean } | null>(null);
  const refOnChange = useRef(onOptionChange);
  refOnChange.current = onOptionChange;
  const refOnWhole = useRef(onWholeChange);
  refOnWhole.current = onWholeChange;

  useEffect(() => {
    let current = true;
    void getItems({ selector: byDisplay ? DISPLAY : null }).then((items: IFilter.Items): void => {
      if (!current) return;
      const carry = refCarry.current;
      refCarry.current = null;
      const next = new Set<string>();
      for (const item of items.items) {
        const keep = carry ? (carry.values.has(keyOfValue(item.value)) || carry.texts.has(item.text)) : item.checked;
        if (keep) next.add(keyOfItem(item, byDisplay));
      }
      // The blank's row is checked as its rows pass, like any value's.
      if (items.hasBlanks && (carry ? carry.blank : items.blanksChecked)) next.add(BLANK_KEY);
      setRead(items);
      setChecked(next);
    });
    return () => { current = false; };
  }, [getItems, byDisplay]);

  // Said back on load and on every change; the handler's identity is not a reason to say it again.
  useEffect(() => {
    if (!read) return;
    refOnChange.current(toSnapshot(read, checked, byDisplay));
    // A list cut short at the host's cap is never the whole population.
    let values = !read.truncated;
    for (let i=0; values && i<read.items.length; i++) values = checked.has(keyOfItem(read.items[i], byDisplay));
    const blanks = !read.hasBlanks || ignoreBlank || checked.has(BLANK_KEY);
    refOnWhole.current?.(values, blanks);
  }, [read, checked, byDisplay, ignoreBlank]);

  const items = useMemo((): ValueChecklistItem[] => {
    if (!read) return [];
    const labels = labelItems(read.items, byDisplay, t);
    const rows = read.items.map((item: IFilter.Item, index: number): ValueChecklistItem => ({
      text: labels[index], value: item.value, count: item.count, key: keyOfItem(item, byDisplay)
    }));
    // A blank is a value of the population, listed last, unless the
    // condition ignores blanks, when the row has nothing to say.
    if (read.hasBlanks && !ignoreBlank) rows.push({ text: t('checklist.blank'), value: null, key: BLANK_KEY, blank: true });
    return rows;
  }, [read, byDisplay, ignoreBlank, t]);

  const onCheckedChange = useCallback((keys: readonly string[], value: boolean): void => {
    if (readOnly) return;
    setChecked((prev: Set<string>): Set<string> => {
      const next = new Set(prev);
      for (const key of keys) { if (value) next.add(key); else next.delete(key); }
      return next;
    });
  }, [readOnly]);

  const onByDisplayChange = useCallback((next: boolean): void => {
    if (readOnly || !read || !onSelectorChange || next === byDisplay) return;
    const carry = { values: new Set<string>(), texts: new Set<string>(), blank: checked.has(BLANK_KEY) };
    for (const item of read.items) {
      if (!checked.has(keyOfItem(item, byDisplay))) continue;
      carry.values.add(keyOfValue(item.value));
      carry.texts.add(item.text);
    }
    refCarry.current = carry;
    // The reading is the condition's selector; the host sets it and this re-reads under it.
    onSelectorChange(next ? DISPLAY : null);
  }, [readOnly, read, checked, byDisplay, onSelectorChange]);

  return (
    // `typography` sets the theme font on the box: the list rows are plain divs that inherit, unlike
    // the MUI controls around them, and would otherwise fall through to the body default.
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, typography: 'body2', ...sx }}>
      <ValueChecklist
        items={items}
        dates={read?.dates}
        checked={checked}
        onCheckedChange={onCheckedChange}
        byDisplay={byDisplay}
        onByDisplayChange={onSelectorChange ? onByDisplayChange : undefined}
        truncated={read?.truncated ?? false}
        // Sized by its rows between the two: a short column shows them all, a long one scrolls
        // at about nine rows (Excel's box), and a popup shorter than that scrolls as a whole.
        style={{ minHeight: 220, maxHeight: 260 }}
        {...propsList}
      />
    </Box>
  );
});

SnapshotMembership.displayName = 'SnapshotMembership';

/**
 * Whether a source is a union of ranges, `A1:A3,C1:C3`, bare or in parentheses. Syntax only: a
 * name that refers to a union is not seen here.
 */
const isUnion = (node: ICalculation.FormulaNode | null | undefined): boolean => {
  let current = node;
  while (current?.type === 'paren' && current.inputs?.length === 1) current = current.inputs[0];
  if (current?.type === 'list') return true;
  return current?.type === 'paren' && (current.inputs?.length ?? 0) > 1;
};

/**
 * The rows the preview shows before it scrolls: fewer than the cell's dropdown,
 * so the rest of a validation's editor stays in view.
 */
const PREVIEW_ROWS = 6;

/** A typed member's text: what the author would type to get it. */
const textOfMember = (value: Scalar): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
};

/**
 * A set its author builds (a validation, a format): one field, and a preview of what it lists.
 *
 * @remarks
 * - **The field**: the `=` decides. Bare text is the typed list, split on the editing locale's
 *   list separator (`Yes, No` under en, `Ja; Nein` under de) and stored as additions. `=`-text is
 *   a live base: a range or formula whose result is the list, one range (a pick replaces rather
 *   than adds, and a union is its error). The two are exclusive, as the file can carry only one:
 *   typing either clears the other, and a source's exclusions go with it.
 * - **The preview**: the candidates the ACTIVE cell would be offered, as its dropdown shows them
 *   (source order, duplicates and blank rows as the source has them), read through the rule
 *   ({@link FormulaFrameContext}); without a rule to ask, the typed list. Nothing in it is
 *   editable: edits happen in the field. Exclusions a stored set holds show by their absence. It
 *   keeps the dropdown's full height whatever is listed, so the pane does not jump as the list is
 *   typed. It wears the filter list's chrome, a search line over the list with the count at its
 *   end, so the two lists read as one thing; the search narrows the preview and nothing else.
 */
const AuthoredMembership = memo<MembershipOptionProps>((props) => {
  const { option, onOptionChange, ignoreBlank = false, readOnly, sx, propsChecklist } = props;

  const t = useTranslator();
  const sheet = useWorksheet();
  const frame = useContext(FormulaFrameContext);
  const formulas = useFormulaOption();
  const separator = getLocaleProfile(sheet?.getWorkbook()?.getLocale() ?? 'en').listSeparator;

  const items = option?.items;
  const source = option?.source;
  const additions = option?.additions;
  const subtractions = option?.subtractions;
  const blank = option?.blank;
  const hasSource = source !== undefined && source !== null && source !== '';

  // The typed list, as text: a snapshot's items (seeded from the cells) read as additions do.
  const typed = useMemo((): string[] => {
    const listed: string[] = [];
    if (Array.isArray(items)) {
      for (let i=0; i<items.length; i++) {
        const text = textOfMember(items[i]);
        if (text.length > 0) listed.push(text);
      }
    }
    if (additions) for (let i=0; i<additions.length; i++) listed.push(additions[i]);
    return listed;
  }, [items, additions]);

  // What the rule lists at the active cell, re-read whenever the set changes. The latest ask wins.
  // Without a rule to ask (a format's editor), the typed list is the preview.
  const [listed, setListed] = useState<readonly IDataValidation.ListItem[] | null>(null);
  const asking = useRef(0);
  useEffect(() => {
    if (!frame?.getListItemsAt || !sheet) {
      setListed(null);
      return;
    }
    const token = ++asking.current;
    const { rowIndex, colIndex } = activeCellOf(sheet);
    frame.getListItemsAt(rowIndex, colIndex).then(
      (resolved) => { if (token === asking.current) setListed(resolved); },
      () => { if (token === asking.current) setListed([]); }
    );
  }, [frame, sheet, items, source, additions, subtractions, blank]);

  const rows = useMemo((): PickListItem[] => {
    const entries: PickListItem[] = [];
    if (listed) {
      for (let i=0; i<listed.length; i++) {
        const entry = listed[i];
        // The blank is the `null` entry; ignored, it has nothing to say.
        if (entry.value === null) {
          if (!ignoreBlank) entries.push({ text: t('checklist.blank') });
          continue;
        }
        entries.push({ text: entry.text });
      }
      return entries;
    }
    for (let i=0; i<typed.length; i++) entries.push({ text: typed[i] });
    if (blank && !ignoreBlank) entries.push({ text: t('checklist.blank') });
    return entries;
  }, [listed, typed, blank, ignoreBlank, t]);

  const [sourceError, setSourceError] = useState<string | null>(null);
  // The field's own parse error, shown on the line below it with ours.
  const [parseError, setParseError] = useState<string | null>(null);

  const onText = useCallback((text: string): void => {
    // The set without the parts the field owns; what it keeps (the blank, a date group) rides along.
    const { source: _source, items: _items, additions: _additions, subtractions: _subtractions, ...kept } = option ?? {};
    const trimmed = text.trim();
    if (trimmed.startsWith('=')) {
      const body = trimmed.substring(1).trim();
      // A source being started: nothing to store yet, and nothing to clear.
      if (body.length === 0) {
        setSourceError(null);
        return;
      }
      const compiled = formulas.compile(body);
      const expression = typeof compiled === 'string' ? compiled : compiled.getExpression();
      if (typeof compiled !== 'string' && isUnion(FormulaText.parse(expression))) {
        setSourceError(messageKey('condition.listSourceOneRange'));
        return;
      }
      setSourceError(null);
      onOptionChange({ ...kept, source: expression });
      return;
    }
    const entries = trimmed.length === 0
      ? []
      : trimmed.split(separator).map((entry: string) => entry.trim()).filter((entry: string) => entry.length > 0);
    // A file's typed list is split on `,`, so it has no way to hold one inside a value.
    if (entries.some((entry: string) => entry.includes(','))) {
      setSourceError(messageKey('condition.listItemHasComma'));
      return;
    }
    setSourceError(null);
    onOptionChange(entries.length > 0 ? { ...kept, additions: entries } : kept);
  }, [option, onOptionChange, formulas, separator]);

  const fieldText = useMemo((): string => {
    if (hasSource) {
      const body = (source as ICalculation.IFormula).isIFormula
        ? formulas.display(source as ICalculation.IFormula)
        : (source as string);
      return '=' + body;
    }
    return typed.join(separator + ' ');
  }, [hasSource, source, formulas, typed, separator]);

  const shownError = parseError ?? sourceError;
  const { viewport, itemHeight } = propsChecklist ?? {};
  const rowHeight = itemHeight ?? 24;

  // The search narrows the preview only.
  const [query, setQuery] = useState<string>('');
  const shown = useMemo(() => query ? filterByText(rows, query) : rows, [rows, query]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      gap: 1,
      typography: 'body2',
      ...sx as object
    }}>
      <FormulaField
        size="small"
        home={formulas.home}
        value={fieldText}
        onChangeText={onText}
        // No label, as the other operand fields have none; the When row already says List.
        label={null}
        placeholder={t('condition.enterListSource')}
        disabled={readOnly}
        fullWidth
        // The `=` decides: bare text is the typed list, never parsed and never an error.
        equals="literal"
        // The source is authored once for the whole range, as Excel's own picks are.
        pickAs="absolute"
        // One range: Ctrl+click replaces rather than adds.
        allowMulti={false}
        validationError={sourceError}
        onChangeError={setParseError}
        showError={false}
        helperText={null}
      />
      {shownError && <FormHelperText error sx={{ mt: -0.5 }}>{t(shownError)}</FormHelperText>}
      {/* The dropdown the active cell gets, as it gets it. Picking here does nothing. */}
      <Box className="list-preview" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder={t('condition.listPreviewSearch')}
          clearLabel={t('condition.listPreviewClearSearch')}
          trailing={
            <Box
              component="span"
              className="list-preview-count"
              sx={{ flex: '0 0 auto', fontSize: 12, opacity: 0.75, whiteSpace: 'nowrap' }}
            >
              {query
                ? t('checklist.countFiltered', { checked: shown.length, total: rows.length })
                : t('condition.listItems', { count: rows.length })}
            </Box>
          }
        />
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          // The filter list's own border, so the two read alike.
          border: '1px solid var(--sxl-color-base-300, light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.16)))',
          borderRadius: '4px',
          overflow: 'hidden',
          minWidth: 0,
          // Its full height whatever is listed (plus the border), so the pane does not jump.
          height: PREVIEW_ROWS * rowHeight + 2
        }}>
          {shown.length === 0 ? (
            // Centered in the body, as the filter list's message is.
            <Typography variant="body2" color="text.disabled" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
              {query ? t('condition.listPreviewNoMatch') : t('condition.listPreviewEmpty')}
            </Typography>
          ) : (
            <PickList
              items={shown}
              itemHeight={itemHeight}
              viewport={viewport}
              visibleRows={PREVIEW_ROWS}
              // The list sizes itself to its widest row; the preview is the field's width.
              style={{ minWidth: '100%' }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
});

AuthoredMembership.displayName = 'AuthoredMembership';

/**
 * The editor of a set, the `InSet` operator's param, under every host.
 *
 * @remarks
 * What a host can do with a set is its capabilities. A filter gives {@link MembershipOptionProps.getItems}:
 * the set is a snapshot of its column, the members are listed with checkboxes, and a checkbox takes
 * a member out, since there the author chooses from the column. A validation or a format gives
 * none: the author builds the set in one field, a typed list or a `=`source, over a read-only
 * preview of what the cell will be offered.
 *
 * Whether blanks pass is not the set's to say. It is the condition's, and its editor asks it.
 */
export const MembershipOption = memo<MembershipOptionProps>((props) => {
  const getItems = props.getItems;
  if (getItems) return <SnapshotMembership {...props} getItems={getItems} />;
  return <AuthoredMembership {...props} />;
});

MembershipOption.displayName = 'MembershipOption';
