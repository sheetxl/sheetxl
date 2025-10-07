import React from 'react';

import { useModal } from 'mui-modal-provider';

import type { ShowOptionsOptions } from '@sheetxl/utils-react';
import type { InternalWindowProps } from './InternalWindow';

const Dialog = React.lazy(() => import(/* webpackPrefetch: true */'./OptionsDialog'));

export interface OptionsDialogProps<T=any, C=any> extends ShowOptionsOptions<T,C>, Omit<InternalWindowProps<T, C>, 'style' | 'onInput' | 'autoFocus' | 'onKeyDown'> {};

const useOptionsDialog = (propsDefault?: OptionsDialogProps): (options: OptionsDialogProps) => Promise<string> => {
  const { showModal } = useModal();
  const showWindow = (options: OptionsDialogProps): Promise<string> => {
    return new Promise<string>((resolve) => {

      const modal = showModal(Dialog, {
        ...propsDefault as any,
        ...options,
        onOption(option) {
          options?.onOption?.(option, option === options.cancelOption, option === options.defaultOption);
          resolve(option);
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

export default useOptionsDialog;
export { useOptionsDialog };
