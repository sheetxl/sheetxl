import type React from 'react';
import { useState, memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { type UndoManager, type UndoEntry } from '@sheetxl/utils';

import {
  useCommands, useTranslator, type TranslateFn, KeyCodes, DynamicIcon, CommandButtonType
} from '@sheetxl/utils-react';

import { COMMAND_META_KEY } from '@sheetxl/react';

import {
  CommandPopupButton, defaultRenderPopupPanel, ExhibitDivider, ExhibitMenuItem, SimpleTooltip,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

/**
 * The icon of the command that made an entry, in the leading slot. Blank for an entry no command
 * made (typing, a paste, an agent's script) — the slot keeps the column aligned.
 */
const EntryCommandIcon: React.FC<{ entry: UndoEntry }> = ({ entry }) => {
  const key = entry.meta[COMMAND_META_KEY] ?? '';
  const [command] = useCommands([key]);
  const icon = key ? command?.getIcon() : undefined;
  if (!icon) return <DynamicIcon/>;
  return typeof icon === 'string' ? <DynamicIcon iconKey={icon} /> : icon;
};

/**
 * The mark for each of the SDK's author kinds (`ITransaction.Author`) other than the user's own, which
 * carries none. When authors become people (collaborators), they will come from a people service
 * instead.
 */
const AUTHOR_MARKS: Readonly<Record<string, { icon: string; label: (t: TranslateFn) => string }>> = {
  agent: { icon: 'Agent', label: (t) => t('undo.author.agent') }
};

/** Who made an entry, at its end — only for an author other than the user. */
const EntryAuthorMark: React.FC<{ entry: UndoEntry }> = ({ entry }) => {
  const t = useTranslator();
  const mark = entry.author ? AUTHOR_MARKS[entry.author] : undefined;
  if (!mark) return null;
  const label = mark.label(t);
  return (
    <SimpleTooltip disableInteractive title={label}>
      <Box component="span" role="img" aria-label={label} sx={{ display: 'inline-flex', flex: '0 0 auto', ml: 1, color: 'text.secondary' }}>
        <DynamicIcon iconKey={mark.icon} />
      </Box>
    </SimpleTooltip>
  );
};

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
    undoManager: propUndoManager,
    groupKey,
    sx: propSx,
    disabled: propDisabled,
    ...rest
  } = props;

  const commandKeys = [quickCommand ?? ''];
  if (!isRedo && nestRedo) {
    commandKeys.push('redo');
  }
  // const resolved = useCommands<any, UndoContext>(propCommands, commandKeys);

  const resolved = useCommands(commandKeys);
  const t = useTranslator();

  const command = resolved[0];
  const commandRedo = resolved[1];
  const undoManager = propUndoManager ?? command?.getContext?.()?.undoManager;

  let disabled = propDisabled;
  if (!propDisabled) {
    disabled = !command || command.disabled();
    if (commandRedo && !commandRedo.disabled()) {
      disabled = false;
    }
  }

  const [actionCount, setActionCount] = useState<number>(0);
  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    let actionText = actionCount === 0 ? `Cancel` : `${command?.getLabel()} ${actionCount} Action${actionCount === 1 ? '' : 's'}`;
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
      command?.execute(value as any);
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
        icon={null}  /* we don't want left padding for Cancel */
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

    // Stack entries are stored canonically — a `messageKey` (see `@sheetxl/utils` `messageKey`), not text —
    // so they must be resolved HERE, at display time, exactly like the `undo`/`redo` command's own
    // `action` param. `t(key)` passes plain-text descriptions through unchanged, so both forms render.
    const stackEntries = isRedo ? undoManager?.getRedoEntries() : undoManager?.getUndoEntries();

    const menus = [];
    for (let i=0; i<stackEntries.length; i++) {
      const entry = stackEntries[i];
      const action = t(entry.description);
      menus.push(
        <ExhibitMenuItem
          sx={{
            maxWidth: '360px', // TODO - make this the width of some piece of predetermined text
            display: 'flex',
          }}
          disabled={disabled}
          selected={i < actionCount}
          key={`action:${i}`}
          icon={<EntryCommandIcon entry={entry} />}
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
              noWrap
              sx={{ flex: '1 1 auto', minWidth: 0 }}
            >
              {action}
            </Typography>
            <EntryAuthorMark entry={entry} />
          </Box>
        </ExhibitMenuItem>
      )
    }

    let nestedRedo = null;
    if (!isRedo && nestRedo) {
      const commandPopupProps = {
        groupKey: 'undo',
        variant: CommandButtonType.Menuitem,
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
        onClick={() => { props.closeFloatAll?.() }}
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

    return defaultRenderPopupPanel({...props, children});
  }, [command?.getContext(), command?.getState(), groupKey, undoManager, actionCount, disabled, t]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={quickCommand}
      groupKey={groupKey}
      disabled={disabled}
      label={command?.getLabel(groupKey) ?? (isRedo ? 'Redo' : 'Undo')}
      tooltip={(<><span>{`${command?.getLabel() ?? 'No'} last actions.`}</span></>)}
      renderPopupPanel={renderPopupPanel}
      icon={icon ?? (isRedo ? 'Redo' : 'Undo')}
      selected={false} // ignore state
      {...rest}
    />
  );
}));