import React from 'react';

import { useModal } from 'mui-modal-provider';

import { type InputDialogProps } from './InputDialog';

const Dialog = React.lazy(() => import('./InputDialog'));

const useInputDialog = (propsDefault?: InputDialogProps): (props: InputDialogProps) => Promise<{input: string, option: string}> => {
  const { showModal } = useModal();
  const showInput = (props: InputDialogProps): Promise<{input: string, option: string}> => {
    const {
      defaultOption = props.options?.[0],
      cancelOption = 'Cancel',
      ...inputOptions
    }  = props;

    return new Promise<{input: string, option: string}>((resolve) => {
      const modal = showModal(Dialog, {
        ...propsDefault as any,
        defaultOption,
        cancelOption,
        ...inputOptions,
        onOption(option: string) {
          inputOptions?.onOption?.(option, option === cancelOption, option === defaultOption);
          resolve({input: '', option});
        },
        onInput(input: string, option: string) {
          inputOptions?.onInput?.(input, option);
          resolve({input, option});
        },
        onDone: () => {
          inputOptions?.onDone?.();
          modal.hide();
        }
      });
    });
  };
  return showInput;
}

export default useInputDialog;
export { useInputDialog };
