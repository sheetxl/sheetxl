import { useState, memo, forwardRef, useCallback, isValidElement } from 'react';

import clsx from 'clsx';

import { useSnackbar, SnackbarContent, CustomContentProps } from 'notistack';

import { useTheme } from '@mui/material/styles';
import { Collapse } from '@mui/material';
import { Typography } from '@mui/material';
import { Card } from '@mui/material';
import { CardActions } from '@mui/material';
import { IconButton } from '@mui/material';

import { ErrorUtils, ExpectedError } from '@sheetxl/utils';
import { DynamicIcon } from '@sheetxl/utils-react';
import { StackTrace } from '@sheetxl/utils-mui';

import styles from './ToastError.module.css';

interface ToastErrorProps extends CustomContentProps {
  /**
   * If not provided just the error message will be displayed.
   */
  error?: Error;
}

const ToastError = memo(forwardRef<HTMLDivElement, ToastErrorProps>((props, ref) => {
    const {
      id,
      message,
      iconVariant,
      error: propError,
      hideIconVariant,
      ...rest
    } = props;
    const { closeSnackbar } = useSnackbar();
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const rootError = ErrorUtils.collectErrorChain(propError, true)?.[0]?.error;
    const isUnexpectedError = rootError && !(rootError instanceof ExpectedError);
    const handleExpandClick = useCallback(() => {
      setExpanded((oldExpanded) => !oldExpanded);
    }, []);

    const handleDismiss = useCallback(() => {
      closeSnackbar(id);
    }, [id, closeSnackbar]);

    // This is a bit wonky but notistack requires a message so we have it 2x
    let displayMessage: string | React.ReactNode = rootError?.message;
    if (!displayMessage && isValidElement(message)) {
      displayMessage = message as React.ReactNode;
    }
    if (!displayMessage && typeof message === 'string') {
      displayMessage = message;
    }
    if (!displayMessage) {
      displayMessage = `Unknown Error: ${message}`;
    }

    return (
      <SnackbarContent
        ref={ref} className={clsx(styles.root, 'error-snackbar')}
        // {...rest}
      >
        <Card
          className={styles.card}
          style={{
            backgroundColor: theme.palette.error.dark,
            border: `1px solid ${theme.palette.error.dark}`,
          }}
        >
          <CardActions className={styles.actionRoot}>
            {hideIconVariant ? null : iconVariant?.error}
            <Typography
              variant="body2"
              component="div"
              className={styles.typography}
            >
              {displayMessage}
            </Typography>
            <div
              style={{ flex: '1 1 auto' }}
            />
            <div className={styles.icons}>
              {isUnexpectedError ?
                <IconButton
                  aria-label="Show more"
                  size="small"
                  className={clsx(styles.expand, {
                    [styles.expandOpen]: expanded
                  })}
                  onClick={handleExpandClick}
                >
                <DynamicIcon iconKey="ExpandMore" />
                </IconButton>
              : null}
              <IconButton
                size="small"
                className={styles.expand}
                onClick={handleDismiss}
              >
                <DynamicIcon iconKey="Close" style={{transform: 'scale(0.8)'}} />
              </IconButton>
            </div>
          </CardActions>
          {isUnexpectedError ?
          <Collapse in={expanded} timeout="auto">
            <div
              className={styles.stackTraceContainer}
              style={{
                backgroundColor: theme.palette.error.light,
                borderTop: `1px solid ${theme.palette.error.main}`,
              }}
            >
              <StackTrace
                error={propError}
                hideLineNumbers={true}
              />
            </div>
          </Collapse>
          : null}
        </Card>
      </SnackbarContent>
    );
  }
));

ToastError.displayName = "ToastError";
export { ToastError };