import type React from 'react';
import { memo, useMemo, useState, useEffect, useRef } from 'react';

import { Box, FormControlLabel, Checkbox, type SxProps, type Theme } from '@mui/material';

import { Condition, ICondition, type ICellRanges } from '@sheetxl/sdk';

import { useTranslator, useLanguage } from '@sheetxl/utils-react';

import { SelectorSelect } from './SelectorSelect';
import { OperatorSelectPopupButton } from './OperatorSelectPopupButton';
import { OperatorAndParamEditor, type RemoveButtonProps } from './OperatorAndParamEditor';
import {
  buildDefaultParam, filterBySelector, operatorReadsUnder, pinFirst, resolveSelectorChange, type OperatorParam
} from './ConditionUtils';
import { type MembershipItemsProvider, type MembershipOptionProps } from './MembershipOption';

/**
 * The frame a host draws around a {@link ConditionEditor}: a rounded, faintly filled box the rule
 * card sits in. The host adds its own padding (a pane's is wider than a menu's).
 */
export const SxConditionEditorFrame = {
  backgroundColor: 'action.hover',
  border: 1,
  borderColor: 'divider',
  borderRadius: 1
} as const;

/**
 * The selector row's value for a Formula rule. A formula whose result is the reading is a
 * selector, so it is listed with the selectors, as Excel's "Custom" is
 * under Allow; the condition still stores it as the `expression` operator with no selector, the
 * degenerate case Formula + IsTrue, until the general Formula selector exists (§13).
 */
const FORMULA_ROW = 'formula';

export interface ConditionEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The condition.
   */
  condition: ICondition | null;
  /**
   * The callback function to handle condition changes.
   */
  // TODO - odd that we take an ICondition but event a json
  onConditionChange: (condition: ICondition.JSON | null) => void;
  /**
   * Optional title for the selector select input.
   *
   * @remarks
   * This should be the action that the condition represents,
   * e.g. "Allow", "Highlight", "Show", etc. depending on the context of the condition consumer.
   */
  selectorTitle?: string;
  /**
   * Whether the "Ignore Blank" checkbox is shown. It is the condition's `includeBlanks`: checked,
   * a blank is never judged, under every host. A host whose list carries the `(Blank)` row may
   * hide it.
   *
   * @defaultValue `true`
   * @see {@link ICondition.isIncludeBlanks}
   */
  showIncludeBlanks?: boolean;
  /**
   * The host's own settings for the rule, shown on the Ignore Blank row after it: a validation's
   * In-cell dropdown. Shown whether or not Ignore Blank is.
   */
  qualifiers?: React.ReactNode;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
  /**
   * The list of operators to show. Defaults to all built-in operators.
   */
  operators?: ICondition.IOperator[];
  /**
   * The list of selectors to show. Defaults to all built-in selectors.
   */
  selectors?: ICondition.ISelector[];
  /**
   * The cells the condition covers, so a selector's default can fit them (a List seeded with the
   * values already there). See {@link ICondition.ISelector.getDefaultCondition}.
   */
  ranges?: ICellRanges | null;
  /**
   * The items an `InSet` may be chosen from (a filter's column). With it `InSet` is offered and
   * edited as a checklist of those items, whatever the selector.
   */
  getItems?: MembershipItemsProvider;
  /** Passed to the `InSet` checklist. */
  propsChecklist?: MembershipOptionProps['propsChecklist'];
  /**
   * Whether the type (selector) row is shown. A filter's column has one type, so its menu hides it.
   *
   * @defaultValue `true`
   */
  showSelector?: boolean;
  /**
   * The label of the root rule's operator select. "When" reads as a sentence under a selector
   * row ("Allow … When …"); a host with no selector row may pass `''` for the bare select.
   * Nested rules keep their own labels ("and", "or").
   *
   * @defaultValue "When"
   */
  operatorTitle?: string;
  /**
   * The button that takes the root rule out, in place of the X. What that means is the host's: a
   * validation or format pane clears its rule (the X), a filter has nothing to clear and passes
   * `null` for no button. See {@link RemoveButtonProps}. Nested rules keep their X.
   */
  renderRemove?: ((props: RemoveButtonProps) => React.ReactNode) | null;
  /**
   * The box's own styles. The editor draws no surface or padding of its own: a pane that wants
   * it framed gives it the frame; a menu lays it against its own edges.
   */
  sx?: SxProps<Theme>;
}

/**
 * Reusable condition editor with a type selector (single) and a recursive operator+param editor.
 *
 * @remarks
 * This component abstracts the condition editing logic so it can be reused across:
 * - Data Validation
 * - Conditional Formatting
 * - Table Filters
 * - Any other condition consumer
 *
 * Architecture:
 * - One selector at the top (always shown)
 * - A single root OperatorAndParamEditor (which may recursively contain a CombinatorOption)
 * - If no operator is chosen yet, an AddConditionButton (OperatorSelectPopupButton) is shown
 * - operators and selectors lists are passed all the way down (not filtered per level)
 */
export const ConditionEditor = memo<ConditionEditorProps>((props) => {
  const {
    condition,
    onConditionChange,
    showIncludeBlanks = true,
    qualifiers,
    selectorTitle,
    readOnly,
    operators: propOperators,
    selectors: propSelectors,
    ranges,
    getItems,
    propsChecklist,
    showSelector = true,
    operatorTitle,
    renderRemove,
    sx,
    ...rest
  } = props;

  const t = useTranslator();
  const language = useLanguage();

  const [selector, setSelector] = useState<ICondition.ISelector | null>(
    () => condition?.getSelector() ?? null
  );
  const [operatorParam, setOperatorParam] = useState<{ operator: string; param: any } | null>(
    () => condition?.getOperator() ? { operator: condition.getOperator()!.getName(), param: condition.getParam() } : null
  );

  const [includeBlanks, setIncludeBlanks] = useState(() => condition?.isIncludeBlanks() ?? false);

  // Sync from external condition changes
  useEffect(() => {
    if (!condition) {
      setSelector(null);
      setOperatorParam(null);
      return;
    }
    const newOperator = condition.getOperator();
    const newSelector = condition.getSelector() ?? null;
    setSelector(newSelector);
    setOperatorParam(newOperator ? { operator: newOperator.getName(), param: condition.getParam() } : null);
    setIncludeBlanks(condition.isIncludeBlanks());
  }, [condition]);

  const allSelectors = useMemo(() => {
    const list = propSelectors ?? (Object.values(Condition.BuiltInSelectors) as ICondition.ISelector[]);
    // Titles are localized, so collate in the active language rather than the host default.
    return list.slice().sort((a, b) => (a.getTitle?.() ?? '').localeCompare(b.getTitle?.() ?? '', language));
  }, [propSelectors, language]);

  const allOperators = useMemo(() => {
    return propOperators ?? (Object.values(Condition.BuiltInOperators) as ICondition.IOperator[]);
  }, [propOperators]);

  // A Formula rule, chosen on the selector row: its operator is settled, and the When menus do
  // not list it. Only where the selector row is shown; a filter's menu keeps its own list.
  const expressionOperator = useMemo((): ICondition.IOperator | null =>
    allOperators.find((op) => op.getName() === ICondition.BuiltInOperatorNames.Expression) ?? null, [allOperators]);
  const formulaOnSelectorRow = showSelector && !!expressionOperator;
  const isFormula = formulaOnSelectorRow && operatorParam?.operator === ICondition.BuiltInOperatorNames.Expression;

  // Membership listed first under Any: where an Excel user looks for "List".
  // The same operator under the same title, pinned for this editor's default list alone.
  const listFirst = useMemo((): ICondition.IOperator | null => {
    if (propOperators) return null;
    const inSet = allOperators.find((op) => op.getName() === ICondition.BuiltInOperatorNames.InSet);
    return inSet ? pinFirst(Object.create(inSet) as ICondition.IOperator) : null;
  }, [allOperators, propOperators]);

  // Leaf + combinator operators filtered by the current selector. An explicit list is taken as
  // given (nothing withheld from it); with an items provider `InSet` stays, whatever the selector:
  // it is the checklist, not a list-typed rule. With the selector row hidden (a filter's menu)
  // the selector is a reading chosen inside the checklist, not a type the author declared, so
  // the operators are the host's list as it stands.
  const filteredOperators = useMemo(() => {
    const filtered = filterBySelector(showSelector ? selector : null, allOperators, language, propOperators ? [] : undefined);
    if (getItems) {
      const inSet = allOperators.find((op) => op.getName() === ICondition.BuiltInOperatorNames.InSet);
      if (inSet && !filtered.includes(inSet)) filtered.unshift(inSet);
    }
    if (listFirst && !selector) {
      const index = filtered.findIndex((op) => op.getName() === ICondition.BuiltInOperatorNames.InSet);
      if (index >= 0) filtered.splice(index, 1, listFirst);
    }
    return filtered;
  }, [selector, allOperators, language, propOperators, getItems, showSelector, listFirst]);

  // What the When menus offer: the Formula row of the selector select is the way into a Formula
  // rule, so the operator is not listed twice.
  const menuOperators = useMemo((): ICondition.IOperator[] => {
    if (!formulaOnSelectorRow) return filteredOperators;
    return filteredOperators.filter((op) => op.getName() !== ICondition.BuiltInOperatorNames.Expression);
  }, [filteredOperators, formulaOnSelectorRow]);

  // What this edit last held under each selector, so switching away and back loses nothing.
  const visited = useRef<Map<string, OperatorParam>>(new Map());
  const selectorKey = (s: ICondition.ISelector | null): string => s?.getName() ?? '';

  // The operator + param area, and whether a choice just made should move the cursor into it.
  const paramArea = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);

  const handleSelectorChange = (newSelector: ICondition.ISelector | null, extra?: string) => {
    if (operatorParam) visited.current.set(isFormula ? FORMULA_ROW : selectorKey(selector), operatorParam);
    if (extra === FORMULA_ROW && expressionOperator) {
      const next: OperatorParam = visited.current.get(FORMULA_ROW)
        ?? { operator: expressionOperator.getName(), param: expressionOperator.createDefaultParam?.() ?? '' };
      setSelector(null);
      setOperatorParam(next);
      focusPending.current = true;
      onConditionChange?.({ selector: null, ...next, includeBlanks });
      return;
    }
    const next = resolveSelectorChange({
      from: selector,
      to: newSelector,
      // A Formula rule does not carry over: its operator belongs to the row being left.
      current: isFormula ? null : operatorParam,
      remembered: visited.current.get(selectorKey(newSelector)) ?? null,
      operators: allOperators,
      context: { ranges }
    });
    setSelector(newSelector);
    setOperatorParam(next);
    focusPending.current = true;
    onConditionChange?.({ selector: newSelector, ...(next ?? { operator: null, param: null }), includeBlanks });
  };

  /* After a type or operator is chosen, the next thing to do is type its value, so the cursor goes
     to the first value field with its contents selected: typing replaces a defaulted or restored
     value rather than appending to it. This runs after the select's menu has handed focus back to
     the select (its focus trap restores in a cleanup, before this effect). A select's own hidden
     value input (`tabindex="-1"`) is not a value field. */
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const field = Array.from(paramArea.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([tabindex="-1"]), textarea'
    ) ?? []).find((el) => !el.disabled && !el.readOnly && el.getAttribute('aria-hidden') !== 'true');
    if (!field) return;
    field.focus();
    field.select();
  }, [selector, operatorParam]);

  const handleOperatorParamChange = (newOperatorParam: OperatorParam) => {
    // A reading chosen inside the checklist (Display) says nothing to an operator that cannot
    // read under it: choosing a comparison in a filter's menu lets it go.
    const operator = allOperators.find((op) => op.getName() === newOperatorParam.operator) ?? null;
    const keepSelector = showSelector || !selector || !operator || operatorReadsUnder(selector, operator);
    const nextSelector = keepSelector ? selector : null;
    if (nextSelector !== selector) setSelector(nextSelector);
    setOperatorParam(newOperatorParam);
    onConditionChange?.({ selector: nextSelector, ...newOperatorParam, includeBlanks });
  };

  const onIncludeBlanksChange = (include: boolean) => {
    setIncludeBlanks(include);
    onConditionChange?.({ selector, ...operatorParam, includeBlanks: include });
  }

  // A reading chosen from inside the operator's editor (the checklist's "By value": Display or
  // none), which keeps the operator and its param as they are.
  const handleSelectorChoice = (name: string | null) => {
    const chosen = name ? (allSelectors.find((s) => s.getName() === name) ?? Condition.Selectors.get(name) ?? null) : null;
    setSelector(chosen);
    onConditionChange?.({ selector: chosen, ...operatorParam, includeBlanks });
  };
  const handleRemove = () => {
    setOperatorParam(null);
    onConditionChange?.({ selector, operator: null, param: null, includeBlanks });
  };

  return (
    <Box
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 1 },
        ...(Array.isArray(sx) ? sx : [sx])
      ]}
      {...rest}
    >
      {/* Selector row */}
      {showSelector ? (
        <SelectorSelect
          title={selectorTitle}
          selectors={allSelectors}
          value={selector}
          onChange={handleSelectorChange}
          allowNull={true}
          readOnly={readOnly}
          extras={formulaOnSelectorRow ? [{ value: FORMULA_ROW, title: expressionOperator!.getTitle?.() ?? FORMULA_ROW }] : undefined}
          extraValue={isFormula ? FORMULA_ROW : null}
        />
      ) : null}

      {/* Operator + param area */}
      {operatorParam ? (
        // `contents`: a handle for focusing its fields that adds no box to the column's layout.
        <Box ref={paramArea} sx={{ display: 'contents' }}>
          <OperatorAndParamEditor
            operatorParam={operatorParam}
            onOperatorParamChange={handleOperatorParamChange}
            onRemove={handleRemove}
            renderRemove={renderRemove}
            operatorTitle={operatorTitle}
            operators={isFormula ? filteredOperators : menuOperators}
            operatorFixed={isFormula}
            selector={selector}
            onSelectorChange={handleSelectorChoice}
            getItems={getItems}
            propsChecklist={propsChecklist}
            ignoreBlank={includeBlanks}
            readOnly={readOnly}
          />
        </Box>
      ) : !readOnly && (
        <Box
          sx={{
            display: 'flex'
          }}
        >
          <OperatorSelectPopupButton
            label={operatorTitle ?? t('condition.when')}
            operators={menuOperators}
            value={null}
            onChange={(newOperator) => {
              if (!newOperator) return;
              focusPending.current = true;
              handleOperatorParamChange({ operator: newOperator?.getName() ?? null, param: buildDefaultParam(newOperator, filteredOperators, selector, getItems ? undefined : { ranges }) });
            }}
            readOnly={readOnly}
          />
        </Box>
      )}

      {/* Ignore Blank: the one qualifier on the condition, the same words under every host.
          Checked, a blank is never judged; unchecked, it is a value the rule decides on, and a
          list offers it as its (Blank) row. The host's qualifiers share
          its row. */}
      {showIncludeBlanks || qualifiers ? (
        <Box className="condition-qualifiers" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2 }}>
          {showIncludeBlanks ? (
            <FormControlLabel
              className="include-blanks"
              control={
              <Checkbox
                size="small"
                checked={includeBlanks}
                onChange={(e) => onIncludeBlanksChange(e.target.checked)}
              />}
              disabled={readOnly}
              label={t('condition.ignoreBlank')}
            />
          ) : null}
          {qualifiers}
        </Box>
      ) : null}
    </Box>
  );
});

ConditionEditor.displayName = 'ConditionEditor';