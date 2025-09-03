import ModalProvider from 'mui-modal-provider';

export * from './useLazyWindow';

export * from './InternalWindow';

// Export both types and components
// The dynamic imports in hooks will still work for code splitting when used via hooks
export * from './OptionsDialog';
export * from './InputDialog';

export * from './useOptionsDialog';
export * from './useInputDialog';

// We want to share  the provider but we don't want clients to re-import as this may create multiple instances
export * from 'mui-modal-provider';

export { ModalProvider };
