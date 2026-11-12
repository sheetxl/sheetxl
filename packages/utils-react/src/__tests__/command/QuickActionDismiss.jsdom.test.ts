import { describe, it, expect, vi } from 'vitest';

import { createElement, type ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { CommandScope } from '../../command/CommandScope';
import { CommandScopeProvider } from '../../command/CommandScopeContext';
import { CommandAnchorProvider } from '../../command/CommandAnchorProvider';
import { ManualActivation } from '../../command/ActivationTracker';
import { QUICK_ACTION_TAG } from '../../command/tags';
import { useCommands } from '../../command/useCommands';
import { FloatStackProvider } from '../../float/FloatStackContext';
import { type FloatReference } from '../../float/useFloatStack';
import { type ResolvedCommand } from '../../command/createResolvedCommand';

/**
 * Dismiss-on-execute is a CONTAINER behavior: `useCommands` closes the enclosing float when any
 * command it observes executes, so menus auto-close with no per-item wiring. The `quickAction` tag is
 * the opt-out for the quick-button rows a popup leads with (font size ±, indent ±, decimals, the
 * number-format styles) — they apply in place and are meant to be pressed repeatedly.
 *
 * The opt-out has to ride the command, not the surface: an execute notifies EVERY mounted observer of
 * the key, and a co-observer elsewhere (the same command on the toolbar, whose float is the popup's
 * ancestor) would otherwise close the popup out from under the quick button.
 */
describe('useCommands — quickAction opts out of dismiss-on-execute', () => {
  const setup = async (): Promise<{
    commands: Record<string, ResolvedCommand | undefined>;
    closeAll: ReturnType<typeof vi.fn>;
    unmount: () => Promise<void>;
  }> => {
    const app = new CommandScope('app');
    app.updateCommand('formatIndentIncrease', { callback: () => {}, tags: ['mutator', QUICK_ACTION_TAG] });
    app.updateCommand('clearContents', { callback: () => {}, tags: ['mutator'] });

    const closeAll = vi.fn();
    const float = { closeAll, closeChild: vi.fn(), close: vi.fn() } as unknown as FloatReference;

    const commands: Record<string, ResolvedCommand | undefined> = {};
    const Probe = (): null => {
      const [quick, plain] = useCommands(['formatIndentIncrease', 'clearContents']);
      commands.quick = quick;
      commands.plain = plain;
      return null;
    };

    const node: ReactElement = createElement(CommandScopeProvider, { scope: app },
      createElement(CommandAnchorProvider, { tracker: new ManualActivation(app), keyBindings: false },
        createElement(FloatStackProvider, { value: float }, createElement(Probe))
      )
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(node); });

    return {
      commands,
      closeAll,
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  it('leaves the enclosing float open for a quickAction command', async () => {
    const { commands, closeAll, unmount } = await setup();
    await act(async () => { await commands.quick?.execute(); });
    expect(closeAll).not.toHaveBeenCalled();
    await unmount();
  });

  it('still dismisses for an untagged command', async () => {
    const { commands, closeAll, unmount } = await setup();
    await act(async () => { await commands.plain?.execute(); });
    expect(closeAll).toHaveBeenCalled();
    await unmount();
  });
});
