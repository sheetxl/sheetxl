import { ICondition, type IDataValidation } from '@sheetxl/sdk';

/** How many items of a list the title names before it counts the rest. */
const LIST_ITEMS_SHOWN = 3;

/**
 * What a validation checks, in one line: "Whole Number: Between 1 and 10", "List: Yes, No, Maybe
 * +2", "List from $A$1:$A$5", "Custom: =ISNUMBER(A1)", or "Any value" for a prompt-only rule.
 *
 * @remarks
 * Shared so the card's title and the editor's header say the same thing about the same rule. Every
 * comparison is the condition's own description, as a conditional format's title is; only the
 * shapes a condition cannot describe well (a list source, a custom formula, no condition) are
 * spelled here.
 */
export const dataValidationTitle = (
  item: IDataValidation,
  t: (key: string, options?: any) => string
): string => {
  const condition = item.getCondition();
  if (!condition) return t('dataValidation.anyValue');
  const json: ICondition.JSON = condition.toJSON();

  if (json.operator === ICondition.BuiltInOperatorNames.Expression && typeof json.param === 'string') {
    return t('dataValidation.titleCustom', { formula: json.param });
  }

  // A list as Excel means one: membership under no selector. Under a selector the condition
  // describes itself ("Whole Number: List 1, 2, 3").
  if (!json.selector && json.operator === ICondition.BuiltInOperatorNames.InSet) {
    const param = json.param as ICondition.InSetOption | null;
    const source: unknown = param?.source;
    if (typeof source === 'string' && source.length > 0) {
      return t('dataValidation.titleListFrom', { source });
    }
    // Typed values lose their leading spaces, as the check drops them.
    const items: string[] = (param?.items ?? []).map((value: unknown) => String(value ?? ''))
      .concat((param?.additions ?? []).map((item: string) => item.trimStart()));
    return t('dataValidation.titleList', {
      items: items.slice(0, LIST_ITEMS_SHOWN).join(', '),
      more: Math.max(0, items.length - LIST_ITEMS_SHOWN)
    });
  }

  return condition.toString();
};
