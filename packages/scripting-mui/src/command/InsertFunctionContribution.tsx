import { memo, forwardRef, useCallback } from 'react';

import { useCommandButtonEntry } from '@sheetxl/utils-react';

import {
  CommandPopupButton, defaultRenderPopupPanel,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { InsertFunctionPopupPanel } from './InsertFunctionPopupPanel';

export interface InsertFunctionContributionProps extends CommandPopupButtonProps {}

/**
 * The **Custom Functions** popup button — the scripting plugin's contribution to the Formulas ribbon
 * (`formulaToolbar`). Opens a menu of the workbook's user-defined calculation functions ({@link
 * InsertFunctionPopupPanel}); picking one inserts it via the workbook `insertFunction` command.
 *
 * @remarks
 * Peer of the Macros button (`RunScriptContribution`). Stays **enabled even with no custom functions** — the
 * popup always offers an "Edit Script" button, which is the way to create the first one — so it never gates
 * on emptiness (the has-functions probe was dropped).
 */
export const InsertFunctionContribution = memo(
  forwardRef<HTMLElement, InsertFunctionContributionProps>((props, refForwarded) => {
  const {
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const entry = useCommandButtonEntry('customFunctionOptions');

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const panel = (
      <InsertFunctionPopupPanel
        disabled={propDisabled}
        groupKey={groupKey}
        {...props}
      />
    );
    return defaultRenderPopupPanel({...props, children: panel});
  }, [propDisabled, groupKey]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      disabled={propDisabled}
      renderPopupPanel={renderPopupPanel}
      // Head chrome from the registered `customFunctionOptions` entry (catalog-backed).
      label={entry?.getLabel?.()}
      tooltip={entry?.getDescription?.()}
      icon="FormulaCustom"
      {...rest}
    />
  )
}));

InsertFunctionContribution.displayName = 'InsertFunctionContribution';
