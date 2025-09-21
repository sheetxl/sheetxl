import React, { memo, forwardRef, useEffect, useState } from 'react';

import clsx from 'clsx';

import { Theme, SxProps } from '@mui/system';
import { alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box, Button, Typography } from '@mui/material';
// TODO - replace with ours
import { CircularProgress } from '@mui/material';

import { ChainedError } from '@sheetxl/utils';
import { ReactUtils, DynamicIcon } from '@sheetxl/utils-react';

import { fetchDirectory, DirectoryFile, DEFAULT_SCRIPT_PATH } from '../utils';

export interface TemplateSelectPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  /**
   * Path to fetch directory scripts from.
   */
  scriptPath?: string;
  /**
   * Called when a script button is clicked
   */
  onScriptSelect?: (file: DirectoryFile) => void;
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
const TemplateSelectPanel = memo(forwardRef<HTMLDivElement, TemplateSelectPanelProps>(
  (props: TemplateSelectPanelProps, refForwarded) => {
  const {
    scriptPath=DEFAULT_SCRIPT_PATH,
    onScriptSelect,
    sx: propSx = ReactUtils.EmptyCssProperties,
    className: propClassName,
    buttonMinWidth = 210,
    buttonMinHeight = 80,
    gap = 12,
    ...rest
  } = props;

  const [files, setFiles] = useState<DirectoryFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      const files: DirectoryFile[] = [{
        path: null,
        metadata: {
          title: 'Blank Template...',
          summary: 'Start with an empty script.'
        },
        content: ''
      }];
      try {
        setLoading(true);
        setError(null);
        const result = await fetchDirectory(scriptPath);
        // Filter out any null results (failed fetches)
        for (let i=0; i<result.length; i++) {
          const file = result[i];
          if (!file) continue;
          files.push(file);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scripts');
        if (!(err instanceof ChainedError)) {
          console.error('Error loading scripts:', err);
        }
      } finally {
        setFiles(files);
        setLoading(false);
      }
    };

    loadFiles();
  }, [scriptPath]);

  if (loading) {
    // TODO - use our loading panel
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
        className={clsx(propClassName, 'script-select')}
        sx={{
          background: (theme: Theme) => {
            return theme.palette.background.paper;
          },
          zIndex: 1000, // to ensure we sip above monaco scrolling
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          ...propSx
        }}
        {...rest}
      >
        <CircularProgress/>
      </Box>
    );
  }

  let errorNode: React.ReactNode = null;
  if (error) {
    errorNode = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        // height="100%"
        className={clsx(propClassName, 'script-select', 'error-results')}
        sx={{
          background: (theme: Theme) => theme.palette.error.light,
          flex: '0',
          zIndex: 1000, // to ensure we sip above monaco scrolling
          flexDirection: 'column',
          padding: theme => theme.spacing(1),
          border: (theme: Theme) => `1px solid ${theme.palette.error.main}`,
          // borderTopLeftRadius: 0,
          // borderTopRightRadius: 0,
          borderBottomLeftRadius: 1,
          borderBottomRightRadius: 1,
          // borderRadius: 1,
          // background: (theme: Theme) => {
          //   return theme.palette.background.paper;
          // },
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          // ...propSx
        }}
         {...rest}
      >
        <Typography color="error" variant="h6" component="div" gutterBottom>Error loading Templates</Typography>
        <Typography color="error" component="div">{error}</Typography>
      </Box>
    );
  }

  const icon = (file: DirectoryFile) => {
    const metaIcon = file.metadata?.icon;
    if (metaIcon === 'macro') {
      return <DynamicIcon iconKey="ScriptMacro" size="1em"/>;
    }
    if (metaIcon === 'formula') {
      return <DynamicIcon iconKey="ScriptFormula" size="1em"/>;
    }
    if (metaIcon === 'autostart') {
      return <DynamicIcon iconKey="ScriptAutoStart" size="1em"/>;
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
        backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
        ...propSx
      }}
       {...rest}
    >
      <Box p={3}
        className="script-select-content"
        sx={{
          overflow: 'auto',
          flex: '1 1 auto',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Script Template
        </Typography>
        <Typography
          variant="body2"
          component="div"
          color="text.secondary"
          gutterBottom
        >
          Choose from a template to provide a starting point to automate tasks or create user defined functions.
        </Typography>
        <Typography
          variant="body2"
          component="div"
          color="text.secondary"
          gutterBottom
        >
          Templates provide a foundation to customize and meet your specific needs.
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
                  {file.metadata?.title || file.path.split('/').pop()?.replace(/\.\w+$/, '') || 'Untitled'}
                </Typography>
                {icon(file)}
              </Box>
              {file.metadata?.summary && (
                <Typography
                  variant="body2"
                  component="div"
                  color="text.secondary"
                  sx={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    textOverflow: 'ellipsis',
                    alignItems: 'flex-start',
                  }}
                >
                  {file.metadata.summary}
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
export { TemplateSelectPanel };