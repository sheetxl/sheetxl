import React from 'react';

import { useModal } from 'mui-modal-provider';

import { type InputDialogProps } from './InputDialog';

const Dialog = React.lazy(() => import('./InputDialog'));

const useInputDialog = (propsDefault?: InputDialogProps): (props: InputDialogProps) => Promise<{input: string, option: string}> => {
  const { showModal } = useModal();
  const showWindow = (props: InputDialogProps): Promise<{input: string, option: string}> => {
    const {
      defaultOption = props.options?.[0],
      cancelOption = 'Cancel',
      ...options
    }  = props;

    return new Promise<{input: string, option: string}>((resolve) => {
      const modal = showModal(Dialog, {
        ...propsDefault as any,
        defaultOption,
        cancelOption,
        // ...options,
        onOption(option: string) {
          options?.onOption?.(option, option === cancelOption, option === defaultOption);
          resolve({input: '', option});
        },
        onInputOption(input: string, option: string) {
          options?.onInputOption?.(input, option);
          resolve({input, option});
        },
        onDone: () => {
          options?.onDone?.();
          modal.hide();
        }
      });
    });
  };
  return showWindow;
}

export default useInputDialog;
export { useInputDialog };
