import type React from 'react';
import { memo, useMemo } from 'react';

import { Box } from '@mui/material';

import { ICondition } from '@sheetxl/sdk';

import { useMeasure, DynamicIcon, RenderSlot, useCallbackRef, useTranslator } from '@sheetxl/utils-react';
import { ExhibitIconButton } from '@sheetxl/utils-mui';

const Ops = ICondition.BuiltInOperatorNames;
/**
 * The comparison operators whose Scalar param may be a `=`-prefixed formula operand
 * (CONDITIONS-OPERANDS design §2) — these take the literal-or-formula field. NOT the text-rule
 * params (`textContains` &c.): those are OOXML's `text` attribute, plain text by type, and a
 * marker there would corrupt them. `between` routes through its own param editor.
 */
const FORMULA_OPERAND_OPERATORS = new Set<string>([
  Ops.EqualTo, Ops.GreaterThan, Ops.GreaterThanEqualTo, Ops.LessThan, Ops.LessThanEqualTo,
  Ops.After, Ops.AfterEqualTo, Ops.Before, Ops.BeforeEqualTo
]);

import { OperatorSelect } from './OperatorSelect';
import { OperatorSelectPopupButton } from './OperatorSelectPopupButton';
import { CombinatorOption } from './CombinatorOption';
import { buildDefaultParam, type CombinatorInput } from './ConditionUtils';
import { StringOption } from './StringOption';
import { NumberOption } from './NumberOption';
import { ScalarOption } from './ScalarOption';
import { BooleanOption } from './BooleanOption';
import { AverageOption } from './AverageOption';
import { TimePeriodOption } from './TimePeriodOption';
import { TopNOption } from './TopNOption';
import { BetweenOption } from './BetweenOption';
import { ExpressionOption } from './ExpressionOption';
import { MembershipOption, type MembershipItemsProvider, type MembershipOptionProps } from './MembershipOption';

/** What a {@link OperatorAndParamEditorProps.renderRemove} renderer is given. */
export interface RemoveButtonProps {
  /** Takes the rule out. */
  onClick: () => void;
  /** The name of the operator the rule holds. */
  operator: string | null;
  readOnly?: boolean;
}

export interface OperatorAndParamEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The current operator+param pair being edited.
   */
  operatorParam: { operator: string; param: any };
  /**
   * Called when either the operator or param changes.
   */
  onOperatorParamChange: (operatorParam: { operator: string; param: any }) => void;
  /**
   * Called when the X (remove) button is clicked.
   */
  onRemove: () => void;
  /**
   * The button that takes the rule out, in place of the X. What taking a rule out means is the
   * host's (a validation clears it, a filter has nothing to clear), so the host draws the button,
   * or none: `null` draws no button, `undefined` the X. The renderer may answer `null` too, for
   * one operator and not another.
   */
  renderRemove?: ((props: RemoveButtonProps) => React.ReactNode) | null;
  /**
   * All operators available at this level (leaf + combinator), already filtered by selector.
   * Passed straight through to children — not re-filtered here.
   */
  operators: ICondition.IOperator[];
  /**
   * The current selector (passed through to param editors and children).
   */
  selector: ICondition.ISelector | null;
  /**
   * Called when the param's editor chooses a reading of its own (the checklist's "By value":
   * Display or none), by selector name. The operator and param stay as they are.
   */
  onSelectorChange?: (selector: string | null) => void;
  /**
   * The population an `InSet` is a snapshot of (a filter's column). With it the set's members
   * are that population's values; without it the author builds the set (a data validation).
   */
  getItems?: MembershipItemsProvider;
  /** Passed to the `InSet` editor. */
  propsChecklist?: MembershipOptionProps['propsChecklist'];
  /** The root condition's Ignore Blank: an `InSet` editor then lists no (Blank) row. */
  ignoreBlank?: boolean;
  /**
   * Optional title for the operator select input.
   */
  operatorTitle?: string;
  /**
   * The operator is settled by the host's selector row (Formula under Allow), so no select is
   * drawn and the param editor takes the row. Nested rules are unaffected.
   */
  operatorFixed?: boolean;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
  /**
   * If true, hides the remove (X) button — use when exactly one child is required (e.g. NOT combinator).
   */
  required?: boolean;
}

/**
 * Edits a single operator+param pair.
 *
 * @remarks
 * - If the operator is a combinator (and/or/not), renders CombinatorOption for the body.
 * - Otherwise renders the appropriate leaf param editor.
 * - Shows the remove button in the top-right: the X, or what `renderRemove` draws.
 * - The operator can be changed via the OperatorSelect at the top-left.
 * - Operators and selector are passed straight through to children without re-filtering.
 */
export const OperatorAndParamEditor = memo<OperatorAndParamEditorProps>((props) => {
  const {
    operatorParam,
    onOperatorParamChange,
    onRemove,
    renderRemove,
    operators,
    selector,
    onSelectorChange,
    getItems,
    propsChecklist,
    ignoreBlank,
    operatorTitle: propOperatorTitle,
    operatorFixed = false,
    readOnly,
    required,
    ...rest
  } = props;

  const t = useTranslator();
  const operatorTitle = propOperatorTitle ?? t('condition.when');

  const operatorName = operatorParam?.operator ?? null;

  // The button that takes the rule out: none under Not's one child, none when the host says so,
  // else the host's or the X.
  const removeButton = (): React.ReactNode => {
    if (readOnly || required || renderRemove === null) return null;
    if (renderRemove) return <RenderSlot render={renderRemove} props={{ onClick: onRemove, operator: operatorName, readOnly }} />;
    return (
      <ExhibitIconButton
        icon={<DynamicIcon iconKey="Close" />}
        onClick={onRemove}
      />
    );
  };
  const operator = operators.find(op => op.getName() === operatorName) ?? null;
  const param = operatorParam?.param ?? null;

  const isCombinator = !!operator?.isCombinator?.();
  // A set has one editor under every host and selector, chosen by the operator.
  const isMembership = operatorName === ICondition.BuiltInOperatorNames.InSet;

  // Measure the outer container so we can decide between single-line and stacked layouts.
  const [refMeasure, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  // Compute paramType outside the editor memo so the layout logic can also inspect it.
  const paramType = useMemo(() => {
    if (!operator || isCombinator) return null;
    return operator.getParamType?.(selector ?? undefined) ?? null;
  }, [operator, isCombinator, selector]);

  // Single-line layout: put [OperatorSelect] [param editor] [✕] on one row when:
  //   • the container is wider than 360 px (measured, not the viewport)
  //   • the operator is a leaf (combinators always stay stacked — they have the Add button)
  //   • the param is not a set (its editor expands vertically and must stay below)
  const useSingleLine = operatorFixed || (!isCombinator && !isMembership && containerWidth > 360);

  // STABLE identity, always-fresh closure: the memo below deliberately excludes callbacks from
  // its deps, so a plain closure here froze whatever `onOperatorParamChange` (and through it, the
  // parent's selector state) looked like when the memo last rebuilt — after changing the selector,
  // every param keystroke then emitted the PREVIOUS selector, and the two flip-flopped forever.
  const handleParamChange = useCallbackRef((newOption: any) => {
    onOperatorParamChange({ operator: operatorName, param: newOption });
  }, [onOperatorParamChange, operatorName]);

  // Leaf param editor (only rendered when NOT a combinator)
  const paramEditor = useMemo(() => {
    if (!operator || isCombinator) return null;

    // Existing option components use `option` (not `param`) as the value prop name
    const commonProps = {
      // The row is the param's alone when the operator draws no select.
      sx: { flex: operatorFixed ? 1 : 0.6, minWidth: 0 },
      option: param,
      onOptionChange: handleParamChange,
    };

    if (isMembership) {
      return (
        <MembershipOption
          {...commonProps}
          getItems={getItems}
          selector={selector}
          onSelectorChange={onSelectorChange}
          readOnly={readOnly}
          propsChecklist={propsChecklist}
          ignoreBlank={ignoreBlank}
        />
      );
    }
    if (!paramType) return null;

    // A comparison operator's operand is a literal OR a `=`-prefixed formula — one field, the `=`
    // deciding (Excel's own box). The text-rule and set-shaped params below keep their typed
    // editors.
    const allowsFormulaOperand = operatorName ? FORMULA_OPERAND_OPERATORS.has(operatorName) : false;

    // params mix selector and operator types
    // selectors
    // TODO - FIX ParamType - this is incorrect. This should not be using names but rather a param type keyword
    if (paramType === ICondition.BuiltInSelectorNames.Number) {
      return allowsFormulaOperand ? <ScalarOption {...commonProps}/> : <NumberOption {...commonProps}/>;
    }
    if (paramType === ICondition.BuiltInSelectorNames.TextLength) {
      return allowsFormulaOperand ? <ScalarOption {...commonProps}/> : <NumberOption {...commonProps}/>;
    }

    if (paramType === ICondition.BuiltInSelectorNames.Whole) {
      if (allowsFormulaOperand) return <ScalarOption {...commonProps}/>;
      return <NumberOption {...commonProps} placeholder={t('condition.enterWholeNumber')} slotProps={{ htmlInput: { step: 1, onKeyDown: (e: React.KeyboardEvent) => { if (['.', ',', 'e', 'E'].includes(e.key)) e.preventDefault(); }, onPaste: (e: React.ClipboardEvent) => { if (!/^-?\d+$/.test(e.clipboardData.getData('text'))) e.preventDefault(); } } }} />;
    }

    if (paramType === ICondition.BuiltInSelectorNames.Text || paramType === ICondition.BuiltInSelectorNames.Display) {
      return allowsFormulaOperand ? <ScalarOption {...commonProps}/> : <StringOption {...commonProps} />;
    }

    // A date or time operand is typed as it is into a cell, or given as a formula (`=TODAY()`),
    // as Excel's own Start date box takes it: the literal-or-formula field, reading the literal as
    // a date. A picker beside it is a later addition; a native date input was neither editable
    // nor able to hold a formula.
    if (paramType === ICondition.BuiltInSelectorNames.DateTime) return <ScalarOption {...commonProps} literal="dateTime" />;
    if (paramType === ICondition.BuiltInSelectorNames.Date) return <ScalarOption {...commonProps} literal="date" />;
    if (paramType === ICondition.BuiltInSelectorNames.Time) return <ScalarOption {...commonProps} literal="time" />;

    if (paramType === ICondition.BuiltInSelectorNames.Logical) return <BooleanOption {...commonProps} />;

    // operators
    if (paramType === ICondition.BuiltInOperatorNames.Average) return <AverageOption {...commonProps} />;
    if (paramType === ICondition.BuiltInOperatorNames.TimePeriod) return <TimePeriodOption {...commonProps} />;
    if (paramType === ICondition.BuiltInOperatorNames.TopN) return <TopNOption {...commonProps} />;
    if (paramType === ICondition.BuiltInOperatorNames.Between) return <BetweenOption {...commonProps} selector={selector} />;
    if (paramType === ICondition.BuiltInOperatorNames.Expression) return <ExpressionOption {...commonProps} />;
    return null;
  }, [operator, isCombinator, isMembership, getItems, propsChecklist, ignoreBlank, readOnly, paramType, param, selector, onSelectorChange, operatorFixed, t]);

  // Combinator inputs: param is CombinatorInput[] for and/or, single CombinatorInput for not.
  // getInputKey (WeakMap-based) lazily assigns stable React keys on first access — no normalisation needed.
  const combinatorInputs: CombinatorInput[] = useMemo(() => {
    if (!isCombinator) return [];
    if (!param) return [];
    return Array.isArray(param) ? param : [param];
  }, [isCombinator, param]);

  const isNot = isCombinator && operator?.getName() === 'not';

  const handleCombinatorChange = (inputs: CombinatorInput[]) => {
    onOperatorParamChange({ operator: operatorName, param: isNot ? (inputs[0] ?? null) : inputs });
  };

  const handleCombinatorAdd = (newOperator: ICondition.IOperator | null) => {
    if (!newOperator) return;
    const defaultParam = buildDefaultParam(newOperator, operators, selector);
    const next = [...combinatorInputs, { operator: newOperator?.getName() ?? null, param: defaultParam }];
    onOperatorParamChange({ operator: operatorName, param: next });
  };

  // Shared operator-change handler — identical logic regardless of which layout is active.
  const handleOperatorChange = (newOperator: ICondition.IOperator | null) => {
    if (!newOperator || newOperator === operator) return;
    const isNewCombinator = !!newOperator.isCombinator?.();
    let nextParam: any;
    if (isNewCombinator && isCombinator) {
      // Combinator → combinator: reuse existing children to avoid data loss.
      // Switching to NOT: trim to the first child (unary).
      const isNewNot = newOperator.getName() === 'not';
      if (isNewNot) {
        nextParam = combinatorInputs[0] ?? buildDefaultParam(newOperator, operators, selector);
      } else {
        // AND/OR: keep all children; wrap NOT's single child back into an array
        nextParam = combinatorInputs.length > 0 ? combinatorInputs : buildDefaultParam(newOperator, operators, selector);
      }
    } else {
      // Leaf → leaf: preserve param only when param type is identical. Combinator → leaf: always
      // build fresh — a combinator's param is its children, and its param TYPE reads as the
      // selector's (the default of every operator), the same as the leaf's, so the type alone
      // would carry the children into a value field. Anything → combinator: always build fresh.
      const oldParamType = operator?.getParamType?.(selector ?? undefined) ?? null;
      const newParamType = newOperator.getParamType?.(selector ?? undefined) ?? null;
      nextParam = (!isNewCombinator && !isCombinator && newParamType && newParamType === oldParamType)
        ? param
        : buildDefaultParam(newOperator, operators, selector);
    }
    onOperatorParamChange({ operator: newOperator?.getName() ?? null, param: nextParam });
  };

  return (
    <Box
      ref={refMeasure}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
      }}
      {...rest}
    >
      {useSingleLine ? (
        /* ─── Single-line: [OperatorSelect] [param editor] [✕] ─── */
        (<Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
          {operatorFixed ? null : (
            <OperatorSelect
              title={operatorTitle}
              sx={{ flex: 0.4 }}
              value={operator}
              operators={operators}
              onChange={handleOperatorChange}
              readOnly={readOnly}
            />
          )}
          {paramEditor}
          {removeButton()}
        </Box>)
      ) : (
        <>
          {/* Header row: [OperatorSelect] [Add (combinator only)] [Close X] */}
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
            <OperatorSelect
              title={operatorTitle}
              // MUI Selector doesn't autoFit for options (just selected).
              // sx={{ flex: '0 0 auto', minWidth: 'content' }}
              sx={{ flex: 1 }}
              value={operator}
              operators={operators}
              onChange={handleOperatorChange}
              readOnly={readOnly}
            />
            {/* Add child button — AND/OR combinators only */}
            {isCombinator && !isNot && !readOnly && (
              <OperatorSelectPopupButton
                label={operator?.getTitle?.()}
                icon={<DynamicIcon iconKey="Add" />}
                operators={operators}
                value={null}
                onChange={handleCombinatorAdd}
              />
            )}
            {removeButton()}
          </Box>

          {/* Body: leaf param editor OR combinator children */}
          {isCombinator ? (
            <CombinatorOption
              operator={operator!}
              inputs={combinatorInputs}
              onOptionChange={handleCombinatorChange}
              operators={operators}
              selector={selector}
              getItems={getItems}
              propsChecklist={propsChecklist}
              ignoreBlank={ignoreBlank}
              readOnly={readOnly}
            />
          ) : (
            paramEditor
          )}
        </>
      )}
    </Box>
  );
});

OperatorAndParamEditor.displayName = 'OperatorAndParamEditor';
