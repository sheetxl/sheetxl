import React, { memo } from 'react';

import { Box } from '@mui/material';

import { Condition, type ICondition } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type CombinatorInput, getInputKey, transferInputKey } from './ConditionUtils';
import { OperatorAndParamEditor } from './OperatorAndParamEditor';
import { type MembershipItemsProvider, type MembershipOptionProps } from './MembershipOption';

export interface CombinatorOptionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The combinator operator (and / or / not).
   */
  operator: ICondition.IOperator;
  /**
   * The current list of child operator+param pairs.
   */
  inputs: CombinatorInput[];
  /**
   * Called when the full inputs list changes.
   */
  onOptionChange: (inputs: CombinatorInput[]) => void;
  /**
   * All available operators to pass down to children (leaf + combinator).
   * Passed straight through — not filtered per level.
   */
  operators: ICondition.IOperator[];
  /**
   * The selector (passed down to children).
   */
  selector: ICondition.ISelector | null;
  /** The items provider for an `InSet` checklist, passed down to children. */
  getItems?: MembershipItemsProvider;
  /** Passed down to an `InSet` checklist. */
  propsChecklist?: MembershipOptionProps['propsChecklist'];
  /** The root condition's Ignore Blank, passed down to an `InSet` checklist. */
  ignoreBlank?: boolean;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/**
 * Renders the body of a combinator operator (All of / Any of / Is Not).
 *
 * @remarks
 * - For AND/OR: shows a list of OperatorAndParamEditors, each with an X button,
 *   separated by a small label ("and" / "or"), plus an AddConditionButton at the bottom.
 * - For NOT: shows a single OperatorAndParamEditor (no Add button — unary).
 * - Operators and selectors are passed straight through (not re-filtered here).
 */
export const CombinatorOption = memo<CombinatorOptionProps>((props) => {
  const {
    operator,
    inputs,
    onOptionChange,
    operators,
    selector,
    getItems,
    propsChecklist,
    ignoreBlank,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const isNot = operator.getName() === 'not'; // unary
  // Label shown between sibling conditions ("and" / "or") — the NAME is canonical, display translates.
  const separatorLabel = isNot ? null
    : operator.getName() === 'and' ? t('condition.and') : t('condition.or');

  const handleChildChange = (index: number, updated: { operator: string; param: any }) => {
    const next = inputs.slice();
    const previous = inputs[index];
    const newInput: CombinatorInput = { operator: updated.operator, param: updated.param };
    // A child's own reading survives an edit of its operator or param.
    if (previous?.selector) newInput.selector = previous.selector;
    // Carry the stable React key forward so this slot doesn't remount on edit
    transferInputKey(inputs[index], newInput);
    next[index] = newInput;
    onOptionChange(next);
  };

  const handleChildRemove = (index: number) => {
    const next = inputs.filter((_, i) => i !== index);
    onOptionChange(next);
  };

  // A child reads through its own selector when it has one, else its parent's.
  const childSelector = (input: CombinatorInput): ICondition.ISelector | null => {
    return input.selector ? (Condition.Selectors.get(input.selector) ?? selector) : selector;
  };

  const handleChildSelectorChange = (index: number, name: string | null) => {
    const next = inputs.slice();
    const { selector: _selector, ...rest } = inputs[index];
    const newInput: CombinatorInput = name ? { ...rest, selector: name } : rest;
    transferInputKey(inputs[index], newInput);
    next[index] = newInput;
    onOptionChange(next);
  };

  const operatorTitle = isNot ? t('condition.not') : separatorLabel;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        pl: 1,
        borderLeft: 2,
        borderColor: 'divider',
      }}
      {...rest}
    >
      {inputs.map((input, index) => (
        <React.Fragment key={getInputKey(input)}>
          {/* Separator label between siblings (not before first, not for NOT) */}
          {/* {separatorLabel && index > 0 && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', alignSelf: 'flex-start', px: 0.5 }}
            >
              {separatorLabel}
            </Typography>
          )} */}
          <OperatorAndParamEditor
            operatorTitle={index > 0 ? (operatorTitle ?? '') : ''}
            operatorParam={input}
            onOperatorParamChange={(updated) => handleChildChange(index, updated)}
            onRemove={() => handleChildRemove(index)}
            operators={operators}
            selector={childSelector(input)}
            onSelectorChange={(name) => handleChildSelectorChange(index, name)}
            getItems={getItems}
            propsChecklist={propsChecklist}
            ignoreBlank={ignoreBlank}
            readOnly={readOnly}
            required={isNot}
          />
        </React.Fragment>
      ))}
    </Box>
  );
});

CombinatorOption.displayName = 'CombinatorOption';
