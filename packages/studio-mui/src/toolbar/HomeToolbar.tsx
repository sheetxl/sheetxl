import React, { useCallback, useState, useEffect, memo, forwardRef } from 'react';

import { IColor, IScript } from '@sheetxl/sdk';

import { useCommands, Command } from '@sheetxl/utils-react';

import {
  CommandContext, DefaultTaskPaneRegistry, useTaskPaneArea,
  type CommandButtonProps, type IScriptEditor
} from '@sheetxl/react';

import {
  CommandButton, ExhibitDivider, CommandToolbar,
  type CommandToolbarButtonProps, type CommandToolbarProps, type ICommandToolbarElement
} from '@sheetxl/utils-mui';

import { AutoColorPosition } from '../components';

import {
  WalkingCopyCommandButton, PasteCommandButton, UnderlineCommandButton, TextEffectsCommandButton,
  FontFamilyCommandButton, ColorCommandButton, FontSizeCommandButton, BorderCommandButton,
  MergeCommandButton, HorizontalAlignCommandButton, VerticalAlignCommandButton, TextOverflowCommandButton,
  TextRotateCommandButton, NumberFormatCommandButton, ClearCommandButton, FindCommandButton,
  PresetCellStylesCommandButton, FillCommandButton, PresetTableStylesCommandButton,
  CellsInsertCommandButton, CellsDeleteCommandButton, CellsFormatCommandButton,
  SortFilterCommandButton, UndoRedoCommandButton, InsertFunctionSumCommandPopupButton
 } from '../command';

import { RunScriptCommandButton } from '../scripting';

import { OverflowPalette } from './OverflowPalette';

// import { CommandButton }  from '@sheetxl/utils-mui';

// import { NestingPopupButton } from '@sheetxl/utils-mui';
// import { PopupButtonType } from '@sheetxl/utils-mui';

export interface HomeToolbarProps extends Omit<CommandToolbarProps, "renderToolbarPalette"> {
}

const defaultCreateCommandButton = (props: CommandButtonProps): React.ReactElement => {
  return <CommandButton {...props} />;
}

/**
 * Note - The order of our toolbar is what I think is a more logical grouping that Excel
 * but... Perhaps we should just be like Excel (for example we have all text coloring grouped but excel has fill and border in the text section)
 * ...but we are not exactly following this rule as alignment, rotation, and formatting style is after fill, border, merge
 */
export const HomeToolbar = memo(forwardRef<ICommandToolbarElement, HomeToolbarProps>(
  (props: HomeToolbarProps, refForwarded: React.Ref<ICommandToolbarElement>) => {
  const {
    commands,
    parentFloat,
    propsCommandButton: propCommandButtonProps,
    ...rest
  } = props;


  /* Scripts button is on the view toolbar but if there are scripts we move to home for convenience */
  const [showRunScript, setShowRunScript] = useState<boolean>(false);
  const resolvedCommands = useCommands(commands, ['executeScript', 'showScriptEditor']);
  const contextScript:IScriptEditor.Context = resolvedCommands[0]?.context?.() as unknown as IScriptEditor.Context;

  useEffect(() => {
    const scripts:IScript = contextScript?.getScripts();
    if (!scripts) return;
    const showScriptEditorCommand = resolvedCommands[1];
    const checkScripts = async () => {
      if (!showScriptEditorCommand) return;
      const isOpen: boolean = !!showScriptEditorCommand.state();
      let hasMacros: boolean = false;
      if (!isOpen) {
        const macros = await scripts.searchFunctions({ type: 'macro' });
        const macrosLength = macros?.length ?? 0;
        for (let i=0; macros && !hasMacros && i<macrosLength; i++) {
          hasMacros = true; // must be a script
        }
      }
      setShowRunScript(hasMacros || !!showScriptEditorCommand.state());
    }
    checkScripts();
    const commandListenerRemove = showScriptEditorCommand.addPropertyListener(() => {
      checkScripts();
    });

    const scriptListenerRemove = scripts.addListeners({
      onChange: () => {
        checkScripts();
      }
    });
    return () => {
      scriptListenerRemove();
      commandListenerRemove();
    };
  }, [contextScript]);


  const taskPaneArea = useTaskPaneArea();
  // const service = useCommandUIService();
  // const surface = service.createSurface(variant);

  const renderToolbarPalette = useCallback((props: CommandToolbarButtonProps) => {
    const {
      propsCommandButton,
      propsCommandPopup
    } = props;

    const entries = DefaultTaskPaneRegistry.findContributions('ribbon/home');

    let commandsEntries: React.ReactElement[];
    const entriesLength = entries.length;
    if (entriesLength > 0) {
      commandsEntries = [];
      for (let i=0; i<entriesLength; i++) {
        const entry = entries[i];
        // TODO refactor as this is silly.
        const command = entry.createCommand?.(taskPaneArea);
        if (!command) continue;
        const propsCommandButton = {
          command,
          ...propsCommandPopup
        };
        const createCommandButton = entry.createCommandButton ?? defaultCreateCommandButton;
        const button = createCommandButton(propsCommandButton);
        commandsEntries.push(button);
      }
    }
    const formatFontColor = (
      <ColorCommandButton
        {...propsCommandPopup}
        command={(commands.getCommand('formatFontColor') as Command<IColor, CommandContext.Color>)}
        isSplit={true}
        propsPanel={{
          disableAlpha: true, // Excel doesn't allow alpha
          // autoColorLabel: "Automatic", // default
          // autoColorPosition : AutoColorPosition.Start, // default
        }}
      />
    );

    const formatFillColor = (
      <ColorCommandButton
        {...propsCommandPopup}
        command={(commands.getCommand('formatFillColor') as Command<IColor, CommandContext.Color>)}
        isSplit={true}
        propsPanel={{
          disableAlpha: true,
          autoColorLabel: "No Fill",
          autoColorPosition : AutoColorPosition.End,
        }}
      />
    );

    const commandUndo = commands.getCommand('undo');
    const undoButton = commandUndo ? (<>
      <UndoRedoCommandButton
        {...propsCommandPopup}
        quickCommand="undo"
        // command={commandUndo as Command<any, any>}
      />
    </>) : null;

    const commandRedo = false;//commands.getCommand('redo');
    const redoButton = commandRedo ? (<>
      <UndoRedoCommandButton
        {...propsCommandPopup}
        quickCommand={'redo'}
        isRedo={true}
      />
    </>) : null;

    const commandFind = commands.getCommand('find');
    const findButton = commandFind ? (<>
      <FindCommandButton
        {...propsCommandPopup}
      />
      {/* <CommandButton
        {...propsCommandButton}
        command={commandFind}
        icon={<SearchIcon/>}
      /> */}
    </>) : null;

    let runScriptButton: React.ReactElement | null = null;
    if (showRunScript) {
      runScriptButton = (<>
        <ExhibitDivider/>
        <RunScriptCommandButton
          {...propsCommandPopup}
        />
      </>);
    }

    const children = (
    <OverflowPalette
      parentFloat={parentFloat}
    >
      {undoButton}
      {redoButton}
      {undoButton || redoButton ? <ExhibitDivider/> : null}
      {/* <CommandButton
        {...propsCommandButton}
        command={commands.getCommand('cut')}
        icon={<ContentCutIcon/>}
      /> */}
      <PasteCommandButton
        {...propsCommandPopup}
        command={commands.getCommand('paste') as Command<void>}
      />
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('formatPainterToggle') as Command<boolean>)}
      />
      <WalkingCopyCommandButton
        {...propsCommandButton}
        command={commands.getCommand('copy')}
      />
      <ExhibitDivider/>
      <FontFamilyCommandButton
        {...propsCommandPopup}
        command={(commands.getCommand('formatFontFamily') as Command<string>)}
      />
      <FontSizeCommandButton
        {...propsCommandPopup}
        command={(commands.getCommand('formatFontSize') as Command<number>)}
      />
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('formatBoldToggle') as Command<boolean>)}
      />
      <CommandButton
        {...propsCommandButton}
        command={(commands.getCommand('formatItalicToggle') as Command<boolean>)}
      />
      <UnderlineCommandButton
        {...propsCommandPopup}
      />
      <TextEffectsCommandButton
        {...propsCommandPopup}
      />
      <BorderCommandButton
        {...propsCommandPopup}
      />
      {formatFillColor}
      {formatFontColor}
      <ExhibitDivider/>
      <HorizontalAlignCommandButton
        {...propsCommandPopup}
      />
      <VerticalAlignCommandButton
        {...propsCommandPopup}
      />
      <TextRotateCommandButton
        {...propsCommandPopup}
      />
      <TextOverflowCommandButton
        {...propsCommandPopup}
      />
      <MergeCommandButton
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      <NumberFormatCommandButton
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      {/* <ConditionalCellStylesCommandButton
        command={(commands.getCommand('conditionalCellStyle'))}
        {...propsCommandPopup}
      /> */}
      {/* cell style is swapped with table style in excel online */}
      <PresetCellStylesCommandButton
        command={(commands.getCommand('formatCellStyle'))}
        {...propsCommandPopup}
      />
      {/* table style is swapped with cell style in excel online */}
      <PresetTableStylesCommandButton
        command={(commands.getCommand('formatTableStyle'))}
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      <CellsInsertCommandButton
        {...propsCommandPopup}
      />
      <CellsDeleteCommandButton
        {...propsCommandPopup}
      />
      <CellsFormatCommandButton
        {...propsCommandPopup}
      />
      <ExhibitDivider/>
      <InsertFunctionSumCommandPopupButton
        {...propsCommandPopup}
      />
      <FillCommandButton
        {...propsCommandPopup}
      />
      <ClearCommandButton
        {...propsCommandPopup}
      />
      <SortFilterCommandButton
        {...propsCommandPopup}
      />

      {findButton}
      {runScriptButton}
      {commandsEntries}

      {/* <ExhibitDivider/>
      <CommandButton
        {...propsCommandButton}
        command={commands.getCommand('selectAll')}
        icon={<SelectAllIcon/>}
      /> */}
      {/*
      <NestingPopupButton
        variant={PopupButtonType.Toolbar}
        {...buttonProps}
        parentFloat={floatReferenceToolbar}
        icon={<AccountTreeIcon/>}
        label="root-nest-button"
        nestedChildren={[{
            label: "level 1 a",
            nestedChildren: [{
              label: "level 2 a"
            }, {
              label: "level 2 b"
            }]
          }, {
            label: "level 1 b",
            nestedChildren: [{
              label: "level 2 c",
              nestedChildren: [{
                label: "level 3a a",
                nestedChildren: [{
                  label: "level 4a a",
                  nestedChildren: [{
                    label: "level 5a a"
                  }]
                }]
              }]

            }, {
              label: "level 2 d",
              nestedChildren: [{
                label: "level 3 b",
                nestedChildren: [{
                  label: "level 4 b",
                  nestedChildren: [{
                    label: "level 5 b"
                  }]
                }]
              }]
            }]
          }]
        }
      /> */}
      </OverflowPalette>);
    return children;
    // return defaultCreatePopupPanel({...props, children});
  }, [commands, resolvedCommands, showRunScript, taskPaneArea]);

  return (
    <CommandToolbar
      ref={refForwarded}
      commands={commands}
      parentFloat={parentFloat}
      propsCommandButton={propCommandButtonProps}
      renderToolbarPalette={renderToolbarPalette}
      {...rest}
    />
  );
}));

HomeToolbar.displayName = "HomeToolbar";