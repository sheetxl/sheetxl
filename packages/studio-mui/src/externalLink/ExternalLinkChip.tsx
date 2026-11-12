import type React from 'react';
import { memo } from 'react';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { PresetChip } from '../conditionalFormat/PresetChip';

export interface ExternalLinkChipProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Chip height in px.
   * @defaultValue 28
   */
  size?: number;
}

/**
 * The glyph that leads a linked book's card.
 *
 * @remarks
 * One kind, so one glyph — a link has no `NamedKind` to distinguish. Drawn in the same chip at the
 * same footprint as a name's and a conditional format's: the three sit in the same task pane, and a
 * reader moving between them should find the leading visual in the same place at the same size.
 */
export const ExternalLinkChip = memo<ExternalLinkChipProps>((props) => {
  const { size = 28, ...rest } = props;
  const t = useTranslator();

  return (
    <PresetChip
      className="sxl-external-link-chip"
      title={t('externalLink.linkedWorkbook')}
      sx={{
        width: 'auto',
        minWidth: `${size * 1.7}px`,
        height: `${size}px`,
        // `ExternalLinked` carries its own primary layer on the chain half, so the chip only has to
        // set the grid half's color.
        color: 'text.secondary'
      }}
      {...rest}
    >
      <DynamicIcon iconKey="ExternalLinked" size={Math.round(size * 0.7)} />
    </PresetChip>
  );
});

ExternalLinkChip.displayName = 'ExternalLinkChip';
