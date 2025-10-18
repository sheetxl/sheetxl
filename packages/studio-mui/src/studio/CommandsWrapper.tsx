import React, { useCallback, useMemo, memo } from 'react';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { UndoManager } from '@sheetxl/utils';

import type { IWorkbook } from '@sheetxl/sdk';

import { type ICommands, type ICommand, useCallbackRef } from '@sheetxl/utils-react';

import type { IWorkbookElement, WorkbookElementProps, IWorkbookTitleElement } from '../components/workbook';

import { HelpCommandButton } from '../command';
import { useStudioCommands } from './useStudioCommands';

import type { StudioProps } from './StudioProps';

export interface CommandsWrapperProps extends StudioProps {
  /**
   * Render the workbook element
   *
   * @param props The properties for the workbook element.
   */
  renderWorkbook: (props: WorkbookElementProps) => React.ReactElement;

  /**
   * The workbook
   */
  workbook: IWorkbook;
  setWorkbook: any;
  importExportDisabled: boolean;
  titleWorkbook: string | null;
  setWorkbookTitle: (newWorkbookTitle: string | null) => void;
  titlePlaceHolder: string;

  undoManager: UndoManager;
  refWorkbookTitle: React.RefObject<IWorkbookTitleElement>;

  commands: ICommands.IGroup;
}

/**
 * Because snackbar is configured using a context provider we have to create
 * an intermediary component to retrieve and wrap the notifier (and commands)
 */
export const CommandsWrapper: React.FC<CommandsWrapperProps> = memo(
  (props: CommandsWrapperProps) => {
  const {
    workbook,
    setWorkbook,
    refWorkbookTitle,
    titleWorkbook,
    setWorkbookTitle,
    titlePlaceHolder,
    // children,
    undoManager,
    commands: commandsParent,
    importExportDisabled,
    themeOptions,
    renderWorkbook
  } = props;

  const onExecute = useCallback(() => {
    // refSheet.current.focus();
  }, []);

  const commandsStudio = useStudioCommands({
    workbook,
    setWorkbook,
    importExportDisabled,
    workbookTitle: titleWorkbook,
    setWorkbookTitle: setWorkbookTitle,
    commands: commandsParent,
    requestWorkbookTitle: (requestReason: string): Promise<string | null> => {
      return new Promise<string | null>((resolve) => {
        if (refWorkbookTitle.current) {
          refWorkbookTitle.current.requestWorkbookTitle((workbookTitle: string, _commitReason: string) => {
            resolve(workbookTitle);
          }, { selectAll: true, requestReason });
        } else {
          resolve(titlePlaceHolder);
        }
      });
    },
    themeOptions,
    undoManager,
    onExecute
  });

  const helpCommandPopup = useMemo(() => {
    return (
      <HelpCommandButton
        commands={commandsStudio}
        disableHover={true}
        sx={{
          padding: '0',
        }}
        propsButton={{
          sx: {
            maxHeight: '22px', // make smaller to fit into statusbar
          }
        }}
      />
    )
  }, [commandsStudio]);

  const [drag, setDrag] = React.useState<{ item: DataTransferItem, text: string }>(null);
  // handle drag events
  const handleDrag = useCallback((e: React.DragEvent<any>) => {
    const dataTransfer = e.dataTransfer;
    if (!commandsStudio?.getCommand('openWorkbook') || !dataTransfer) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      const getItem = (type: string): DataTransferItem => {
        const items = dataTransfer.items;
        const itemsLength = items.length;
        for (let i=0; i<itemsLength; i++) {
          const item = items[i];
          if (item.type.startsWith(type)) return item;
        }
        return null;
      }
      let item: DataTransferItem = null;
      // Note - drop will be supported at the sheet level soon. If will auto handle text types and provide a callback for files (to open or embed)
      item = getItem('image/');
      const types = dataTransfer.types;
      const items = dataTransfer.items;
      if (item) {
        setDrag({ item, text: '' });
      } else if (types.includes('Files') && items.length > 0) {
        // TODO - use IO to check type
        setDrag({ item: items[0], text: 'Drop to open' });
        // e.dataTransfer.dropEffect = "copy";
      } else if (types.includes('text/html') || types.includes('text/plain')) {
        setDrag({ item: items[0], text: '' });
        // Behavior needs to. (1. convert to in-memory sheet (to find shape). 2. Provide a drop target with shape on drag. 3. paste on drop)
        //setDragText(`Drop to paste`);
        //e.dataTransfer.effectAllowed = "copy";
        dataTransfer.effectAllowed = "none";
        dataTransfer.dropEffect = "none";
      } else {
        dataTransfer.effectAllowed = "none";
        dataTransfer.dropEffect = "none";
      }
    } else if (e.type === "dragleave") {
      setDrag(null);
    }
    e.preventDefault();
  }, [commandsStudio]);

  const refWorkbookElement = React.useRef<IWorkbookElement>(null);

  // triggers when file is dropped
  const handleDrop = useCallbackRef((e: React.DragEvent<any>) => {
    if (!drag || !commandsStudio) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (file?.type?.startsWith("image/")) {
        const view = refWorkbookElement.current?.getSheetElement()?.getGridElement().getViewFromClient(e.clientX, e.clientY);
        if (!view) return;
        const point = view.getRelativePointFromClient(e.clientX, e.clientY);
        // TODO - would be nice if view had a getAbsoluteBoundsFromClient method
        const pointAbs = view.toAbsoluteBounds({
          ...point,
          width: 0,
          height: 0,
        });
        const coords = view.getCellCoordsFromClient(e.clientX, e.clientY);
        commandsStudio.getCommand('insertImageFromFile')?.execute({
          file,
          options: {
            bounds: {
              x: pointAbs.x,
              y: pointAbs.y
            }
          },
          goto: {
            range: {
              ...coords
            }
          }
        });
      } else {
        commandsStudio.getCommand('openWorkbook')?.execute(file);
      }
    }
  }, [commandsStudio, drag]);

  const dropOverlay = useMemo(() => {
    if (!drag || !drag.text) return null;
    return (
      <Box
        sx={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: (theme: Theme) => {
            return theme.palette.divider;
          },
          color: (theme: Theme) => {
            return theme.palette.primary.dark;
          }
        }}
      >
        <Typography variant="h4">
          {drag.text}
        </Typography>
      </Box>
    )
  }, [drag]);

  const propsWorkbook: WorkbookElementProps = {
    ref: refWorkbookElement,
    commands: commandsStudio,
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
  if (workbook) {
    propsWorkbook.propsStatusBar = {
      childrenEnd: helpCommandPopup
    }
  }

  let retValue = renderWorkbook(propsWorkbook);
  if (!dropOverlay) return retValue

  return (<>
    {retValue}
    {dropOverlay}
  </>)
});

CommandsWrapper.displayName = "CommandsWrapper";