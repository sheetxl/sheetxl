import { describe, it, expect, beforeAll } from 'vitest';

import { DefaultLanguagePackService, t } from '@sheetxl/utils';

import { Workbook, type IWorkbook, type IDataValidation } from '@sheetxl/sdk';

import enMessages from '../../resources/locales/en/ui.msg.json';

import { dataValidationTitle } from '../dataValidation/DataValidationTitle';

/**
 * The card title and the editor header for each kind of validation.
 */
describe('dataValidationTitle', () => {

  let workbook: IWorkbook;
  beforeAll(async () => {
    DefaultLanguagePackService.registerDefaultMessages('@sheetxl/studio-mui', 'en', enMessages as any);
    workbook = new Workbook();
    await workbook.getCalculation().ready();
  });

  const titleOf = (properties: Partial<IDataValidation.Properties>): string => {
    const validation = workbook.getSelectedWorksheet().getDataValidations().add('A1', properties as any);
    try {
      return dataValidationTitle(validation, t);
    } finally {
      validation.delete();
    }
  };

  it('names a prompt-only rule "Any value"', () => {
    expect(titleOf({ prompt: 'Enter a code', showPromptMessage: true })).toBe('Any value');
  });

  it('names a literal list by its first three items and counts the rest', () => {
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: '"Yes,No"' } } }))
      .toBe('List: Yes, No');
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: '"a, b,c,d,e"' } } }))
      .toBe('List: a, b, c +2');
  });

  it('keeps a quote inside a literal as an ordinary character', () => {
    // The file's `"""q,r"",s"`: three items, `"q`, `r"`, `s`.
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: '"""q,r"",s"' } } }))
      .toBe('List: "q, r", s');
  });

  it('names a reference or formula source as written', () => {
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: '$A$1:$A$5' } } }))
      .toBe('List from $A$1:$A$5');
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: 'INDIRECT($E1)' } } }))
      .toBe('List from INDIRECT($E1)');
  });

  it('names an items array as a literal list', () => {
    expect(titleOf({ condition: { selector: 'list', operator: 'inSet', param: { items: [1, 2] } } }))
      .toBe('List: 1, 2');
  });

  it('names a custom formula with its marker', () => {
    expect(titleOf({ condition: { operator: 'expression', param: 'ISNUMBER(A1)' } }))
      .toBe('Custom: =ISNUMBER(A1)');
  });

  it('leaves a comparison, negated or not, to the condition', () => {
    const between = { selector: 'wholeNumber', operator: 'between', param: { from: 1, to: 10 } };
    const notBetween = { selector: 'wholeNumber', operator: 'not', param: { operator: 'between', param: { from: 1, to: 10 } } };
    for (const condition of [between, notBetween]) {
      const validation = workbook.getSelectedWorksheet().getDataValidations().add('A1', { condition } as any);
      try {
        expect(dataValidationTitle(validation, t)).toBe(validation.getCondition()!.toString());
      } finally {
        validation.delete();
      }
    }
    expect(titleOf({ condition: notBetween } as any)).not.toBe(titleOf({ condition: between } as any));
  });

});
