import type React from 'react';
import { memo, forwardRef, useCallback, useRef } from 'react';

import { MenuItem, MenuList } from '@mui/material';

import { type ICondition } from '@sheetxl/sdk';

import { KeyCodes, DynamicIcon, useTranslator, useLanguage } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, type ExhibitPopupPanelProps, type ExhibitPopupIconButtonProps
} from '@sheetxl/utils-mui';

import { buildOperatorMenuItems, SxMenuItem } from './ConditionUtils';

export interface OperatorSelectPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, "renderPopupPanel" | "onChange"> {
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

  propsPanel?: Partial<React.HTMLAttributes<HTMLElement>>;

  darkMode?: boolean;

  /**
   * Ref to the underlying element
   */
  ref?: React.Ref<HTMLElement>;
}

export const OperatorSelectPopupButton = memo( forwardRef<HTMLElement, OperatorSelectPopupButtonProps>(
  (props: OperatorSelectPopupButtonProps, refForwarded) => {
  const {
    icon: propIcon,
    tooltip,
    label,
    darkMode,
    propsPanel,
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

  const icon = propIcon || <DynamicIcon iconKey="Add" />;

  // Keep a stable ref so renderPopupPanel (memoized on operators only) always calls
  // the latest onChange without needing it in the useCallback dep array.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps): React.ReactElement<any> => {
    const { closeFloatAll } = props;

    const menuElements = buildOperatorMenuItems(operators, (operator) => (
      <MenuItem
        sx={SxMenuItem}
        key={operator.getName()}
        value={operator.getName()}
        onClick={() => {
          closeFloatAll?.();
          onChangeRef.current(operator);
        }}
      >
        {operator.getTitle?.()}
      </MenuItem>
    ), t, language);

    return (
      <div
        style={{
          minWidth: 200,
          paddingTop: '8px',
          paddingBottom: '8px',
          ...propsPanel?.style
        }}
        {...propsPanel}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if ((e.which === KeyCodes.Enter)) {
            closeFloatAll?.();
          }
        }}
      >
        <MenuList disablePadding>
          {menuElements}
        </MenuList>
      </div>
    )
    // `t`/`language` — the panel bakes the section headers and their collation order.
  }, [operators, t, language]);

  const propsButton = {
    // ref: refForwarded,
    renderPopupPanel: renderPopupPanel,
    // propsPopup: {
    //   propsPopper: {
    //   },
    // },
    tooltip: tooltip || label || "When",
    label,
    disabled: readOnly,
    icon,
    ...rest
  }
  return <ExhibitPopupIconButton ref={refForwarded} {...propsButton}/>
}));
