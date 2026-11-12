import type React from 'react';
import { memo, forwardRef } from 'react';

import { Box } from '@mui/material';

import { type IMovable } from '@sheetxl/sdk';

import { CommandButtonType, useCommandButtonRegistry, type FloatReference } from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

import { renderMembers } from '@sheetxl/utils-mui';

export interface MovableContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {

  movable: IMovable;

  disabled?: boolean;

  floatReference: FloatReference;
}

/**
 * Context menu for a movable elements.
 */
export const MovableContextMenu = memo(forwardRef<HTMLDivElement, MovableContextMenuProps>(
  (props: MovableContextMenuProps, refForwarded) => {
  const {
    movable,
    disabled: propDisabled,
    floatReference,
    ...rest
  } = props;

  useModelListener<IMovable, IMovable.IListeners>(movable, {
    onAnyChange(_source: IMovable): void {

    }
  });

  const registry = useCommandButtonRegistry();

  // No `beforeExecute → closeAll`: dismiss-on-execute is owned by the enclosing float. The `useCommands`
  // observer closes the float published via `FloatStackProvider` on execute (honoring `quickAction`) —
  // the same float this menu's `floatReference` points at, so the hook was redundant.
  const commandProps = {
    disabled: propDisabled,
  };

  // The drawing menu is fully static, so its entire shape (plus any host contributions) lives in the
  // registered `movableContextMenu` surface.
  const children = renderMembers(registry.resolveMembers('movableContextMenu') ?? [], {
    variant: CommandButtonType.Menuitem,
    dividerOrientation: 'horizontal',
    groupKey: 'movableContextMenu',
    registry,
    propsCommandButton: commandProps,
    propsCommandPopup: commandProps
  });

  return (
    <Box
      ref={refForwarded}
      sx={{
        paddingTop: '4px', // TODO - size of rounded border from theme
        paddingBottom: '4px', // TODO - size of rounded border from theme
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}));

MovableContextMenu.displayName = 'MovableContextMenu';
