import { useState, useMemo, memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type ICalculation, type ICellRanges } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext, useReferenceMode } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { FormulaField } from '../form';

export interface SparklineNewDialogProps extends InputDialogProps<CommandContext.NewSparklines> {};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/** The Create and Edit Sparklines dialogs: the same two fields. */
export interface SparklineRangesDialogProps extends InputDialogProps<CommandContext.NewSparklines | CommandContext.EditSparklines> {
  /**
   * `'edit'` is Excel's Edit Sparklines, for a group's cells and data: each field takes several
   * areas, and there is no type.
   */
  variant: 'new' | 'edit';
}

/**
 * Excel's Create Sparklines: the cells to draw and the cells to draw them in.
 *
 * @remarks
 * The location comes proposed (the column beside the data, or the cell below one column of it),
 * where Excel leaves it blank. The type is the one chosen from the Insert menu.
 */
export const SparklineNewDialog = memo<SparklineNewDialogProps>((props: SparklineNewDialogProps) => {
  return <SparklineRangesDialog {...props as SparklineRangesDialogProps} variant="new" />;
});

export const SparklineRangesDialog = memo<SparklineRangesDialogProps>((props: SparklineRangesDialogProps) => {
  const {
    variant,
    onInput,
    onOption,
    onValidateOption: _onValidateOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    initialValue,
    context: _context,
    ...rest
  } = props;

  const t = useTranslator();
  const edit = variant === 'edit';
  const [data, setData] = useState<ICellRanges | string | null>(() => initialValue?.data ?? null);
  const [location, setLocation] = useState<ICellRanges | null>(() => initialValue?.location ?? null);

  // Each field's anchor for bare text: the sheet the dialog opened on, however the tabs change
  // while picking. The data may be on another sheet; the location is on this one.
  const home = useMemo(() => {
    const anchor = initialValue?.location ?? (typeof initialValue?.data === 'string' ? null : initialValue?.data);
    const sheetName = anchor?.getWorksheet?.()?.getName();
    return sheetName ? { scope: sheetName } : undefined;
  }, [initialValue]);

  // While a field is picking on the sheet the dialog suspends its modality (Excel's RefEdit).
  const referenceMode = useReferenceMode();
  const picking = referenceMode.getMode()?.mode === 'point';

  const handleDone = useCallbackRef((option?: OptionInput) => {
    let value: CommandContext.NewSparklines | CommandContext.EditSparklines | null = null;
    if (data && location) {
      value = edit
        ? { data, location }
        : { type: (initialValue as CommandContext.NewSparklines)?.type ?? 'line', data: data as ICellRanges, location };
    }
    const isCancel = option === cancelOption || !option;
    onInput?.(!isCancel && value ? value : undefined);
    onOption?.(option ?? cancelOption, isCancel, option === defaultOption);
    onDone?.({ option, value });
  }, [onDone, onOption, onInput, defaultOption, cancelOption, data, location, initialValue, edit]);

  const handleValidation = useCallback(async (_input?: OptionInput, _option?: OptionInput): Promise<boolean> => {
    return !!data && !!location;
  }, [data, location]);

  return (
    <OptionsDialog
      title={edit ? t('sparklineEdit.title') : t('sparklineNew.title')}
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
        <FormulaField
          grammar="reference"
          classNameInput={edit ? 'autoFocus' : undefined}
          formName={'data'}
          label={t('sparklineNew.data')}
          value={data}
          allowMulti={edit}
          home={home}
          pickAs={'absolute'}
          onChangeInput={(value: ICalculation.IFormula | null) => setData(value?.getReferences() ?? null)}
        />
        <FormulaField
          grammar="reference"
          classNameInput={edit ? undefined : 'autoFocus'}
          formName={'location'}
          label={t('sparklineNew.location')}
          value={location}
          allowMulti={edit}
          allowCrossSheet={false}
          home={home}
          pickAs={'absolute'}
          onChangeInput={(value: ICalculation.IFormula | null) => setLocation(value?.getReferences() ?? null)}
        />
      </Box>
    </OptionsDialog>
  );
});

export default SparklineNewDialog;
