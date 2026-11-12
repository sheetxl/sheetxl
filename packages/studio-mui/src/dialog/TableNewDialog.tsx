import type React from 'react';
import { useState, useMemo, memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { type ICalculation, type ICellRanges } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext, useReferenceMode } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { FormulaField, InputField } from '../form';

export interface TableNewDialogProps extends InputDialogProps<CommandContext.NewTable, CommandContext.Table> {};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

const DEFAULT_NAME_KEY = 'table.defaultName';

/**
 * Used when creating a new table within the workbook.
 */
export const TableNewDialog = memo<TableNewDialogProps>((props: TableNewDialogProps) => {
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


  // const context = initialTableOptions?.context;

  const t = useTranslator();
  const [firstFocus, setFirstFocus] = useState<boolean>(false);
  const [hasHeader, setHasHeader] = useState<boolean>(() => initialValue?.hasHeader ?? false);
  const [ranges, setRanges] = useState<ICellRanges | null>(() => initialValue?.ranges ?? null);

  const getNames = context?.()?.getNames;
  // Excel proposes the next free default (`Table2` when `Table1` is taken). The template is the SDK's
  // localized default; `t` hands back the key when no pack carries it.
  const [name, setName] = useState<string>(() => {
    if (initialValue?.name) return initialValue.name;
    const localized = t(DEFAULT_NAME_KEY, { n: 1 });
    const template = localized === DEFAULT_NAME_KEY ? 'Table1' : localized;
    try {
      return getNames?.().findValidName(template) ?? template;
    } catch {
      return template;
    }
  });

  // The field's anchor: the sheet the table is being created on — the initial ranges' sheet (they are
  // the sheet selection, so they always have one). Bare text resolves there rather than against
  // whichever tab is selected when the user tabs away mid-pick.
  const home = useMemo(() => {
    const sheetName = initialValue?.ranges?.getWorksheet?.()?.getName();
    return sheetName ? { scope: sheetName } : undefined;
  }, [initialValue]);

  // The Excel "RefEdit" behavior: while the field is PICKING (reference point mode on the bus), the
  // dialog suspends its modality so grid/header clicks reach the sheet; done (Enter/Escape/toggle)
  // restores it. (The field's workbook comes from `WorkbookProvider`, which wraps the modal host.)
  const referenceMode = useReferenceMode();
  const picking = referenceMode.getMode()?.mode === 'point';

  const handleDone = useCallbackRef((option?: OptionInput) => {
    // `ranges` can be null (nothing picked); `NewTable.ranges` is required, so only build a payload
    // when a range exists. A null payload is treated as "no table" (the command no-ops on falsy).
    const tableOptions:CommandContext.NewTable | null = ranges ? {
      ...initialValue,
      name,
      hasHeader,
      ranges
    } : null;

    const isCancel = option === cancelOption || !option;
    // if (!isCancel) {
    onInput?.(!isCancel && tableOptions ? tableOptions : undefined);
    // }
    onOption?.(option ?? cancelOption, isCancel, option === defaultOption);
    onDone?.({
      option,
      tableOptions
    });
  }, [onDone, onOption, defaultOption, cancelOption, name, hasHeader, ranges, initialValue]);

  // Tables are workbook-scoped names, so the check is against the global scope.
  const validateName = useCallbackRef((text: string): void => {
    getNames?.().validateName(text);
  }, [getNames]);

  const handleValidation = useCallback(async (_input?: OptionInput, _option?: OptionInput): Promise<boolean> => {
    try {
      validateName(name);
    } catch {
      return false;
    }
    return true;
  }, [validateName, name]);

  // const handleKeyDown = useCallbackRef(async (e: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (e.keyCode === KeyCodes.Enter) {
  //       // let valid = await handleValidation(input, null);
  //       // if (valid !== false)
  //     // handleDone(defaultOption);
  //   }
  // }, []);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!firstFocus) {
      e.target?.select();
    }
    setFirstFocus(true);
  };

  return (
    <OptionsDialog
      title={t('tableNew.title')}
      options={options}
      onDone={handleDone}
      // onOption={(option: string) => handleDone(option) }
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
        {/* Name before range, the order the named-reference dialog uses. */}
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
          formName={'range'}
          // The command payload (`NewTable.ranges`) wants ranges, so the state stays `ICellRanges` —
          // and the field takes them as-is, addressing them through the SDK. The emitted formula's
          // references convert back.
          value={ranges}
          // A table is ONE block on ONE sheet — same contract as `TableDetailsPanel`.
          allowMulti={false}
          allowCrossSheet={false}
          home={home}
          onChangeInput={(value: ICalculation.IFormula | null) => setRanges(value?.getReferences() ?? null)}
          // TODO - valid resize
          // onKeyDown={handleKeyDown}
          // disabled={table?.isProtected() ?? true}
          onFocus={handleFocus}
        />
        <FormControlLabel
          // The range field's reserved helper line already spaces this row; the column's row gap and
          // the checkbox's default padding would double it.
          sx={{ marginTop: (theme: Theme) => theme.spacing(-1) }}
          control={
            <Checkbox
              checked={hasHeader}
              onChange={() => setHasHeader(!hasHeader)}
              sx={{ paddingTop: 0.5, paddingBottom: 0.5 }}
            />
          }
          label={t('tableNew.hasHeaders')}
          labelPlacement="end"
        />
      </Box>
    </OptionsDialog>
  );
});

export default TableNewDialog;
