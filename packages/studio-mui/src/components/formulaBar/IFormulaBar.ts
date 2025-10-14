import type React from 'react';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

import type { IWorkbook } from '@sheetxl/sdk';

import type { ICommands } from '@sheetxl/utils-react';

import type { GridStyle } from '@sheetxl/grid-react';

import type { ISheetElement } from '@sheetxl/react';

import type{ NamedCollectionEditorProps, INamedCollectionEditorElement } from '../named';

export interface FormulaBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook that is used for the range.use
   */
  workbook?: IWorkbook;
  /**
   * Used for startEdit and focus
   */
  sheetElement?: ISheetElement;
  /**
   * If the NamedCollectionEditor should be shown.
   * @defaultValue true
   */
  showNamedCollectionEditor?: boolean;
  /**
   * Allow for customizations on NamedCollectionEditor
   */
  NamedCollectionEditorProps?: NamedCollectionEditorProps;
  /**
   * Override the default NamedCollectionEditor
   */
  renderNamedCollectionEditor?: (props: NamedCollectionEditorProps, ref: React.Ref<INamedCollectionEditorElement>) => React.ReactElement;
  /**
   * Key down listeners
   */
  commands?: ICommands.IGroup;
  /**
   * Disabled the ui.
   */
  disabled?: boolean;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * The grid style to use for the cell editor.
   */
  // TODO - move to css properties
  gridStyle?: GridStyle;

  /**
   * Ref for the FormulaBar element.
   */
  ref?: React.Ref<IFormulaBarElement>;
}


export interface FormulaBarAttributes {
  isFormulaBarElement: () => true;
  getNamedCollectionEditorElement: () => INamedCollectionEditorElement;
}
/**
 * Type returned via ref property
 */
export interface IFormulaBarElement extends FormulaBarAttributes, HTMLElement {};
