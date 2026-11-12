import { memo } from 'react';

import {
  Box, type BoxProps
} from '@mui/material';

import { ICondition, type ICalculation } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { ScalarOption, type ScalarOptionLiteral } from './ScalarOption';

export interface BetweenProps extends BoxProps {
  /**
   * The between option to edit.
   */
  option: ICondition.BetweenOption;

  /**
   * The callback function to handle changes in the between option.
   */
  onOptionChange: (option: ICondition.BetweenOption) => void;
  /**
   * The selector the bounds are compared under. A date or time selector has its bounds typed and
   * shown as dates or times.
   */
  selector?: ICondition.ISelector | null;
  /**
   * If true, makes the editor read-only.
   */
  readOnly?: boolean;
}

/** How a bound's literal is read under `selector`. */
const literalOf = (selector: ICondition.ISelector | null | undefined): ScalarOptionLiteral | undefined => {
  switch (selector?.getName()) {
    case ICondition.BuiltInSelectorNames.Date: return 'date';
    case ICondition.BuiltInSelectorNames.Time: return 'time';
    case ICondition.BuiltInSelectorNames.DateTime: return 'dateTime';
    default: return undefined;
  }
};

/**
 * Component for editing between option (between two values).
 *
 * @remarks
 * Each bound is a literal or a formula, independently — Excel's own between boxes —
 * so both sides take the literal-or-formula field ({@link ScalarOption}).
 */
export const BetweenOption = memo<BetweenProps>((props) => {
  const { option, onOptionChange, selector, readOnly, ...rest } = props;

  const t = useTranslator();
  const literal = literalOf(selector);

  return (
    <Box
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 0.25,
        ...rest?.sx
      }}
    >
      {/* A bound starts empty and a cleared one stays empty (a null param), never a 0 the user did
          not type; the comparison is inert until both are given (BetweenOperator). */}
      <ScalarOption
        option={option?.from ?? null}
        literal={literal}
        placeholder={t('condition.from')}
        onOptionChange={(value) => {
          onOptionChange({ ...option, from: value as number | string | ICalculation.IFormula | null });
        }}
        readOnly={readOnly}
        sx={{ flex: 0.6, minWidth: 0 }}
      />
      <ScalarOption
        option={option?.to ?? null}
        literal={literal}
        placeholder={t('condition.to')}
        onOptionChange={(value) => {
          onOptionChange({ ...option, to: value as number | string | ICalculation.IFormula | null });
        }}
        readOnly={readOnly}
        sx={{ flex: 0.6, minWidth: 0 }}
      />
    </Box>
  );
});

BetweenOption.displayName = 'BetweenOption';
