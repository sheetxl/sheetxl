import React, { useState, memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { UndoManager } from '@sheetxl/utils';

import {
  UndoContext, useCommands, KeyCodes, ICommands, DynamicIcon, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitDivider, ExhibitMenuItem, ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

export interface UndoRedoCommandButtonProps extends CommandPopupButtonProps {
  quickCommand?: string;
  // command: Command<void, UndoContext>;

  undoManager?: UndoManager;

  /**
   * If true will show redo instead of undo and change text accordingly
   */
  isRedo?: boolean;

  nestRedo?: boolean;
}

// TODO - listen to undo manager for changes. (or it won't update on open which is ok for now)
export const UndoRedoCommandButton = memo(
  forwardRef<HTMLElement, UndoRedoCommandButtonProps>((props, refForwarded) => {
  const {
    quickCommand,
    icon,
    isRedo = false,
    nestRedo = true,
    // commandHook: propCommandHook,
    undoManager: propUndoManager,
    scope,
    sx: propSx,
    disabled: propDisabled,

    commands: propCommands,
    ...rest
  } = props;

  const commandKeys = [quickCommand];
  if (!isRedo && nestRedo) {
    commandKeys.push('redo');
  }
  const resolved = useCommands<any, UndoContext>(propCommands, commandKeys);
  const command = resolved[0];
  const commandRedo = resolved[1];
  const undoManager = propUndoManager ?? command?.context?.()?.undoManager;

  let disabled = propDisabled;
  if (!propDisabled) {
    disabled = !command || command.disabled();
    if (commandRedo && !commandRedo.disabled()) {
      disabled = false;
    }
  }

  const [actionCount, setActionCount] = useState<number>(0);
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    let actionText = actionCount === 0 ? `Cancel` : `${command.label()} ${actionCount} Action${actionCount === 1 ? '' : 's'}`;
    let isEmpty = false;
    if (!undoManager) {
      isEmpty = true;
    }
    if (!isEmpty) {
      if (nestRedo) {
        isEmpty = !undoManager.hasRedo() && !undoManager.hasUndo();
      } else if (isRedo) {
        isEmpty = !undoManager.hasRedo();
      } else {
        isEmpty = !undoManager.hasRedo();
      }
    }

    const handleClick = (value: number) => {
      command.execute(value as any); // , propCommandHook
    }
    const actionLabel = (
      <ExhibitMenuItem
        sx={{
          display:'flex',
          flex: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: !isEmpty ? '0 0' : undefined,
          minWidth: '180px'
        }}
        icon={<DynamicIcon/>}
        onMouseEnter={() => { setActionCount(0); }}
        onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
        onMouseUp={(e) => { if (e.button !== 0) return; handleClick(actionCount) }}
        onKeyDown={(e: React.KeyboardEvent) => {
          // button prevents space so we don't check it
          if (e.isDefaultPrevented()) return;
          if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
            handleClick(actionCount);
          }
        }}
      >
        <Typography
          component="div"
          variant="caption" // "body"
          sx={{
            fontSize: '0.875rem',
            letterSpacing: '0.01071em'
          }}
        >
          { actionText }
        </Typography>
      </ExhibitMenuItem>
    );

    if (isEmpty) return actionLabel;

    const stackCommands = isRedo ? undoManager?.getRedoDescriptions() : undoManager?.getUndoDescriptions();

    const menus = [];
    for (let i=0; i<stackCommands.length; i++) {
      const action = stackCommands[i];
      menus.push(
        <ExhibitMenuItem
          sx={{
            maxWidth: '360px', // TODO - make this the width of some piece of predetermined text
            display: 'flex',
          }}
          disabled={disabled}
          selected={i < actionCount}
          key={`action:${i}`}
          // TODO - we can find the icon from the command key
          icon={<DynamicIcon/>}
          onMouseEnter={ () => {
            setActionCount(i+1);
          } }

          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onMouseUp={(e) => { if (e.button !== 0) return; handleClick(i+1) }}
          onKeyDown={(e: React.KeyboardEvent) => {
            // button prevents space so we don't check it
            if (e.isDefaultPrevented()) return;
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
              handleClick(i+1);
            }
          }}
        >
          <Box
            sx={{
            // bold and larger
              display: 'flex',
              flex: '1 1 100%',
              flexDirection: 'row',
              alignItems: 'center',
              overflow: 'hidden'
            }}
          >
            <Typography
              // variant="body"
              component="div"
            >
              {action}
            </Typography>
            <DynamicIcon/>
          </Box>
        </ExhibitMenuItem>
      )
    }

    let nestedRedo = null;
    if (!isRedo && nestRedo) {
      const commandPopupProps = {
        scope: 'undo',
        commands,
        variant: CommandButtonType.Menuitem,
        parentFloat: props.floatReference
      }
      nestedRedo = [];
      nestedRedo.push(
        <UndoRedoCommandButton
          key={`nested:redo`}
          {...commandPopupProps}
          quickCommand={'redo'}
          isRedo={true}
        />
      );
      if (undoManager.hasRedo() && undoManager.hasUndo()) {
        nestedRedo.push(<ExhibitDivider key={`action:redo-div`} orientation="horizontal"/>);
      }
    }

    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
        onClick={() => { props.closeFloatAll() }}
        onMouseLeave={() => { setActionCount(0); }}
      >
        {nestedRedo}
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {menus}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
        {actionLabel}
      </Box>
    );

    return defaultCreatePopupPanel({...props, children});
  }, [command?.context(), command?.state(), scope, undoManager, actionCount, disabled]); // , propCommandHook

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propCommands}
      quickCommand={quickCommand}
      // commandHook={propCommandHook}
      scope={scope}
      disabled={disabled}
      label={command?.label() ?? (isRedo ? 'Redo' : 'Undo')}
      tooltip={(<><span>{`${command?.label() ?? 'No'} last actions.`}</span></>)}
      createPopupPanel={createPopupPanel}
      icon={icon ?? (isRedo ? 'Redo' : 'Undo')}
      selected={false} // ignore state
      {...rest}
    />
  );
}));