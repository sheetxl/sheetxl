import { memo } from 'react';

import {
  FormControl, Select, MenuItem, InputLabel, type FormControlProps
} from '@mui/material';

import { type ICondition } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator, useLanguage } from '@sheetxl/utils-react';

import { buildOperatorMenuItems, SxMenuItem } from './ConditionUtils';

// TODO - accept a list of Rules
export interface OperatorSelectProps extends Omit<FormControlProps, 'onChange' | 'children'> {
  /**
   * Current selected rule. Null represents "Any".
   */
  value: ICondition.IOperator | null;
  /**
   * The list of operators to choose from.
   */
  operators: ICondition.IOperator[];
  /**
   * Callback fired when the operator changes.
   */
  onChange: (operator: ICondition.IOperator | null) => void;
  /**
   * Optional title for the select input. If not provided.
   *
   * @default 'Operator'.
   */
  title?: string;
  /**
   * If true, the select is readonly (not editable, but not visually disabled).
   *
   * @remarks
   * Uses `readOnly` on the Select to prevent opening the dropdown while
   * maintaining consistent sizing and non-disabled appearance.
   */
  readOnly?: boolean;
}

/**
 * Select component for choosing an operator.
 */
export const OperatorSelect = memo<OperatorSelectProps>((props) => {
  const {
    value,
    operators,
    onChange,
    title: propTitle,
    readOnly = false,
    ...rest
  } = props;

  const t = useTranslator();
  const language = useLanguage();
  const title = propTitle ?? t('condition.operatorTitle');

  // Create a map from operator name to operator object for lookup
  const operatorMap = new Map<string, ICondition.IOperator>();
  operators.forEach((operator) => {
    operatorMap.set(operator.getName(), operator);
  });

  const menuItems = buildOperatorMenuItems(operators, (op) => (
    <MenuItem
      key={op.getName()}
      value={op.getName()}
      sx={SxMenuItem}
    >
      {op.getTitle?.()}
    </MenuItem>
  ), t, language);

  return (
    <FormControl size="small" {...rest}>
      <InputLabel>{title}</InputLabel>
      <Select
        value={value?.getName() ?? 'null'}
        label={title}
        readOnly={readOnly}
        IconComponent={(props) => <DynamicIcon iconKey="ExpandMore" {...props} />}
        onChange={(e) => {
          const selectedName = e.target.value as string;
          const selectedOperator = selectedName === 'null' ? null : operatorMap.get(selectedName) ?? null;
          onChange(selectedOperator);
        }}
        sx={readOnly ? {
          '& .MuiSelect-icon': {
            display: 'none' // Hide dropdown arrow when readonly
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'action.disabled' // Subtle visual cue
          }
        } : undefined}
      >
        {menuItems}
      </Select>
    </FormControl>
  );
});

OperatorSelect.displayName = 'OperatorSelect';
