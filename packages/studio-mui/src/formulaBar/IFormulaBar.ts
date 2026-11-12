import type React from 'react';

import { type IWorkbook } from '@sheetxl/sdk';

import { type RenderSlotFn } from '@sheetxl/utils-react';
import { type SheetEditable } from '@sheetxl/react';

import { type NamedCollectionEditorProps, type INamedCollectionEditorElement } from '../named';

/**
 * Where a formula bar sits in the studio: above the grid, or below it directly above the status bar.
 */
export type FormulaBarPlacement = 'top' | 'bottom';

export interface FormulaBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook that is used for the range.use
   */
  workbook?: IWorkbook;
  /**
   * The shared cell editor. When provided (and the editor is on), the
   * formula bar edits through this SAME {@link SheetEditable} the grid uses — live two-way sync.
   */
  editable?: SheetEditable;
  /**
   * If the NamedCollectionEditor should be shown.
   * @defaultValue true
   */
  showNamedCollectionEditor?: boolean;
  /**
   * Allow for customizations on NamedCollectionEditor
   */
  propsNamedCollectionEditor?: NamedCollectionEditorProps;
  /**
   * Override the default NamedCollectionEditor. Pass `props.ref` on to the
   * {@link INamedCollectionEditorElement}.
   */
  renderNamedCollectionEditor?: RenderSlotFn<NamedCollectionEditorProps>;
  /**
   * Disabled the ui.
   */
  disabled?: boolean;

  /**
   * If a Calculate Now (F9) button is shown at the start of the bar while the workbook is in
   * manual calculation mode. Never shown in automatic mode.
   *
   * @defaultValue true
   */
  showCalculateNow?: boolean;

  /**
   * Which edge of the grid the bar sits on. A bar below the grid grows upward when expanded and
   * marks focus along its top edge.
   *
   * @defaultValue 'top'
   */
  placement?: FormulaBarPlacement;

  /**
   * Whether a bar at the bottom edits on top of the virtual keyboard. The bar stays in place, read
   * only, and the field moves to a bar that rides the keyboard while it is up. `false` keeps the field
   * in place (for a host that manages the keyboard itself). Ignored at the top.
   *
   * @defaultValue true
   */
  floatOnKeyboard?: boolean;

  /**
   * Ref for the FormulaBar element.
   */
  ref?: React.Ref<IFormulaBarElement>;
}


export interface FormulaBarAttributes {
  getNamedCollectionEditorElement: () => INamedCollectionEditorElement | null;
  /**
   * The shared cell editor the formula bar drives, or `null` if none. The same instance
   * the grid uses.
   */
  getEditable: () => SheetEditable | null;
  /**
   * Whether focus is in the bar, including a part of it that rides the virtual keyboard outside the
   * bar's element.
   */
  isFocusWithin: () => boolean;
  /**
   * For runtime introspection
   */
  isFormulaBarElement: () => true;
}

/**
 * Type returned via ref property.
 */
export interface IFormulaBarElement extends FormulaBarAttributes, HTMLDivElement {};
