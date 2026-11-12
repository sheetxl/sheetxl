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

export interface InsertFunctionPopupPanelProps extends ExhibitPopupPanelProps, CommandPopupButtonProps {

}
/**
 * Popup panel listing the workbook's **custom calculation** functions (the user-defined formula functions).
 *
 * @remarks
 * Mirrors `RunScriptPopupPanel` but filters `searchFunctions` by `type: 'calculation'` (not `'macro'`) and
 * inserts the chosen function via the workbook `insertFunction` command (seeds `=FN(` into the active cell)
 * instead of running a macro.
 */
export const InsertFunctionPopupPanel = memo(forwardRef<any, InsertFunctionPopupPanelProps>(
  (props: InsertFunctionPopupPanelProps, refForwarded) => {
  const {
    ...rest
  } = props;

  const workbook = useWorkbook();
  const t = useTranslator();
  const [functions, setFunctions] = useState<IFunction[]>([]);

  useEffect(() => {
    const scripts = workbook?.getScripts();
    if (!scripts) return;
    let cancelled = false;
    const checkFunctions = async () => {
      const functionsResolved = await scripts.searchFunctions({ type: 'formula' });
      if (cancelled) return; // stale fetch (workbook changed mid-flight) — don't clobber a newer result
      setFunctions(functionsResolved);
    };
    checkFunctions();
    const removeListener = scripts.addListeners({ onChange: () => { checkFunctions(); } });
    return () => { cancelled = true; removeListener(); };
  }, [workbook]);

  const commandButtonProps = {
    variant: CommandButtonType.Menuitem,
    shortcut: undefined
  }

  const functionElements = [];
  const functionsLength = functions ? functions.length : 0;
  for (let i=0; i<functionsLength; i++) {
    const fn = functions[i];
    functionElements.push(
      <CommandButton
        key={`function-${fn.getName()}-${i}`}
        {...commandButtonProps}
        commandKey={'insertFunction'}
        // `insertFunction`'s execute(arg) takes the IFunction directly (see CommandButton → command.execute(commandState)).
        commandState={fn}
        propsTooltip={{
          // UDF names are canonical (never localized) — only the surrounding prose translates.
          description: t('insertFunction.insertNamed', { name: fn.getName() ?? t('insertFunction.fallbackLabel') })
        }}
        icon={<DynamicIcon iconKey="FormulaCustom"/>}
        label={fn.getName() ?? t('insertFunction.fallbackLabel')}
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
      {functionElements.length > 0 ? (<>
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {functionElements}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
      </>): null }
      {/* Always available — open the script editor to create/edit custom functions (this is the only way in
          when there are none yet, which is why the button stays enabled rather than disabling on empty). */}
      <CommandButton
        {...commandButtonProps}
        key={`show-editor`}
        commandKey={'showScriptEditor'}
      />
    </Box>
  );

  return defaultRenderPopupPanel({...rest, children});
}));

InsertFunctionPopupPanel.displayName = 'InsertFunctionPopupPanel';
