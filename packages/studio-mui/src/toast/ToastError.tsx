import { useState, memo, forwardRef, useCallback, isValidElement } from 'react';

import clsx from 'clsx';

import { useSnackbar, SnackbarContent, type CustomContentProps } from 'notistack';

import { Collapse } from '@mui/material';
import { Typography } from '@mui/material';
import { Card } from '@mui/material';
import { CardActions } from '@mui/material';
import { IconButton } from '@mui/material';

import { ErrorUtils, ExpectedError } from '@sheetxl/utils';
import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';
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

    const t = useTranslator();
    const { closeSnackbar } = useSnackbar();
    const [expanded, setExpanded] = useState(false);

    const rootError = propError ? ErrorUtils.collectErrorChain(propError, true)?.[0]?.error : undefined;
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
            backgroundColor: 'var(--sxl-color-error)',
            color: 'var(--sxl-color-error-content)',
            border: `1px solid var(--sxl-color-error)`,
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
                  aria-label={t('toast.showMore')}
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
                // a faint error tint over the base surface (adapts per mode), accented by an error rule
                backgroundColor: 'color-mix(in srgb, var(--sxl-color-error) 90%, var(--sxl-color-base-100))',
                borderTop: `1px solid var(--sxl-color-error)`,
              }}
            >
              <StackTrace
                error={propError!}
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