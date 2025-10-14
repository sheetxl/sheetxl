
import type React from 'react';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

import type { INamedCollection, IWorkbook } from '@sheetxl/sdk';

import type { CommandPopupButtonProps, FloatReference } from '@sheetxl/utils-mui';


export interface NamedCollectionEditorAttributes {
}

/**
 * Type returned via ref property
 */
export interface INamedCollectionEditorElement extends NamedCollectionEditorAttributes, HTMLDivElement {};

export interface NamedCollectionEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The named ranges
   */
  names: INamedCollection;
  /**
   * The workbook
   */
  workbook: IWorkbook;
  /**
   * Returns focus to primary.
   * @remarks
   * Removes the FloatReference is used.
   */
  restoreFocus?: (options?: FocusOptions) => void;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  disabled?: boolean;

  readonly?: boolean;

  parentFloat?: FloatReference;

  commandPopupButtonProps?: CommandPopupButtonProps;

  /**
   * Reference to the underlying element
   */
  ref?: React.Ref<INamedCollectionEditorElement>;
}