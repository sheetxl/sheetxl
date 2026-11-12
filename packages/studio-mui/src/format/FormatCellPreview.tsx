import type React from 'react';
import { memo, useMemo } from 'react';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { type ICell } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { StaticCellRenderer } from '@sheetxl/react';

import { type FormatSelection } from './useFormatSelection';

export interface FormatCellPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  selection: FormatSelection;
  /**
   * Height of the preview box.
   *
   * @remarks
   * Roughly two grid rows — enough for vertical alignment and a tilt to read, without the pane's
   * top third being an empty rectangle.
   */
  height?: number;
  /**
   * Widest the preview box is drawn, in px. It still shrinks with a narrower pane.
   *
   * @remarks
   * A cap, not a width: the pane is several cell-widths wide, and a preview stretched across all of
   * it stops reading as a cell — a filled format (accounting's `* `) spans the whole span, and the
   * ends land a hand's width apart. This keeps the box near the width the value would actually be
   * shown at.
   */
  maxWidth?: number;
}

/**
 * The number the preview stands in with when the anchor cell holds no number of its own.
 *
 * @remarks
 * Excel Online gives each of its format panels a different, tab-shaped sample. One sample for all
 * five tabs is only useful if it survives every tab — and the Number tab is the one that needs an
 * actual number, so a numeric stand-in is what the shared preview uses when the cell has none.
 */
const SAMPLE_VALUE = 1234.56;

/**
 * The one preview shared by every tab of the format pane: the selection's ANCHOR cell, rendered the
 * way the grid will render it.
 *
 * @remarks
 * The pane applies live, so this is not a "what you would get" mock — it is the cell, re-read after
 * each edit. Only the VALUE is ever substituted: a cell holding text (or nothing) previews
 * {@link SAMPLE_VALUE} instead, so the Number tab has something to format. The style is always the
 * real one.
 */
export const FormatCellPreview = memo((props: FormatCellPreviewProps) => {
  const {
    selection,
    height = 46,
    maxWidth = 260,
    ...rest
  } = props;

  const t = useTranslator();
  const { cell, createCell, disabled } = selection;

  const previewCell: ICell | null = useMemo(() => {
    const value = cell.getValue();
    if (typeof value === 'number') return cell;
    return createCell({ value: SAMPLE_VALUE, style: cell.getStyle() });
  }, [cell, createCell]);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
      {...rest}
    >
      <Typography variant="caption" component="div">
        {t('format.preview')}
      </Typography>
      <StaticCellRenderer
        cell={previewCell}
        disabled={disabled}
        style={{
          width: '100%',
          maxWidth: `${maxWidth}px`,
          height: `${height}px`,
          flex: '0 0 auto',
          // The gridline color, resolved against the GRID surface the renderer adopts on this same
          // element — so the preview is framed the way the cell it shows is framed, in either mode.
          border: '1px solid var(--sxl-color-base-300, rgb(224, 224, 224))'
        }}
        propsBorder={{
          style: {
            height: '100%',
            width: '100%'
          }
        }}
      />
    </Box>
  );
});

FormatCellPreview.displayName = 'FormatCellPreview';
