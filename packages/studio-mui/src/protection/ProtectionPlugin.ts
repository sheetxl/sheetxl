import type React from 'react';

import { defineLazyModule } from '@sheetxl/utils';
import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

const ManageProtectionTaskPaneModule = defineLazyModule('studio:manageProtectionTaskPane', () => import('./ManageProtectionTaskPane'));
const ManageProtectionTaskPane = lazyPanel(() => ManageProtectionTaskPaneModule.load().then((m) => ({ default: m.ManageProtectionTaskPane })));
const ProtectedRangeDetailsTaskPane = lazyPanel(() => ManageProtectionTaskPaneModule.load().then((m) => ({ default: m.ProtectedRangeDetailsTaskPane })));

/**
 * Registers the **Manage Protection** pane.
 *
 * @remarks
 * Replaces `ProtectedRangePlugin`. The retired `protectedRangeDetails` key stays registered as an
 * alias so a host that activates it by name still lands somewhere sensible — the same pane, opened
 * on Ranges. Nothing in the product references it any more; `manageProtectedRange` (the
 * Data ribbon and the context menu) opens `manageProtection` with the tab as its argument.
 */
export const ProtectionPlugin = (): (() => void) => {
  const removeManage = DefaultTaskPaneRegistry.registerTaskPane({
    key: TaskPaneKey.Protection,
    component: ManageProtectionTaskPane
  }, true);

  const removeRangeDetails = DefaultTaskPaneRegistry.registerTaskPane({
    key: 'protectedRangeDetails',
    getTitle(): string {
      return 'Manage Protection';
    },
    getIcon(): React.ReactElement | string {
      return 'Lock';
    },
    component: ProtectedRangeDetailsTaskPane
  }, true);

  return (): void => {
    removeManage();
    removeRangeDetails();
  };
}
