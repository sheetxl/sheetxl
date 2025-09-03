import React, { useCallback, useState, useEffect, memo, forwardRef } from 'react';

import { useCommands, Command } from '@sheetxl/utils-react';

import { IColor, IScript } from '@sheetxl/sdk';

import { CommandContext, IScriptEditor } from '@sheetxl/react';

import {
  ColorizedFillIcon, ColorizedTextIcon, TextItalicIcon, TextBoldIcon, FormatPaintIcon
} from '@sheetxl/utils-mui';


import {
  CommandButton, ExhibitDivider, themeIcon,
  CommandToolbar, CommandToolbarButtonProps, CommandToolbarProps, ICommandToolbarElement,
} from '@sheetxl/utils-mui';

import { AutoColorPosition } from '../components';

import {
  WalkingCopyCommandButton, PasteCommandButton, UnderlineCommandButton, TextEffectsCommandButton,
  FontFamilyCommandButton, ColorCommandButton, FontSizeCommandButton, BorderCommandButton,
  MergeCommandButton, HorizontalAlignCommandButton, VerticalAlignCommandButton, TextOverflowCommandButton,
  TextRotateCommandButton, NumberFormatCommandButton, ClearCommandButton, FindCommandButton,
  PresetCellStylesCommandButton, FillCommandButton, PresetTableStylesCommandButton,
  InsertCellsCommandButton, DeleteCellsCommandButton, SortFilterCommandButton, UndoRedoCommandButton,
  InsertFunctionSumCommandPopupButton
 } from '../command';

 import { OverflowPalette } from './OverflowPalette';

import { RunScriptCommandButton } from '../script';

// import { CommandButton }  from '@sheetxl/utils-mui';
// import { SelectAll as SelectAllIcon } from '@mui/icons-material';
// import { AccountTree as AccountTreeIcon } from '@mui/icons-material';

// import { NestingPopupButton } from '@sheetxl/utils-mui';
// import { PopupButtonType } from '@sheetxl/utils-mui';

export interface HomeToolbarProps extends Omit<CommandToolbarProps, "createToolbarPalette"> {
}

/**
 * Note - The order of our toolbar is what I think is a more logical grouping that Excel
 * but... Perhaps we should just be like Excel (for example we have all text coloring grouped but excel has fill and border in the text section)
 * ...but we are not exactly following this rule as alignment, rotation, and formatting style is after fill, border, merge
 */
const HomeToolbar = memo(forwardRef<ICommandToolbarElement, HomeToolbarProps>((props, refForwarded) => {
  const {
    commands,
    parentFloat,
    commandButtonProps: propCommandButtonProps,
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

  const createToolbarPalette = useCallback((props: CommandToolbarButtonProps) => {
    const {
      commandButtonProps,
      commandPopupProps
    } = props;

    const formatFontColor = (
      <ColorCommandButton
        {...commandPopupProps}
        command={(commands.getCommand('formatFontColor') as Command<IColor, CommandContext.Color>)}
        icon={<ColorizedTextIcon/>}
        isSplit={true}
        panelProps={{
          disableAlpha: true, // Excel doesn't allow alpha
          // autoColorLabel: "Automatic", // default
          // autoColorPosition : AutoColorPosition.Start, // default
        }}
      />
    );

    const formatFillColor = (
      <ColorCommandButton
        {...commandPopupProps}
        command={(commands.getCommand('formatFillColor') as Command<IColor, CommandContext.Color>)}
        icon={<ColorizedFillIcon/>}
        isSplit={true}
        panelProps={{
          disableAlpha: true,
          autoColorLabel: "No Fill",
          autoColorPosition : AutoColorPosition.End,
        }}
      />
    );

    const commandUndo = commands.getCommand('undo');
    const undoButton = commandUndo ? (<>
      <UndoRedoCommandButton
        {...commandPopupProps}
        quickCommand="undo"
        // command={commandUndo as Command<any, any>}
      />
    </>) : null;

    const commandRedo = false;//commands.getCommand('redo');
    const redoButton = commandRedo ? (<>
      <UndoRedoCommandButton
        {...commandPopupProps}
        quickCommand={'redo'}
        isRedo={true}
      />
    </>) : null;

    const commandFind = commands.getCommand('find');
    const findButton = commandFind ? (<>
      <FindCommandButton
        {...commandPopupProps}
      />
      {/* <CommandButton
        {...commandButtonProps}
        command={commandFind}
        icon={<SearchIcon/>}
      /> */}
    </>) : null;

    let runScriptButton: React.ReactElement | null = null;
    if (showRunScript) {
      runScriptButton = (<>
        <ExhibitDivider/>
        <RunScriptCommandButton
          {...commandPopupProps}
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
        {...commandButtonProps}
        command={commands.getCommand('cut')}
        icon={<ContentCutIcon/>}
      /> */}
      <PasteCommandButton
        {...commandPopupProps}
        command={commands.getCommand('paste') as Command<void>}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatPainterToggle') as Command<boolean>)}
        icon={themeIcon(<FormatPaintIcon/>)}
      />
      <WalkingCopyCommandButton
        {...commandButtonProps}
        command={commands.getCommand('copy')}
      />
      <ExhibitDivider/>
      <FontFamilyCommandButton
        {...commandPopupProps}
        command={(commands.getCommand('formatFontFamily') as Command<string>)}
      />
      <FontSizeCommandButton
        {...commandPopupProps}
        command={(commands.getCommand('formatFontSize') as Command<number>)}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatBoldToggle') as Command<boolean>)}
        icon={<TextBoldIcon/>}
      />
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('formatItalicToggle') as Command<boolean>)}
        icon={<TextItalicIcon/>}
      />
      <UnderlineCommandButton
        {...commandPopupProps}
      />
      <TextEffectsCommandButton
        {...commandPopupProps}
      />
      {formatFontColor}
      <ExhibitDivider/>
      {formatFillColor}
      <BorderCommandButton
        {...commandPopupProps}
      />
      <MergeCommandButton
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <HorizontalAlignCommandButton
        {...commandPopupProps}
      />
      <VerticalAlignCommandButton
        {...commandPopupProps}
      />
      <TextOverflowCommandButton
        {...commandPopupProps}
      />
      <TextRotateCommandButton
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <NumberFormatCommandButton
        {...commandPopupProps}
      />
      {/* cell style is swapped with table style in excel online */}
      <PresetCellStylesCommandButton
        command={(commands.getCommand('formatCellStyle'))}
        {...commandPopupProps}
      />
      {/* table style is swapped with cell style in excel online */}
      <PresetTableStylesCommandButton
        command={(commands.getCommand('formatTableStyle'))}
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <InsertCellsCommandButton
        {...commandPopupProps}
      />
      <DeleteCellsCommandButton
        {...commandPopupProps}
      />
      <ExhibitDivider/>
      <FillCommandButton
        {...commandPopupProps}
      />
      { __DEV__ ?
        <InsertFunctionSumCommandPopupButton
          {...commandPopupProps}
        />
      : null }
      <ClearCommandButton
        {...commandPopupProps}
      />
      <SortFilterCommandButton
        {...commandPopupProps}
      />

      {findButton}
      {runScriptButton}

      {/* <ExhibitDivider/>
      <CommandButton
        {...commandButtonProps}
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
  }, [commands, resolvedCommands, showRunScript]);

  return (
    <CommandToolbar
      ref={refForwarded}
      commands={commands}
      parentFloat={parentFloat}
      commandButtonProps={propCommandButtonProps}
      createToolbarPalette={createToolbarPalette}
      {...rest}
    />
  );
}));

HomeToolbar.displayName = "HomeToolbar";
export { HomeToolbar };