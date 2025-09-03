import React, {
  memo, forwardRef, useState, useMemo, useRef, useCallback, useEffect
} from 'react';

import clsx from 'clsx';
import { useMeasure } from 'react-use';

import { Box } from '@mui/material';

import { IScript, IFunction } from '@sheetxl/sdk';

import { ICommand, CommandButtonType, useCommands } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButtonProps,
  ExhibitDivider, defaultCreatePopupPanel, ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import { IScriptEditor } from '@sheetxl/react';

import { ScriptMacroIcon, CodeIcon } from '@sheetxl/utils-mui';

export interface RunScriptPopupPanelProps extends ExhibitPopupPanelProps, CommandPopupButtonProps {

}
const RunScriptPopupPanel = memo(forwardRef<any, RunScriptPopupPanelProps>((props: RunScriptPopupPanelProps, refForwarded) => {
  const {
    // floatReference,
    commands: propCommands,
    // commandHook: propCommandHook,
    ...rest
  } = props;

  const resolvedCommands = useCommands(propCommands, ['executeScript', 'showScriptEditor']);
  const [macros, setMacros] = useState<IFunction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const contextScript:IScriptEditor.Context = resolvedCommands[0]?.context?.() as unknown as IScriptEditor.Context;

  useEffect(() => {
    const scripts:IScript = contextScript?.getScripts();
    if (!scripts) return;
    const checkScripts = async () => {
      setIsLoading(true);
      const macrosResolved = await scripts.searchFunctions({ type: 'macro' });
      setMacros(macrosResolved);
      setIsLoading(false);
    }
    checkScripts();
  }, []);

  const commandButtonProps = {
    variant: CommandButtonType.Menuitem,
    parentFloat: props.floatReference,
    // commandHook: propCommandHook,
    scope: 'scripts',
    // disabled,
    shortcut: null
  }

  // const scripting: IScript = context;
  // await scripting.isDirty();
  // await scripting.save();
  // scripting.searchFunctions({ scope: scope });
  const scriptsElements = [];
  const macrosLength = macros.length;
  for (let i=0; i<macrosLength; i++) {
    const udf = macros[i];
    scriptsElements.push(
      <CommandButton
        key={`macro-${udf.getName()}-${i}`}
        {...commandButtonProps}
        command={propCommands.getCommand('executeScript') as ICommand<boolean>}
        commandState={{ declaration: udf }}
        tooltipProps={{
          description: `Execute ${udf.getName() ?? 'macro'}`
        }}
        icon={themeIcon(<ScriptMacroIcon/>)}
        label={udf.getName() ?? `Script '${udf.getName()}'`}
      />
    );
  }

  const children = (
    <Box
      ref={refForwarded}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 100%',
        overflow: 'hidden'
      }}
    >
      {scriptsElements.length > 0 ? (<>
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {scriptsElements}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
      </>): null }
      <CommandButton
        {...commandButtonProps}
        key={`show-editor`}
        command={propCommands.getCommand('showScriptEditor') as ICommand<boolean>}
        icon={themeIcon(<CodeIcon/>)}
      />
    </Box>
  );

  return defaultCreatePopupPanel({...rest, children});

}));

RunScriptPopupPanel.displayName = 'RunScriptPopupPanel';
export { RunScriptPopupPanel };