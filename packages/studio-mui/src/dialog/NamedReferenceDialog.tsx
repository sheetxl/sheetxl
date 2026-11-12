import type React from 'react';
import { useState, useMemo, memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type INamed, type ICellRanges, type ICalculation } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext, useReferenceMode } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { FormulaField, InputField } from '../form';


export interface NamedReferenceDialogProps extends InputDialogProps<INamed, CommandContext.NamedReference> {};


const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * Any of the field's value shapes → the "refers to" expression text. Ranges contribute their SDK
 * address (a reference expression, sheet-qualified because a name's refers-to is workbook-scoped).
 */
const expressionOf = (
  value: ICalculation.IFormula | ICellRanges | string | null
): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if ((value as ICellRanges).isICellRanges) return (value as ICellRanges).toString();
  return (value as ICalculation.IFormula).getExpression();
};

/**
 * An editor for create or editing NamedReference.
 *
 * TODO -
 * If 'hasHeader' then use top.left as a template (look for a name that is not used)
 * Add scope dropdown that has 'Workbook' and a list of sheetNames.
 * Add comment editor ()
 */
export const NamedReferenceDialog = memo<NamedReferenceDialogProps>((props: NamedReferenceDialogProps) => {
  const {
    initialValue = null,
    context,
    onOption,
    onValidateOption,
    onDone,
    onInput,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  // const [scope] = useState<string>("");

  const t = useTranslator();

  const defaultName = useMemo(() => {
    return context?.().getNames().findValidName('Range1');
  }, []);

  const isNew = useMemo(() => {
    if (!initialValue) return true;
  }, []);

  const [name, setName] = useState<{ displayText: string | undefined; errorText: string | null }>({
    displayText: initialValue?.getName() ?? defaultName,
    errorText: null
  });

  const [ranges, setRanges] = useState<{ displayValue: ICalculation.IFormula | ICellRanges | string | null; errorText: string | null }>(() => {
    // Taken as-is: a name's refers-to is workbook-scoped, so the SDK addresses these sheet-qualified.
    const initial: ICellRanges | null = initialValue?.getRanges?.() ?? context?.()?.selection() ?? null;
    return {
      displayValue: initial,
      errorText: null
    };
  });

  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  // The Excel "RefEdit" behavior: while the field is PICKING (reference point mode on the bus), the
  // dialog suspends its modality so grid/header clicks reach the sheet; done restores it. (The
  // field's workbook comes from `WorkbookProvider`, which wraps the modal host.)
  const referenceMode = useReferenceMode();
  const picking = referenceMode.getMode()?.mode === 'point';

  const onValidateInputOption = useCallback(async (_option?: OptionInput): Promise<boolean> => {
    if (name.errorText) return false;
    if (ranges.errorText) return false;
    return true;
  }, []);

  const handleOnOption = useCallbackRef((option: OptionInput, isCancel: boolean, isDefault: boolean) => {
    if (!isCancel) {
      const displayText = name?.displayText ?? '';
      // The name's "refers to" EXPRESSION, from whichever value shape the field is holding: the
      // initial ranges (never edited), the parsed formula (edited), or authored text. A range address
      // is just a reference expression, so ranges contribute their SDK address unchanged.
      const displayValue = expressionOf(ranges?.displayValue ?? null);
      let rangeUpsert: INamed | null = null;
      if (isNew || !initialValue) {
        if (displayValue) {
          rangeUpsert = context?.()?.getNames().addFormula(displayText, displayValue, false) ?? null;
        }
      } else {
        // Every defined name is owned by the calculation engine, so "Refers to" is a redefinition
        // of the expression. A range name is simply one whose expression is a reference.
        const asFormula = initialValue as Partial<ICalculation.INamedFormula>;
        if (asFormula.setExpression) {
          initialValue.doBatch(() => {
            initialValue.setName(displayText);
            if (displayValue)
              asFormula.setExpression!(displayValue);
          }, t('op.editNamedItem', { name: displayText }));
        }
        rangeUpsert = initialValue;
      }
      if (rangeUpsert) {
        rangeUpsert.select(); // should the dialog do this or the controller?
        onInput?.(rangeUpsert);
      }
    }

    onOption?.(option, isCancel, isDefault);
    onDone?.();
  }, [context, name, ranges, onDone, onOption, defaultOption, cancelOption, onInput]);

  const handleOnNameChange = useCallbackRef((displayText: string) => {
    let errorText = null;
    try {
      context?.().getNames().validateName(displayText);
    } catch (e) {
      const message = (e as Error)?.message;
      errorText = message ? t(message) : message;
    }
    setName({
      displayText,
      errorText
    });
  }, []);

  const handleOnNameValidate = useCallbackRef((name: string) => {
    if (initialValue && initialValue.getName().toLowerCase() === name.toLowerCase()) return;
    context?.().getNames().validateName(name);
  }, [context, initialValue]);


  const handleOnRangeChange = useCallback((ranges: ICalculation.IFormula | null) => {
    let errorText = null;
    try {
      // context?.getNames().validateNamedItem({
      //   ref: range
      // });
    } catch (e) {
      const message = (e as Error)?.message;
      errorText = message ? t(message) : message;
    }
    setRanges({
      displayValue: ranges ?? null,
      errorText
    });
  }, []);

  return (
    <OptionsDialog
      title={isNew ? t('namedRange.titleDefine') : t('namedRange.titleEdit')}
      options={options}
      onOption={handleOnOption}
      onValidateOption={onValidateInputOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      suspendModal={picking}
      sx={{
        width: '460px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0), // helper text spacing is already applied
          rowGap: (theme: Theme) => theme.spacing(1),
          range: 'flex',
          flexDirection: 'column'
        }}
      >
        <InputField
          // Neither field widget reserves room for its floating label; the first row is the one that
          // would clip against the dialog title, so it states its own clearance.
          sx={{ paddingTop: (theme: Theme) => theme.spacing(1.5) }}
          formName={'name'}
          defaultInput={defaultName}
          value={name.displayText}
          onChangeInput={handleOnNameChange}
          onValidate={handleOnNameValidate}
          //disabled={names.isProtected()}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            if (!firstFocus) {
              e.target?.select();
            }
            setFirstFocus(true);
          }}
          // onContextMenu={(e) => { e.stopPropagation(); }}
        />
        <FormulaField
          grammar="reference"
          formName={'range'}
          value={ranges.displayValue}
          onChangeInput={handleOnRangeChange}
          // A name denotes a FIXED region — a pick lands absolute (`$A$1:$B$2`), Excel's default for
          // a defined name. Typing and F4 still reach the relative form.
          pickAs="absolute"
          allowMulti
          // disabled={workbookStructure.isProtected()}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            if (!firstFocus) {
              e.target?.select();
            }
            setFirstFocus(true);
          }}
          // onContextMenu={(e) => { e.stopPropagation(); }}
        />
      </Box>
    </OptionsDialog>
  );
});

export default NamedReferenceDialog;
