import type React from 'react';
import { useRef, useMemo, useState, memo, forwardRef } from 'react';

import { primaryInput } from 'detect-it';
import { useForm, FormProvider, type SubmitHandler, type FieldValues } from 'react-hook-form';

import { alpha } from '@mui/system';
import { type Theme } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { DialogContent } from '@mui/material';
import { DialogActions } from '@mui/material';
import { Button, type ButtonProps } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { type TouchRippleActions } from '@mui/material';

import {
  RenderSlot, useCallbackRef, KeyCodes, useTranslator, DynamicIcon, NotifierType, type OptionInput, type IconGlyphKey
} from '@sheetxl/utils-react';

import InternalWindow from './InternalWindow';

import { type OptionsDialogProps } from './useOptionsDialog';

/**
 * Options DialogBox to give the user a choice of next actions.
 * There is special support for defaultOption and cancelOption. in that they response
 * to enter and esc keys respectively.
 */

// TODO - a button ripple on enter and esc
// TODO - make the cancel button slightly different? Icon? something else?
const DEFAULT_OPTIONS = ['Ok', 'Cancel'];
const DEFAULT_RIPPLE_DURATION = 180;

/** The icon each {@link NotifierType} implies. `default` has none. */
const TYPE_ICONS: Partial<Record<NotifierType, IconGlyphKey>> = {
  [NotifierType.Info]: 'ValidationInformation',
  [NotifierType.Warning]: 'ValidationWarning',
  [NotifierType.Error]: 'ValidationStop',
  [NotifierType.Success]: 'Check'
};
const ICON_SIZE = 32;

/**
 * The stable, language-free IDENTITY of an option — its `id` if given, else the `string` form, else the
 * {@link InputOption} object itself. This is what crosses the notifier boundary as `results.option` and
 * what `defaultOption`/`cancelOption` are matched against.
 *
 * @remarks
 * Exported for a host that takes an option's action from somewhere OTHER than the action row — a
 * list's double-click "that one", a keyboard shortcut. `options`/`defaultOption` hold the rich form,
 * `onOption` receives the identity, and a shortcut that forwards what it was given hands its own
 * handler an object where every button hands it a string. Every `option === 'Next'` comparison in that
 * handler then silently answers `false`.
 */
export const optionIdentity = (option: OptionInput): OptionInput =>
  typeof option === 'string' ? option : (option.id ?? option);

/** Whether option `a` is the same as a default/cancel `target` (both compared by {@link optionIdentity}). */
const sameOption = (a: OptionInput, target?: OptionInput): boolean =>
  target !== undefined && optionIdentity(a) === optionIdentity(target);

/** {@link InputOption.disabled}, resolved — a thunk is called at render, so live state can gate it. */
const isOptionDisabled = (option: OptionInput): boolean => {
  if (typeof option === 'string') return false;
  return typeof option.disabled === 'function' ? option.disabled() : option.disabled === true;
};

export const OptionsDialog = memo(forwardRef<HTMLDivElement, OptionsDialogProps>((props, refForwarded) => {
  const {
    description,
    type,
    icon: propIcon,
    onCancel,
    onOption,
    onDone,
    onValidateOption,
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

  const t = useTranslator();

  const icon = useMemo(() => {
    const iconKey = typeof propIcon === 'string' ? propIcon : (propIcon ? undefined : TYPE_ICONS[type!]);
    if (!iconKey) return propIcon ?? null;
    return <DynamicIcon iconKey={iconKey} size={ICON_SIZE} ariaHidden />;
  }, [propIcon, type]);
  // The DISPLAY label, resolved at render so a language change while the dialog is open re-localizes it.
  // An InputOption owns its label (a thunk is called here); a bare identity string localizes the two
  // built-ins (Ok/Cancel) and otherwise renders itself.
  const labelForOption = useCallbackRef((option: OptionInput): string => {
    if (typeof option !== 'string') return typeof option.label === 'function' ? option.label() : option.label;
    if (option === 'Ok') return t('dialog.ok');
    if (option === 'Cancel') return t('dialog.cancel');
    return option;
  }, [t]);

  const refForm = useRef<HTMLFormElement>(null);

  // The option whose validation is in flight, or null. Validation may be genuinely slow (a network
  // round-trip, or a password derivation with a deliberate work factor), and without this the dialog
  // simply appears frozen — and invites a second click that starts the work again.
  const [pendingOption, setPendingOption] = useState<OptionInput | null>(null);

  const handleOptionSelect = useCallbackRef(async (option: OptionInput) => {
    // Callers receive the IDENTITY (id / string / object), never the rich InputOption's display parts.
    const identity = optionIdentity(option);
    if (pendingOption !== null) return; // already validating — ignore repeat activation
    // Guarded here as well as on the button: Enter submits the form straight to the default option.
    if (isOptionDisabled(option)) return;
    // Backing out is never gated by validation: a dialog whose validator is failing must still be
    // dismissable.
    const isCancel = sameOption(option, cancelOption);
    let result = undefined;
    try {
      setPendingOption(identity);
      result = isCancel ? true : (await Promise.resolve(onValidateOption?.(identity)) ?? true);
      if (result !== true)
        return;
      await Promise.resolve(onOption?.(identity, isCancel, sameOption(option, defaultOption)));
      onDone?.(identity);
    } catch (e) {
    } finally {
      setPendingOption(null);
    }
  }, [onOption, onDone, onValidateOption, cancelOption, defaultOption, pendingOption]);

  // `defaultOption` belongs in the deps, not just `handleOptionSelect` (which is stable): without it
  // this closure keeps the default the dialog was FIRST rendered with, and the submit path — the
  // default button and Enter — goes on activating it after the prop changes. Invisible for a dialog
  // whose action row never moves; fatal for a multi-page one, where page 2's default button
  // re-activated page 1's "Next".
  const doSubmit:SubmitHandler<any> = useCallbackRef((_data: FieldValues, _event?: React.BaseSyntheticEvent) => {
    // formEvent.preventDefault();
    setTimeout(() => {
      handleOptionSelect(defaultOption);
    }, DEFAULT_RIPPLE_DURATION);
  }, [handleOptionSelect, defaultOption]);

  const handleCancel = useCallbackRef(() => {
    onOption?.(optionIdentity(cancelOption), true/*isCancel*/, false);
    onCancel?.();
    onDone?.(null);
  }, [onOption, cancelOption, onCancel, onDone]);
  // `isSubmitting` (in flight), NOT `isSubmitted` (a submit was ever attempted). The latter is
  // sticky: once a submit had been tried, the default button stayed disabled forever — invisible
  // while a failed validation also closed the dialog, but fatal now that a dialog can stay open and
  // be retried (a rejected password left Open permanently dead). Double-activation is covered by
  // `pendingOption` below, which tracks the actual in-flight option.
  const disabled = formState && (Object.keys(formState.errors).length > 0 || formState.disabled || formState.isSubmitting);

  const createOptionsButton = useCallbackRef((option: OptionInput, isDefaultOption: boolean, index: number) => {
    const isCancelButton = sameOption(option, cancelOption);

    // NOTE: no `key` here — it must be passed directly on the returned element, never spread (React warns).
    const propsButton: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      className: isDefaultOption ? 'defaultOption' : 'action',
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
    // A rich option may render its own button. The dialog owns the list key, so it goes on the slot.
    const renderButton = typeof option !== 'string' ? option.renderButton : undefined;
    if (renderButton)
      return <RenderSlot key={`action:${index}`} render={renderButton} props={{ buttonProps: propsButton, isDefaultOption }} />;

    const isPending = pendingOption !== null && sameOption(option, pendingOption);
    const propsMui: ButtonProps = {
      className: isDefaultOption ? 'defaultOption' : 'action',
      variant: isDefaultOption ? 'contained' : 'outlined',
      size: `small`,
      // While an option is validating, every other button is inert — including Cancel, which would
      // otherwise resolve the dialog out from under the in-flight call.
      disabled: (!isCancelButton && (disabled || isOptionDisabled(option))) || (pendingOption !== null && !isPending),
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
        key={`action:${index}`}
        {...propsMui}
      >
        <div
          style={{
            // NO padding and NO line-height here — deliberately. `ButtonBase` is already a centering
            // flex container, and the button's HEIGHT comes from this label's line box
            // (`typography.button`, line-height 1.75). A `paddingTop: 3px` used to live here ("not
            // sure why this is needed to make visually nice"), which is what made every dialog's
            // label sit a few pixels low; overriding `line-height` instead is worse still, since it
            // shrinks the button. Leaving both alone gives MUI's own metrics, centered.
            //
            // The spinner overlays the label rather than replacing it, so the button keeps its
            // width and the dialog's action row does not jump when validation starts.
            visibility: isPending ? 'hidden' : undefined
          }}
        >
          {labelForOption(option)}
        </div>
        {/*
          * Mounted with the button and revealed with opacity, rather than mounted when validation
          * starts — one less thing to happen at the moment the main thread is busiest.
          *
          * NOTE: this alone does not make a spinner appear. A validator that never yields (an await
          * loop only queues microtasks, which are drained before the browser renders) blocks paint
          * entirely, and the spinner stays invisible or frozen mid-frame however it is mounted. See
          * `AgileCrypto.yieldToHost` for the other half.
          *
          * Only on buttons that can actually validate — cancel never does (see handleOptionSelect).
          */}
        {onValidateOption && !isCancelButton ? (
          <CircularProgress
            size={16}
            color="inherit"
            // Inline (not `sx`) so the visible/hidden state can be read back without a style engine.
            style={{ opacity: isPending ? 1 : 0 }}
            sx={{
              position: 'absolute',
              top: 'calc(50% - 8px)',
              left: 'calc(50% - 8px)',
              // Above MuiTouchRipple, which is the last child of ButtonBase and is
              // `position:absolute; inset:0; z-index:0` — a stacking context that would otherwise
              // paint over a z-index:auto sibling declared before it. Defensive, not a fix.
              zIndex: 1,
              pointerEvents: 'none',
              transition: 'opacity 120ms'
            }}
          />
        ) : null}
      </Button>
    )
  }, [options, defaultOption, cancelOption, formState, labelForOption, pendingOption]);

  const optionActions = useMemo(() => {
    const retValue = [];
    for (let i=0; i<options.length; i++) {
      const option = options[i];
      const isDefaultOption = (defaultOption !== undefined ? sameOption(option, defaultOption) : i === 0);
      retValue.push(createOptionsButton(option, isDefaultOption, i));
    }
    return retValue;
    // `pendingOption` belongs here: the buttons render the spinner and the disabled state from it,
    // and without it in the deps this memo held the pre-validation buttons — the dialog just sat
    // there looking inert while the work ran.
  }, [options, defaultOption, formState, t, pendingOption]);

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

          let option: OptionInput | null = null;
          let refRipple: React.RefObject<TouchRippleActions | null> | null = null;
          const isCancel = e.which === KeyCodes.Escape && cancelOption;
          if (isCancel) {
            // Escape must not be swallowed while an option is validating, nor gated by it.
            if (pendingOption !== null) return;
            option = cancelOption;
            refRipple = refRippleCancel;
          } else if (disabled || pendingOption !== null) {
            return;
          } else if (e.which === KeyCodes.Enter) {
            option = defaultOption ?? options[0];
            refRipple = refRippleDefault;
          }
          if (option) {
            refRipple?.current?.start(e, {
              center: false
            })
            setTimeout(() => {
              refRipple?.current?.stop(e);
              // `handleCancel`, NOT `handleOptionSelect` — the latter runs `onValidateOption` first,
              // so Escape on a dialog with a failing validator reported the validation error instead
              // of closing (a wrong password made the dialog impossible to dismiss by keyboard).
              // This is also exactly what the Cancel button does, so the two paths now agree.
              if (isCancel) // we don't do this for submit
                handleCancel();
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
              flexDirection: 'row',
              alignItems: 'flex-start',
              columnGap: (theme: Theme) => theme.spacing(2)
            }}
          >
            {icon ? (
              <Box sx={{ display: 'flex', flex: 'none' }}>
                {icon}
              </Box>
            ) : null}
            <Typography sx={{ alignSelf: 'center' }}>
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
