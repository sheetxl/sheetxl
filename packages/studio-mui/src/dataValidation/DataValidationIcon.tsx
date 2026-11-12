import { memo } from 'react';

import { ICondition, type IDataValidation } from '@sheetxl/sdk';

import { DynamicIcon } from '@sheetxl/utils-react';
import { useModelSync } from '@sheetxl/react';

import { PresetChip } from '../conditionalFormat/PresetChip';

const Selectors = ICondition.BuiltInSelectorNames;

/*
 * One glyph per Allow type. These borrow existing glyphs until dedicated ones are drawn; the
 * mapping is the one place that changes when they are.
 */
const ICON_BY_SELECTOR: Record<string, string> = {
  [Selectors.Whole]: 'FormulaMathTrig',
  [Selectors.Number]: 'IncreaseDecimal',
  [Selectors.Date]: 'FormulaDateTime',
  [Selectors.DateTime]: 'FormulaDateTime',
  [Selectors.Time]: 'FormulaDateTime',
  [Selectors.TextLength]: 'FormulaText'
};

/**
 * The glyph a validation's Allow type is shown with: "Any value", each selector, "List" or "Custom".
 */
export const dataValidationIconKey = (item: IDataValidation): string => {
  const condition = item.getCondition();
  if (!condition) return 'DataValidation';
  const json: ICondition.JSON = condition.toJSON();
  if (json.operator === ICondition.BuiltInOperatorNames.Expression) return 'FormulaCustom';
  // A list: membership under no selector.
  if (!json.selector && json.operator === ICondition.BuiltInOperatorNames.InSet) return 'Menu';
  return (typeof json.selector === 'string' && ICON_BY_SELECTOR[json.selector]) || 'DataValidation';
};

export interface DataValidationIconProps {
  dataValidation: IDataValidation;
  /**
   * Chip height in px, as `RulePreview`'s.
   * @defaultValue 28
   */
  size?: number;
}

/**
 * The leading glyph of a validation's card and editor header.
 *
 * @remarks
 * Drawn in the same chip, at the same footprint, as a conditional format's `RulePreview`, so the
 * two panes' cards and headers line up. A glyph is chrome, not a cell, so the chip is not `sheet`.
 */
export const DataValidationIcon = memo<DataValidationIconProps>(({ dataValidation, size = 28 }) => {
  useModelSync<IDataValidation.IListeners>(dataValidation, 'onAnyChange');
  return (
    <PresetChip
      className="sxl-dv-icon"
      sx={{ width: 'auto', minWidth: `${size * 1.7}px`, height: `${size}px` }}
    >
      <DynamicIcon iconKey={dataValidationIconKey(dataValidation)} size={Math.round(size * 0.6)} ariaHidden />
    </PresetChip>
  );
});

DataValidationIcon.displayName = 'DataValidationIcon';
