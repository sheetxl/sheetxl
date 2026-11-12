import React from 'react';

import { ListSubheader, Divider } from '@mui/material';

import { Condition, ICondition } from '@sheetxl/sdk';

import { type TranslateFn } from '@sheetxl/utils-react';

/** Monotonically increasing counter for stable React keys on combinator children. */
let _nextKey = 0;
const nextKey = (): string => `__ci_${++_nextKey}`;

/**
 * Module-level WeakMap — maps CombinatorInput objects to their stable React keys.
 * This avoids polluting the data shape with UI-only fields.
 */
const _inputKeyMap = new WeakMap<object, string>();

/**
 * Returns a stable React key for a combinator input object.
 * Creates and stores a new key the first time a given object reference is seen.
 */
export const getInputKey = (input: object): string => {
  let key = _inputKeyMap.get(input);
  if (!key) {
    key = nextKey();
    _inputKeyMap.set(input, key);
  }
  return key;
};

/**
 * Copies the stable React key from one input object to another.
 * Use this when replacing an input object in-place (e.g. after an edit)
 * so that the React subtree for that slot is not remounted.
 */
export const transferInputKey = (from: object, to: object): void => {
  const key = _inputKeyMap.get(from);
  if (key) _inputKeyMap.set(to, key);
};

/**
 * Internal data shape for a single child inside a combinator (AND/OR/NOT).
 */
export interface CombinatorInput {
  /** The child's own selector, when it reads the value differently from its parent (a file's
   * `notEqual` is `not(Display + equalTo)`). Absent, the parent's selector reads for it. */
  selector?: string | null;
  operator: string;
  param: any;
}

/**
 * The operators no *authoring* UI offers by default: an icon or color test is a scale, not a
 * predicate. A caller that does want them (AutoFilter) passes its own `exclude`.
 */
export const DEFAULT_EXCLUDED_OPERATORS: readonly string[] = Object.freeze([
  ICondition.BuiltInOperatorNames.Icon,
  ICondition.BuiltInOperatorNames.Color
]);

/** The text operators, offered under no selector and under Text: they read raw text. */
const TEXT_FAMILY: ReadonlySet<string> = new Set<string>([
  ICondition.BuiltInOperatorNames.TextContains,
  ICondition.BuiltInOperatorNames.TextStartsWith,
  ICondition.BuiltInOperatorNames.TextEndsWith,
  ICondition.BuiltInOperatorNames.TextMatches,
  ICondition.BuiltInOperatorNames.TextEmail,
  ICondition.BuiltInOperatorNames.TextIsUrl
]);

/** Operators a host lists ahead of the rest, whatever their titles. */
const PINNED_FIRST = new WeakSet<ICondition.IOperator>();

/**
 * Marks `operator` to be listed first among its kind: a host's own name for the test its users
 * reach for (a filter's "Values").
 */
export const pinFirst = <T extends ICondition.IOperator>(operator: T): T => {
  PINNED_FIRST.add(operator);
  return operator;
};

/** Operators a host lists under a section of its own, ahead of Basic, by that section's title. */
const GROUPED_FIRST = new WeakMap<ICondition.IOperator, string>();

/**
 * Marks `operator` to be listed under `title`, a section ahead of Basic in the order the
 * operators are given: a host's own grouping of the tests its users look for first (a filter
 * column's Number / Text / Date Filters, in Excel's order).
 */
export const groupFirst = <T extends ICondition.IOperator>(operator: T, title: string): T => {
  GROUPED_FIRST.set(operator, title);
  return operator;
};

/**
 * Orders operators by title in `language`, the pinned ones first, then the grouped ones in the
 * order given (a stable sort keeps it), then the rest.
 */
export const compareOperators = (language?: string) => (a: ICondition.IOperator, b: ICondition.IOperator): number => {
  const pinned = Number(PINNED_FIRST.has(b)) - Number(PINNED_FIRST.has(a));
  if (pinned !== 0) return pinned;
  const groupedA = GROUPED_FIRST.has(a);
  const groupedB = GROUPED_FIRST.has(b);
  if (groupedA || groupedB) return Number(groupedB) - Number(groupedA);
  return (a.getTitle?.() ?? '').localeCompare(b.getTitle?.() ?? '', language);
};

/**
 * Whether `operator` can be asked about `selector`'s reading: it takes the selector's type, or
 * any type, or tests the cell rather than the reading (`blank`, which is settled before any
 * selector). No selector reads for every operator.
 */
export const operatorReadsUnder = (selector: ICondition.ISelector | null, operator: ICondition.IOperator): boolean => {
  if (!selector) return true;
  const name = operator.getName();
  if (name === ICondition.BuiltInOperatorNames.Blank) return true;
  if (selector.getName() === ICondition.BuiltInSelectorNames.Display && TEXT_FAMILY.has(name)) return false;
  const operatorTypes = operator.getAcceptsTypes?.();
  return !operatorTypes || operatorTypes.includes(selector.getSelectType() ?? null);
};

/**
 * Filters operators by selector type.
 *
 * @remarks
 * Canonical location — re-exported from here so both ConditionEditor and any
 * other consumers use the same implementation.
 */
export const filterBySelector = (
  selector: ICondition.ISelector | null,
  operators?: ICondition.IOperator[],
  /** Active UI language, for collating the localized titles. Defaults to the host locale. */
  language?: string,
  /** Operator names to withhold. Defaults to {@link DEFAULT_EXCLUDED_OPERATORS}. */
  exclude: readonly string[] = DEFAULT_EXCLUDED_OPERATORS
): ICondition.IOperator[] => {
  const operatorsToFilter: ICondition.IOperator[] = operators ?? (Object.values(Condition.BuiltInOperators) as ICondition.IOperator[]);
  const type = selector?.getSelectType() ?? null;
  const isDisplay = selector?.getName() === ICondition.BuiltInSelectorNames.Display;
  const filtered = operatorsToFilter.filter((op) => {
    if (exclude.includes(op.getName())) return false;
    // "Any" (no selector) is not a type constraint — every operator applies. This is
    // conditional formatting's "cell value" category, and every rule read from xlsx arrives
    // selector-less; filtering by a null type would hide the very operator such a rule uses.
    if (!selector) return true;
    // Display offers identity (equal to, one of) and nothing of the text family: Excel's text
    // filters read the raw text of a text cell, never a number's display.
    if (isDisplay && TEXT_FAMILY.has(op.getName())) return false;
    const operatorTypes = op.getAcceptsTypes?.();
    if (!operatorTypes) return true;
    return operatorTypes.includes(type);
  });
  // Titles are localized, so collate in the active language rather than the host default.
  return filtered.sort(compareOperators(language));
};

/**
 * Builds grouped menu items (Basic section + Combine section) from an operators list.
 *
 * @param operators  The full operator list (leaf + combinator).
 * @param renderItem Callback that receives each operator and returns the concrete menu item
 *                   (e.g. `<MenuItem value={op.getName()}>` for Select, or with `onClick` for popups).
 * @param t          The caller's bound translator (`useTranslator()`) — a plain function returning
 *                   JSX cannot call the hook itself, and a `.tsx` may not read the module-level `t`
 *                   (it would freeze at mount-time language), so the subscription is threaded in.
 *
 * @remarks
 * A host's own sections ({@link groupFirst}) come first, in the order the operators are given.
 * Both of the sections after them are sorted alphabetically **in the active language** — operator
 * titles are localized, so the collation has to follow the UI language rather than the host
 * default. If only one section has operators the header and divider for the empty section are
 * omitted. Works with both MUI `Select` (which accepts `ListSubheader` children natively) and
 * custom popup panels.
 */
export const buildOperatorMenuItems = (
  operators: ICondition.IOperator[],
  renderItem: (operator: ICondition.IOperator) => React.ReactNode,
  t: TranslateFn,
  language?: string
): React.ReactNode[] => {
  const byTitle = compareOperators(language);
  const grouped = new Map<string, ICondition.IOperator[]>();
  for (const op of operators) {
    const title = GROUPED_FIRST.get(op);
    if (title === undefined) continue;
    const section = grouped.get(title);
    if (section) section.push(op); else grouped.set(title, [op]);
  }
  const leaf = operators.filter(op => !op.isCombinator?.() && !GROUPED_FIRST.has(op)).sort(byTitle);
  const combinator = operators.filter(op => op.isCombinator?.()).sort(byTitle);

  const items: React.ReactNode[] = [];

  for (const [title, section] of grouped) {
    items.push(
      <ListSubheader key={`__header:${title}`} disableSticky sx={SxListSubheader}>
        {title}
      </ListSubheader>
    );
    section.forEach(op => items.push(renderItem(op)));
  }

  if (grouped.size > 0 && leaf.length > 0) {
    items.push(<Divider key="__divider:grouped" />);
  }

  if (leaf.length > 0) {
    items.push(
      <ListSubheader key="__header:leaf" disableSticky sx={SxListSubheader}>
        {t('condition.groupBasic')}
      </ListSubheader>
    );
    leaf.forEach(op => items.push(renderItem(op)));
  }

  if (leaf.length > 0 && combinator.length > 0) {
    items.push(<Divider key="__divider" />);
  }

  if (combinator.length > 0) {
    items.push(
      <ListSubheader key="__header:combinator" disableSticky sx={SxListSubheader}>
        {t('condition.groupCombine')}
      </ListSubheader>
    );
    combinator.forEach(op => items.push(renderItem(op)));
  }

  return items;
};

/**
 * Builds the default `param` value for a newly-selected operator.
 *
 * @remarks
 * - For **leaf** operators: delegates to `operator.createDefaultParam(ctx)`.
 * - For **combinator** operators (and/or/not): pre-populates with one default child
 *   using the first available leaf operator, so the combinator is never empty on creation.
 *   - AND/OR: `param` is `CombinatorInput[]` with one entry.
 *   - NOT: `param` is a single `CombinatorInput` (unary).
 *
 * @param newOperator The operator being added/switched to.
 * @param operators   The full list of available operators at this level (used to find the first leaf).
 * @param context     What the condition will apply to, for a leaf operator that fits its default
 *                    to it (a list starts from the values already in the cells).
 */
export const buildDefaultParam = (
  newOperator: ICondition.IOperator,
  operators: ICondition.IOperator[],
  selector: ICondition.ISelector | null = null,
  context?: ICondition.DefaultConditionContext
): any => {
  if (!newOperator.isCombinator?.()) {
    return newOperator.createDefaultParam?.(selector ?? undefined, context) ?? null;
  }

  const firstLeaf = operators.find(op => !op.isCombinator?.()) ?? null;
  const child: CombinatorInput | null = firstLeaf
    ? { operator: firstLeaf.getName(), param: firstLeaf.createDefaultParam?.(selector ?? undefined) ?? null }
    : null;

  const isNot = newOperator.getName() === 'not';
  if (isNot) return child; // unary — single child or null
  return child ? [child] : []; // n-ary — array
};

/**
 * An operator and its param, as the editor holds them.
 */
export interface OperatorParam {
  operator: string;
  param: any;
}

export interface SelectorChange {
  /** The selector being left. */
  from: ICondition.ISelector | null;
  /** The selector chosen. */
  to: ICondition.ISelector | null;
  /** What the condition holds now. */
  current: OperatorParam | null;
  /** What this edit last held under `to`, if it was visited before. */
  remembered?: OperatorParam | null;
  /** Every operator on offer, before filtering by selector. */
  operators: ICondition.IOperator[];
  /** Passed to {@link ICondition.ISelector.getDefaultCondition}. */
  context?: ICondition.DefaultConditionContext;
}

/**
 * The operator and param a condition holds once its selector changes.
 *
 * @remarks
 * In order: what this edit last held under the new selector (so switching away and back loses
 * nothing); else the current operator when it still applies (its param rebuilt if the value type
 * changed); else the new selector's default. Only a selector with no default and no applicable
 * operator yields `null`, the empty "add condition" state.
 */
export const resolveSelectorChange = (change: SelectorChange): OperatorParam | null => {
  const { from, to, current, remembered, operators, context } = change;
  const applicable = filterBySelector(to, operators);
  const findApplicable = (name: string | undefined): ICondition.IOperator | null =>
    (name && applicable.find((op) => op.getName() === name)) || null;

  if (remembered && findApplicable(remembered.operator)) return remembered;

  const currentOperator = findApplicable(current?.operator);
  if (current && currentOperator) {
    // A combinator's children were built for the old selector, and a param whose value type
    // changed (number → text) no longer means anything: both start over, on the same operator.
    const typeChanged = (currentOperator.getParamType?.(from ?? undefined) ?? null)
      !== (currentOperator.getParamType?.(to ?? undefined) ?? null);
    if (currentOperator.isCombinator?.() || typeChanged) {
      return { operator: current.operator, param: buildDefaultParam(currentOperator, applicable, to) };
    }
    return current;
  }

  const defaultCondition = to?.getDefaultCondition?.(context) ?? null;
  const defaultOperator = findApplicable(defaultCondition?.operator);
  if (defaultCondition && defaultOperator) {
    return {
      operator: defaultCondition.operator,
      param: defaultCondition.param !== undefined
        ? defaultCondition.param
        : buildDefaultParam(defaultOperator, applicable, to)
    };
  }
  return null;
};

export const SxListSubheader = {
  userSelect: 'none',
  // lineHeight: '28px',
  // px: '16px',
  // py: 0,

  lineHeight: '2',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'text.secondary',
  paddingLeft: 1,
  paddingRight: 1
};

export const SxMenuItem = {
  pl: 2
}