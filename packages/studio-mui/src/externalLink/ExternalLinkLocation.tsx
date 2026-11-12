import type React from 'react';

import { Box, Typography } from '@mui/material';

import { type IExternalBook, externalBookLocation } from '@sheetxl/sdk';

import { SimpleTooltip } from '@sheetxl/utils-mui';

import { type ItemBodyProps } from '../itemsPanel';

/**
 * Where the linked file is — the card's bold label, under the icon and title.
 *
 * @remarks
 * Elides in the MIDDLE rather than at the end: a path's two informative ends are the drive/host and
 * the file name, and a tail ellipsis eats the half that says which file this is. Done by splitting
 * at the last separator and letting only the head shrink, so it costs no measurement — the tail is
 * `flex: 0 0 auto` and the head carries the ellipsis.
 *
 * Renders nothing when no source carries a directory. The title already says the file name, and
 * repeating it as a path that is not one helps nobody (a book may record only a bare relative name
 * — see {@link externalBookLocation}).
 */
export const ExternalLinkLocation: React.FC<ItemBodyProps<IExternalBook>> = ({ item }) => {
  const location = externalBookLocation(item);
  if (!location) return null;

  const cut = Math.max(location.lastIndexOf('/'), location.lastIndexOf('\\'));
  const head = cut === -1 ? '' : location.substring(0, cut + 1);
  const tail = cut === -1 ? location : location.substring(cut + 1);

  return (
    <SimpleTooltip title={location}>
      <Box
        className="sxl-external-link-location"
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          minWidth: 0,
          // The bold label the card's subtitle slot would have rendered as a string.
          typography: 'subtitle2',
          fontWeight: 600
        }}
      >
        {head ? (
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {head}
          </Typography>
        ) : null}
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, flex: '0 0 auto', whiteSpace: 'nowrap' }}
        >
          {tail}
        </Typography>
      </Box>
    </SimpleTooltip>
  );
};
