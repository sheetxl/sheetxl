import type React from 'react';
import { useState, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';

import {
  CommandButtonType, useCommandButtonRegistry, useTranslator,
  type CommandButtonEntry, type FloatReference
} from '@sheetxl/utils-react';

import { type IWorkbook } from '@sheetxl/sdk';

import { useModelListener, type TabStripRef } from '@sheetxl/react';

import {
  ExhibitMenuItem, renderMembers
} from '@sheetxl/utils-mui';

export interface SheetTabMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook.
   */
  workbook: IWorkbook;

  index?: number;

  /** The panel/group the menu's commands resolve labels against (default `'sheet'`). */
  groupKey?: string;
  disabled?: boolean;

  floatReference: FloatReference;

  tabStripRef?: TabStripRef;
}

/**
 * Menu for sheet tab operations such as renaming, deleting, and coloring.
 */
export const SheetTabMenu = memo(forwardRef<HTMLDivElement, SheetTabMenuProps>(
  (props: SheetTabMenuProps, refForwarded) => {
  const {
    workbook,
    index,
    groupKey = "sheet",
    disabled: propDisabled,
    floatReference,
    className: propClassName,
    tabStripRef,
    ...rest
  } = props;

  // The flag, not the protection object — see `WorkbookStrip`.
  const [structureAllowed, setStructureAllowed] = useState<boolean>(() => workbook?.getProtection().isStructureAllowed() ?? true);
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onProtectionChange: (source: IWorkbook) => {
      setStructureAllowed(source?.getProtection().isStructureAllowed() ?? true);
    },
  });

  const registry = useCommandButtonRegistry();
  const t = useTranslator();

  // No `beforeExecute → closeAll`: dismiss-on-execute is owned by the enclosing float. The `useCommands`
  // observer closes the float published via `FloatStackProvider` on execute (honoring `quickAction`) —
  // the same float this menu's `floatReference` points at, so the hook was redundant.
  const shared = {
    disabled: propDisabled || index === undefined,
  };

  // Weave the bespoke "Rename" trigger (an inline tab-strip edit, not a command) in right after
  // `deleteSheet`; everything else comes from the registered `sheetTabMenu` surface + host contributions.
  const members: (string | '-' | null | CommandButtonEntry)[] = [];
  const base = registry.resolveMembers('sheetTabMenu') ?? [];
  for (let i=0; i<base.length; i++) {
    members.push(base[i]);
    if (base[i] === 'deleteSheet') {
      members.push({
        render: () => (
          <ExhibitMenuItem
            onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); }}
            onMouseUp={() => {
              Promise.resolve(floatReference.closeAll()).then(() => {
                if (index !== undefined) tabStripRef?.startEdit(index);
              });
            }}
            disabled={propDisabled || !structureAllowed}
          >
            {groupKey !== 'sheet' ? t('sheetTab.renameSheet') : t('sheetTab.rename')}
          </ExhibitMenuItem>
        )
      });
    }
  }

  // `commandState: index` targets the right-clicked tab; `groupKey` keeps the command labels
  // resolving against the menu's group (default `sheet`).
  const children = renderMembers(members, {
    variant: CommandButtonType.Menuitem,
    dividerOrientation: 'horizontal',
    groupKey,
    commandState: index,
    registry,
    propsCommandButton: shared,
    propsCommandPopup: shared
  });

  return (
    <Box
      ref={refForwarded}
      className={clsx("menu", propClassName)}
      {...rest}
    >
      {children}
    </Box>
  );
}));

SheetTabMenu.displayName = "SheetTabMenu";
