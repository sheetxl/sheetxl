import { UndoManager } from '@sheetxl/utils';

import { type IWorkbook } from '@sheetxl/sdk';

import { type ReadWorkbookOptions, type WorkbookHandle } from '@sheetxl/io';

import { ErrorPanelProps, type ThemeModeOptions } from '@sheetxl/utils-mui';

import type { IWorkbookElement, WorkbookElementProps, WorkbookTitleProps } from '../components';


/**
 * Properties for the Studio component.
 */
export interface StudioProps extends Omit<WorkbookElementProps, "workbook" | "onError"> {
  /**
   * The model to use in the IWorkbookElement.
   *
   * @remarks
   * If not provided a default model will be created.
   */
  workbook?: IWorkbook | Promise<IWorkbook> | WorkbookHandle | Promise<WorkbookHandle> | ReadWorkbookOptions;
  /**
   * Called if the `IWorkbook` changes.
   *
   * @param workbook - The workbook
   */
  onWorkbookChange?: (workbook: IWorkbook) => void;
  /**
   * Custom logo.
   */
  logo?: React.ReactNode;
  /**
   * Called if the workbook model is a promise that fails to load.
   *
   * @param error The error
   */
  onError?: (error: any) => void;
  /**
   * Allow for a custom error panel to be used for errors.
   *
   * @defaultValue ErrorPanel
   */
  errorPanel?: React.ComponentType<ErrorPanelProps>;

  /**
   * Title to display.
   *
   * @defaultValue none
   *
   * @remarks
   * If title is null then it is hidden but if it is '' then it is shown with placeholder
   */
  title?: string;

  /**
   * Callback for title changes.
   *
   * @param title - The new title.
   */
  onTitleChange?: (title: string) => void;

  /**
   * Additional WorkbookTitle properties.
   *
   * @remarks
   * If onTitleChange or title is provided then the prop versions are ignored
   */
  titleProps?: WorkbookTitleProps;
  /**
   * Disable the import export options in the menu.
   */
  importExportDisabled?: boolean;

  /**
   * Studio will inherit the theme unless this is explicitly set.
   *
   * @remarks
   * If this is set then there are two additional options that can be provided:
   * * onModeChange(mode: ThemeMode);
   * * onDarkGridChange(allow: boolean);
   * * onDarkImagesChange(allow: boolean);
   */
  themeOptions?: ThemeModeOptions;

  /**
   * Autofocus on load. If loading multiple workbooks or using an a secondary component this
   * should be set to false.
   *
   * @defaultValue false
   */
  autoFocus?: boolean | FocusOptions;

  /**
   * Allow for a custom undo manager.
   *
   * @defaultValue a new undo manager for each standaloneWorkbook
   */
  undoManager?: UndoManager;

  /**
   * Set the license key via a property
   * @remarks
   * This will only be used the first time.
   */
  licenseKey?: string;
  // onNew
  // onOpen
  // onSave
}

/**
 * Extends the IWorkbookElement with additional properties for the Studio.
 */
export interface StudioElement extends IWorkbookElement {
  // No additional properties, but can be extended in the future
}
