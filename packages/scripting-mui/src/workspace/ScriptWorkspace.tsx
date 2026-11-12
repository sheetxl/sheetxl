/* cspell:ignore inmemory */
import type React from 'react';
import {
  memo, forwardRef, useMemo, useState, useEffect, useRef, useCallback
} from 'react';

import clsx from 'clsx';

import { type SxProps } from '@mui/system';
import { useTheme, type Theme } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Paper } from '@mui/material';

import {
  useImperativeElement, useCallbackRef
} from '@sheetxl/utils-react';

import { type IScript } from '@sheetxl/sdk';

import { AnimatedLoadingPanel } from '@sheetxl/utils-mui';

import { ScriptEditorToolbar } from '../toolbar/ScriptEditorToolbar';

import { type IFrame } from '@sheetxl/react';

import {
  ScriptEditor,
  type IScriptEditor, type IScriptEditorElement, type ScriptEditorProps
} from '@sheetxl/scripting-react';

import { type ScriptTemplate } from '../utils';
import { TemplateSelectPanel } from '../template/TemplateSelectPanel';

/**
 * Move this to another project. Automation-Editor
 */
export interface ScriptWorkspaceProps extends React.HTMLAttributes<HTMLElement> {
 /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
  /**
   * If the values can be modified
   */
  readOnly?: boolean;
  /**
   * Called before hiding the task pane.
   *
   * @remarks
   * If a promise is returned, the task pane will show a loading pane.
   */
  frame?: IFrame;
  /**
   * Allows for component to be autoFocused.
   * @remarks
   * If a string is provided this will be used as a querySelector to find the initial focusable component.
   */
  autoFocusSel?: string;
  /**
   * Props to pass to the editor.
   */
  propsScriptEditor?: ScriptEditorProps;
  /**
   * The script module to interact with.
   */
  scripts: IScript;
  /**
   * Reference to the component instance.
   */
  ref?: React.Ref<IScriptWorkspaceElement>;
}


export interface ScriptWorkspaceAttributes {
  isScriptWorkspaceElement: () => true;
}
/**
 * Type returned via ref property
 */
export interface IScriptWorkspaceElement extends ScriptWorkspaceAttributes, HTMLDivElement {};

/**
 * This tracks the selection of the sheet and
 * updates the a named range editor and a sheet cell editor.
 */
export const ScriptWorkspace = memo(forwardRef<IScriptWorkspaceElement, ScriptWorkspaceProps>(
  (props: ScriptWorkspaceProps, refForwarded) => {
  const {
    className: propClassName,
    sx: propSx,
    propsScriptEditor,
    readOnly = false,
    // onClose: propOnClose,
    frame,
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

  const [initialSource, setInitialSource] = useState<{ source: string | null } | null>(null);

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

  const onStatusChange = useCallback((status: Partial<IScriptEditor.Status>) => {
    setStatus((prev: any) => {
      return {
        ...prev,
        ...status
      }
    });
  }, []);

  const refScriptEditor = useRef<IScriptEditorElement>(null);

  const [lastFocus, setLastFocus] = useState<HTMLElement | null>(null);
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
      <AnimatedLoadingPanel
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
          // backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          marginLeft: (theme: Theme) => { return theme.spacing(0.5) },
          marginRight: (theme: Theme) => { return theme.spacing(0.5) },
          marginTop: (theme: Theme) => { return theme.spacing(1) },
          marginBottom: (theme: Theme) => { return theme.spacing(1) }
        }}
      >
        <ScriptEditorToolbar/>
      </Paper>
    )
  }, [theme]);

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
            frame={frame}
            scripts={scripts}
            autoFocus={autoFocus}
            onStatusChange={onStatusChange}
            darkMode={theme.palette.mode === 'dark'}
            {...propsScriptEditor}
          />
        </Box>
        {statusBar}
      </Box>
    )
  }, [theme, toolbar, statusBar, hasFocus, loadingPanel, readOnly, propsScriptEditor, autoFocus, autoFocusSel, frame, onStatusChange]);

  const scriptWorkspace = useMemo(() => {
    let welcome:React.ReactNode;
    if (initialSource === null) {
      return loadingPanel;
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
          disabled={readOnly}
          onScriptSelect={(file: ScriptTemplate) => {
            // console.log('onScriptSelect', refScriptEditor.current, refScriptEditor.current?.getEditor());
            refScriptEditor.current?.insertSnippet(file.content);
            setInitialSource({ source : file.content ?? '' });
            // The editor was `visibility:hidden` behind the template; selecting one flips it visible on
            // this state commit. A hidden element isn't focusable, so focus after the flip paints —
            // otherwise focus lands nowhere and the editor needs a second click.
            requestAnimationFrame(() => refScriptEditor.current?.focus());
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
          // backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
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
        <Box
          sx={{
            flex: '1 1 100%',
            position: 'relative',
            display: 'flex'
          }}
        >
          {/* Keep the editor mounted (its ref backs `onScriptSelect`'s `insertSnippet`) but hidden
              while the template shows — otherwise the toolbar paints behind the overlay and bleeds
              through during the template panel's own async load. */}
          <Box
            sx={{
              display: 'flex',
              flex: '1 1 100%',
              minWidth: 0,
              minHeight: 0,
              visibility: welcome ? 'hidden' : 'visible'
            }}
          >
            {editorPane}
          </Box>
          {welcome}
        </Box>
      </Box>
    )
  }, [toolbar, editorPane, propClassName, initialSource, loadingPanel, readOnly]);

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