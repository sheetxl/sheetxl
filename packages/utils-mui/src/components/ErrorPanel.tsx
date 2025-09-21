import React, { useMemo, memo, forwardRef } from 'react';

import { Theme } from '@mui/material/styles';

import { Paper } from '@mui/material';
import { Box, BoxProps } from '@mui/material';
import { Typography } from '@mui/material';

import { DynamicIcon } from '@sheetxl/utils-react';
import { StackTrace } from './StackTrace';

export interface ErrorPanelProps extends BoxProps {
  icon?: React.ReactNode;
  error?: any;
  /**
   * Whether to hide the stack trace.
   *
   * @defaultValue false
   */
  hideStackTrace?: boolean;
  /**
   * Whether the stack trace should be expanded by default
   *
   * @defaultValue false
   */
  stackTraceExpanded?: boolean;
}

export const wrapErrorAsComponent = (error: any, hideStackTrace: boolean = false, stackTraceExpanded: boolean = false): React.ReactNode => {
  if (React.isValidElement(error)) {
    return error;
  }
  if (error instanceof Error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '500px',
          width: '100%'
        }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{
            fontSize: '0.875rem',
            lineHeight: 1.43,
            mb: 1
          }}
        >
          {error.message}
        </Typography>
        {error.cause ? (
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontSize: '0.875rem',
              lineHeight: 1.43,
              letterSpacing: '0.01071em',
              mb: 1,
              opacity: 0.8
            }}
          >
            Caused by: {error.cause instanceof Error ? error.cause.message : String(error.cause)}
          </Typography>
        ): null}
        {!hideStackTrace && (
          <StackTrace
            error={error}
            hideLineNumbers={true}
          />
        )}
      </Box>
    );
  }
  const asMessage =  error === 'string' ? error : `Unknown Error: ${String(error)}`;
  return (
    <Typography
      variant="caption"
      component="div"
      sx={{
        fontSize: '0.875rem',
        lineHeight: 1.43,
        letterSpacing: '0.01071em'
      }}
    >
      {asMessage}
    </Typography>
  );
}

/**
 * Simple panel to show error.
 * Todo - allow for action flag
 */
const ErrorPanel: React.FC<ErrorPanelProps & { ref?: any }> = memo(
  forwardRef<any, ErrorPanelProps>((props, refForwarded) => {
  const {
    sx: propSx,
    icon = <DynamicIcon iconKey='Error' style={{ fontSize: 48 }} />,
    error,
    hideStackTrace = false,
    stackTraceExpanded = false,
    ...rest
  } = props;

  const errorWrapped = useMemo(() => {
    return wrapErrorAsComponent(error, hideStackTrace, stackTraceExpanded);
  }, [error, hideStackTrace, stackTraceExpanded]);

  const retValue = useMemo(() => {
    return (
      <Box
        ref={refForwarded}
        sx={{
          boxSizing: 'border-box',
          alignItems: 'center',
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          ...propSx
        }}
        {...rest}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <Box
            className="backdrop"
            sx={{
              // background: (theme: Theme)=> {
              //   return theme.palette.background.paper;
              // },
              backdropFilter: `blur(4px)`,
              borderRadius: (theme: Theme) => {
                return `${theme.shape.borderRadius}px`;
              },
              zIndex: -1, // shouldn't be required but is.
              position: 'absolute',
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
          </Box>
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              rowGap: '8px',
              alignSelf: 'center',
              marginBottom: '5%',
              backgroundColor:  (theme: Theme) => {
                return theme.palette.error.light; // '#2196f3'; // nice blue
              },
              color:  (theme: Theme) => {
                return theme.palette.error.contrastText; // '#fff'; // white
              },
              paddingLeft: (theme: Theme) => theme.spacing(2),
              paddingRight: (theme: Theme) => theme.spacing(2),
              paddingTop: (theme: Theme) => theme.spacing(2),
              paddingBottom: (theme: Theme) => theme.spacing(2),
              borderRadius: (theme: Theme) => {
                return `${theme.shape.borderRadius}px`;
              },
              boxShadow: (theme: Theme) => {
                return theme.shadows[2];
              },
              '& .primary': {
                background: (theme: Theme) => {
                  return `${theme.palette.error.contrastText} !important`; // '#fff'; // white
                },
                border: 'solid transparent',
              },
              zIndex: 1
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: (theme: Theme) => theme.spacing(2),
                width: '100%',
                maxWidth: '600px'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: (theme: Theme) => theme.spacing(2)
                }}
              >
                {icon}
                {errorWrapped}
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }, [propSx]);

  return retValue;
}));

ErrorPanel.displayName = 'ErrorPanel';
export { ErrorPanel };