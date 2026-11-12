import { CommonUtils, type IConditionalFormat } from '@sheetxl/sdk';

/**
 * What a rule is, in one line — the condition it tests, or the kind of scale it paints.
 *
 * @remarks
 * Shared so the card's title and the editor's header say the SAME thing about the same rule:
 * moving from the list into the editor should not restate a rule differently.
 */
export const conditionalFormatTitle = (
  item: IConditionalFormat,
  t: (key: string, options?: any) => string
): string => {
  const condition = item.getCondition()?.toString();
  if (condition) return condition;
  const scale = item.getScale();
  if (scale) return CommonUtils.camelToPrettyCase(scale.type);
  return t('conditionalFormat.noCondition');
};
