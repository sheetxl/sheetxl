import { memo, useEffect } from 'react';

import type { CommandContributionComponentProps } from '@sheetxl/utils-react';

import { useTaskPaneArea, type WorkbookCommandContributorData } from '@sheetxl/react';

import { ANOMALIES_PANE_KEY, SHOW_ANOMALIES_PANE } from './_source';

/**
 * The per-workbook behavior of `showAnomaliesPane`: toggles the Anomalies pane. Its state is whether
 * the pane is open, so a button on it reads as a toggle.
 */
export const AnomaliesCommands = memo((props: CommandContributionComponentProps<WorkbookCommandContributorData>) => {
  const { scope } = props;
  const taskPaneArea = useTaskPaneArea();
  // A derived boolean, not `getOpen()` itself: that is a fresh array every render.
  const isOpen = taskPaneArea.getOpen().includes(ANOMALIES_PANE_KEY);

  useEffect(() => {
    if (!scope) return undefined;
    const contribution = scope.contribution();
    contribution.updateCommand<boolean>(SHOW_ANOMALIES_PANE, {
      // Reads and writes nothing of the workbook's.
      tags: ['noTransaction', 'noRepeat'],
      state: isOpen,
      callback: () => {
        if (taskPaneArea.getOpen().includes(ANOMALIES_PANE_KEY)) {
          void taskPaneArea.close(ANOMALIES_PANE_KEY);
        } else {
          taskPaneArea.activate(ANOMALIES_PANE_KEY);
        }
      }
    });
    return () => { contribution.remove(); };
  }, [scope, taskPaneArea, isOpen]);

  return null;
});

AnomaliesCommands.displayName = 'AnomaliesCommands';
