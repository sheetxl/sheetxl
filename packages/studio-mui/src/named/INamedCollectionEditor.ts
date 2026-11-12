
import type React from 'react';

import { type INamedCollection, type IWorkbook } from '@sheetxl/sdk';

import { type CommandPopupButtonProps } from '@sheetxl/utils-mui';
import { type FloatReference } from '@sheetxl/utils-react';


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
   *
   * @remarks
   * Removes the FloatReference is used.
   */
  restoreFocus?: (options?: FocusOptions) => void;

  disabled?: boolean;

  readonly?: boolean;

  parentFloat?: FloatReference;

  propsCommandPopupButton?: CommandPopupButtonProps;

  /**
   * Reference to the underlying element
   */
  ref?: React.Ref<INamedCollectionEditorElement>;
}