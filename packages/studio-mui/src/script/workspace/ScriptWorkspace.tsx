/* cspell:ignore inmemory */
import React, {
  memo, forwardRef, useMemo, useState, useEffect, useRef, useCallback
} from 'react';

import clsx from 'clsx';

import { SxProps } from '@mui/system';
import { useTheme, Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { DialogTitle } from '@mui/material';
import { IconButton } from '@mui/material';
import { TouchRippleActions } from '@mui/material';

import { Close as CloseIcon } from '@mui/icons-material';

import {
  useImperativeElement, ICommands, useCallbackRef
} from '@sheetxl/utils-react';

import { IScript } from '@sheetxl/sdk';

import { LoadingPanel, ExhibitTooltip } from '@sheetxl/utils-mui';

import { ScriptEditorToolbar } from '../toolbar/ScriptEditorToolbar';

import { IScriptEditor, IScriptEditorElement, ScriptEditorProps } from '@sheetxl/react';

import { ScriptEditor } from '@sheetxl/react';

import { DirectoryFile } from '../utils/FetchDirectory';
import { TemplateSelectPanel } from '../components/TemplateSelectPanel';
/**
 * Move this to another project. Automation-Editor
 */
export interface ScriptWorkspaceProps extends React.HTMLAttributes<HTMLElement> {
 /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * The commands to use for the toolbar.
   */
  commands?: ICommands.IGroup;
  /**
   * If the values can be modified
   */
  readOnly?: boolean;
  /**
   * Called when the user request a close.
   */
  onClose?: () => void;
  /**
   * Allows for component to be autoFocused.
   * @remarks
   * If a string is provided this will be used as a querySelector to find the initial focusable component.
   */
  autoFocusSel?: string;
  /**
   * Props to pass to the editor.
   */
  editorProps?: ScriptEditorProps;
  /**
   * The script module to interact with.
   */
  scripts: IScript;
}


export interface ScriptWorkspaceAttributes {
  isScriptWorkspaceElement: () => true;
}
/**
 * Type returned via ref property
 */
export interface IScriptWorkspaceElement extends ScriptWorkspaceAttributes, HTMLElement {};

export type ScriptWorkspaceAttribute = {
  ref?: React.Ref<IScriptWorkspaceElement>;
};

/**
 * This tracks the selection of the sheet and
 * updates the a named range editor and a sheet cell editor.
 */
const ScriptWorkspace: React.FC<ScriptWorkspaceProps & ScriptWorkspaceAttribute> = memo(
  forwardRef<IScriptWorkspaceElement, ScriptWorkspaceProps>((props, refForwarded) => {
  const {
    className: propClassName,
    sx: propSx,
    editorProps,
    commands,
    readOnly = false,
    onClose: propOnClose,
    autoFocusSel,
    autoFocus = true,
    scripts,
    ...rest
  } = props;

  // const disabled = propDisabled || protection !== null;
  const theme = useTheme();

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const refHasFocus = useRef<boolean>(false);

  const [status, setStatus] = useState<any>({
    message: 'Loading',
    cursor: '',
    dirty: false
  });

  const [initialSource, setInitialSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setInitialSource(null);
    async function loadInitialSource() {
      if (scripts) {
        await scripts.start();
        if (!cancelled) {
          const source = scripts.getModules().getItems()[0]?.getSource();
          setInitialSource({
            source: source ? source : null
          });
        }
      }
    }
    loadInitialSource();
    return () => { cancelled = true; };
  }, [scripts]);

  const onStatusChange = useCallback((status: IScriptEditor.Status) => {
    setStatus((prev: any) => {
      return {
        ...prev,
        ...status
      }
    });
  }, []);

  const refRipple = useRef<TouchRippleActions>(null);
  const refScriptEditor = useRef<IScriptEditorElement>(null);

  const [lastFocus, setLastFocus] = useState<HTMLElement>(null);
  const relatedFocus = useRef<HTMLElement>(null);
  const doFocus = useCallbackRef((options?: FocusOptions): boolean => {
    if (lastFocus) {
      lastFocus.focus(options);
      return true;
    }

    if (autoFocusSel) {
      const autoFocus = refScriptEditor.current?.querySelectorAll?.(autoFocusSel);
      if (autoFocus && autoFocus.length > 0) {
        (autoFocus[0] as any)?.focus?.(options);
        return true;
      }
    }
    refScriptEditor.current?.focus?.(options);
    return false;
  }, [lastFocus, autoFocusSel, autoFocus]);

  const loadingPanel = useMemo(() => {
    return (
      <LoadingPanel
        transitionDelay='160ms'
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%'
        }}
        transparentBackground={false}
      />
    )
  }, []);

  const toolbar = useMemo(() => {
    return (
      <Paper
        elevation={1}
        tabIndex={0}
        sx={{
          display:'flex',
          alignItems: 'center',
          userSelect: 'none',
          flexGrow: 1,
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          marginLeft: (theme: Theme) => { return theme.spacing(0.5) },
          marginRight: (theme: Theme) => { return theme.spacing(0.5) },
          marginTop: (theme: Theme) => { return theme.spacing(1) },
          marginBottom: (theme: Theme) => { return theme.spacing(1) }
        }}
      >
        <ScriptEditorToolbar
          commands={commands}
        />
      </Paper>
    )
  }, [theme, commands]);

  const statusBar = useMemo(() => {
    return (<Box
      className={clsx('script-status-panel','status-panel')}
      sx={{
        display: "flex",
        alignItems: "stretch",
        flexDirection: "row",
        flex: "0",
        paddingLeft: "12px",
        paddingRight: "12px",
        gap: '8px',
        paddingTop: '1px',
        minHeight: "calc(1em + 8px)",
        margin: 0,
        borderTop: `solid 1px ${theme.palette.divider}`
      }}
    >
      <div
        style={{
          flex: "1 1 100%",
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center'
        }}
      >
        <Typography
          component="div"
          sx={{
            userSelect: 'none',
            whiteSpace: 'pre',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: '1 1 100%',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          variant="caption"
        >
          {status.message}
        </Typography>
        <Typography
          component="div"
          sx={{
            userSelect: 'none',
            whiteSpace: 'pre',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 'none',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          variant="caption"
        >
          {status.dirty ? 'Unsaved' : ''}
        </Typography>
        <Typography
          component="div"
          sx={{
            userSelect: 'none',
            whiteSpace: 'pre',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 'none',
            marginLeft: '8px',
            minWidth: '90px',
            display: 'flex',
            justifyContent: 'end',
            color: (theme: Theme) => theme.palette.text.secondary,
          }}
          variant="caption"
        >
          {status.cursor}
        </Typography>
      </div>
    </Box>
    );
  }, [status]);

  // toolbar, editor, status
  const editorPane = useMemo(() => {
    return (
      <Box
        className={clsx('script-editor-content')}
        sx={{
          display: 'flex',
          flex: '1 1 100%',
          width: '100%',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {toolbar}
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 100%',
            width: '100%',
            flexDirection: 'row',
            position: 'relative',
            boxSizing: 'border-box'
          }}
        >
          <ScriptEditor
            ref={refScriptEditor}
            loadingPanel={loadingPanel}
            readOnly={readOnly}
            onClose={propOnClose}
            autoFocus={autoFocus}
            commands={commands}
            onStatusChange={onStatusChange}
            darkMode={theme.palette.mode === 'dark'}
            {...editorProps}
          />
        </Box>
        {statusBar}
      </Box>
    )
  }, [theme, commands, toolbar, statusBar, hasFocus, loadingPanel, readOnly, editorProps, autoFocus, autoFocusSel, propOnClose, onStatusChange]);

  const titleBar = useMemo(() => {
    return (
      <DialogTitle
        className={clsx({
          ['Mui-selected']: refHasFocus.current
        })}
        sx={{
          display: 'flex',
          color: (theme: Theme) => theme.palette.text.secondary,
          boxSizing: 'border-box',
          padding: '0 0', // measure is not honoring border-box directive so we moved the paddings to the children
          transitionProperty: 'opacity',
          transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest}ms`, // should also use leaving screen with a second class
          opacity: 0.7,
          '&.Mui-selected': {
            opacity: 1,
            transitionDuration: (theme: Theme) => `${theme.transitions.duration.shortest / 2}ms`, // should also use leaving screen with a second class
          },
          backgroundColor: (theme: Theme) => {
            return alpha(theme.palette.action.hover, 0.03);
          },
          borderBottom: (theme: Theme) => { // same as toolbar
            return `solid ${alpha(theme.palette.divider, 0.2)} 1px`
          }
        }}
        onPointerDown={(e: React.PointerEvent<any>) => {
          if (e.isDefaultPrevented()) return;
          e.preventDefault();
          doFocus();
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 10%',
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: (theme: Theme) => theme.spacing(0.25),
            marginBottom: (theme: Theme) => theme.spacing(0.25),
            marginLeft: (theme: Theme) => theme.spacing(1),
            marginRight: (theme: Theme) => theme.spacing(1),
          }}
        >
          <Box
            sx={{
              flex: '1 1 100%',
              paddingLeft: (theme: Theme) => theme.spacing(1),
            }}
          >
            Script (Typescript)
          </Box>
          <ExhibitTooltip
            label={"Close"}
          >
            <IconButton
              aria-label="close"
              sx={{
                color: (theme: Theme) => {
                  return ((theme.palette.text as any).icon ?? theme.palette.action.active);
                }
              }}
              touchRippleRef={refRipple}
              onPointerDown={(e) => {
                refRipple.current?.start(e, {
                  center: false
                });
                e.stopPropagation();
                e.preventDefault();
              }}
              onPointerUp={() => {
                refScriptEditor.current?.close();
              }}
            >
              <CloseIcon/>
            </IconButton>
          </ExhibitTooltip>
        </Box>
      </DialogTitle>
    )
  }, [theme, hasFocus]);

  const scriptWorkspace = useMemo(() => {
    let welcome:React.ReactNode;
    if (initialSource === null) {
      return null;//loadingPanel;
    } else if (initialSource.source === null) {
      welcome = (
        <TemplateSelectPanel
          sx={{
            display: 'flex',
            flex: '1 1 100%',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'absolute',
            boxSizing: 'border-box',
            width: '100%',
            height: '100%'
          }}
          onScriptSelect={(file: DirectoryFile) => {
            // console.log('onScriptSelect', refScriptEditor.current, refScriptEditor.current?.getEditor());
            refScriptEditor.current?.getEditor().insertSnippet(file.content);
            setInitialSource({ source : file.content ?? '' });
          }}
        />
      );
    }
    return (
      <Box
        tabIndex={0}
        className={clsx('script-workspace', propClassName)}
        sx={{
          display:'flex',
          flex: '1 1 100%',
          flexDirection: 'column',
          overflow: 'hidden',
          alignItems: 'stretch',
          userSelect: 'none',
          flexGrow: 0,
          outline: 'none',
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          // border: (theme: Theme) => {
          //   return `solid ${(!disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled)} 1px`
          // }
        }}
        onPointerDown={(e) => {
          if (!e.isDefaultPrevented()) {
            refScriptEditor.current?.focus();
          }
        }}
      >
        {titleBar}
        <Box
          sx={{
            flex: '1 1 100%',
            position: 'relative',
            display: 'flex'
          }}
        >
          {editorPane}
          {welcome}
        </Box>
      </Box>
    )
  }, [toolbar, editorPane, propClassName, initialSource]);

  const refLocal = useImperativeElement<IScriptWorkspaceElement, ScriptWorkspaceAttributes>(refForwarded, () => ({
    isScriptWorkspaceElement: () => true,
    focus: (options?: FocusOptions) => {
      doFocus(options);
    }
  }), []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flex: "1 1 100%",
        position: 'relative',
        ...propSx
      }}
      ref={refLocal}
      {...rest}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        setHasFocus(true)
        refHasFocus.current = true;
        if (refLocal.current?.contains(e.target) && e.target !== refLocal.current) {
          setLastFocus(e.target);
        }
        if (e.relatedTarget && !relatedFocus.current) {
          relatedFocus.current = e.relatedTarget as HTMLElement;
        }
        rest?.onFocus?.(e);
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        if (!(refLocal?.current?.contains(e.relatedTarget) || refLocal?.current === e.relatedTarget)) {
          relatedFocus.current = null;
          // The FocusTrap react component doesn't expose the FocusTrap instance type
          // (refFocusTrap.current as any)?.focusTrap?.pause();
          refHasFocus.current = false;
          setHasFocus(false);
        }
        rest?.onBlur?.(e);
      }}
    >
      {scriptWorkspace}
    </Box>
    );
  })
);

ScriptWorkspace.displayName = "ScriptWorkspace";
export { ScriptWorkspace };