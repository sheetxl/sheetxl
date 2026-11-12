import type React from 'react';
import { memo } from 'react';

import { Box, Button, Typography } from '@mui/material';

import { useLazyRetry, useTranslator } from '@sheetxl/utils-react';

import { StackTraceErrorPanel, type StackTraceErrorPanelProps } from './StackTraceErrorPanel';

export interface LazyLoadErrorPanelProps extends Omit<StackTraceErrorPanelProps, 'error' | 'hideStackTrace'> {
  /**
   * The load failure.
   */
  error: unknown;
}

/**
 * Shows that a feature failed to load.
 *
 * @remarks
 * When rendered from a `lazyComponent` error renderer, a Retry button loads the feature again.
 */
export const LazyLoadErrorPanel: React.FC<LazyLoadErrorPanelProps> = memo((props: LazyLoadErrorPanelProps) => {
  const { error, ...rest } = props;
  const retry = useLazyRetry();
  const t = useTranslator();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <StackTraceErrorPanel
      hideStackTrace={true}
      error={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="body2" component="div">
            {message}
          </Typography>
          {retry ? (
            <Button variant="outlined" size="small" onClick={retry}>
              {t('lazyLoad.retry')}
            </Button>
          ) : null}
        </Box>
      }
      {...rest}
    />
  );
});

LazyLoadErrorPanel.displayName = 'LazyLoadErrorPanel';
