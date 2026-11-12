import { useModal } from 'mui-modal-provider';

import { defineLazyModule } from '@sheetxl/utils';
import { type OptionInput, type InputResults } from '@sheetxl/utils-react';

import { type InputDialogProps } from './InputDialog';
import { lazyModal } from './lazyModal';

const InputDialogModule = defineLazyModule('utils-mui:inputDialog', () => import('./InputDialog'));
const Dialog = lazyModal(InputDialogModule.load);

const useInputDialog = (propsDefault?: InputDialogProps): (props: InputDialogProps) => Promise<InputResults> => {
  const { showModal } = useModal();
  const showInput = (props: InputDialogProps): Promise<InputResults> => {
    const {
      defaultOption = props.options?.[0],
      cancelOption = 'Cancel',
      ...inputOptions
    }  = props;

    return new Promise<InputResults>((resolve, reject) => {
      const modal = showModal(Dialog, {
        ...propsDefault as any,
        defaultOption,
        cancelOption,
        ...inputOptions,
        onOption(option: OptionInput, isCancel: boolean, isDefault: boolean) {
          inputOptions?.onOption?.(option, isCancel, isDefault);
          resolve({input: '', option});
        },
        onInput(input: string, option?: OptionInput) {
          inputOptions?.onInput?.(input, option);
          // onInput is only ever dispatched with a resolved option (InputDialog.handleInput's
          // param is required), so `option` is present here.
          resolve({input, option: option!});
        },
        onDone: () => {
          inputOptions?.onDone?.();
          modal.hide();
        },
        onLoadError: (error: unknown) => {
          modal.destroy();
          reject(error);
        }
      });
    });
  };
  return showInput;
}

export default useInputDialog;
export { useInputDialog };
