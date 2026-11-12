import ModalProvider from 'mui-modal-provider';

export * from './lazyModal';
export * from './useLazyWindow';

export * from './InternalWindow';

// OptionsDialog is used directly by consumers, so it's a full re-export.
export * from './OptionsDialog';

// InputDialog's component is lazy loaded
export type { InputDialogProps } from './InputDialog';

export * from './useOptionsDialog';
export * from './useInputDialog';

// We want to share  the provider but we don't want clients to re-import as this may create multiple instances
export * from 'mui-modal-provider';

export { ModalProvider };
