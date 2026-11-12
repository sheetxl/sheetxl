import type React from 'react';

import { Box, Typography, type SxProps, type Theme } from '@mui/material';

/**
 * `sx` for a button's inline text label — the theme font at `subtitle2` size, single line, no
 * uppercasing. A bare MUI icon button leaves text children unstyled (browser serif, default size),
 * so any button that renders a label as content applies this. Mirrors `LabelIcon`'s text styling and
 * is the single source of truth for `ExhibitPopupIconButton` and `CommandButton` (leaf).
 */
export const buttonLabelSx: SxProps<Theme> = {
  whiteSpace: 'nowrap',
  textTransform: 'none',
  lineHeight: 1,
  fontSize: (theme: Theme) => theme.typography.subtitle2.fontSize,
  paddingLeft: (theme: Theme) => theme.spacing(0.25),
  paddingRight: (theme: Theme) => theme.spacing(0.25),
};

/**
 * Compose a button's visible content from a `glyph` (icon / split-toggle checkmark) and an optional
 * text `label`. The label renders only when non-empty and is wrapped in a themed `Typography` (see
 * {@link buttonLabelSx}). With both present they sit side-by-side; otherwise whichever exists is
 * returned (or `undefined` when neither does — the caller/downstream supplies any blank spacer).
 */
export function composeButtonContent(
  glyph: React.ReactNode,
  label: React.ReactNode
): React.ReactNode {
  const hasLabel = label !== null && label !== undefined && label !== false && label !== '';
  const labelNode = hasLabel
    ? <Typography component="div" sx={buttonLabelSx}>{label}</Typography>
    : null;
  if (glyph && labelNode) {
    return <Box sx={{ display: 'flex', alignItems: 'center' }}>{glyph}{labelNode}</Box>;
  }
  return glyph ?? labelNode ?? undefined;
}
