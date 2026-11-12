import type React from 'react';
import { memo } from 'react';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook, type INamed } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { PresetChip } from '../conditionalFormat/PresetChip';

import { isEditableNamed } from './NamedDraft';

/**
 * What a name IS, as far as its glyph is concerned.
 *
 * @remarks
 * `'range'` and `'formula'` are the same model — a named formula whose expression is a pure
 * reference (`INamedFormula.getRanges` answers) against one whose expression is anything else. A
 * `'table'` is a derived name a table owns; see `isEditableNamed`.
 */
export type NamedKind = 'table' | 'range' | 'formula';

const KIND_ICONS: Record<NamedKind, string> = {
  table: 'Table',
  range: 'NamedRange',
  formula: 'Function'
};

const KIND_MESSAGE_KEYS: Record<NamedKind, string> = {
  table: messageKey('named.kindTable'),
  range: messageKey('named.kindRange'),
  formula: messageKey('named.kindFormula')
};

/**
 * The {@link NamedKind} of an existing name.
 */
export const namedKindOf = (item: INamed): NamedKind => {
  if (!isEditableNamed(item)) return 'table';
  try {
    return item.getRanges?.() ? 'range' : 'formula';
  } catch (error: any) {
    // An unresolvable expression is still an expression.
    return 'formula';
  }
};

/**
 * The {@link NamedKind} an expression being AUTHORED would define — for the editor, where there is
 * no item to ask yet.
 */
export const namedKindOfExpression = (workbook: IWorkbook, expression: string): NamedKind => {
  const text = expression.trim().replace(/^=\s*/, '');
  if (!text) return 'formula';
  try {
    return workbook.createFormula(text, undefined, { target: 'display' }).isReferenceOnly() ? 'range' : 'formula';
  } catch (error: any) {
    return 'formula';
  }
};

export interface NamedKindChipProps extends React.HTMLAttributes<HTMLElement> {
  kind: NamedKind;
  /**
   * Chip height in px.
   * @defaultValue 28
   */
  size?: number;
}

/**
 * The glyph that leads a name's card and its editor: a table, a range, or a formula.
 *
 * @remarks
 * Drawn in the same chip, at the same footprint, as a conditional format's preview — the two
 * panes sit in the same task pane, and a reader moving between them should find the leading
 * visual in the same place at the same size.
 */
export const NamedKindChip = memo<NamedKindChipProps>((props) => {
  const { kind, size = 28, ...rest } = props;
  const t = useTranslator();

  return (
    <PresetChip
      className="sxl-named-kind-chip"
      title={t(KIND_MESSAGE_KEYS[kind])}
      sx={{
        width: 'auto',
        minWidth: `${size * 1.7}px`,
        height: `${size}px`,
        // The `Table` glyph is a single `currentColor` layer, so its blue — the toolbar's
        // `TableInsert` is one all-primary layer — has to come from the chip. The range glyph
        // carries its own primary corner and the formula glyph has no blue at all.
        color: kind === 'table' ? 'primary.main' : 'text.secondary'
      }}
      {...rest}
    >
      {/* A single glyph on an empty chip needs more of the height than the "Aa" preview takes —
          at the CF preview's ratio it reads as undersized. */}
      <DynamicIcon iconKey={KIND_ICONS[kind]} size={Math.round(size * 0.7)} />
    </PresetChip>
  );
});

NamedKindChip.displayName = 'NamedKindChip';
