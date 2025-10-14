import React, { useEffect, useMemo, useCallback } from 'react';

import { useMediaQuery } from '@mui/material';

import { CommonUtils, UndoManager } from '@sheetxl/utils';
import { IWorkbook } from '@sheetxl/sdk';

import {
  SimpleCommand, Command, ICommand, ICommandProperties, ICommands, CommandGroup,
  KeyModifiers, useUndoManager, useCallbackRef, useNotifier
} from '@sheetxl/utils-react';

import {
  useModal, type ThemeModeOptions, ThemeMode, useResolvedThemeMode
} from '@sheetxl/utils-mui';

import {
  WorkbookIO, type ReadWorkbookDetails, type ReadWorkbookOptions, type ReadFormatType, type WriteFormatType
} from '../io';

export interface useStudioCommandsOptions {
  /**
   * The workbook
   */
  workbook: IWorkbook;

  setWorkbook: (newWorkbook: IWorkbook) => void;

  /**
   * Disabled the importExport options
   */
  importExportDisabled: boolean;

  /**
   * @defaultValue 'varies based on import/export'
   */
  workbookTitle?: string;

  setWorkbookTitle?: (newWorkbookTitle: string | null) => void;

  /**
   * If the workbookTitle is not specified this will be call at time of save.
   * @remarks
   * If null is returned or the project is rejected then treat as cancel.
   */
  requestWorkbookTitle?: (reason?: string) => Promise<string | null>;

  themeOptions?: ThemeModeOptions;

  /**
   * If undo manager provider then undo commands will be added to the command map
   */
  undoManager?: UndoManager;

  commands?: ICommands.IGroup;

  // TODO - review as part of standard command review. This doesn't belong here.
  onExecute?: () => void;
}

/**
 * Add csv import as new sheet or replace existing workbook
 */
const CSV_IMPORT_ADD_SHEET: boolean = true;

/**
 * Hooks for a standalone workbook app
 */
export const useStudioCommands = (
  props: useStudioCommandsOptions
): ICommands.IGroup => {
  const {
    workbook,
    setWorkbook,
    importExportDisabled,
    workbookTitle = 'export',
    setWorkbookTitle,
    requestWorkbookTitle,
    themeOptions,
      undoManager,
    // commandTarget,
    // allCommands,
    commands: commandsParent,
    onExecute,
  } = props;

  const notifier = useNotifier();

  const onModeChange = useCallbackRef(themeOptions?.onModeChange, [themeOptions?.onModeChange]);
  const onEnabledDarkGridChange = useCallbackRef(themeOptions?.onEnabledDarkGridChange, [themeOptions?.onEnabledDarkGridChange]);
  const onEnabledDarkImagesChange = useCallbackRef(themeOptions?.onEnabledDarkImagesChange, [themeOptions?.onEnabledDarkImagesChange]);

  const importWorkbook = useCallbackRef(async (
    input: File | Promise<File> | string=null,
    typedCreateWorkbookOptions: Record<string, IWorkbook.ConstructorOptions>=null,
    onStart: (details: ReadWorkbookDetails, total?: number) => Promise<void> | void=null
  ): Promise<IWorkbook> => {
    const warnings = [];
    const onWarning = (message: string) => {
      warnings.push(message);
    }
    let inputResolve:File | Promise<File>;

    let inputFile:File | Promise<File> = null;
    let inputInputs:string = null;
    if (typeof input == 'string') {
      inputInputs = input;
    } else {
      inputFile = input;
    }
    if (!inputFile) {
      inputResolve = await CommonUtils.openFileDialog(inputInputs ?? (await WorkbookIO.getAllReadFormatsAsString()));
    } else {
      inputResolve = input as (File | Promise<File>);
    }

    if (!inputResolve) {
      // cancel
      return null;
    }

    const optionsFile:ReadWorkbookOptions = {
      source: inputResolve,
      typedCreateWorkbookOptions,
      progress: {
        onWarning
      }
    }
    if (onStart) {
      optionsFile.progress.onStart = onStart;
    }

    const retValue = await WorkbookIO.read(optionsFile, notifier);
    if (warnings.length > 0) {
      notifier.showMessage(`Some elements were not able to be imported. See console for details.`);
      console.warn('Import warnings:\n' + warnings.join('\n'));
    }
    return retValue;
  }, [onExecute, notifier, workbook]);

  const exportToFile = useCallbackRef(async (
    workbook: IWorkbook,
    fileNameDefault: string | null,
    format?: WriteFormatType
  ): Promise<boolean> => {
    if (!fileNameDefault && requestWorkbookTitle) {
      const fileNameRequested: string | null = await requestWorkbookTitle(`Enter Workbook name to ${format?.isDefault ? `Save.` : `Export as ${format?.description}.`}`);
      if (fileNameRequested === null) {
        return false;
      }
      return WorkbookIO.writeFile(fileNameRequested, workbook, {
        format: format.key
      });
    }

    return WorkbookIO.writeFile(fileNameDefault, workbook, {
      format: format.key
    });
  }, [notifier, workbook, requestWorkbookTitle]);

  const commandTarget:() => ICommands.ITarget = useCallback(() => {
    return {
      contains(_element: Node | null): boolean {
        return true;
      },
      focus(): void {
      }
    };
  }, []);

  const [commandsAsync, setCommandsAsync] = React.useState<ICommand<any, any>[]>([]);
  useEffect(() => {
    if (importExportDisabled) {
      setCommandsAsync([]);
      return;
    }
    const readExport = async () => {
      const commands: ICommand<any, any>[] = [];
      const writeFormats = await WorkbookIO.getWriteFormats();
      writeFormats.forEach((format: WriteFormatType) => {
        const isDefault = format.isDefault;
        const commandProperties:ICommandProperties<any, any> = {
          label: isDefault ? `Save Workbook` : `Save Workbook as ${format.description}`,
          scopedLabels: {
            'workbook': 'Save',
            'saveWorkbook': `as ${format.description}`
          },
          tags: format.tags,
          description: `Save the workbook to the desktop${isDefault ? '' : ` as ${format.description}`}.`,
          icon: 'FileDownloadAsSheet'
        };
        if (isDefault) {
          commandProperties.shortcut = {
            key: 'S',
            modifiers: [KeyModifiers.Ctrl]
          }
          // Also do a save as with ctrl+shift+S
          commands.push(new Command<string>(`saveWorkbookAs`, commandTarget, {
            label: `Save Workbook As\u2026`, // '...' // ellipsis
            scopedLabels: {
              'workbook': 'Save as\u2026', // '...' // ellipsis
              'saveWorkbook': `as\u2026` // '...' // ellipsis
            },
            shortcut: [{
              key: 'S',
              modifiers: [KeyModifiers.Shift, KeyModifiers.Ctrl]
            }, {
              key: 'F12'
            }],
            description: `Save the workbook to the desktop with the provided name.`
          }, () => {
            // specifically ignore the name
            exportToFile(workbook, null, format)
              .catch(error => {
              notifier.showError(error);
            });
          }));
        }
        const formatKey = format.key;
        const commandKey = isDefault ? 'saveWorkbook' : `saveWorkbookAs${formatKey}`;
        if (formatKey === 'CSV') {
          commandProperties.icon = 'FileDownloadAsCSV';
        } else if (formatKey === 'Excel') {
          commandProperties.icon = 'FileDownloadAsExcel';
        }
        commands.push(new Command<string>(commandKey, commandTarget, commandProperties, (inputName: string) => {
          exportToFile(workbook, inputName ?? workbookTitle, format)
            .catch(error => {
            notifier.showError(error);
          });
        }));
      });
      commands.push(new Command<File | Promise<File> | string>('openWorkbook', commandTarget, {
        label: 'Open Workbook\u2026', // '...' // ellipsis
        scopedLabels: {
          'workbook': 'Open\u2026', // '...'  // ellipsis
        },
        description: 'Open a workbook from the desktop.',
        icon: 'FileOpen',
        shortcut: {
          key: 'O',
          modifiers: [KeyModifiers.Ctrl]
        }
      }, async (input: File | Promise<File> | string=null): Promise<void> => {
        // we want csv to inherit the current workbook options.
        const typedCreateWorkbookOptions = {
          'csv': {
            date1904: workbook.isDate1904(),
            ...workbook.options
          }
        }
        try {
          let formatType:ReadFormatType = null;
          let readName: string;
          const onStart = async (details: ReadWorkbookDetails) => {
            formatType = details.format;
            readName = details.name;
          }
          const importedWorkbook:IWorkbook = await importWorkbook(input, typedCreateWorkbookOptions, onStart);
          if (!importedWorkbook) return; // cancel
          // We use the csv filename for sheet name

          // const name = loadResults.name;
          const importedSheet = importedWorkbook.getSelectedSheet();
          if (formatType.mimeType === 'text/csv' && CSV_IMPORT_ADD_SHEET) {
            // Add to existing sheet
            const newSheetName = workbook.findValidSheetName(readName);
            await workbook.doBatch(async () => {
              const topLeft = {
                colStart: 0,
                rowStart: 0,
                colEnd:0,
                rowEnd:0
              };
              let importRange = importedSheet.getUsedRange();
              if (!importRange) {
                // TODO - move to csv handler onWarn?
                notifier.showMessage("The file appears to be blank.");
                return;
              }
              //union of topleft to ensure we get leading blanks.
              importRange = importRange.getUnion(topLeft);

              const sheetTo = workbook.getSheets().add({ name: newSheetName, autoSelect: true });
              const rangeTo = sheetTo.getRange(topLeft);
              await rangeTo.copyFrom(importRange);
            }, `Import CSV '${newSheetName}'`);
            // TODO - allow add sheet to be an unDoable action. Then we can wrap the import as a transaction that can be undone.
            // undoManager?.clear(); // copy is an unDoable action, but we don't want to undo it.
          } else {
            // clear old workbook
            workbook?.close();
            // Set name and replace.
            setWorkbookTitle?.(importedWorkbook.getName() ?? '');
            setWorkbook(importedWorkbook);
          }
        } catch (error: any) {
          notifier.showError(error);
        }
      }));
      commands.push(new Command<string>('openWorkbookFromUrl', commandTarget, {
        label: 'Open Workbook From Web',
        scopedLabels: {
          'insert': 'From Web',
          'workbook': 'From Web\u2026', // '...' // ellipsis
        },
        description: 'Open a workbook from the web.',
        // icon: 'FileOpen',
      }, async function(url: string) {
        if (!url) {
          const results = await notifier.showInput({
            title: 'Open Workbook from the Web',
            description: `Enter the web address for the workbook to open.`,
            inputLabel: 'Address',
            initialValue: 'https://www.sheetxl.com/examples/features-checklist.xlsx',
            inputProps: {
              style: {
                minWidth: '440px'
              }
            },
            options: ['Open']
          });
          if (results.option !== 'Open')
            return;
          url = results.input;
        }
        if (!url) return;
        // TODO - refactor open command to take either argument
        console.log('openWorkbookFromUrl', url);
        // addImage(this, { fetch: url });
      }));
      // CTRL+W only works in window mode - https://codereview.chromium.org/9701108
      commands.push(new SimpleCommand('closeWorkbook', commandTarget, {
        label: 'Close Workbook',
        description: 'Close the workbook.',
        shortcut: {
          key: 'W',
          modifiers: [KeyModifiers.Ctrl, KeyModifiers.Alt]
        }
      }, async function() {
          const doClose = () => {
          window.close();
        }
        // TODO - confirm only if unsaved data
        // workbook.isDirty()
        const option = await notifier.showOptions({
          title: 'Confirm',
          description: `This will close the current workbook tab. Do you want to continue?`,
          options: ['Close', 'Cancel'],
          defaultOption: 'Close'
        });
        if (option !== 'Close')
            return;
          doClose();
      }));
      commands.push(new SimpleCommand('newWorkbook', commandTarget, { // CTRL+N only works in window mode - https://codereview.chromium.org/9701108
        label: 'New Workbook',
        description: 'Create a new workbook in another tab.',
        icon: 'FileNew',
        // shortcut: {
        //   key: 'N',
        //   modifiers: [KeyModifiers.Ctrl]
        // }
      }, async function() {
        defaultNewWorkbook();
      }));
      setCommandsAsync(commands);
    }
    readExport();
  }, [importExportDisabled, notifier, workbook, workbookTitle]); // undoManager

  const commandsSync = useMemo(() => {
    let commandsDarkModeToggle: ICommand<any, any>[] = [];
    if (themeOptions) {
      commandsDarkModeToggle = [
        new Command<ThemeMode | null>('themeMode', commandTarget, {
          label: `Light/Dark Mode`,
          scopedLabels: {
            'appearance': `Light/Dark Mode`
          },
          description: `Toggle the application styling between light and dark mode.`,
        }),
        new Command<boolean>('defaultThemeMode', commandTarget, {
          label: `Use System Light/Dark Mode`,
          scopedLabels: {
            'appearance': `Use System Default`
          },
          description: `Use the system settings to determine styling for light and dark mode.`,
        }),
        new Command<boolean>('enableDarkGrid', commandTarget, {
          label: `Enable Dark Grid`,
          description: `Allow the grid to render in dark mode if dark mode is being used. This is ensures that the grid will render the colors as specified in another tools (for example Excel).`,
        }),
        new Command<boolean>('enableDarkImages', commandTarget, {
          label: `Enable Dark Images`,
          description: `Allow the images to render in dark mode if dark mode is being used. This is ensures that the images will render the colors as specified in another tools (for example Excel). This only has any effect if the grid is in dark mode.`,
        })
      ];
    }
    const commandsStudio: ICommand<any, any>[] = [
      ...commandsDarkModeToggle,
      new SimpleCommand('help', commandTarget, {
        label: 'Show Help',
        description: 'Provide Help.',
        icon: 'Documentation',
        shortcut: {
          key: 'F1'
        }
      }, () => {}),
      new SimpleCommand('showKeyboardShortcuts', commandTarget, {
        label: 'Keyboard Shortcuts',
        description: 'Show keyboard shortcuts.',
        icon: 'Keyboard',
        shortcut: {
          key: '/',
          modifiers: [KeyModifiers.Ctrl]
        }
      }, () => {}),
      new Command<string>('gotoUrlGithub', commandTarget, {
        label: 'Github',
        description: 'Download examples, explore source code, and leave a star.',
        icon: 'Github'
      }, () => {
        window?.open('https://github.com/sheetxl/sheetxl');
      }),
      new Command<string>('gotoUrlDiscord', commandTarget, {
        label: 'Discord',
        description: 'Join our community on discord.',
        icon: 'Discord'
      }, () => {
        window?.open('https://discord.gg/NTKdwUgK9p');
      }),
      new Command<string>('gotoUrlDocumentation', commandTarget, {
        label: 'Documentation',
        description: 'Read the documentation.',
        icon: 'Documentation'
      }, () => {
        window?.open('https://www.sheetxl.com/docs');
      }),
      new Command<string>('gotoUrlIssue', commandTarget, {
        label: 'Create Issue',
        description: 'Create an issue to identify a bug or a feature request.',
        icon: 'Ticket'
      }, () => {
        window?.open('https://github.com/sheetxl/sheetxl/issues');
      }),
      // new SimpleCommand('debug', target, {
      //   label: 'Toggle Debug',
      //   description: 'Toggle Debug.',
      //   shortcut: {
      //     key: 'F3'
      //   }
      // }, () => {
      //   notifier.showBusy('Testing with a long piece of text that may wrap...').then((hideBusy) => {
      //     // sync timeout
      //     // let start = Date.now();
      //     // let lapsed = 0;
      //     // console.log('showBusy');
      //     // do {
      //     //   lapsed = Math.floor((Date.now() - start) / 1000);
      //     // } while (lapsed < 3);
      //     // console.log('hideBusy nested');

      //     // notifier.showBusy('Testing nested...').then((hideBusyNested) => {
      //     //   start = Date.now();
      //     //   do {
      //     //     lapsed = Math.floor((Date.now() - start) / 1000);
      //     //   } while (lapsed < 3);
      //     //   hideBusyNested();
      //     //   console.log('hideBusyNested');
      //     // });
      //     // hideBusy();
      //     // console.log('hideBusy');

      //     // async timeout
      //     setTimeout(() => {
      //       hideBusy();
      //     }, 7 * 1000);
      //   });
      // })
    ];
    return commandsStudio;
  }, [workbook, workbookTitle, notifier, importExportDisabled, themeOptions]);

  const commandsArray = useMemo(() => {
    return [
      ...commandsSync,
      ...commandsAsync
    ];
  }, [commandsSync, commandsAsync]);

  const commands = useMemo(() => {
    let retValue = null;
    if (commandsParent) {
      retValue = commandsParent.createChildGroup(commandTarget, 'standaloneWorkbook', false);
    } else {
      retValue = new CommandGroup(commandTarget, 'standaloneWorkbook');
    }
    retValue.addCommands(commandsArray, true);
    return retValue;
  }, [commandsParent, commandsSync, commandsAsync]);

  // const commands:ICommands.IGroup = useMemo(() => {
  //   commandsParent?.addCommands(commandsArray, true);
  //   return commandsParent;
  // }, [commandsParent, commandsArray]);

  useUndoManager({
    manager: undoManager,
    commands,
    // disabled: propDisabled,
  });

  const darkModeSystemDefault = useMediaQuery('(prefers-color-scheme: dark)');
  const { themeMode: defaultThemeMode } = useResolvedThemeMode();
  useEffect(() => {
    if (!themeOptions || !commands) return;
    const currentDark = themeOptions.mode === 'dark' || (!themeOptions.mode && defaultThemeMode === 'dark');

    commands.getCommand('themeMode').update({
      state: themeOptions.mode ?? null,
      label: currentDark ? 'Dark Mode' : 'Light Mode',
      scopedLabels: {
        'appearance': currentDark ? 'Dark Mode' : 'Light Mode'
      },
      icon: currentDark ? 'DarkMode' : 'LightMode'
    }).updateCallback(() => {
      onModeChange(currentDark ? ThemeMode.Light : ThemeMode.Dark);
    });

    commands.getCommand('defaultThemeMode').update({
      state: !themeOptions.mode,
      icon: darkModeSystemDefault ? 'SystemDefaultDarkMode' : 'SystemDefaultLightMode',
    }).updateCallback(() => {
      onModeChange(null);
    });
    commands.getCommand('enableDarkGrid').update({
      state: themeOptions.enableDarkGrid,
    }).updateCallback(() => {
      onEnabledDarkGridChange(!themeOptions.enableDarkGrid)
    });
    commands.getCommand('enableDarkImages').update({
      state: themeOptions.enableDarkImages,
    }).updateCallback(() => {
      onEnabledDarkImagesChange(!themeOptions.enableDarkImages)
    });
  }, [defaultThemeMode, themeOptions, commandsArray]);

  const { showModal } = useModal();
  useEffect(() => {
    const showKeyboardShortcutsDialog = () => {
      return new Promise<boolean>((resolve, _reject) => {
        const LazyShortcutKeysDialog = React.lazy(() => import('../dialog/ShortcutKeysDialog'));
        const modal = showModal(LazyShortcutKeysDialog, {
          title: 'Shortcut Keys Reference',
          commands,
          onDone: () => {
            modal.hide();
          },
          slotProps: {
            transition: {
              onExited: () => {
                resolve(true);
              }
            }
          }
        });
      });
    };

    commands.getCommand('showKeyboardShortcuts').updateCallback(() => {
      return showKeyboardShortcutsDialog();
    });

    commands.getCommand('help').updateCallback(() => {
      return showKeyboardShortcutsDialog(); // For now we just map to keyboard shortcuts
    });
  }, [commandsArray, commands]);

  return commands;
}

const defaultNewWorkbook = () => {
  window.open(window.origin.toString(), "sheetxl-" + CommonUtils.uuidV4(), "popup=true");
}