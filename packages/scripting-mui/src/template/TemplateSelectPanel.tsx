import type React from 'react';
import { memo, forwardRef, useEffect, useState } from 'react';

import clsx from 'clsx';

import { type SxProps, type Theme, alpha } from '@mui/system';
import { Box, Button, Typography } from '@mui/material';
// TODO - replace with ours
import { CircularProgress } from '@mui/material';

import { ReactUtils, DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { loadScriptTemplates, type ScriptTemplate, DEFAULT_SCRIPT_PATH } from '../utils';
import { registerScriptingMuiLocales } from '../locales';

// Module-init so this package's `messages.json` slice is registered before first render.
registerScriptingMuiLocales();

export interface TemplateSelectPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * The script templates to read: a URL that serves `templates-scripting/contents.json`.
   * @defaultValue {@link DEFAULT_SCRIPT_PATH}
   */
  scriptPath?: string;
  /**
   * Called when a script button is clicked
   */
  onScriptSelect?: (file: ScriptTemplate) => void;
  /**
   * Disables every template, for scripts that cannot be changed.
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Button minimum width in pixels
   * @default 210
   */
  buttonMinWidth?: number;
  /**
   * Button minimum height in pixels
   * @default 80
   */
  buttonMinHeight?: number;
  /**
   * Gap between buttons in pixels
   * @default 12
   */
  gap?: number;
}

/**
 * Panel displaying script buttons from a directory
 */
export const TemplateSelectPanel = memo(forwardRef<HTMLDivElement, TemplateSelectPanelProps>(
  (props: TemplateSelectPanelProps, refForwarded) => {
  const {
    scriptPath=DEFAULT_SCRIPT_PATH,
    onScriptSelect,
    disabled = false,
    sx: propSx = ReactUtils.EmptyCssProperties,
    className: propClassName,
    buttonMinWidth = 210,
    buttonMinHeight = 80,
    gap = 12,
    ...rest
  } = props;

  const t = useTranslator();
  const [files, setFiles] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const blank: ScriptTemplate = {
      path: null,
      title: t('templateSelect.blankTitle'),
      summary: t('templateSelect.blankSummary'),
      content: ''
    };
    setLoading(true);
    setError(null);
    // An offline app is expected to land here: the panel says so and still offers the blank template.
    loadScriptTemplates(scriptPath).then(
      (templates) => { if (!cancelled) setFiles([blank, ...templates]); },
      (err: unknown) => {
        if (cancelled) return;
        setFiles([blank]);
        setError(err instanceof Error ? err.message : t('templateSelect.loadFailed'));
      }
    ).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `t` — the blank entry's title/summary are baked into state, so a language switch must rebuild.
    // `attempt` — a failed catalog is not cached, so bumping it reloads.
  }, [scriptPath, t, attempt]);

  if (loading) {
    // TODO - use our loading panel
    return (
      <Box
        className={clsx(propClassName, 'script-select')}
        {...rest}
        sx={[{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",

          background: (theme: Theme) => {
            return theme.palette.background.paper;
          },

          // to ensure we stack above monaco scrollbar
          zIndex: 1000,

          ...(Array.isArray(propSx) ? {} : propSx)
        }, ...(Array.isArray(propSx) ? propSx : [])]}>
        <CircularProgress/>
      </Box>
    );
  }

  let errorNode: React.ReactNode = null;
  if (error) {
    errorNode = (
      <Box
        className="error-results"
        sx={{
          display: "flex",
          flexDirection: 'column',
          alignItems: "center",
          flex: 'none',
          gap: 0.5,
          padding: 1.5,
          background: (theme: Theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.16 : 0.06),
          borderTop: (theme: Theme) => `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
        }}>
        <Typography color="error" variant="subtitle1" component="div">{t('templateSelect.errorTitle')}</Typography>
        <Typography variant="body2" component="div" sx={{ color: 'text.secondary', textAlign: 'center' }}>{error}</Typography>
        <Button size="small" color="error" onClick={() => setAttempt((prev) => prev + 1)}>
          {t('templateSelect.retry')}
        </Button>
      </Box>
    );
  }

  const icon = (file: ScriptTemplate) => {
    const metaIcon = file.icon;
    if (metaIcon === 'macro') {
      return <DynamicIcon iconKey="ScriptMacro" size="1em"/>;
    }
    if (metaIcon === 'formula') {
      return <DynamicIcon iconKey="ScriptFormula" size="1em"/>;
    }
    if (metaIcon === 'autostart') {
      return <DynamicIcon iconKey="ScriptAutoRun" size="1em"/>;
    }
    return null;
  }

  return (
    <Box
      ref={refForwarded}
      className={clsx(propClassName, 'script-select')}
      sx={{
        background: (theme: Theme) => {
          return theme.palette.background.paper;
        },
        zIndex: 1000, // to ensure we sip above monaco scrolling
        ...propSx
      }}
       {...rest}
    >
      <Box
        className="script-select-content"
        sx={{
          p: 3,
          overflow: 'auto',
          flex: '1 1 auto'
        }}>
        <Typography variant="h6" gutterBottom>
          {t('templateSelect.title')}
        </Typography>
        <Typography
          variant="body2"
          component="div"
          gutterBottom
          sx={{
            color: "text.secondary"
          }}
        >
          {t('templateSelect.intro')}
        </Typography>
        <Typography
          variant="body2"
          component="div"
          gutterBottom
          sx={{
            color: "text.secondary"
          }}
        >
          {t('templateSelect.intro2')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${buttonMinWidth}px, 1fr))`,
            gap: `${gap}px`,
            padding: 2,
            paddingLeft: '0px',
            paddingRight: '0px',
          }}
        >
          {files.map((file, index) => (
            <Button
              key={`${file.path}-${index}`}
              variant="outlined"
              disabled={disabled}
              sx={{
                minWidth: buttonMinWidth,
                minHeight: buttonMinHeight,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: 2,
                textTransform: 'none',
                overflow: 'hidden',
                // If it's the first item (blank template), add special styling
                ...(index === 0 && {
                  borderStyle: 'dashed',
                  marginBottom: '8px',
                }),
                ...(index === 1 && {
                  gridColumn: '1',
                  // bgcolor: (theme) => alpha(theme.palette.background.default, 0.6),
                }),
              }}
              onClick={() => onScriptSelect?.(file)}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  marginBottom: 0.50,
                }}
              >
                <Typography
                  variant="subtitle2"
                  component="div"
                >
                  {file.title || t('templateSelect.untitled')}
                </Typography>
                {icon(file)}
              </Box>
              {file.summary && (
                <Typography
                  variant="body2"
                  component="div"
                  sx={{
                    color: "text.secondary",
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    textOverflow: 'ellipsis',
                    alignItems: 'flex-start'
                  }}>
                  {file.summary}
                </Typography>
              )}
            </Button>
          ))}
        </Box>
      </Box>
      {errorNode}
    </Box>
  );
}));

TemplateSelectPanel.displayName = "TemplateSelectPanel";