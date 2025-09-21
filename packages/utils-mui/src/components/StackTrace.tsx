import React, { useState, memo } from 'react';

import { type Theme } from '@mui/material/styles';

import { Box, Typography, IconButton } from '@mui/material';

import { DynamicIcon } from '@sheetxl/utils-react';

export interface StackTraceProps {
  /**
   * The error object containing the stack trace.
   */
  error: Error;
  /**
   * Maximum number of stack trace lines to show.
   *
   * If not provided, all lines will be shown.
   */
  maxLines?: number;
  /**
   * Whether to show line numbers
   */
  hideLineNumbers?: boolean;
}

/* ------------------------------------------------------------------ *
 * 1.  Regexes – capture optional modifier + two Chrome shapes
 * ------------------------------------------------------------------ */
const reWithParen = /^\s*at\s+(?:(async|new|await)\s+)?(.+?)\s+\((.+?):(\d+):(\d+)\)$/;
const reNoParen   = /^\s*at\s+(?:(async|new|await)\s+)?(.+?):(\d+):(\d+)\s*$/;

const cleanPath = (raw: string): string => {
  if (!raw) return '';

  // If it parses as URL → drop origin & search/hash
  try { raw = new URL(raw).pathname; } catch {/* not absolute URL */}

  raw = raw.replace(/^\/+/, '');          // leading slash from URL
  raw = raw.replace(/^@?fs[\\/]/, '');    // vite’s virtual fs prefix
  return raw;
};

type Frame = {
  line: string;            // what you show in the UI
  location?: string;       // longer path (italic sub-line)
  isBoundary?: boolean;    // for error separators
};

const parseStack = (stackText: string): Frame[] => {
  return stackText.split('\n').filter(Boolean).map((rawLine) => {
    /* ----- Chrome / Node / Edge: “at … (file:line:col)” ------------- */
    let m = rawLine.match(reWithParen);
    if (m) {
      const [, mod = '', method, file, ln, col] = m;
      const cleaned   = cleanPath(file);
      const filename  = cleaned.split(/[\\/]/).pop();
      return {
        line     : `at ${mod ? mod + ' ' : ''}${method}`,
        location : `${filename}:${ln}:${col}`
      };
    }

    /* ----- Chrome (no method)  “at async file:line:col” ------------- */
    m = rawLine.match(reNoParen);
    if (m) {
      const [, mod = '', file, ln, col] = m;
      const cleaned  = cleanPath(file);
      const filename = cleaned.split(/[\\/]/).pop();
      const shortLoc = `${filename}:${ln}:${col}`;
      return {
        line     : `at ${mod ? mod + ' ' : ''}${shortLoc}`,
        location : cleaned !== shortLoc ? `${cleaned}:${ln}:${col}` : undefined
      };
    }

    /* ----- Firefox or anything else – fall back to raw -------------- */
    return { line: rawLine.trim() };
  });
}


/**
 * Recursively collects all errors in the cause chain, deepest first
 */
const collectErrorChain = (error: Error): Array<{ error: Error; depth: number }> => {
  const errors: Array<{ error: Error; depth: number }> = [];

  const traverse = (currentError: Error, depth: number = 0) => {
    if (!currentError) return;

    // Add current error
    errors.push({ error: currentError, depth });

    // Recursively traverse cause chain
    if (currentError.cause && currentError.cause instanceof Error) {
      traverse(currentError.cause, depth + 1);
    }
  };

  traverse(error);

  // Return deepest first (reverse the array)
  return errors.reverse();
};

const StackTrace: React.FC<StackTraceProps> = memo(({
  error,
  maxLines = Number.MAX_SAFE_INTEGER,
  hideLineNumbers = false
}) => {
  const [displayText, setDisplayText] = useState<string | null>(null);

  if (!error?.stack) {
    return null;
  }

  // Collect the entire error chain (deepest cause first), then reverse to match Chrome (root last)
  const errorChain = collectErrorChain(error).reverse();

  const frames: Frame[] = [];
  errorChain.forEach(({ error: e }, idx) => {
    const part = parseStack(e.stack || '');
    if (!part.length) return;
    frames.push({ line: idx ? `Caused by: ${part[0].line}` : part[0].line, isBoundary: true });
    frames.push(...part.slice(1));
  });

  const displayLines = maxLines ? frames.slice(0, maxLines) : frames;
  const hasMore = maxLines && frames.length > maxLines;

  const handleCopy = async () => {
    try {
      // Build error chain text for clipboard, including 'Caused by:' prefix for non-root errors, using formatted location from parseStackTrace
      let errorLine = 0;
      const clipboardText = frames
          .map((frame: Frame) => {
            if (frame.isBoundary) {
              errorLine = 0;
              return frame.line;
            }
            errorLine++;

            const hasLocation = frame.location && frame.line !== frame.location;
            let body = hasLocation
                ? `${frame.line} (${frame.location})`
                : frame.line;
            if (errorLine >= 1) {
              body = `    ${body}`; // indent subsequent lines
            }
            return body;
          })
          .join('\n');
      await navigator.clipboard.writeText(clipboardText);
      setDisplayText(`Copied!`);
      setTimeout(() => setDisplayText(null), 2000);
    } catch (err) {
      setDisplayText(`Can't copy!`);
      console.warn('Failed to copy stack trace:', err);
    }
  };

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 1,
          px: 1,
          py: 0.5
        }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{
            fontSize: '0.75rem',
            opacity: 0.8
          }}
        >
          Stack Trace({errorChain.length > 1 ? ` (${errorChain.length} frames)` : ''})
        </Typography>
        <Box sx={{ flex: 1 }} />
        {displayText && (
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontSize: '0.625rem',
              opacity: 0.8
            }}
          >
            {displayText}
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{ color: 'inherit', opacity: 0.7, '&:hover': { opacity: 1 } }}
          title="Copy stack trace"
        >
          <DynamicIcon iconKey='ContentCopy' style={{ fontSize: '0.875rem' }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => {
            setDisplayText(`Logged!`);
            setTimeout(() => setDisplayText(null), 2000);
            console.log(error);
          }}
          sx={{ color: 'inherit', opacity: 0.7, '&:hover': { opacity: 1 } }}
          title="Log error to console"
        >
          <DynamicIcon iconKey='BugReport' style={{ fontSize: '0.875rem' }} />
        </IconButton>
      </Box>
      <Box
        sx={{
          mt: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 1,
          p: 1,
          maxHeight: '300px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.4
        }}
      >
        {displayLines.map((stackLine, index) => {
          // Render error boundary markers
          if (stackLine.isBoundary) {
            return (
              <Box
                key={`error-${index}`}
                sx={{
                  py: 1,
                  mt: index > 0 ? 1 : 0,
                  mb: 0.5,
                  borderTop: index > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                }}
              >
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: (theme: Theme) => {
                      return stackLine.isBoundary ? theme.palette.text.primary : theme.palette.text.secondary;
                    },
                    display: 'block'
                  }}
                >
                  {stackLine.line}
                </Typography>
              </Box>
            );
          }

          // Render regular stack trace lines
          return (
            <Box
              key={`stack-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                py: 0.25,
                pl: 1, // Indent stack lines slightly
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              {!hideLineNumbers && (
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    fontSize: '0.625rem',
                    opacity: 0.5,
                    minWidth: '20px',
                    textAlign: 'right',
                    userSelect: 'none'
                  }}
                >
                  {index + 1}
                </Typography>
              )}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'inherit'
                  }}
                >
                  {stackLine.line}
                </Typography>
                {/* Only show location if it exists and is not already the whole line (i.e., not the special Vite fs/ case) */}
                {stackLine.location && stackLine.line !== stackLine.location && (
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{
                      fontSize: '0.625rem',
                      opacity: 0.6,
                      fontStyle: 'italic'
                    }}
                  >
                    {stackLine.location}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
        {hasMore && (
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontSize: '0.625rem',
              opacity: 0.6,
              fontStyle: 'italic',
              textAlign: 'center',
              display: 'block',
              mt: 1
            }}
          >
            ... and {frames.length - maxLines} more frames
          </Typography>
        )}
      </Box>
    </Box>
  );
});

StackTrace.displayName = 'StackTrace';
export { StackTrace };