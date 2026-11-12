import { useModal } from 'mui-modal-provider';

import { type ShowOptionsOptions, type OptionInput } from '@sheetxl/utils-react';
import { type InternalWindowProps } from './InternalWindow';

import OptionsDialog from './OptionsDialog';

export interface OptionsDialogProps<T=any, C=any> extends ShowOptionsOptions<T,C>, Omit<InternalWindowProps<T, C>, 'style' | 'onInput' | 'autoFocus' | 'onKeyDown'> {};

const useOptionsDialog = (propsDefault?: OptionsDialogProps): (options: OptionsDialogProps) => Promise<OptionInput> => {
  const { showModal } = useModal();
  const showWindow = (options: OptionsDialogProps): Promise<OptionInput> => {
    return new Promise<OptionInput>((resolve) => {

      const modal = showModal(OptionsDialog, {
        ...propsDefault as any,
        ...options,
        onOption(option: OptionInput, isCancel: boolean, isDefault: boolean) {
          options?.onOption?.(option, isCancel, isDefault);
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
