import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Box, Button, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';

import { Condition, ICondition, IPivotTable, NumberFormat, type IFilter } from '@sheetxl/sdk';

import { useTranslator, type FloatReference } from '@sheetxl/utils-react';

import { ExhibitDivider, ExhibitMenuHeader, ExhibitMenuItem, SelectedIcon } from '@sheetxl/utils-mui';

import { EditorCommitContext, type EditorCommit, type EditorCommits } from '../itemsPanel';
import { ConditionEditor, SxConditionEditorFrame } from '../conditions/ConditionEditor';
import { buildDefaultParam, groupFirst } from '../conditions/ConditionUtils';
import { MembershipOption, type MembershipItemsProvider, type MembershipOptionProps } from '../conditions/MembershipOption';

export interface PivotMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The fields of the button pressed: one, or a compact header's row or column fields. */
  fields: readonly IPivotTable.IField[];
  disabled?: boolean;
  /** The popup, closed on Apply and Cancel. */
  floatReference: FloatReference;
  /** Passed to the checklist: its rows' look, or (a test) its scroll state. */
  propsChecklist?: MembershipOptionProps['propsChecklist'];
}

const Ops = ICondition.BuiltInOperatorNames;
const Selectors = ICondition.BuiltInSelectorNames;

const Display = Condition.Selectors.get(Selectors.Display) ?? null;

/**
 * The menu's three spellings of a filter: the items shown, a rule over each item's caption or
 * date, and a rule over each item's total. Unlike a table column's, they stand together: Apply
 * sets the one in view and leaves the others.
 */
type Mode = 'values' | 'rule' | 'value';

/** The kinds of a field's rule: its dates when it holds dates, as Excel's Date Filters replace its Label Filters. */
type RuleKind = 'label' | 'date';

/** Each kind's operators in the order Excel's submenus list them, with the combinators a `does not` or a file's range reads as. */
const COMBINATORS: readonly string[] = [Ops.And, Ops.Or, Ops.Not];
const OPERATOR_NAMES: Record<RuleKind | 'value', readonly string[]> = {
  label: [Ops.EqualTo, Ops.TextStartsWith, Ops.TextEndsWith, Ops.TextContains, Ops.GreaterThan, Ops.GreaterThanEqualTo, Ops.LessThan, Ops.LessThanEqualTo],
  date: [Ops.EqualTo, Ops.After, Ops.AfterEqualTo, Ops.Before, Ops.BeforeEqualTo, Ops.Between, Ops.TimePeriod],
  value: [Ops.EqualTo, Ops.GreaterThan, Ops.GreaterThanEqualTo, Ops.LessThan, Ops.LessThanEqualTo, Ops.Between, Ops.TopN]
};

const SELECTORS: Record<RuleKind | 'value', string | null> = { label: Selectors.Display, date: Selectors.Date, value: null };

const operatorsFor = (kind: RuleKind | 'value', title: string): ICondition.IOperator[] => {
  const all = Object.values(Condition.BuiltInOperators) as ICondition.IOperator[];
  const byName = (name: string): ICondition.IOperator | undefined => all.find((op) => op.getName() === name);
  // The registry's operator is every host's; the section is this menu's, so a clone carries it.
  const listed = OPERATOR_NAMES[kind].flatMap((name) => {
    const op = byName(name);
    return op ? [groupFirst(Object.create(op) as ICondition.IOperator, title)] : [];
  });
  return [...listed, ...COMBINATORS.flatMap((name) => byName(name) ?? [])];
};

const nameOf = (named: string | { getName(): string } | null | undefined): string | null => {
  if (!named) return null;
  return typeof named === 'string' ? named : named.getName();
};

/** The rule a mode opens on: its kind's first operator, the operand empty. */
const firstRule = (kind: RuleKind | 'value', operators: readonly ICondition.IOperator[]): ICondition.JSON => {
  const operator = operators[0] ?? null;
  const selectorName = SELECTORS[kind];
  const selector = selectorName ? (Condition.Selectors.get(selectorName) ?? null) : null;
  return {
    selector: selectorName,
    operator: operator?.getName() ?? null,
    param: operator ? buildDefaultParam(operator, operators as ICondition.IOperator[], selector) : null,
    includeBlanks: false
  };
};

/** Whether a field's items are dates: its number format, which Excel copies to the field when placing it. */
const holdsDates = (field: IPivotTable.IField): boolean => {
  const table = field.getPivotTable();
  const index = table.getFields().findIndex((each) => each.getName() === field.getName());
  const format = table.toJSON()?.fields?.[index]?.numberFormat;
  return typeof format === 'string' && NumberFormat.getEngine().isDateFormat(format);
};

/** The table's data fields, by the names the field's API takes. */
const dataFieldNamesOf = (field: IPivotTable.IField): string[] => {
  const table = field.getPivotTable();
  const fields = table.getFields();
  return (table.toJSON()?.dataFields ?? []).map((data) => data.name ?? fields[data.field]?.getName() ?? '').filter(Boolean);
};

interface FieldPanelProps {
  field: IPivotTable.IField;
  disabled?: boolean;
  floatReference: FloatReference;
  propsChecklist?: MembershipOptionProps['propsChecklist'];
}

/**
 * What the menu shows of one field. Mounted per field: a field picked anew is a new list and new
 * drafts.
 */
const FieldPanel: React.FC<FieldPanelProps> = memo((props: FieldPanelProps) => {
  const { field, disabled, floatReference, propsChecklist } = props;

  const t = useTranslator();
  const isPage = field.getAxis() === IPivotTable.Axis.Page;
  const [filters] = useState(() => field.getFilters());
  const [sort] = useState(() => field.getSort());
  const [dataFields] = useState(() => dataFieldNamesOf(field));

  const ruleKind: RuleKind = useMemo(() => (
    filters.date ? 'date' : !filters.label && holdsDates(field) ? 'date' : 'label'
  ), [filters, field]);
  const ruleTitle = ruleKind === 'date' ? t('filter.dateFilters') : t('filter.labelFilters');
  const valueTitle = t('filter.valueFilters');
  const ruleOperators = useMemo(() => operatorsFor(ruleKind, ruleTitle), [ruleKind, ruleTitle]);
  const valueOperators = useMemo(() => operatorsFor('value', valueTitle), [valueTitle]);

  const initialRule: ICondition.JSON | null = filters[ruleKind] ?? null;
  const initialValue: ICondition.JSON | null = filters.value?.condition ?? null;

  const [mode, setMode] = useState<Mode>(() => {
    if (isPage || filters.manual) return 'values';
    if (initialRule) return 'rule';
    return initialValue ? 'value' : 'values';
  });

  // ─── Values: the checklist, read once as the items show. ───
  const getItems = useMemo((): MembershipItemsProvider => {
    return async (): Promise<IFilter.Items> => {
      const page = isPage ? field.getCurrentPage()?.getName() ?? null : null;
      const items = field.getItems().map((item): IFilter.Item => {
        const name = item.getName();
        return { text: name, value: name, count: 0, checked: page !== null ? name === page : item.isVisible(), firstRow: 0 };
      });
      return { items, hasBlanks: false, blanksChecked: false, truncated: false, total: items.length, selector: Selectors.Display };
    };
  }, [field, isPage]);
  const [option, setOption] = useState<ICondition.InSetOption | null>(null);
  const refWhole = useRef<boolean>(false);
  const names = useMemo((): string[] => (option?.items ?? []).map((item) => String(item)), [option]);
  const handleOptionChange = useCallback((next: ICondition.InSetOption): void => { setOption(next); }, []);

  // ─── The rules: each its own draft, kept while the menu is open. ───
  const [draftRule, setDraftRule] = useState<ICondition.JSON | null>(initialRule);
  const [draftValue, setDraftValue] = useState<ICondition.JSON | null>(initialValue);
  const [dataField, setDataField] = useState<string>(filters.value?.dataField ?? dataFields[0] ?? '');
  const conditionRule = useMemo((): ICondition | null => draftRule ? Condition.resolveInput(draftRule) : null, [draftRule]);
  const conditionValue = useMemo((): ICondition | null => draftValue ? Condition.resolveInput(draftValue) : null, [draftValue]);
  // The editor drops a reading the operator just chosen cannot take (no text operator under
  // Display); a caption is what a label rule reads, and the field keeps it there on applying.
  const handleRuleChange = useCallback((next: ICondition.JSON | null): void => {
    setDraftRule((prev: ICondition.JSON | null): ICondition.JSON | null => {
      if (!next || next.selector || next.operator === prev?.operator) return next;
      const name = nameOf(next.operator);
      if (ruleKind === 'label' || name === null || COMBINATORS.includes(name)) return next;
      return { ...next, selector: SELECTORS[ruleKind] };
    });
  }, [ruleKind]);
  const handleValueChange = useCallback((next: ICondition.JSON | null): void => { setDraftValue(next); }, []);

  const handleMode = useCallback((next: Mode | null): void => {
    if (!next) return;
    if (next === 'rule') setDraftRule((prev: ICondition.JSON | null) => prev ?? firstRule(ruleKind, ruleOperators));
    if (next === 'value') setDraftValue((prev: ICondition.JSON | null) => prev ?? firstRule('value', valueOperators));
    setMode(next);
  }, [ruleKind, ruleOperators, valueOperators]);

  const closeAfter = useCallback((done: Promise<void>): void => {
    void done.then(() => floatReference.closeAll());
  }, [floatReference]);

  const applyValues = useCallback((): void => {
    if (names.length === 0) return;
    const whole = refWhole.current;
    if (isPage) {
      if (whole) closeAfter(field.setCurrentPage(null));
      else closeAfter(names.length === 1 ? field.setCurrentPage(names[0]) : field.setVisibleItems(names));
    } else {
      closeAfter(field.setVisibleItems(whole ? null : names));
    }
  }, [field, names, isPage, closeAfter]);

  /* An operand field commits on done, and Apply is a button, which takes focus without it: Apply
     first has every field land what it holds on the draft, and applies on the render after, as
     the column menu does. A field holding text it cannot commit refuses, with its error showing. */
  const refCommits = useRef<Set<EditorCommit>>(new Set());
  const commits = useMemo((): EditorCommits => ({
    register: (commit: EditorCommit): (() => void) => {
      refCommits.current.add(commit);
      return () => { refCommits.current.delete(commit); };
    }
  }), []);
  const [applyPending, setApplyPending] = useState<boolean>(false);
  const handleApply = useCallback((): void => {
    if (mode === 'values') {
      applyValues();
      return;
    }
    let committed = true;
    for (const commit of Array.from(refCommits.current)) {
      if (!commit()) committed = false;
    }
    if (committed) setApplyPending(true);
  }, [mode, applyValues]);

  useEffect(() => {
    if (!applyPending) return;
    setApplyPending(false);
    const draft = mode === 'rule' ? draftRule : draftValue;
    const condition = mode === 'rule' ? conditionRule : conditionValue;
    // A rule without its operand is not applied: the menu stays open on it.
    if (!draft || !condition || condition.validate() || draft.param === '') return;
    if (draft === (mode === 'rule' ? initialRule : initialValue)) {
      floatReference.closeAll();
    } else if (mode === 'rule') {
      closeAfter(field.applyFilter({ [ruleKind]: draft }));
    } else {
      closeAfter(field.applyFilter({ value: { condition: draft, dataField } }));
    }
  }, [applyPending, mode, draftRule, draftValue, conditionRule, conditionValue, initialRule, initialValue, ruleKind, dataField, field, floatReference, closeAfter]);

  const handleCancel = useCallback((): void => { floatReference.closeAll(); }, [floatReference]);

  // Enter applies and Escape closes, as in the column menu; and it says whether every item is checked.
  const propsMembership = useMemo((): MembershipOptionProps['propsChecklist'] => ({
    ...propsChecklist,
    onApply: handleApply,
    onClose: handleCancel,
    onWholeChange: (values: boolean): void => { refWhole.current = values; }
  }), [propsChecklist, handleApply, handleCancel]);

  const sxToggle = { textTransform: 'none', pt: 0.25, pb: 0.25 } as const;
  const sortedBy = (order: 'ascending' | 'descending', byData: boolean): boolean =>
    sort?.order === order && (byData ? sort.dataField === dataField : sort.dataField === undefined);
  const sortItem = (className: string, order: 'ascending' | 'descending', byData: boolean, label: string, onSort: () => Promise<void>): React.ReactNode => {
    const selected = sortedBy(order, byData);
    return (
      <ExhibitMenuItem
        className={className}
        disabled={disabled}
        selected={selected}
        icon={selected ? <SelectedIcon /> : undefined}
        onClick={() => closeAfter(onSort())}
      >
        {label}
      </ExhibitMenuItem>
    );
  };
  const clearable: IPivotTable.IField.FilterType | null = mode === 'rule' && initialRule ? ruleKind : mode === 'value' && initialValue ? 'value' : null;

  const dataFieldSelect = dataFields.length > 1 ? (
    <Box sx={{ px: 1, pt: 1, pb: 1 }}>
      <TextField
        select
        fullWidth
        size="small"
        className="pivot-menu-data-field"
        label={t('filter.dataField')}
        value={dataField}
        disabled={disabled}
        onChange={(e) => { setDataField(e.target.value); }}
      >
        {dataFields.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
      </TextField>
    </Box>
  ) : null;

  const ruleEditor = (
    condition: ICondition | null,
    onChange: (next: ICondition.JSON | null) => void,
    operators: ICondition.IOperator[]
  ): React.ReactNode => (
    <Box className="filter-editor" sx={{ px: 1, display: 'flex', flexDirection: 'column' }}>
      <EditorCommitContext.Provider value={commits}>
        <ConditionEditor
          sx={{ ...SxConditionEditorFrame, p: 1 }}
          condition={condition}
          onConditionChange={onChange}
          operators={operators}
          showSelector={false}
          showIncludeBlanks={false}
          operatorTitle=""
          renderRemove={null}
          readOnly={disabled}
        />
      </EditorCommitContext.Provider>
    </Box>
  );

  return (
    <>
      {!isPage ? (
        <>
          <ExhibitMenuHeader variant="subtitle2" sx={{ paddingLeft: '16px' }}>{t('filter.sortTitle')}</ExhibitMenuHeader>
          {sortItem('pivot-sort-labels-ascending', 'ascending', false, t('filter.sortLabelsAscending'), () => field.sortByLabels('ascending'))}
          {sortItem('pivot-sort-labels-descending', 'descending', false, t('filter.sortLabelsDescending'), () => field.sortByLabels('descending'))}
          {dataField ? (
            <>
              {sortItem('pivot-sort-values-ascending', 'ascending', true, t('filter.sortValuesAscending', { name: dataField }), () => field.sortByValues('ascending', dataField))}
              {sortItem('pivot-sort-values-descending', 'descending', true, t('filter.sortValuesDescending', { name: dataField }), () => field.sortByValues('descending', dataField))}
            </>
          ) : null}
          <ExhibitDivider orientation="horizontal" />
          {Object.keys(filters).length > 0 ? (
            <>
              <ExhibitMenuItem
                className="pivot-clear-filters"
                disabled={disabled}
                onClick={() => closeAfter(field.clearAllFilters())}
              >
                {t('filter.clearFromField', { name: field.getName() })}
              </ExhibitMenuItem>
              <ExhibitDivider orientation="horizontal" />
            </>
          ) : null}
          <ExhibitMenuHeader variant="subtitle2" sx={{ paddingLeft: '16px' }}>{t('filter.filterTitle')}</ExhibitMenuHeader>
          <Box sx={{ px: 1, pt: 0.25, pb: 1.25 }}>
            <ToggleButtonGroup
              className="filter-mode"
              exclusive
              fullWidth
              size="small"
              value={mode}
              disabled={disabled}
              onChange={(_, next: Mode | null) => handleMode(next)}
            >
              <ToggleButton value="values" sx={sxToggle}>{t('filter.values')}</ToggleButton>
              <ToggleButton value="rule" sx={sxToggle}>{ruleKind === 'date' ? t('filter.family.date') : t('filter.family.label')}</ToggleButton>
              <ToggleButton value="value" sx={sxToggle} disabled={disabled || dataFields.length === 0}>{t('filter.family.value')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </>
      ) : null}
      {/* The checklist reads its checks when it mounts, so it stays mounted and keeps them itself. */}
      <Box className="filter-values" sx={{ px: 1, display: mode === 'values' ? 'flex' : 'none', flexDirection: 'column' }}>
        <MembershipOption
          option={option}
          onOptionChange={handleOptionChange}
          getItems={getItems}
          selector={Display}
          ignoreBlank={false}
          readOnly={disabled}
          propsChecklist={propsMembership}
        />
      </Box>
      {mode === 'rule' ? ruleEditor(conditionRule, handleRuleChange, ruleOperators) : null}
      {mode === 'value' ? (
        <>
          {dataFieldSelect}
          {ruleEditor(conditionValue, handleValueChange, valueOperators)}
        </>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, px: 1, pt: 1, pb: 0.5 }}>
        {clearable ? (
          <Button
            size="small"
            className="pivot-clear-rule"
            disabled={disabled}
            sx={{ marginRight: 'auto' }}
            onClick={() => closeAfter(field.clearFilter(clearable))}
          >
            {t('filter.clear')}
          </Button>
        ) : null}
        <Button size="small" onClick={handleCancel}>{t('filter.cancel')}</Button>
        <Button size="small" variant="contained" disabled={disabled || (mode === 'values' && names.length === 0)} onClick={handleApply}>
          {t('filter.apply')}
        </Button>
      </Box>
    </>
  );
});

/**
 * A pivot table field's **dropdown menu**, Excel's with its submenus laid out as the table column
 * menu's: a Sort section (by the labels, and by a data field's values over the grand total), Clear
 * while the field holds a filter, and a Filter section in one of three modes under a toggle:
 * **Values**, the field's items as a checklist; **Label** (**Date** on a field of dates), a rule
 * over each item; and **Value**, a rule over each item's total of a data field, Top N among them.
 * A field picker sits above it when the button is a compact header's (Excel's "Select field").
 *
 * Apply sets the mode in view and leaves the others, since a field's hidden items, its label or
 * date rule and its value rule stand together. On the checklist, every item checked shows them all,
 * and nothing checked is not applied, as Excel's OK is off. Each is one change of the table, laid
 * out again from its cache; Cancel closes.
 *
 * A page field has the checklist alone: one item is the item chosen and more than one a multiple
 * selection, Excel's "Select Multiple Items" without the switch.
 */
export const PivotMenu = memo(forwardRef<HTMLDivElement, PivotMenuProps>((props: PivotMenuProps, refForwarded) => {
  const {
    fields,
    disabled: propDisabled,
    style: propStyle,
    floatReference,
    propsChecklist,
    ...rest
  } = props;

  const t = useTranslator();
  const [index, setIndex] = useState<number>(0);
  const field: IPivotTable.IField | null = fields[Math.min(index, fields.length - 1)] ?? null;

  return (
    <Box
      ref={refForwarded}
      className="pivot-menu"
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
      {fields.length > 1 ? (
        <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
          <TextField
            select
            fullWidth
            size="small"
            className="pivot-menu-field"
            label={t('filter.selectField')}
            value={Math.min(index, fields.length - 1)}
            disabled={propDisabled}
            onChange={(e) => { setIndex(Number(e.target.value)); }}
          >
            {fields.map((each, i) => <MenuItem key={i} value={i}>{each.getName()}</MenuItem>)}
          </TextField>
        </Box>
      ) : (
        <ExhibitMenuHeader variant="subtitle2" sx={{ paddingLeft: '16px' }}>{field?.getName() ?? ''}</ExhibitMenuHeader>
      )}
      {field ? (
        <FieldPanel
          key={index}
          field={field}
          disabled={propDisabled}
          floatReference={floatReference}
          propsChecklist={propsChecklist}
        />
      ) : null}
    </Box>
  );
}));

PivotMenu.displayName = 'PivotMenu';
