import React, {
  useCallback, useMemo, memo
} from 'react';

import { UndoManager } from '@sheetxl/utils';

import { IWorkbook } from '@sheetxl/sdk';

import { ICommands } from '@sheetxl/utils-react';

import type { WorkbookElementProps, IWorkbookTitleElement } from '../components/workbook';

import { HelpCommandButton } from '../command';
import { useStudioCommands } from './useStudioCommands';

import type { StudioProps } from './StudioProps';

export interface CommandsWrapperProps extends StudioProps {

  children: React.ReactElement<any, string | React.JSXElementConstructor<any>>;

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
export const CommandsWrapper: React.FC<CommandsWrapperProps> =
  memo((props: CommandsWrapperProps) => {
  const {
    workbook,
    setWorkbook,
    refWorkbookTitle,
    titleWorkbook,
    setWorkbookTitle,
    titlePlaceHolder,
    children,
    undoManager,
    commands: commandsParent,
    importExportDisabled,
    themeOptions,
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
        buttonProps={{
          sx: {
            maxHeight: '22px', // make smaller to fit into statusbar
          }
        }}
      />
    )
  }, [commandsStudio]);

  const propsWorkbook: WorkbookElementProps & { ref?: React.Ref<HTMLDivElement> } = {
    // ref,
    commands: commandsStudio
  }
  if (workbook) {
    propsWorkbook.statusBarProps = {
      childrenEnd: helpCommandPopup
    }
  }
  return children ? React.cloneElement(children, propsWorkbook) : null;
});

CommandsWrapper.displayName = "CommandsWrapper";