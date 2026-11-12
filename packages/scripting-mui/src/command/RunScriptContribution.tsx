import type React from 'react';
import { memo, useEffect, useReducer, useState } from 'react';

import { useCommands } from '@sheetxl/utils-react';

import { type IScript } from '@sheetxl/sdk';

import { ExhibitDivider } from '@sheetxl/utils-mui';

import { useWorkbook } from '@sheetxl/react';

import { RunScriptCommandButton, type RunScriptCommandButtonProps } from './RunScriptCommandButton';

export interface RunScriptContributionProps extends RunScriptCommandButtonProps {
  /**
   * When `true` the button is always shown (used by the view ribbon).
   *
   * @remarks
   * Otherwise it only appears when the workbook has macros or the script editor is open - this keeps
   * the run-script visibility logic with the scripting plugin rather than in the generic toolbar.
   */
  alwaysShow?: boolean;
}

/**
 * Command bar contribution wrapper for {@link RunScriptCommandButton}.
 *
 * @remarks
 * Self-gating: renders nothing (including its leading divider) until it should appear, so it can be
 * dropped into a ribbon contribution point without the host toolbar knowing scripting's rules.
 */
export const RunScriptContribution: React.FC<RunScriptContributionProps> = memo((props: RunScriptContributionProps) => {
  const {
    alwaysShow = false,
    ...rest
  } = props;

  // Re-check on command change (was `addPropertyListener` on the legacy command) via the `useCommands`
  // listener → a version bump the effect depends on.
  const [commandVersion, bumpCommandVersion] = useReducer((x: number) => x + 1, 0);
  const [commandShowScriptEditor] = useCommands(['showScriptEditor'], {
    onChange: () => bumpCommandVersion()
  });
  const workbook = useWorkbook();

  const [show, setShow] = useState<boolean>(alwaysShow);
  useEffect(() => {
    if (alwaysShow) {
      setShow(true);
      return;
    }
    const scripts = workbook?.getScripts();
    if (!scripts || !commandShowScriptEditor) {
      setShow(false);
      return;
    }
    const checkScripts = async () => {
      const isOpen: boolean = !!commandShowScriptEditor.getState();
      let hasMacros: boolean = false;
      if (!isOpen) {
        const macros = await scripts.searchFunctions({ type: 'macro' });
        hasMacros = (macros?.length ?? 0) > 0;
      }
      setShow(hasMacros || !!commandShowScriptEditor.getState());
    };
    checkScripts();
    const removeScriptListener = scripts.addListeners({
      onChange: () => {
        checkScripts();
      }
    });
    return () => {
      removeScriptListener();
    };
  }, [alwaysShow, workbook, commandShowScriptEditor, commandVersion]);

  if (!show) return null;
  return (
    <>
      <ExhibitDivider/>
      <RunScriptCommandButton {...rest}/>
    </>
  );
});
RunScriptContribution.displayName = 'RunScriptContribution';
