import type React from 'react';
import { useState, useMemo, memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type ICalculation, type ICellRanges } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext, useReferenceMode, useWorkbook } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { FormulaField, InputField } from '../form';
import { pivotSourceOf } from '../pivot/_pivotSource';

export interface PivotTableNewDialogProps extends InputDialogProps<CommandContext.NewPivotTable, CommandContext.PivotTableTarget> {};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * Used when creating a new pivot table within the workbook.
 */
export const PivotTableNewDialog = memo<PivotTableNewDialogProps>((props: PivotTableNewDialogProps) => {
  const {
    onInput,
    onOption,
    onValidateOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    initialValue,
    context,
    ...rest
  } = props;

  const t = useTranslator();
  const [firstFocus, setFirstFocus] = useState<boolean>(false);
  const [name, setName] = useState<string>(() => initialValue?.name ?? '');
  const [source, setSource] = useState<ICellRanges | string | null>(() => initialValue?.source ?? null);
  const [location, setLocation] = useState<ICellRanges | null>(() => initialValue?.location ?? null);

  const target = context?.();

  // Each field's anchor, for bare text: the source's sheet for the source, and the sheet the dialog
  // opened on for the location, however the tabs change while picking.
  const sourceHome = useMemo(() => {
    const seed = initialValue?.source;
    const sheetName = seed && typeof seed !== 'string' ? seed.getWorksheet?.()?.getName() : undefined;
    return sheetName ? { scope: sheetName } : undefined;
  }, [initialValue]);
  const workbook = useWorkbook();
  const [locationHome] = useState(() => {
    const sheetName = workbook?.getSelectedWorksheet()?.getName();
    return sheetName ? { scope: sheetName } : undefined;
  });

  // While a field is picking on the sheet the dialog suspends its modality (the Excel RefEdit behavior).
  const referenceMode = useReferenceMode();
  const picking = referenceMode.getMode()?.mode === 'point';

  // A blank location is not yet a place to go; a location in use is refused, as Excel's UI refuses it.
  const locationError = useMemo((): string | null => location ? target?.checkLocation(location) ?? null : null, [location, target]);

  const validateName = useCallbackRef((text: string): void => {
    target?.validateName(text, location);
  }, [target, location]);

  const handleDone = useCallbackRef((option?: OptionInput) => {
    const value: CommandContext.NewPivotTable | null = source && location ? {
      ...initialValue,
      name,
      source,
      location
    } : null;

    const isCancel = option === cancelOption || !option;
    onInput?.(!isCancel && value ? value : undefined);
    onOption?.(option ?? cancelOption, isCancel, option === defaultOption);
    onDone?.({
      option,
      value
    });
  }, [onDone, onOption, defaultOption, cancelOption, name, source, location, initialValue]);

  const handleValidation = useCallback(async (_input?: OptionInput, _option?: OptionInput): Promise<boolean> => {
    if (!source || !location || locationError) return false;
    try {
      validateName(name);
    } catch {
      return false;
    }
    return true;
  }, [validateName, name, source, location, locationError]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!firstFocus) {
      e.target?.select();
    }
    setFirstFocus(true);
  };

  return (
    <OptionsDialog
      title={t('pivotTableNew.title')}
      options={options}
      onDone={handleDone}
      onValidateOption={handleValidation}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      suspendModal={picking}
      sx={{
        width: '360px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0), // helper text spacing is already applied
          rowGap: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <InputField
          formName={'name'}
          value={name}
          onChangeInput={setName}
          onValidate={validateName}
          onFocus={handleFocus}
        />
        <FormulaField
          grammar="reference"
          classNameInput={'autoFocus'}
          formName={'source'}
          label={t('pivotTableNew.source')}
          value={source}
          allowMulti={false}
          home={sourceHome}
          pickAs={'absolute'}
          onChangeInput={(value: ICalculation.IFormula | null) => setSource(pivotSourceOf(value))}
          onFocus={handleFocus}
        />
        <FormulaField
          grammar="reference"
          formName={'location'}
          label={t('pivotTableNew.location')}
          value={location}
          allowMulti={false}
          home={locationHome}
          validationError={locationError}
          onChangeInput={(value: ICalculation.IFormula | null) => setLocation(value?.getReferences() ?? null)}
          onFocus={handleFocus}
        />
      </Box>
    </OptionsDialog>
  );
});

export default PivotTableNewDialog;
