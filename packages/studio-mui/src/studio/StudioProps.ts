import { type UndoManager } from '@sheetxl/utils';

import { type IWorkbook } from '@sheetxl/sdk';

import { type ReadWorkbookOptions } from '@sheetxl/io';

import { type ErrorPanelProps } from '@sheetxl/utils-react';

import { type SxProps } from '@mui/system';
import { type Theme } from '@mui/material/styles';

import { type PaperProps } from '@mui/material';

import { type ThemeModeOptions } from '@sheetxl/utils-mui';

import type { IWorkbookElement, WorkbookElementProps, WorkbookTitleProps } from '../components';

/**
 * Properties for the Studio component.
 */
export interface StudioProps extends Omit<WorkbookElementProps, "workbook">, Omit<PaperProps, 'autoFocus' | 'ref'> {
  /**
   * The IWorkbook for the studio.
   *
   * @remarks
   * This can be either an [IWorkbook](./_sheetxl_sdk.IWorkbook.html), a `Promise`
   * that resolves to an [IWorkbook](./_sheetxl_sdk.IWorkbook.html), or
   * a [ReadWorkbookOptions](./_sheetxl_io.ReadWorkbookOptions.html) object to create
   * the workbook from various sources.
   *
   * @see
   * * [IWorkbook](./_sheetxl_sdk.IWorkbook.html)
   * * [ReadWorkbookOptions](./_sheetxl_io.ReadWorkbookOptions.html)
   */
  workbook?: IWorkbook | Promise<IWorkbook> | ReadWorkbookOptions;
  /**
   * Called if the `IWorkbook` changes.
   *
   * @param workbook - The workbook
   */
  onWorkbookChange?: (workbook: IWorkbook) => void;
  /**
   * Called if the workbook model is a promise that fails to load.
   *
   * @param error The error
   */
  onWorkbookError?: (error: any) => void;
  /**
   * Allow for a custom error panel if workbook load error occurs.
   *
   * @defaultValue StackTraceErrorPanel
   */
  renderWorkbookError?: (props: ErrorPanelProps) => React.ReactElement;
  /**
   * Custom logo.
   */
  logo?: React.ReactNode;

  /**
   * Callback for title changes.
   *
   * @param title - The new title.
   */
  onWorkbookTitleChange?: (title: string) => void;
  /**
   * Additional WorkbookTitle properties.
   *
   * @remarks
   * If onTitleChange or title is provided then the prop versions are ignored
   */
  propsWorkbookTitle?: WorkbookTitleProps;
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

  // TODO - on workbook element but I think we are going to have Studio not extend workbook
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

  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
}

/**
 * Extends the IWorkbookElement with additional properties for the Studio.
 */
export interface StudioElement extends IWorkbookElement {
  // No additional properties, but can be extended in the future
}
