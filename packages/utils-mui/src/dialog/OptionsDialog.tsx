import React, { useRef, useMemo, memo, forwardRef } from 'react';

import { primaryInput } from 'detect-it';
import { useForm, FormProvider, SubmitHandler, FieldValues } from 'react-hook-form';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box, Typography } from '@mui/material';
import { DialogContent } from '@mui/material';
import { DialogActions } from '@mui/material';

import { Button, type ButtonProps } from '@mui/material';
import { TouchRippleActions } from '@mui/material';

import { useCallbackRef, KeyCodes } from '@sheetxl/utils-react';

import InternalWindow from './InternalWindow';

import { type OptionsDialogProps } from './useOptionsDialog';

/**
 * Options DialogBox to give the user a choice of next actions.
 * There is special support for defaultOption and cancelOption. in that they response
 * to enter and esc keys respectively.
 */

// TODO - a button ripple on enter and esc
// TODO - make the cancel button slightly different? Icon? something else?
// TODO - finish icon support
const DEFAULT_OPTIONS = ['Ok', 'Cancel'];
const DEFAULT_RIPPLE_DURATION = 180;

export const OptionsDialog = memo(forwardRef<HTMLDivElement, OptionsDialogProps>((props, refForwarded) => {
  const {
    description,
    icon,
    onCancel,
    onOption,
    onDone,
    onValidateOption,
    createOptionsButton: propCreateOptionsButton,
    options = DEFAULT_OPTIONS,
    autoFocusSel = `.defaultOption`,
    defaultOption = options[0],
    cancelOption = 'Cancel',
    autoFocus: propAutoFocus,
    children,
    ...rest
  } = props;
  const formMethods = useForm<any>({
    shouldUseNativeValidation: false
  }); // TODO - make this a generic types
  const { handleSubmit, formState } = formMethods;

  const refRippleDefault = useRef<TouchRippleActions>(null);
  const refRippleCancel = useRef<TouchRippleActions>(null);

  const refForm = useRef<HTMLFormElement>(null);

  const handleOptionSelect = useCallbackRef(async (option: string) => {
    let result = undefined;
    try {
      result = await Promise.resolve(onValidateOption?.(option)) ?? true;
      if (result !== true)
        return;
      await Promise.resolve(onOption?.(option, option === cancelOption, option === defaultOption));
      onDone?.(option);
    } catch (e) {}
  }, [onOption, onDone, onValidateOption, cancelOption, defaultOption]);

  const doSubmit:SubmitHandler<any> = useCallbackRef((_data: FieldValues, _event?: React.BaseSyntheticEvent) => {
    // formEvent.preventDefault();
    setTimeout(() => {
      handleOptionSelect(defaultOption);
    }, DEFAULT_RIPPLE_DURATION);
  }, [handleOptionSelect]);

  const handleCancel = useCallbackRef(() => {
    onOption?.(cancelOption, true/*isCancel*/, false);
    onCancel?.();
    onDone?.(null);
  }, [onOption, cancelOption, onCancel, onDone]);
  const disabled = formState && (Object.keys(formState.errors).length > 0 || formState.disabled || formState.isSubmitted);

  const createOptionsButton = useCallbackRef((option: string, isDefaultOption: boolean) => {
    const isCancelButton = option === cancelOption;

    const propsButton: React.HTMLAttributes<HTMLButtonElement> & React.Attributes = {
      // key: `action:${option}`,
      className: isDefaultOption ? 'defaultOption' : 'action',
      // @ts-ignore
      type: isDefaultOption ? "submit" : "button",
      style: {
        minWidth: `75px`
      },
      onClick: () => {
        if (isCancelButton) {
          handleCancel()
        } else if (!isDefaultOption) { // default is handle on submit to be form compatible.
          handleOptionSelect(option);
        }
      }
    }
    if (propCreateOptionsButton)
      return (propCreateOptionsButton(option, propsButton, isDefaultOption));

    const propsMui: ButtonProps = {
      className: isDefaultOption ? 'defaultOption' : 'action',
      variant: isDefaultOption ? 'contained' : 'outlined',
      size: `small`,
      disabled: !isCancelButton && disabled,
      //@ts-ignore
      color: `primary`, // set differently for default action
      ...propsButton
    };
    if (isDefaultOption || isCancelButton) {
      const refRipple = isDefaultOption ? refRippleDefault : refRippleCancel;
      propsMui.touchRippleRef = refRipple;
      propsMui.onPointerDown = (e) => {
        refRipple.current?.start(e, {
          center: false
        });
        e.stopPropagation();
        e.preventDefault();
      }
    }
    return (
      <Button
        key={`action:${option}`}
        {...propsMui}
      >
        <div
          style={{
            paddingTop: '3px' // not sure why this is needed to make visually nice
          }}
        >
          {option}
      </div>
      </Button>
    )
  }, [options, defaultOption, cancelOption, propCreateOptionsButton, formState]);

  const optionActions = useMemo(() => {
    const retValue = [];
    for (let i=0; i<options.length; i++) {
      const option = options[i];
      const isDefaultOption = (defaultOption ? option === defaultOption : i === 0);
      retValue.push(createOptionsButton(option, isDefaultOption));
    }
    return retValue;
  }, [options, defaultOption, formState]);

  return (
    <InternalWindow
      onCancel={handleCancel}
      initialPosition={{ y: primaryInput === 'touch' ? '15' : '35' }} // to make room for virtual keyboard
      onDone={onDone}
      autoFocusSel={autoFocusSel}
      isModal={true}
      ref={refForwarded}
      // slotProps={{
      //   paper: {
      //     elevation: 3
      //   }
      // }}
      {...rest}
    >
      <FormProvider {...formMethods}>
      <form ref={refForm} onSubmit={handleSubmit(doSubmit)}>
      <DialogContent dividers
        onKeyDown={(e: React.KeyboardEvent<any>) => {
          if (e.isDefaultPrevented()) return;
          // needed because dialogs are not using command keys
          e.stopPropagation();

          let option = null;
          let refRipple = null;
          const isCancel = e.which === KeyCodes.Escape && cancelOption;
          if (isCancel) {
            option = cancelOption;
            refRipple = refRippleCancel;
          } else if (disabled) {
            return;
          } else if (e.which === KeyCodes.Enter) {
            option = defaultOption ?? options[0];
            refRipple = refRippleDefault;
          }
          if (option) {
            refRipple.current?.start(e, {
              center: false
            })
            setTimeout(() => {
              refRipple.current?.stop(e);
              if (isCancel) // we don't do this for submit
                handleOptionSelect(option);
            }, DEFAULT_RIPPLE_DURATION);
          }

          // e.preventDefault();
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            whiteSpace: 'pre-wrap',
            rowGap: (theme: Theme) => theme.spacing(icon || description ? 1.5 : 0)
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {icon}
            <Typography>
              {description}
            </Typography>
          </Box>
          {children}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(1),
          paddingLeft: (theme: Theme) => theme.spacing(1),
          paddingRight: (theme: Theme) => theme.spacing(1),
          backgroundColor: (theme: Theme) => {
            return alpha(theme.palette.action.hover, 0.03);
          },
        }}
      >
        {optionActions}
      </DialogActions>
      </form>
      </FormProvider>
    </InternalWindow>
  );
}));

export default OptionsDialog;
