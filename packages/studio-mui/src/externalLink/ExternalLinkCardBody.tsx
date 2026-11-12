import type React from 'react';

import { Box, Typography, type Theme } from '@mui/material';

import { type IExternalBook } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { type ItemBodyProps } from '../itemsPanel';

/**
 * What is known about one linked book beyond where it is: which of its sheets this workbook holds
 * values for, and how many formulas would change if the link were broken.
 */
export const ExternalLinkCardBody: React.FC<ItemBodyProps<IExternalBook>> = ({ item }) => {
  const t = useTranslator();

  const sheetNames = item.getSheetNames();
  /* A sheet is CACHED or it is not — an uncached sheet is unknown, not empty (design doc §1), so
     they are NAMED rather than counted: which ones are here is the answerable question. */
  const cached: string[] = [];
  let refreshError = false;
  for (let i=0; i<sheetNames.length; i++) {
    const data = item.getSheetData(i);
    if (!data) continue;
    cached.push(sheetNames[i]);
    if (data.refreshError) refreshError = true;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: (theme: Theme) => theme.spacing(0.5) }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {cached.length > 0
          ? t('externalLink.cached', { sheets: cached.join(', ') })
          : t('externalLink.cachedNone')}
      </Typography>
      {refreshError ? (
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          {t('externalLink.refreshError')}
        </Typography>
      ) : null}
      {/* Formula BLOCKS, not cells — a block spanning ten cells is one, and a defined name's body
          is one. It is the count Break link acts on. */}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('externalLink.dependents', { count: item.getDependents().length })}
      </Typography>
    </Box>
  );
};
