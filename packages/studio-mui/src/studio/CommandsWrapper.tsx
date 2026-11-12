import type React from 'react';
import { useCallback, useMemo, memo, useRef, useState } from 'react';

import { type Theme, alpha } from '@mui/material';
import { Box, Paper } from '@mui/material';
import { Typography } from '@mui/material';

import { type IWorkbook } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, Command, DynamicIcon } from '@sheetxl/utils-react';

import { WorkbookIO, CommandRootProvider, type IWorkbookElement, type WorkbookElementProps } from '@sheetxl/react';


import { type IDocumentTitleElement } from '../workbook';

import { StudioCommandProvider } from './StudioCommandProvider';
import { type StudioIODeps } from './StudioCommands';
import { type StudioProps } from './StudioProps';

export interface CommandsWrapperProps extends Omit<StudioProps, 'workbook'> {
  /**
   * Render the workbook element
   *
   * @param props The properties for the workbook element.
   */
  renderWorkbook: (props: WorkbookElementProps) => React.ReactElement;

  /**
   * The studio tracker's initial command anchor (see {@link CommandRootProvider}): a recallable
   * {@link Command.DefaultAnchorProvider provider} returning the loaded grid's would-focus pane element —
   * invoked pre-reveal for cold-start and re-invoked when a resize destroys the anchored pane.
   */
  initialCommandAnchor?: Command.FocusActivationInitial;

  /**
   * The workbook
   */
  workbook: IWorkbook;
  setWorkbook: any;
  titleWorkbook: string | null;
  setWorkbookTitle: (newWorkbookTitle: string | null) => void;

  refDocumentTitle: React.RefObject<IDocumentTitleElement | null>;
  /** Live unsaved-changes probe (read at click time); drives close/open confirm. */
  isDirty: () => boolean;
  /** Receives the studio's Save, for `IStudioAttributes.save`. */
  refSave?: StudioIODeps['refSave'];
  /** The studio root element; the target of the fullscreen toggle. */
  host?: HTMLElement | null;
}

interface WorkbookDropZoneProps {
  renderWorkbook: (props: WorkbookElementProps) => React.ReactElement;
}

/**
 * The grid's drag/drop target. Rendered INSIDE {@link SheetCommandProvider} so its handlers can reach
 * the command resolver ({@link Command.useCommandResolver}) and dispatch `insertImageFromFile` /
 * `openWorkbook` from the active pane's anchor (both live on the root/sheet chain).
 */
/** What the drag in flight would do on drop; drives the overlay. */
type DropIntent = 'open' | 'insertImage';

const WorkbookDropZone = ({ renderWorkbook }: WorkbookDropZoneProps): React.ReactElement => {
  const resolver = Command.useCommandResolver();
  const refWorkbookElement = useRef<IWorkbookElement>(null);
  const t = useTranslator();

  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null);
  // handle drag events
  const handleDrag = useCallback((e: React.DragEvent<any>) => {
    const dataTransfer = e.dataTransfer;
    if (!resolver || !dataTransfer) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      const types = dataTransfer.types;
      const items = dataTransfer.items;
      let hasImage = false;
      for (let i=0; i<items.length; i++) {
        if (items[i].type.startsWith('image/')) { hasImage = true; break; }
      }
      // Note - drop will be supported at the sheet level soon. It will auto handle text types and provide a callback for files (to open or embed)
      if (hasImage) {
        setDropIntent('insertImage');
      } else if (types.includes('Files') && items.length > 0) {
        // TODO - use IO to check type
        setDropIntent('open');
      } else {
        // text/html + text/plain drops aren't supported yet. (1. convert to in-memory sheet (to find
        // shape). 2. Provide a drop target with shape on drag. 3. paste on drop)
        dataTransfer.effectAllowed = "none";
        dataTransfer.dropEffect = "none";
      }
    } else if (e.type === "dragleave") {
      // `dragleave` also fires when the pointer crosses between the grid's own children; only a
      // leave to OUTSIDE the drop zone (or out of the window, `relatedTarget` null) ends the drag.
      const related = e.relatedTarget as Node | null;
      if (!related || !e.currentTarget.contains(related)) setDropIntent(null);
    }
    e.preventDefault();
  }, [resolver]);

  // triggers when file is dropped
  const handleDrop = useCallbackRef((e: React.DragEvent<any>) => {
    // Always consumed: the browser's default for a dropped file is to NAVIGATE to it.
    e.preventDefault();
    const intent = dropIntent;
    setDropIntent(null);
    if (!intent || !resolver) return;
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file?.type?.startsWith("image/")) {
        const view = refWorkbookElement.current?.getSheetElement()?.getGridSurface().getPaneFromClient(e.clientX, e.clientY);
        if (!view) return;
        const point = view.getPanePointFromPointer(e.clientX, e.clientY);
        if (!point) return;
        // TODO - would be nice if view had a getAbsoluteBoundsFromClient method
        const pointAbs = view.toAbsoluteBounds({
          x: point.x ?? 0,
          y: point.y ?? 0,
          width: 0,
          height: 0,
        });
        resolver.execute('insertImageFromFile', {
          file,
          options: {
            bounds: {
              x: pointAbs.x,
              y: pointAbs.y
            }
          }
        });
      } else {
        // Dropping a workbook file replaces the current one via `openWorkbook`. Skip when the active
        // backing store can't read (e.g. a VS Code host owns open) so we don't orphan its document.
        if (!WorkbookIO.canRead()) return;
        // Try to capture a File System Access handle from the drop (Chromium) so the opened
        // workbook can be saved back to the dropped file. getAsFileSystemHandle() must be called
        // synchronously during the event; we then open with the handle, or the File as a fallback.
        // SECURE CONTEXTS ONLY: on an insecure origin (plain http on a LAN address) Chromium still
        // exposes the method, but the browser process rejects the request as a bad IPC message and
        // kills the renderer ("Aw, Snap!", RESULT_CODE_KILLED_BAD_MESSAGE) — nothing can catch it.
        const item = e.dataTransfer.items?.[0];
        const handlePromise: Promise<any> | undefined = (typeof window !== 'undefined' && window.isSecureContext)
          ? (item as any)?.getAsFileSystemHandle?.()
          : undefined;
        if (handlePromise) {
          handlePromise
            .then((handle: any) => resolver.execute('openWorkbook', handle?.kind === 'file' ? handle : file))
            .catch(() => resolver.execute('openWorkbook', file));
        } else {
          resolver.execute('openWorkbook', file);
        }
      }
    }
  }, [resolver, dropIntent]);

  const dropOverlay = useMemo(() => {
    if (!dropIntent) return null;
    const isImage = dropIntent === 'insertImage';
    return (
      <Box
        className="drop-overlay"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          // A faint brand TINT rather than a neutral wash: a translucent gray lightens a dark grid
          // and darkens a light toolbar, so the same overlay read as "inverted" across surfaces.
          backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.46),
          // Inset dashed ring. `outline` (not `border`) so it never participates in layout.
          outline: (theme: Theme) => `2px dashed ${theme.palette.primary.main}`,
          outlineOffset: '-6px',
          borderRadius: 2
        }}
      >
        <Paper
          elevation={6}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2,
            borderRadius: 2,
            color: 'text.primary',
            // backgroundColor: (theme: Theme) => alpha(theme.palette.background.paper, 0.9),
            '& .drop-overlay-icon': { color: 'primary.main' }
          }}
        >
          <DynamicIcon iconKey={isImage ? 'InsertImage' : 'FileOpen'} className="drop-overlay-icon" size={32} />
          <Typography variant="h6" component="span">
            {isImage ? t('drop.insertImage') : t('drop.open')}
          </Typography>
        </Paper>
      </Box>
    )
  }, [dropIntent, t]);

  const propsWorkbook: WorkbookElementProps = {
    ref: refWorkbookElement,
    onDragStart: (e: React.DragEvent<any>) => {
      // TODO - dragging an image from the sheet causes a duplicate but should share the resource.
      // We want the pointer at the top/left
      if ((e.target as any).src) {
        const img = new Image();
        img.src = (e.target as any).src;
        e.dataTransfer.setDragImage(img, 1, 1);
      }
    },
    onDragEnter: handleDrag,
    onDragLeave: handleDrag,
    onDragOver: handleDrag,
    onDrop: handleDrop
  }

  return (<>
    {renderWorkbook(propsWorkbook)}
    {dropOverlay}
  </>);
};

/**
 * Because snackbar is configured using a context provider we have to create
 * an intermediary component to retrieve and wrap the notifier (and commands)
 */
export const CommandsWrapper: React.FC<CommandsWrapperProps> = memo(
  (props: CommandsWrapperProps) => {
  const {
    workbook,
    setWorkbook,
    refDocumentTitle,
    titleWorkbook,
    setWorkbookTitle,
    // children,
    isDirty,
    initialCommandAnchor,
    renderWorkbook,
    refSave,
    host
  } = props;

  // The shared command root (registry + app scope + trackers + resolvers). The per-workbook + per-sheet
  // scopes — and the editor/movable pane-layer leaves + the formula bar's own editor leaf — live down inside
  // `WorkbookElement` / the formula bar; no shared `editor` scope is seated here anymore.
  return (
  <CommandRootProvider initialAnchor={initialCommandAnchor}>
  <StudioCommandProvider
    workbook={workbook}
    setWorkbook={setWorkbook}
    workbookTitle={titleWorkbook}
    isDirty={isDirty}
    refSave={refSave}
    fullscreenTarget={host}
  >
    <WorkbookDropZone renderWorkbook={renderWorkbook} />
  </StudioCommandProvider>
  </CommandRootProvider>)
});

CommandsWrapper.displayName = "CommandsWrapper";
