import React, { useState, useMemo, memo, useCallback } from 'react';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';

import { INamed, ICellRanges } from '@sheetxl/sdk';

import { useCallbackRef } from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';

import { OptionsDialog, OptionsDialogProps } from '@sheetxl/utils-mui';

import { RangeInput, NamedInput } from '../components/form';


export interface NamedReferenceDialogProps extends OptionsDialogProps {
  value?: INamed;

  onUpdate?: (named: INamed, isNew: boolean) => void;

  context: CommandContext.NamedReference;
};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * An editor for create or editing NamedReference.
 *
 * TODO -
 * If 'hasHeader' then use top.left as a template (look for a name that is not used)
 * Add scope dropdown that has 'Workbook' and a list of sheetNames.
 * Add comment editor ()
 */
export const NamedReferenceDialog: React.FC<NamedReferenceDialogProps> = memo((props) => {
  const {
    value = null,
    context,
    onOption,
    onValidateOption,
    onDone,
    onUpdate,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  // const [scope] = useState<string>("");

  const defaultName = useMemo(() => {
    return context?.getNames().findValidName('Range1');
  }, []);

  const isNew = useMemo(() => {
    if (!value) return true;
  }, []);

  const [name, setName] = useState({
    displayText: value?.getName() ?? defaultName,
    errorText: null
  });

  const [ranges, setRanges] = useState({
    displayValue: value?.getRanges() ?? context?.selection() ?? null,
    errorText: null
  });

  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const onValidateInputOption = useCallback(async (_option?: string): Promise<boolean> => {
    if (name.errorText) return false;
    if (ranges.errorText) return false;
    return true;
  }, [context]);

  const handleOnOption = useCallbackRef((option: string, isCancel: boolean, isDefault: boolean) => {
    if (!isCancel) {
      let rangeUpsert = null
      if (isNew) {
        rangeUpsert = context?.getNames().addReference(name?.displayText, ranges?.displayValue, false);
      } else {
        if (value.getType() === 'reference') {
          value.doBatch(() => {
            value.setName(name?.displayText);
            (value as INamed.IReference).setReference(ranges?.displayValue);
          }, `Edit Named '${name?.displayText}'`);
        }
        rangeUpsert = value;
      }
      if (rangeUpsert) {
        rangeUpsert.select(); // should the dialog do this or the controller?
        onUpdate(rangeUpsert, isNew);
      }
    }

    onOption?.(option, isCancel, isDefault);
    onDone?.();
  }, [context, name, ranges, onDone, onOption, defaultOption, cancelOption, onUpdate]);

  const handleOnNameChange = useCallbackRef((displayText: string) => {
    let errorText = null;
    try {
      context?.getNames().validateName(displayText);
    } catch (e) {
      errorText = e.message;
    }
    setName({
      displayText,
      errorText
    });
  }, []);

  const handleOnNameValidate = useCallbackRef((name: string) => {
    if (value && value.getName().toLowerCase() === name.toLowerCase()) return;
    context?.getNames().validateName(name);
  }, [context, value]);


  const handleOnRangeChange = useCallback((ranges: ICellRanges) => {
    let errorText = null;
    try {
      // context?.getNames().validateNamedItem({
      //   ref: range
      // });
    } catch (e) {
      errorText = e.message;
    }
    setRanges({
      displayValue: ranges ?? null,
      errorText
    });
  }, []);

  return (
    <OptionsDialog
      title={`${isNew ? 'Define' : 'Edit'} Range`}
      options={options}
      onOption={handleOnOption}
      onValidateOption={onValidateInputOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
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
        <NamedInput
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
        <RangeInput
          formName={'range'}
          value={ranges.displayValue}
          onChangeInput={handleOnRangeChange}
          resolvedAddress={context.getNames().getRanges.bind(context.getNames())}
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
