import React, { useState } from 'react';

import { Command } from '@sheetxl/utils-react';

const { useCommands } = Command;

export const rowStyle: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' };

/**
 * Shared story button: renders a command by key and **ripples** on every execute of that key
 * (its own click, a sibling, the imperative button, a keystroke). It just calls
 * `cmd.execute()` — which dispatches through the registry and fires `onExecute`. Its anchor +
 * cadence come from the nearest `CommandAnchorProvider`, so the button is dumb.
 */
export const CommandButton: React.FC<{ commandKey: string; onExecuted?: () => void }> = ({ commandKey, onExecuted }) => {
  const [flashing, setFlashing] = useState(false);

  const [cmd] = useCommands(commandKey, {
    onExecute: () => {
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 250);
      onExecuted?.();
    }
  });

  const disabled = cmd?.disabled() ?? true;
  const reason = cmd?.disabledReasons()?.[0];

  return (
    <button
      disabled={disabled}
      title={reason ?? undefined}
      onClick={() => cmd?.execute()}
      style={{
        minWidth: 96,
        padding: '6px 10px',
        border: '1px solid #bbb',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 250ms ease',
        background: flashing ? '#ffe08a' : '#f4f4f4'
      }}
    >
      {(cmd?.getIcon() as string) ?? ''} {cmd?.getLabel() ?? commandKey}
    </button>
  );
};
