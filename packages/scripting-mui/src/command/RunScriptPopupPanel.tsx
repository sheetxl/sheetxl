import {
  memo, forwardRef, useState, useEffect
} from 'react';

import { Box } from '@mui/material';

import { type IScript, type IFunction } from '@sheetxl/sdk';

import { CommandButtonType, DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import {
  CommandButton, ExhibitDivider, defaultRenderPopupPanel,
  type ExhibitPopupPanelProps, type CommandPopupButtonProps
} from '@sheetxl/utils-mui';

import { useWorkbook } from '@sheetxl/react';

import { registerScriptingMuiLocales } from '../locales';

// Module-init so this package's `messages.json` slice is registered before first render.
registerScriptingMuiLocales();

export interface RunScriptPopupPanelProps extends ExhibitPopupPanelProps, CommandPopupButtonProps {

}
/**
 * Popup panel showing available scripts to run and option to open script editor.
 */
export const RunScriptPopupPanel = memo(forwardRef<any, RunScriptPopupPanelProps>(
  (props: RunScriptPopupPanelProps, refForwarded) => {
  const {
    // floatReference,
    // `groupKey` is a command-layer concept — pulled out so it can't reach `defaultRenderPopupPanel`
    // and land on a DOM element (React warns: "does not recognize the `groupKey` prop"). The panel's
    // members scope themselves via the explicit `groupKey: 'scriptsOptions'` below.
    groupKey: _groupKey,
    ...rest
  } = props;

  const workbook = useWorkbook();
  const t = useTranslator();
  const [macros, setMacros] = useState<IFunction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const scripts = workbook?.getScripts();
    if (!scripts) return;
    const checkScripts = async () => {
      setIsLoading(true);
      const macrosResolved = await scripts.searchFunctions({ type: 'macro' });
      setMacros(macrosResolved);
      setIsLoading(false);
    }
    checkScripts();
  }, [workbook]);

  const commandButtonProps = {
    variant: CommandButtonType.Menuitem,
    groupKey: 'scriptsOptions',
    // disabled,
    shortcut: undefined
  }

  // const scripting: IScript = context;
  // await scripting.isDirty();
  // await scripting.save();
  // scripting.searchFunctions({ scope: scope });
  const scriptsElements = [];
  const macrosLength = macros ? macros.length : 0;
  for (let i=0; i<macrosLength; i++) {
    const udf = macros[i];
    scriptsElements.push(
      <CommandButton
        key={`macro-${udf.getName()}-${i}`}
        {...commandButtonProps}
        commandKey={'executeScript'}
        commandState={{ declaration: udf }}
        propsTooltip={{
          // Macro names are canonical (never localized) — only the surrounding prose translates.
          description: t('runScript.executeNamed', { name: udf.getName() ?? t('runScript.fallbackLabel') })
        }}
        icon={<DynamicIcon iconKey="ScriptMacro"/>}
        label={udf.getName() ?? t('runScript.fallbackLabel')}
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
        commandKey={'showScriptEditor'}
      />
    </Box>
  );

  return defaultRenderPopupPanel({...rest, children});
}));

RunScriptPopupPanel.displayName = 'RunScriptPopupPanel';