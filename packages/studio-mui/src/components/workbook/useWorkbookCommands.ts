import React, {
  useMemo, useState, useEffect
} from 'react';

import { useFullscreen } from 'rooks';

import {
  IRange, ICell, ICellRange, ICellRanges, IWorkbook, ISheet, IWorkbookView, ITheme, IStyle,
  INamedCollection, INamed, IListener, IScript, IModule, IFunction, CommonUtils, EditMode
} from '@sheetxl/sdk';

import {
  SimpleCommand, Command, KeyModifiers, ICommands, CommandGroup, useEditMode,
  NotifierType, useCallbackRef, ShowInputOptions, ICommand,
  useNotifier, IReactNotifier
} from '@sheetxl/utils-react';

import {
  useModelListener, useDocThemes, CommandContext, IScriptEditor, useTaskPaneArea
} from '@sheetxl/react';

import { IWorkbookElement } from './IWorkbookElement';

export interface useWorkbookCommandsOptions {
  /**
   * The workbook model.
   */
  workbook: IWorkbook;
  /**
   * The workbookElement. Only used for toggling fullscreen.
   */
  workbookElement: IWorkbookElement;

  target: ICommands.ITarget | (() => ICommands.ITarget);

  commands: ICommands.IGroup;

  // TODO - review as part of standard command review. This doesn't belong here.
  onExecute?: () => void;
  /**
   * Whether dark mode is enabled.
   */
  darkMode?: boolean;
}

/**
 * Hook for observing workbook commands. This hook will observe a combination
 * of workbook events and an options selection.

 * Continue to review until we have them all.
 * https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f
 * https://www.excelcampus.com/shortcuts/#:~:text=For%20example%2C%20to%20press%20the,Then%20release%20all%20keys.
 *
 *
 * F6 - Move focus through primary workbook elements (we can implement this by check each workbook element and moving through)
 * F8 - Extend Selection
 * F10 - Move focus to toolbar
 * F11 - Insert chart as a new tab
 *
 */
export const useWorkbookCommands = (props: useWorkbookCommandsOptions): ICommands.IGroup => {
  const {
    workbook,
    workbookElement,
    // onExecute,
    target: commandTarget,
    commands: commandsParent,
    darkMode
  } = props;

  const notifier: IReactNotifier = useNotifier();

  const [activeSheet, setActiveSheet] = useState<ISheet>(workbook?.getSelectedSheet());
  const [sheets, setSheets] = useState<ISheet[]>(workbook?.getSheets().getItems());

  const taskPaneArea = useTaskPaneArea();

  const commandsArray = useMemo(() => {
    return [
      // TODO - remove just for testing.
      new SimpleCommand('activateTask', commandTarget, { // TODO - implement. Note - This should also be available in the status bar
        label: 'Activate Task',
        description: 'Activate Task Pane.',
        shortcut: {
          key: 'F6',
          // modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new SimpleCommand('workbookStatistics', commandTarget, { // TODO - implement. Note - This should also be available in the status bar
        label: 'Workbook Statistics',
        description: 'Show the workbook statistics.',
        shortcut: {
          key: 'G',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new SimpleCommand('workbookStatistics', commandTarget, { // TODO - implement. Note - This should also be available in the status bar
        label: 'Workbook Statistics',
        description: 'Show the workbook statistics.',
        shortcut: {
          key: 'G',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new SimpleCommand('showFormat', commandTarget, { // TODO - implement. Note - This should also be available in the status bar
        label: 'Show Format',
        description: 'Open the format pane.',
        shortcut: {
          key: 'F',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new Command('newCellStyle', commandTarget, {
        label: `New Cell Style\u2026`, // '...' // ellipsis
        scopedLabels: {
          'cellStyle' : `New Cell Style`
        },
        description: `Create a new named style can can be quickly used later.`,
        icon: 'NewPresetStyles'
      }),
      new Command('deleteCellStyle', commandTarget, {
        label: 'Delete Cell Style',
        scopedLabels: {
          'cellStyle' : `Delete`
        },
        description: `Remove a named style that is no longer needed.`,
        // icon: 'DeletePresetStyles'
      }),
      new Command('modifyCellStyle', commandTarget, {
        label: 'Modify Cell Style',
        scopedLabels: {
          'cellStyle' : `Modify`
        },
        description: `Update a style with the currently style.`,
        // icon: 'ModifyPresetStyles'
      }),
      new SimpleCommand('find', commandTarget, {
        label: 'Find',
        description: 'Open the Find window.',
        icon: 'Find',
        shortcut: [{
          key: 'F',
          modifiers: [KeyModifiers.Ctrl]
        }, {
          key: 'F5',
          modifiers: [KeyModifiers.Shift]
        }]
      }),
      new SimpleCommand('findReplace', commandTarget, {
        label: 'Find & Replace',
        description: 'Open the Find & Replace window.',
        icon: 'FindReplace',
        shortcut: [{
          key: 'H',
          modifiers: [KeyModifiers.Ctrl]
        }, {
          key: 'H',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Alt]
        }]
      }),
      new SimpleCommand('goto', commandTarget, {
        label: 'Go To',
        description: `Open the 'Go To' window.`,
        icon: 'GoTo',
        shortcut: [{
          key: 'G',
          modifiers: [KeyModifiers.Ctrl]
        // }, {
        //   key: 'F5' // Hmm. Excel online allows refresh.
        }]
      }),
      new SimpleCommand('workbookViewToggleExpandFormulaBar', commandTarget, {
        label: 'Toggle Expand Formula bar',
        description: 'Expand or collapse the formula bar.',
        shortcut: {
          key: 'U',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new SimpleCommand('workbookViewToggleShowFormulaBar', commandTarget, {
        label: 'View Formula bar',
        scopedLabels: {
          'view': 'Formula Bar'
        },
        description: 'Show or hide the formula bar.'
      }),
      new SimpleCommand('workbookViewToggleShowTabs', commandTarget, {
        label: 'View Sheet Tabs',
        description: 'Show or hide the sheet tabs.',
        scopedLabels: {
          'view': 'Sheet Tabs'
        }
      }),
      new SimpleCommand('workbookViewToggleShowStatusBar', commandTarget, {
        label: 'View Status Bar',
        description: 'Show or hide the status bar.',
        scopedLabels: {
          'view': 'Status Bar'
        }
      }),
      new SimpleCommand('workbookViewToggleShowHorizontalScrollBar', commandTarget, {
        label: 'View Horizontal Scrollbar',
        description: 'Show or hide the horizontal scrollbar.',
        scopedLabels: {
          'view': 'Horizontal Scrollbar'
        }
      }),
      new SimpleCommand('workbookViewToggleShowVerticalScrollBar', commandTarget, {
        label: 'View Vertical Scrollbar',
        description: 'Show or hide the vertical scrollbar.',
        scopedLabels: {
          'view': 'Vertical Scrollbar'
        }
      }),
      new Command<number>('hideSheet', commandTarget, {
        label: 'Hide Sheet',
        scopedLabels: {
          'sheet': 'Hide'
        },
        description: 'Hide the sheet from appearing in the tabs. This keeps the data but de-clutters the tabs.',
        icon: 'VisibilityOff'
      }),
      new Command<number>('deleteSheet', commandTarget, {
        label: 'Delete Sheet',
        scopedLabels: {
          'sheet': 'Delete'
        },
        description: 'Delete the sheet and all the data.'
      }),
      new Command<number>('addSheet', commandTarget, {
        label: 'Insert Sheet',
        scopedLabels: {
          'sheet': 'Insert'
        },
        description: 'Insert sheet before the current sheet.',
        shortcut: [{
          key: 'F11',
          modifiers: [KeyModifiers.Shift]
        }, {
          key: 'F1',
          modifiers: [KeyModifiers.Alt, KeyModifiers.Shift]
        }]
      }),
      new Command<number>('duplicateSheet', commandTarget, {
        label: 'Duplicate Sheet',
        description: 'Duplicate the current sheet.',
        scopedLabels: {
          'sheet': 'Duplicate'
        }
      }),
      new Command<number>('nextSheet', commandTarget, {
        label: 'Next Sheet',
        scopedLabels: {
          'sheet': 'Next'
        },
        description: `Activate the next sheet.`,
        shortcut: [{
          key: 'PageDown',
          modifiers: [KeyModifiers.Ctrl]
        // }, {
        //   key: 'Numpad3',
        //   modifiers: [KeyModifiers.Ctrl]
        }]
      }),
      new Command<number>('previousSheet', commandTarget, {
        label: 'Previous Sheet',
        scopedLabels: {
          'sheet': 'Previous'
        },
        description: `Activate the previous sheet.`,
        shortcut: [{
          key: 'PageUp',
          modifiers: [KeyModifiers.Ctrl]
        // }, {
        //   key: 'Numpad9',
        //   modifiers: [KeyModifiers.Ctrl]
        }]
      }),
      new Command<number>('selectNextSheet', commandTarget, {
        label: 'Select Next Sheet',
        scopedLabels: {
          'sheet': 'Select Next'
        },
        description: `Select the next sheet.`,
        shortcut: [{
          key: 'PageDown',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        // }, {
        //   key: 'Numpad3',
        //   modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }]
      }),
      new Command<number>('selectPreviousSheet', commandTarget, {
        label: 'Select Previous Sheet',
        scopedLabels: {
          'sheet': 'Select Previous'
        },
        description: `Select the previous sheet.`,
        shortcut: [{
          key: 'PageUp',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        // }, {
        //   key: 'Numpad9',
        //   modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }]
      }),
      new Command<ITheme>('selectTheme', commandTarget, {
        label: 'Theme',
        description: `Select a theme that coveys a style suitable for your data.`
      }),
      new Command<INamed, INamed>('selectNamed', commandTarget, {
        label: (context: INamed) => {
          return context?.getName() ?? 'Select Named Item';
        },
        scopedLabels: {
          'namedItem': (context: INamed) => {
            return context?.getName() ?? 'Select';
          }
        },
        description: `Select the item.`
      }),
      // // TODO - selection context
      new Command<INamed.Properties>('addNamedReference', commandTarget, {
        label: 'Define Named Reference',
        scopedLabels: {
          'namedItem': 'Define Name\u2026'
        },
        description: `Add a new named reference. Names can be used as a substitute for cell references.`,
        icon: 'InsertNamedRange'
      }),
      // TODO - selection context
      new Command<INamed>('editNamedReference', commandTarget, {
        label: 'Edit Named Reference\u2026',
        scopedLabels: {
          'namedItem': 'Edit\u2026'
        },
        description: `Add a new named reference. Names can be used as a substitute for cell references.`,
        icon: 'NamedRangeEdit'
      }),
      new Command<INamed>('deleteNamedReference', commandTarget, {
        label: 'Delete Named Reference',
        scopedLabels: {
          'namedItem': 'Delete'
        },
        description: `Remove the named reference.`,
        icon: 'DeleteNamedRange'
      }),
      // TODO - disable if name box is not visible
      new SimpleCommand('activeNameBox', commandTarget, {
        label: 'Activate Name Box',
        description: `Move the focus to the name box.`,
        shortcut: {
          key: 'F3',
          modifiers: [KeyModifiers.Alt]
        }
      }),
      // TODO - selection context (also needed for scoped)
      new SimpleCommand('createNamedReferenceFromSelection', commandTarget, { // TODO - implement
        label: 'Create from Selection',
        description: `Automatically generate names from the selected cells.`,
        shortcut: {
          key: 'F3',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Shift]
        }
      }),
      new SimpleCommand('activeNameManager', commandTarget, {  // TODO - implement
        label: 'Activate Name Manager',
        description: `Create, edit, delete, and find all the names used in the workbook.\n\nNames can be used as a substitute for cell references.`,
        shortcut: {
          key: 'F3',
          modifiers: [KeyModifiers.Ctrl]
        }
      }),
      // Note - This is not a great implementation because we can't capture ESC key and Chrome doesn't fire event if toggles from browser menu bar
      new Command<boolean>('fullScreenToggle', commandTarget, {
        label: 'FullScreen',
        description: `Toggle showing the workbook using the full screen.`,
        shortcut: {
          key: 'F11'
        },
        icon: 'FullScreen'
      }),
      new Command<boolean>('showScriptEditor', commandTarget, {
        label: 'Scripts',
        scopedLabels: {
          'scripts' : `Script Editor\u2026`, // '...' // ellipsis
        },
        description: `Show the script editor.`,
        icon: 'ScriptRun',
        shortcut: [{
        //   key: 'F8', // This is Toggle Extend Selection Mode
        //   modifiers: [KeyModifiers.Alt]
        // }, {
          key: 'F11',
          modifiers: [KeyModifiers.Alt]
        }]
      }),
      // TODO -  move to script
      new Command<string>('executeScript', commandTarget, {
        label: 'Run Script',
        description: `Run the selected or last executed script.`,
        icon: 'ScriptRun',
        shortcut: {
          key: 'F8'
        }
      }),
      new Command<string>('executeSelectedScript', commandTarget, {
        label: 'Run Script',
        description: `Run the selected script.`,
        icon: 'ScriptRun',
        shortcut: {
          key: 'F8'
        }
      }),
      new Command<string>('saveScripts', commandTarget, {
        label: 'Save Script',
        description: `Save the current scripts.`,
        icon: 'ScriptSave',
        // shortcut: {
        //   key: 'S',
        //   modifiers: [KeyModifiers.Ctrl]
        // }
      }),
      // TODO - Excel toggles maximize.
      // We should have this maximize within the browser.
      // This would be useful in examples where the sheet is 'windowed' as an embedded component.
      new Command<boolean>('maximumWorkbookToggle', commandTarget, {
        label: 'Maximize',
        description: `Toggle showing the workbook maximized.`,
        shortcut: {
          key: 'F10',
          modifiers: [KeyModifiers.Ctrl]
        }
      }),
      new Command<boolean>('spellCheck', commandTarget, { // TODO - implement
        label: 'Spell Check',
        description: `Check the workbook for spelling mistakes.`,
        shortcut: {
          key: 'F7'
        }
      }),
      new Command<boolean>('calculateAll', commandTarget, {
        label: 'Calculate Now',
        description: `Recalculate all formulas.`,
        icon: 'Calculate',
        shortcut: {
          key: 'F9'
        }
      }),
      // new Command<boolean>('calculateSettings', commandTarget, {
      //   label: 'Calculation Settings',
      //   description: `Configure calculation settings.`
      // })
    ];
  }, []);

  const commands:ICommands.IGroup = useMemo(() => {
    let retValue = null;
    if (commandsParent) {
      retValue = commandsParent.createChildGroup(commandTarget, 'workbook', false);
    } else {
      retValue = new CommandGroup(commandTarget, 'workbook');
    }
    retValue.addCommands(commandsArray, true);
    return retValue;
  }, [commandsParent, commandsArray]);

  const editModeHandler = useEditMode();

  const refLastFunction = React.useRef<Promise<IScriptEditor.SelectedFunction | null>>(null);
  const updateScripts = useCallbackRef((): void => {
    let _selectedFunction:Promise<IScriptEditor.SelectedFunction | null> | null;
    let _editor: IScriptEditor.Editor = null;

    const commandExecute = commands.getCommand('executeScript');
    commandExecute.update({
      disabled: false,// TODO - make if macroCount === 0,
      context: {
        // TODO - this should get the getScripts from the ScriptEditor not directly from the workbook
        getScripts: () => workbook.getScripts()
      }
    });
    if (!commandExecute) return;

    const commandToggleShow = commands.getCommand('showScriptEditor');
    commandToggleShow.updateCallback(function(_args: boolean=true) {
      if (!_editor) {
        taskPaneArea.activateTaskPane('scriptEditor', {});
      } else {
        _editor.close();
      }
    });

    const command = commands.getCommand('executeSelectedScript');
    if (!command) return;
    const context:IScriptEditor.Context = {
      // TODO - the ScriptEditor should generate the typescript NOT the commands!?
      // TODO - this is incorrect as this should be a before save callback
      saveSource: async (source: string): Promise<IModule> => {
        let module:IModule = null;
        let hideBusy = null;
        const scripts:IScript = workbook.getScripts();
        try {
          // TODO - throw this into core (still lazy load?) How to do as a plugin?
          if (source) {
            hideBusy = await notifier.showBusy("Saving Scripts...");
            const compiled = await scripts.createModule({ source });
            module = compiled;
          }
          scripts.addModule("scripts", module, { replace: true });
          hideBusy?.();
        } catch (error: any) {
          hideBusy?.();
          console.warn(`Unable to compile`, error);
          // We want to pass through the error
          notifier.showError(error);
        }
        return module;
      },
      addContainerListener: (listener: IScriptEditor.ContainerListener): IListener.Remove => {
        refContainerListener.current = listener;
        return () => {
          refContainerListener.current = null;
        };
      },
      setSelectedFunction: (selected: Promise<IScriptEditor.SelectedFunction | null>): void => {
        _selectedFunction = selected ?? refLastFunction.current ?? null;
        Promise.resolve(_selectedFunction).then((result) => {
          // TODO - give disabled reason
          command.update({
            disabled: result === null
          });
        });
      },
      quickInsertFunction: (functionName: string): void => {
        const preFix = `=${functionName.toUpperCase()}(`
        const event = {
          text : preFix + `)`,
          editMode : true,
          initialSelection: { start: preFix.length, end: preFix.length + 0 },
        }
        editModeHandler.setMode((prev: EditMode) => {
          // already editing.
          if (prev?.key === 'edit') {
            return {
              ...prev,
              args: {
                ...prev.args,
              }
            }
          }

          return {
            key:'edit',
            args: {
              stateAndCoords: null,
              start: event
            }
          }
        });
      },
      getSelectedFunction: (): Promise<IScriptEditor.SelectedFunction | null> | null => {
        return _selectedFunction;
      },
      setEditor: (editor: IScriptEditor.Editor): void => {
        // console.log('setEditor', editor);
        _editor = editor ?? null;
        commandToggleShow.update({
          state: _editor !== null
        });
      },
      getEditor: (): IScriptEditor.Editor | null => {
        return _editor;
      },
      getRanges: (address: IWorkbook.RangesAddress): ICellRanges => {
        try {
          return workbook.getRanges(address);
        } catch (error: any) {
          // console.warn(error);
        }
        return null;
      },
      getScripts: (): IScript => {
        return workbook.getScripts();
      }
    };
    command.update({
      context,//: (): IScriptEditor.Context => context
    });
  }, [commands, workbook, workbookElement, notifier])

  const refContainerListener = React.useRef<IScriptEditor.ContainerListener>(null);

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onBeforeSave: async () => {
      await refContainerListener.current?.onBeforeSave();
    },
    onProtectionChange: () => {
      refContainerListener.current?.onReadonlyChange();
    },
    onLoad: () => {
      // TODO - this is incorrect
      const notify = async () => {
        await workbook.getCalculation().start();
        workbook.getScripts().start();
        refContainerListener.current?.onScriptChange();
      }
      notify();
    }
  });//, { fireOnModelChange: false });

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange: (source: IWorkbook) => {
      setSheets(source.getSheets().getItems());
    },
    onViewChange(source: IWorkbook): void {
      setActiveSheet(source?.getSelectedSheet());
    },
    onProtectionChange: (source: IWorkbook) => {
      const disabledProps = {
        disabled: !source.getProtection().isStructureAllowed()
      };
      commands.getCommand('hideSheet').update(disabledProps);
      commands.getCommand('deleteSheet').update(disabledProps);
      commands.getCommand('addSheet').update(disabledProps);
      commands.getCommand('duplicateSheet').update(disabledProps);
      commands.getCommand('selectTheme').update(disabledProps);
      commands.getCommand('addNamedReference').update(disabledProps);
      commands.getCommand('editNamedReference').update(disabledProps);
      commands.getCommand('deleteNamedReference').update(disabledProps);
    },
    onScriptsChange: (_source: IWorkbook) => {
      updateScripts();
    }
  });

  const {
    isFullscreenAvailable,
    isFullscreenEnabled,
    toggleFullscreen,
  } = useFullscreen({
    target: {
      // TODO - make this configurable
      current : workbookElement ?? document.body,
    }
    // onChange: (event: Event) => {}
  });

  const themes = useDocThemes();
  useEffect(() => {
    commands.getCommand('selectTheme').update({
      state: () => {
        return workbook.getTheme();
      },
      context: (): CommandContext.Theme => {
        return {
          theme: workbook.getTheme(),
          themes,
          darkMode
        }
      }
    });
  }, [workbook?.getTheme(), darkMode]);

  const executeScript = useCallbackRef(async function(options: { declaration?: IFunction.IDeclaration, functionName?: string }, command: ICommand<any, any>) {
    let selectedFunction:string = null;
    const scripts:IScript = workbook.getScripts();
    if (options?.declaration || options?.functionName) {
      const name = options.declaration ? options.declaration.getName() : options.functionName;
      const functions = await scripts.searchFunctions({ name });
      if (functions.length > 0) {
        selectedFunction = name;
      }
    }
    if (!selectedFunction) return;

    // TODO - we can query the descriptor to determine what arguments to pass
    try {
      const _results:any = await scripts.executeMacro(selectedFunction);
      refLastFunction.current = Promise.resolve({
        source: null,//module.getSource(),
        name: selectedFunction
      });
      // TODO - show results (in panel on bottom) (pass the ui as a context?)
      // console.log('executeScript:', executed, compiled.declarations);
    } catch (error: any) {
      notifier.showError(error);
      return;
    }
  }, [workbook, notifier]);

  useEffect(() => {
    commands.getCommand('newCellStyle').updateCallback((_currentNamed: IStyle.INamed) => {
      const defaultStyleName = (): string => {
        let index = 0;
        while (true) {
          index++;
          const candidate = `Style ${index}`;
          try {
            workbook.getStyles().validateStyleName(candidate, true);
              return candidate;
          } catch (error: any) {}
        }
      }

      notifier.showInput({
        initialValue: defaultStyleName(),
        title: commands.getCommand('newCellStyle')?.label('cellStyle'),
        description: `Enter a name for the new cell style.`,
        inputLabel: 'Style Name',
        inputProps: {
          style: {
            minWidth: '300px'
          }
        },
        options: ['Ok', 'Cancel'],
        defaultOption: 'Ok',
        onValidateInput: async (input: string, _option: string): Promise<{
          valid: boolean,
          message?: string
        }> => {
          let errorMessage = null;
          try {
            workbook.getStyles().validateStyleName(input, false); // We allow duplicate
          } catch (error: any) {
            errorMessage = error.message;
          }

          let namedStyle = workbook.getStyles().getNamed(input);
          let helperText = errorMessage;
          if (!helperText && namedStyle) {
            helperText = `Update style '${namedStyle.getName()}'.`
          }

          return {
            valid: errorMessage === null,
            message: helperText
          };
        }
      }).then(({input, option}) => {
        const selectedRange = workbook.getSelectedSheet().getSelectedRange();
        if (option !== 'Ok')
          return;
        const newStyle = workbook.getStyles().setNamed({
          name: input,
          style: selectedRange.getCell().getStyle()
        });
        selectedRange.getStyle().update({
          named: newStyle.getName()
        })
      });
    });
    commands.getCommand('deleteCellStyle').updateCallback((style: IStyle.INamed) => {
      style.delete();
      // workbook.getStyles().hideOrRemoveNamed(style.getName());
    });
    commands.getCommand('modifyCellStyle').updateCallback(({ named }) => {
      const selectedRange = workbook.getSelectedSheet().getSelectedRange();
      workbook.getStyles().setNamed({
        name: named.getName(),
        style: selectedRange.getCell().getStyle()
      });
    });
    commands.getCommand('hideSheet').updateCallback((index: number) => {
      workbook.getSheetAt(index).setVisibility(ISheet.Visibility.Hidden);
    });
    commands.getCommand('deleteSheet').updateCallback(async (index: number) => {
      // We support undo.
      // const option = await notifier.showOptions({
      //   title: 'Confirm',
      //   description: `This will permanently delete the sheet and all the data. Do you want to continue?`,
      //   options: ['Delete', 'Cancel'],
      //   defaultOption: 'Delete'
      // });
      // if (option !== 'Delete')
      //   return;
      workbook.getSheetAt(index ?? workbook.getSelectedSheetIndex())?.delete();
    });
    commands.getCommand('addSheet').updateCallback((index: number) => {
      workbook.getSheets().add({ index, autoSelect: true });
    });
    commands.getCommand('duplicateSheet').updateCallback(async (index: number) => {
      const newSheet = await workbook.getSheetAt(index ?? workbook.getSelectedSheetIndex())?.duplicate();
      newSheet?.select();
    });
    commands.getCommand('nextSheet').updateCallback((index: number) => {
      workbook.getNextSheet(index ?? workbook.getSelectedSheetIndex()).select();
    });
    commands.getCommand('previousSheet').updateCallback((index: number) => {
      workbook.getPreviousSheet(index ?? workbook.getSelectedSheetIndex()).select();
    });
    commands.getCommand('selectNextSheet').updateCallback((index: number) => {
      workbook.getNextSheet(index ?? workbook.getSelectedSheetIndex()).select();
    });
    commands.getCommand('selectPreviousSheet').updateCallback((index: number) => {
      workbook.getPreviousSheet(index ?? workbook.getSelectedSheetIndex()).select();
    });

    commands.getCommand('selectTheme').updateCallback((newTheme: ITheme) => {
      workbook.setTheme(newTheme);
    });

    commands.getCommand('calculateAll').updateCallback(() => {
      // TODO - should be on workbook too.
      // workbook.calculate(true);
      workbook.getSelectedSheet().getEntireRange().calculate(true);
    });

    commands.getCommand('executeScript').updateCallback(executeScript);
    commands.getCommand('executeSelectedScript').updateCallback(executeScript);
  }, [workbook, notifier]);

  const onFindOrReplace = useCallbackRef(async (options: CommandContext.FindReplaceOptions): Promise<number> => {
    let count:number = 0;
    let gotoCell:ICell = null;

    let description = 'Find & Replace';
    if (options?.replace && !options?.replaceOptions?.maxCount)
      description = 'Replace All';
    const hideBusy = await notifier.showBusy(description);
    try {
      const scope = options?.scope ?? 'sheet';
      let iterResults:Iterator<ICell> = null;
      const selectedSheet:ISheet = workbook.getSelectedSheet();
      const selectedCell:ICell = selectedSheet.getSelectedCell();
      const optionsFind:ICellRange.FindOptions = {
        from: selectedCell,
        ...options.findOptions
      }
      if (scope === 'sheet') {
      //   /* if we have selected ranges we search them else we search the sheet starting from the current cell */
      //   // const selectedRanges:ICellRanges = selectedSheet.getSelectedRanges();
      //   // iterResults = selectedRanges.find(options.findText, options.findOptions);
      //   // if (selectedRanges.getCount() === 1 && selectedRanges.at(0).size === 1) {
      //     iterResults = selectedSheet.find(options.findText, optionsFind);
      //   // } else {
      //   //   iterResults = selectedRanges.find(options.findText, optionsFind);
      //   // }
        iterResults = workbook.getSelectedSheet().find(optionsFind);
      } else {
        iterResults = workbook.find(optionsFind);
      }
      if (options.replace) {
        const replaced = workbook.replace(iterResults, options.replaceText, options.replaceOptions);
        count = replaced.count;
        if (options.replaceOptions.maxCount) {
          gotoCell = replaced.last;
        }
      } else {
        let result:IteratorResult<ICell> = iterResults.next();
        if (!result.done) {
          count++;
          gotoCell = result.value;
        }
      }
      gotoCell?.select({
        autoFocus: false // we want to allow the keystrokes
      });

      hideBusy?.();
      if (!options.replaceOptions.maxCount && count > 1) {
        // TODO - create a way to have these messages show up on top. (or don't use a toast for this)
        notifier.showMessage(`We replaced ${count} cells.`);
      }
     } catch (error: any) {
      hideBusy?.();
      notifier.showError(error);
    }
    return count;
  }, [workbook, workbookElement]);

  const onNamedReferenceDialog = useCallbackRef((named: INamed): Promise<HTMLElement> => {
    const context: CommandContext.NamedReference = {
      selection: (): ICellRanges => {
        const selected = workbook.getSelectedRanges();

        // TODO - I wish I could do this
        // selected.map((range: ICellRange) => {
        //   return range.getFixed(true)
        // })
        const selectedCount = selected.getCount();
        const fixed = new Array(selectedCount);
        for (let i=0; i<selectedCount; i++) {
          // TODO - we could make a fixed, unfixed util
          // TODO - what is the correct way to do this?
          const range:ICellRange = selected.at(i) as any;
          const rangeFixed:IRange.FixableCoords = range.getFixed(true).getCoords();
          fixed[i] = rangeFixed;
        }
        return workbook.getRanges(fixed);
      },
      getNames: (): INamedCollection => {
        return workbook.getNames();
      }
    };
    const options: ShowInputOptions<INamed> = {
      initialValue: named,
      context: () => context,
      onInput: async (named: INamed) => {
        try {
          await named.select();
        } catch (error: any) {
          notifier.showMessage(error.message, { type: NotifierType.Error });
        }
      }
    }
    return notifier.showWindow('namedDetails', options);
  }, [notifier, workbook, workbookElement]);

  useEffect(() => {
    const showFind = (replace: boolean=false) => {
      const cell = workbook.getSelectedCell();
      const initialValue:CommandContext.FindReplaceOptions = {
        findOptions: {
          text: cell.toTextUnformatted(true/*useFormula*/)
        },
        replace
      };

      const options:ShowInputOptions<CommandContext.FindReplaceOptions, any> = {
        initialValue,
        context: () => {
          // TODO - this is a bit of a hack. Type this.
          return onFindOrReplace//command.context() as () => ICell,
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
          // Note - when we get the context correct this should be removed
          if ((commands.findCommandByEvent(e) === commands.getCommand('find')) ||
              (commands.findCommandByEvent(e) === commands.getCommand('findReplace'))) {
            e.preventDefault();
          }
        },
        autoFocus: true,
        disableAutoDestroy: true
      }
      notifier.showWindow('find', options);
    }

    commands.getCommand('find')?.update({
      disabled: !notifier.showWindow,
    }).updateCallback(() => {
      showFind();
    });
    commands.getCommand('findReplace')?.update({
      disabled: !notifier.showWindow,
    }).updateCallback(() => {
      showFind(true);
    });

    commands.getCommand('activateTask')?.update({
      disabled: !notifier,
    }).updateCallback(() => {
      const props:ShowInputOptions = {
        onInput: async (value: string) => {
          try {
            taskPaneArea.activateTaskPane(value);
          } catch (error: any) {
            notifier.showError(error.message);
          }
        },
        // onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
        //   // Note - if we get the context correct this should remove
        //   if (commands.findCommandByEvent(e) === commands.getCommand('goto')) {
        //     e.preventDefault();
        //   }
        // },
        title: commands.getCommand('activateTask')?.label(),
        inputLabel: 'Task Name',
        options: ['Activate']
      }
      notifier.showInput(props);
    })

    commands.getCommand('goto')?.update({
      disabled: !notifier,
    }).updateCallback(() => {
      const props:ShowInputOptions = {
        onInput: async (value: string) => {
          try {
            await workbook.getRanges(value).select();
          } catch (error: any) {
            notifier.showMessage(error.message, { type: NotifierType.Error })
          }
        },
        // onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
        //   // Note - if we get the context correct this should remove
        //   if (commands.findCommandByEvent(e) === commands.getCommand('goto')) {
        //     e.preventDefault();
        //   }
        // },
        title: commands.getCommand('goto')?.label(),
        inputLabel: 'Location',
        options: ['Go To']
      }
      notifier.showInput(props);
    });
    commands.getCommand('selectNamed')?.update({
      disabled: !notifier,
    }).updateCallback(async (named: INamed): Promise<void> => {
      if (!named) return;
      try{
        await named.select();
      } catch (error: any) {
        notifier.showError(error);
      }
    });
    commands.getCommand('addNamedReference')?.updateCallback(async function(_initialValues: INamed.Properties): Promise<void> {
      onNamedReferenceDialog(null);
    });
    commands.getCommand('editNamedReference')?.updateCallback(async function(named: INamed): Promise<void> {
      onNamedReferenceDialog(named);
    });
    commands.getCommand('deleteNamedReference')?.updateCallback(async function(named: INamed): Promise<void> {
      named?.delete?.();
    });
    commands.getCommand('activeNameBox')?.updateCallback(async function(): Promise<void> {
      workbookElement?.getFormulaBarElement()?.getNamedCollectionEditorElement()?.focus();
    });
  }, [workbookElement, workbook, notifier]);

  // Toggling full screen from chrome menu doesn't fire an event?
  // useEffect(() => {
  //   document.addEventListener('fullscreenchange', (event) => {
  //     if (document.fullscreenElement) {
  //       console.log('doc full screen enter');
  //       // We’re going fullscreen
  //     } else {
  //       console.log('full screen exit');
  //       // We’re exiting fullscreen
  //     }
  //   });
  // }, []);

  useModelListener<IWorkbookView, IWorkbookView.IListeners>(workbook?.getView(), {
    onViewChange: (update: IWorkbookView | null | undefined): void => {
      commands.getCommand('workbookViewToggleShowFormulaBar').update({
        state: update.isShowFormulaBar()
      }).updateCallback(() => {
        update.setShowFormulaBar(!update.isShowFormulaBar());
      });
      commands.getCommand('workbookViewToggleShowTabs').update({
        state: update.isShowTabs()
      }).updateCallback(() => {
        update.setShowTabs(!update.isShowTabs());
      });
      commands.getCommand('workbookViewToggleShowStatusBar').update({
        state: update.isShowStatusBar()
      }).updateCallback(() => {
        update.setShowStatusBar(!update.isShowStatusBar());
      });
      commands.getCommand('workbookViewToggleShowHorizontalScrollBar').update({
        state: update.isShowHorizontalScrollbar()
      }).updateCallback(() => {
        update.setShowHorizontalScrollbar(!update.isShowHorizontalScrollbar());
      });
      commands.getCommand('workbookViewToggleShowVerticalScrollBar').update({
        state: update.isShowVerticalScrollbar()
      }).updateCallback(() => {
        update.setShowVerticalScrollbar(!update.isShowVerticalScrollbar());
      });
    }
  });

  useEffect(() => {
    commands.getCommand('fullScreenToggle').update({
      state: isFullscreenEnabled,
      disabled: !isFullscreenAvailable,
      icon: isFullscreenEnabled ? 'FullScreenOff' : 'FullScreen'
    }).updateCallback(() => {
      toggleFullscreen();
    });
  }, [isFullscreenEnabled, isFullscreenAvailable]);

  useEffect(() => {
    const isStructureAllowed = workbook.getProtection().isStructureAllowed();
    commands.getCommand('hideSheet').update({
      disabled: sheets.length <= 1 || !isStructureAllowed
    });
    commands.getCommand('deleteSheet').update({
      disabled: sheets.length <= 1 || !isStructureAllowed
    });
  }, [sheets, activeSheet]);

  return commands;
}