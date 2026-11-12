import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import { Condition, ICondition, ICellRange, InteropScalarType, ScalarType, type ITable, type IFilter } from '@sheetxl/sdk';

import { CommandButtonType, useLanguage, useTranslator, type FloatReference } from '@sheetxl/utils-react';

import { CommandButton, ExhibitDivider, ExhibitMenuHeader } from '@sheetxl/utils-mui';

import { EditorCommitContext, type EditorCommit, type EditorCommits } from '../itemsPanel';
import { ConditionEditor, SxConditionEditorFrame } from '../conditions/ConditionEditor';
import { DEFAULT_EXCLUDED_OPERATORS, buildDefaultParam, compareOperators, groupFirst } from '../conditions/ConditionUtils';
import { MembershipOption, type MembershipItemsProvider, type MembershipOptionProps } from '../conditions/MembershipOption';

export interface ColumnMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The table column the menu is for. */
  column?: ITable.IColumn;
  disabled?: boolean;
  /** The popup, closed on Apply and Cancel. */
  floatReference: FloatReference;
  /** Passed to the Values checklist: its rows' look, or (a test) its scroll state. */
  propsChecklist?: MembershipOptionProps['propsChecklist'];
}

const Ops = ICondition.BuiltInOperatorNames;
const Selectors = ICondition.BuiltInSelectorNames;

/** Conditions a load can carry that this build cannot evaluate. */
const UNSUPPORTED: ReadonlySet<string> = new Set([Ops.Color, Ops.Icon]);

const operatorByName = (name: string): ICondition.IOperator | null => {
  return (Object.values(Condition.BuiltInOperators) as ICondition.IOperator[]).find((op) => op.getName() === name) ?? null;
};

/** The name a condition's JSON gives, by name or by the object. */
const nameOf = (named: string | { getName(): string } | null | undefined): string | null => {
  if (!named) return null;
  return typeof named === 'string' ? named : named.getName();
};

/**
 * The three spellings of a filter: the values it keeps, one rule of the column's kind (Excel's
 * Number / Text / Date Filters), or any rule (Excel's Custom Filter). Exclusive: a filter is one
 * condition, and Apply takes the mode in view.
 */
type Mode = 'values' | 'family' | 'custom';

/** What a column's values read as: which family its rule mode offers. */
type Family = 'number' | 'text' | 'date';

/** The type a family's operators read. The registry says which operators those are. */
const FAMILY_TYPE: Record<Family, InteropScalarType> = {
  number: InteropScalarType.Number,
  text: InteropScalarType.String,
  date: InteropScalarType.Date
};

/**
 * The reading a family's rule is asked under. A date rule reads under Date: a number gate and
 * the identity, which is what gives its operands a date field. A number
 * or text rule reads under none, as Excel's file has it.
 */
const FAMILY_SELECTOR: Record<Family, string | null> = { number: null, text: null, date: Selectors.Date };

/**
 * Excel's own entries first, in the order its Number / Text / Date Filters submenus list them.
 * The registry's other operators of the type follow, by title.
 */
const EXCEL_ORDER: Record<Family, readonly string[]> = {
  number: [Ops.EqualTo, Ops.GreaterThan, Ops.GreaterThanEqualTo, Ops.LessThan, Ops.LessThanEqualTo, Ops.Between, Ops.TopN, Ops.Average],
  text: [Ops.EqualTo, Ops.TextStartsWith, Ops.TextEndsWith, Ops.TextContains],
  date: [Ops.After, Ops.Before, Ops.Between, Ops.TimePeriod]
};

const builtInOperators = (): ICondition.IOperator[] => Object.values(Condition.BuiltInOperators) as ICondition.IOperator[];

/** What a column holds, as its menu reads it. */
interface ColumnKind {
  numbers: number;
  texts: number;
  showsDates: boolean;
}

const kindOf = (filter: IFilter | null): ColumnKind => {
  if (!filter) return { numbers: 0, texts: 0, showsDates: false };
  const range = filter.getRange();
  const counts = range.getStats().getTypedCounts();
  let showsDates = false;
  for (const _region of range.getRegions(ICellRange.Feature.DateFormat)) { showsDates = true; break; }
  return {
    numbers: counts[ScalarType.Number] ?? 0,
    texts: (counts[ScalarType.String] ?? 0) + (counts[ScalarType.Boolean] ?? 0),
    showsDates
  };
};

/**
 * The family a column's menu offers. A column of one kind is that kind; a mixed column is the
 * more numerous kind, text on a tie.
 * The family is a menu default and nothing else: Custom offers every operator the column admits.
 */
const familyOf = (kind: ColumnKind): Family => {
  if (kind.numbers > kind.texts) return kind.showsDates ? 'date' : 'number';
  return 'text';
};

/**
 * The family's operators: every registered leaf operator that reads the family's type, Excel's
 * own first in Excel's order and the rest by title, under Excel's title for the family. The
 * family mode's whole list, and the first section of Custom's. The registry's operator is every
 * host's; the section is this menu's, so a clone carries it.
 */
const familyOperatorsFor = (family: Family, familyTitle: string, language?: string): ICondition.IOperator[] => {
  const type = FAMILY_TYPE[family];
  const order = EXCEL_ORDER[family];
  const rank = (op: ICondition.IOperator): number => {
    const index = order.indexOf(op.getName());
    return index < 0 ? order.length : index;
  };
  const byTitle = compareOperators(language);
  const ofType = builtInOperators().filter((op) =>
    !DEFAULT_EXCLUDED_OPERATORS.includes(op.getName()) && !op.isCombinator?.() && (op.getAcceptsTypes?.()?.includes(type) ?? false)
  );
  ofType.sort((a, b) => (rank(a) - rank(b)) || byTitle(a, b));
  return ofType.map((op) => groupFirst(Object.create(op) as ICondition.IOperator, familyTitle));
};

/**
 * The operators Custom offers: the family first, then every other registered operator (the
 * editor's own list: List, Formula, Unique, Blank, the other families, And / Or / Not), so a
 * rule can say anything the model can, a list inside an And among it.
 */
const customOperatorsFor = (familyOperators: readonly ICondition.IOperator[]): ICondition.IOperator[] => {
  const seen = new Set<string>(familyOperators.map((op) => op.getName()));
  const rest = builtInOperators().filter((op) => !seen.has(op.getName()) && !DEFAULT_EXCLUDED_OPERATORS.includes(op.getName()));
  return [...familyOperators, ...rest];
};

/**
 * The mode a stored condition is edited in: a list is Values; one of the family's operators is
 * the family; anything else (another operator, a combinator) is Custom.
 */
const modeOf = (condition: ICondition.JSON | null, familyNames: ReadonlySet<string>): Mode => {
  const operator = nameOf(condition?.operator);
  if (operator === Ops.InSet) return 'values';
  return operator !== null && familyNames.has(operator) ? 'family' : 'custom';
};

/**
 * The column **filter menu**, Excel's dropdown as a template menu: a
 * Sort section, Clear filter while the column holds one, and a Filter section in one of three
 * modes under a toggle: **Values**, the column's kind (**Number**, **Text** or **Date**), and
 * **Custom**.
 *
 * Values is the checklist alone, the `InSet` operator's editor, read under Display (the text the
 * cells show) or by value from the menu under its search glyph; a blank is its (Blank) row. The
 * kind is the shared {@link ConditionEditor} with When listing the registry's operators of that
 * type under Excel's title (Number / Text / Date Filters), Excel's own first in Excel's order.
 * Custom is the same editor with every operator, the family first, List (the column's checklist
 * again), Formula, Unique and And / Or / Not among them. A rule mode
 * opens on the family's first operator with an empty operand and the cursor in it; Custom's
 * first visit starts from the kind's rule, and the kind's from Custom's when it is one of the
 * family. Each mode keeps what it held while the menu is open; the condition's Ignore Blank sits
 * under the rule editors.
 *
 * Apply writes the mode in view through the column's filter, ANDed with the other columns';
 * Cancel closes.
 *
 * @remarks
 * The checklist is a view of the column under its stored condition: a column filtered by
 * "greater than 5" opens on its kind, and Values then lists the passing values checked; Apply
 * writes the list. Left on its comparison, Apply leaves it as it is.
 *
 * A values list with nothing left out, the (Blank) row included, says nothing, so Apply clears
 * the column's filter rather than writing it (Excel's Select All).
 */
export const ColumnMenu = memo(forwardRef<HTMLDivElement, ColumnMenuProps>((props: ColumnMenuProps, refForwarded) => {
  const {
    column,
    disabled: propDisabled,
    style: propStyle,
    floatReference,
    propsChecklist,
    ...rest
  } = props;

  const t = useTranslator();
  const language = useLanguage();
  const filter = column?.getFilter() ?? null;
  const existing = filter?.getCondition() ?? null;
  const existingName = existing?.getOperator()?.getName() ?? null;
  // A Color or Icon filter, or an operator no registry knows: shown as filtered, not editable (§3.9).
  const unsupported = !!existing && (existingName === null || UNSUPPORTED.has(existingName));

  const kind = useMemo(() => kindOf(filter), [filter]);
  const family = familyOf(kind);
  const familyTitle = family === 'number' ? t('filter.numberFilters') : family === 'date' ? t('filter.dateFilters') : t('filter.textFilters');
  const familyLabel = family === 'number' ? t('filter.family.number') : family === 'date' ? t('filter.family.date') : t('filter.family.text');
  const familyOperators = useMemo(() => familyOperatorsFor(family, familyTitle, language), [family, familyTitle, language]);
  const familyNames = useMemo((): ReadonlySet<string> => new Set(familyOperators.map((op) => op.getName())), [familyOperators]);
  const customOperators = useMemo(() => customOperatorsFor(familyOperators), [familyOperators]);
  const getItems = useMemo((): MembershipItemsProvider | undefined => {
    if (!filter) return undefined;
    return (options: { selector: string | null }): Promise<IFilter.Items> => filter.getItems(options);
  }, [filter]);

  // The condition as edited. The menu is mounted per opening; the stored condition is read once.
  const [initial] = useState((): ICondition.JSON | null => {
    if (unsupported) return null;
    return existing ? existing.toJSON() : null;
  });
  const [mode, setMode] = useState<Mode>(() => initial ? modeOf(initial, familyNames) : 'values');

  // ─── Values: the set and its reading. The checklist reads its checks from the column when it
  // mounts, so it stays mounted (hidden) once visited and keeps them itself. ───
  const [valuesSelector, setValuesSelector] = useState<string | null>(
    () => initial && modeOf(initial, familyNames) === 'values' ? nameOf(initial.selector) : Selectors.Display
  );
  const [valuesOption, setValuesOption] = useState<ICondition.InSetOption | null>(
    () => initial && modeOf(initial, familyNames) === 'values' ? (initial.param as ICondition.InSetOption) : null
  );
  const [valuesVisited, setValuesVisited] = useState<boolean>(mode === 'values');
  const valuesSelectorObject = useMemo(
    (): ICondition.ISelector | null => valuesSelector ? (Condition.Selectors.get(valuesSelector) ?? null) : null,
    [valuesSelector]
  );
  // A blank is the list's (Blank) row; the condition's flag has nothing to add under Values.
  const draftValues = useMemo((): ICondition.JSON => ({
    selector: valuesSelector, operator: Ops.InSet, param: valuesOption ?? {}, includeBlanks: false
  }), [valuesSelector, valuesOption]);
  // Whether the Values list has every value of the column checked, and its blank.
  const refWhole = useRef<{ values: boolean; blanks: boolean }>({ values: false, blanks: true });

  // ─── The rule modes: each its own draft. ───
  const [draftFamily, setDraftFamily] = useState<ICondition.JSON | null>(
    () => initial && modeOf(initial, familyNames) === 'family' ? initial : null
  );
  const [draftCustom, setDraftCustom] = useState<ICondition.JSON | null>(
    () => initial && modeOf(initial, familyNames) === 'custom' ? initial : null
  );
  const conditionFamily = useMemo((): ICondition | null => draftFamily ? Condition.resolveInput(draftFamily) : null, [draftFamily]);
  const conditionCustom = useMemo((): ICondition | null => draftCustom ? Condition.resolveInput(draftCustom) : null, [draftCustom]);

  const draft: ICondition.JSON | null = mode === 'values' ? draftValues : mode === 'family' ? draftFamily : draftCustom;
  const draftCondition = useMemo((): ICondition | null => {
    if (mode === 'values') return Condition.resolveInput(draftValues);
    return mode === 'family' ? conditionFamily : conditionCustom;
  }, [mode, draftValues, conditionFamily, conditionCustom]);
  // A rule without its operand (a comparison just chosen) is not applied; `validate` walks a combinator's children.
  const invalid: string | null = draftCondition ? draftCondition.validate() : (draft ? 'unresolved' : null);

  const commandButtonProps = useMemo(() => ({
    // No dismiss-on-execute wiring: the enclosing float owns it. The `useCommands` observer reads
    // the float published via `FloatStackProvider` and closes it on execute.
    disabled: propDisabled,
    variant: CommandButtonType.Menuitem
  }), [propDisabled]);

  /** The condition a rule mode opens on: the family's first operator, its operand empty. */
  const firstOfFamily = useCallback((includeBlanks: boolean): ICondition.JSON => {
    const operator = familyOperators[0] ?? null;
    const selectorName = FAMILY_SELECTOR[family];
    const selector = selectorName ? (Condition.Selectors.get(selectorName) ?? null) : null;
    return {
      selector: selectorName,
      operator: operator?.getName() ?? null,
      param: operator ? buildDefaultParam(operator, familyOperators, selector) : null,
      includeBlanks
    };
  }, [family, familyOperators]);

  // An operator chosen in When reads as the menu reads it: a date operator under Date, as its
  // family lists it, so the operand is a date field and not a serial; a list under Display, as
  // a new menu's is, with "By value" the way to the values.
  const underMenuReading = useCallback((next: ICondition.JSON | null, prev: ICondition.JSON | null): ICondition.JSON | null => {
    if (!next || next.operator === prev?.operator || next.selector) return next;
    const name = nameOf(next.operator);
    if (name === Ops.InSet) return { ...next, selector: Selectors.Display };
    const selectorName = name !== null && familyNames.has(name) ? FAMILY_SELECTOR[family] : null;
    if (!selectorName) return next;
    const operator = operatorByName(name!);
    const selector = Condition.Selectors.get(selectorName) ?? null;
    return {
      ...next,
      selector: selectorName,
      param: operator ? buildDefaultParam(operator, familyOperators, selector) : next.param
    };
  }, [family, familyNames, familyOperators]);
  const handleFamilyChange = useCallback((next: ICondition.JSON | null): void => {
    setDraftFamily((prev: ICondition.JSON | null) => underMenuReading(next, prev));
  }, [underMenuReading]);
  const handleCustomChange = useCallback((next: ICondition.JSON | null): void => {
    setDraftCustom((prev: ICondition.JSON | null) => underMenuReading(next, prev));
  }, [underMenuReading]);
  const handleValuesOptionChange = useCallback((option: ICondition.InSetOption): void => { setValuesOption(option); }, []);
  const handleValuesSelectorChange = useCallback((selector: string | null): void => { setValuesSelector(selector); }, []);

  /* An operand field commits on done (its keys, its ✓, a blur to another field); Apply is a
     button, which takes focus without any of them. So Apply first has every field land what it
     holds on the draft, as the DV and CF panes' Save does, and applies on the render after, once
     the draft has it. A field holding text it cannot commit refuses, with its error showing. */
  const refCommits = useRef<Set<EditorCommit>>(new Set());
  const commits = useMemo((): EditorCommits => ({
    register: (commit: EditorCommit): (() => void) => {
      refCommits.current.add(commit);
      return () => { refCommits.current.delete(commit); };
    }
  }), []);
  const [applyPending, setApplyPending] = useState<boolean>(false);
  const handleApply = useCallback((): void => {
    let committed = true;
    for (const commit of Array.from(refCommits.current)) {
      if (!commit()) committed = false;
    }
    if (committed) setApplyPending(true);
  }, []);

  useEffect(() => {
    if (!applyPending) return;
    setApplyPending(false);
    // A rule without its operand is not applied: the menu stays open on it.
    if (!filter || unsupported || invalid || !draft) return;
    const apply = async (): Promise<void> => {
      // Every value checked, and the blank rows kept either way (the (Blank) row, or Ignore Blank):
      // the column is not filtered.
      const whole = refWhole.current;
      const vacuous = mode === 'values' && whole.values && (whole.blanks || draft.includeBlanks === true);
      if (vacuous) {
        // The column is not filtered. Its sort is left as it is.
        if (existing) await filter.delete();
      } else if (draft !== initial) {
        // One Promise: the criteria and the rows land in the same transaction, ANDed with the other
        // columns. The stored condition left as it was is not written again.
        await filter.setCondition(draft);
      }
      floatReference.closeAll();
    };
    void apply();
  }, [applyPending, filter, unsupported, invalid, draft, mode, initial, existing, floatReference]);

  const handleCancel = useCallback((): void => { floatReference.closeAll(); }, [floatReference]);

  // The Values list: Enter applies and Escape, with no search text to clear, closes, as the
  // buttons do; and it says whether every value of the column is checked, for the vacuous rule.
  const propsMembership = useMemo((): MembershipOptionProps['propsChecklist'] => ({
    ...propsChecklist,
    onApply: handleApply,
    onClose: handleCancel,
    onWholeChange: (values: boolean, blanks: boolean): void => { refWhole.current = { values, blanks }; }
  }), [propsChecklist, handleApply, handleCancel]);

  // ─── The modes ───

  // Switching to a rule puts the cursor in its operand: the next thing to do is type it.
  const [focusTicks, setFocusTicks] = useState(0);
  const handleMode = useCallback((next: Mode | null): void => {
    if (!next || next === mode) return;
    // Ignore Blank is the condition's, not the mode's: it carries between the rule modes.
    const includeBlanks = mode !== 'values' && draft?.includeBlanks === true;
    if (next === 'values') {
      setValuesVisited(true);
    } else if (next === 'family') {
      // A first visit starts from Custom's rule when it is one of the family's.
      setDraftFamily((prev: ICondition.JSON | null): ICondition.JSON | null => {
        if (prev) return { ...prev, includeBlanks };
        const custom = draftCustom;
        const customName = nameOf(custom?.operator);
        const fits = !!custom && customName !== null && familyNames.has(customName);
        return fits ? { ...custom!, includeBlanks } : firstOfFamily(includeBlanks);
      });
      setFocusTicks((count: number) => count + 1);
    } else {
      // A first visit starts from the family's rule.
      setDraftCustom((prev: ICondition.JSON | null): ICondition.JSON | null => {
        if (prev) return { ...prev, includeBlanks };
        return draftFamily ? { ...draftFamily, includeBlanks } : firstOfFamily(includeBlanks);
      });
      setFocusTicks((count: number) => count + 1);
    }
    setMode(next);
  }, [mode, draft, draftFamily, draftCustom, familyNames, firstOfFamily]);

  const refEditor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusTicks === 0) return;
    // The editor takes the new operator from its props in an effect of its own and draws the
    // operand on the render after it, so the field is looked for once that has happened.
    const timer = setTimeout(() => {
      // A select's own hidden input (`tabindex="-1"`) is not a value field.
      const field = Array.from(refEditor.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([tabindex="-1"]), textarea'
      ) ?? []).find((el) => !el.disabled && !el.readOnly && el.getAttribute('aria-hidden') !== 'true');
      if (!field) return;
      field.focus();
      field.select();
    }, 0);
    return () => clearTimeout(timer);
  }, [focusTicks]);

  const hasActive = !!column && (((column.getSort()?.getCriteria() ?? null) !== null) || existing !== null);

  const sxToggle = { textTransform: 'none', pt: 0.25, pb: 0.25 } as const;
  const ruleEditor = (modeOfEditor: 'family' | 'custom'): React.ReactNode => (
    // The same frame the DV and CF panes draw, at a menu's tighter padding.
    <Box ref={refEditor} className={`filter-editor ${modeOfEditor}`} sx={{ px: 1, display: 'flex', flexDirection: 'column' }}>
      <ConditionEditor
        sx={{ ...SxConditionEditorFrame, p: 1 }}
        condition={modeOfEditor === 'family' ? conditionFamily : conditionCustom}
        onConditionChange={modeOfEditor === 'family' ? handleFamilyChange : handleCustomChange}
        operators={modeOfEditor === 'family' ? familyOperators : customOperators}
        showSelector={false}
        operatorTitle=""
        renderRemove={null}
        // Custom's List is the column's checklist too (inside an And, say). Its whole-list
        // state is not Values mode's, so the host's `onWholeChange` is not passed.
        getItems={modeOfEditor === 'custom' ? getItems : undefined}
        propsChecklist={modeOfEditor === 'custom' ? propsChecklist : undefined}
        readOnly={propDisabled}
      />
    </Box>
  );

  return (
    <Box
      ref={refForwarded}
      className="column-menu"
      style={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px',
        display: 'flex',
        flexDirection: 'column',
        width: 240,
        ...propStyle,
      }}
      {...rest}
    >
      {/* The section headers the names menu draws (Ranges, Tables). */}
      <ExhibitMenuHeader variant="subtitle2" sx={{ paddingLeft: '16px' }}>{t('filter.sortTitle')}</ExhibitMenuHeader>
      <CommandButton {...commandButtonProps} commandState={column?.getSort()} commandKey="sortAscending" />
      <CommandButton {...commandButtonProps} commandState={column?.getSort()} commandKey="sortDescending" />
      {/* Excel buries this in a color submenu */}
      <CommandButton {...commandButtonProps} commandState={column?.getSort()} commandKey="sortCustom" />
      <ExhibitDivider orientation="horizontal" />
      {hasActive ? (
        <>
          <CommandButton {...commandButtonProps} commandState={column} commandKey="tableFilterClear" />
          <ExhibitDivider orientation="horizontal" />
        </>
      ) : null}
      {column && filter ? (
        <>
          <ExhibitMenuHeader variant="subtitle2" sx={{ paddingLeft: '16px' }}>{t('filter.filterTitle')}</ExhibitMenuHeader>
          {unsupported ? (
            <Typography variant="body2" className="unsupported" sx={{ px: 2, py: 1, opacity: 0.8 }}>
              {t('filter.unsupported')}
            </Typography>
          ) : (
            <>
              {/* The same control the color scale's 2-Color / 3-Color switch is. */}
              <Box sx={{ px: 1, pt: 0.25, pb: 1.25 }}>
                <ToggleButtonGroup
                  className="filter-mode"
                  exclusive
                  fullWidth
                  size="small"
                  value={mode}
                  disabled={propDisabled}
                  onChange={(_, next: Mode | null) => handleMode(next)}
                >
                  <ToggleButton value="values" sx={sxToggle}>{t('filter.values')}</ToggleButton>
                  <ToggleButton value="family" sx={sxToggle}>{familyLabel}</ToggleButton>
                  <ToggleButton value="custom" sx={sxToggle}>{t('filter.custom')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {/* Values is the list and nothing around it: no frame, no When, no Ignore Blank. */}
              {valuesVisited ? (
                <Box
                  className={mode === 'values' ? 'filter-values' : 'filter-values hidden'}
                  // The toggle's and the rule frame's 8px sides; no bottom, the button row's top is the gap.
                  sx={{ px: 1, display: mode === 'values' ? 'flex' : 'none', flexDirection: 'column' }}
                >
                  <MembershipOption
                    option={valuesOption}
                    onOptionChange={handleValuesOptionChange}
                    getItems={getItems}
                    selector={valuesSelectorObject}
                    onSelectorChange={handleValuesSelectorChange}
                    ignoreBlank={false}
                    readOnly={propDisabled}
                    propsChecklist={propsMembership}
                  />
                </Box>
              ) : null}
              <EditorCommitContext.Provider value={commits}>
                {mode === 'family' ? ruleEditor('family') : null}
                {mode === 'custom' ? ruleEditor('custom') : null}
              </EditorCommitContext.Provider>
            </>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, px: 1, pt: 1, pb: 0.5 }}>
            <Button size="small" onClick={handleCancel}>{t('filter.cancel')}</Button>
            <Button size="small" variant="contained" disabled={unsupported || propDisabled} onClick={handleApply}>
              {t('filter.apply')}
            </Button>
          </Box>
        </>
      ) : null}
    </Box>
  );
}));

ColumnMenu.displayName = "ColumnMenu";
