import { createElement, type ReactElement } from 'react';

import { t } from '@sheetxl/utils';
import { Command } from '@sheetxl/utils-react';
import {
  DefaultSheetLayersRegistry, DefaultTaskPaneRegistry, PRESENCE_ICON, PRESENCE_PANE_KEY, PresenceMessages,
  PresenceStore, RangeAnnotationLayer, createPresenceCommands, isWalkedIntent, registerPresenceCommandChrome,
  type PresenceHost, type RangeAnnotation, type TaskPaneProps
} from '@sheetxl/react';

import { PresenceStrip } from './PresenceStrip';
import { PresenceTaskPane } from './PresenceTaskPane';
import { PresenceOverlay } from './PresenceOverlay';

/** What {@link PresencePlugin} hands the host to mount. */
export interface PresencePluginInstance {
  /** The session's state. Bind the live workbook with `store.bind(workbook)` once it loads. */
  store: PresenceStore;
  /** For Studio's `topRight` slot. */
  strip: ReactElement;
  /** Rendered alongside Studio: Esc clearing the agent's working cursor. */
  overlay: ReactElement;
  /** Removes everything the plugin registered and stops the store. */
  dispose(): void;
}

/** The `working` cursor is shown in the strip; on the grid it is its box alone. */
const showChip = (annotation: RangeAnnotation): boolean => isWalkedIntent(annotation.intent);

/**
 * Presence: an agent working in the view. Its findings on the grid, the strip, and the `agent` task
 * pane, fed by one {@link PresenceHost}.
 *
 * @remarks
 * Registers the task pane, the commands (`showAgentPane`, `clearAgentFindings` on the `workbook`
 * scope), their icons and chrome, and the findings layer: a `RangeAnnotationLayer` on every sheet,
 * drawing only the bound session's annotations. Returns the store and what the host mounts:
 *
 * ```tsx
 * const presence = PresencePlugin(host);
 * presence.store.bind(workbook);
 * <Studio topRight={presence.strip} />
 * {presence.overlay}
 * ```
 */
export function PresencePlugin(host: PresenceHost): PresencePluginInstance {
  const store = new PresenceStore(host);

  registerPresenceCommandChrome();
  const removeCommands = Command.DefaultCommandRegistry.registerDynamic('workbook', createPresenceCommands(store));

  const removePane = DefaultTaskPaneRegistry.registerTaskPane({
    key: PRESENCE_PANE_KEY,
    getTitle(): string {
      return t(PresenceMessages.paneTitle);
    },
    getIcon(): string {
      return PRESENCE_ICON;
    },
    component: (props: TaskPaneProps) => createElement(PresenceTaskPane, { ...props, store })
  }, true);

  // The session is read when the layer filters, so a rebind needs no new layer.
  const isMine = (annotation: RangeAnnotation): boolean => {
    const sessionId = store.getSnapshot().sessionId;
    return !!sessionId && annotation.source === sessionId;
  };
  const removeLayer = DefaultSheetLayersRegistry.register({
    key: 'presence',
    layers: createElement(RangeAnnotationLayer, {
      key: 'presence-findings', className: 'sxl-agent-highlights', filter: isMine, showChip
    })
  }, true);

  return {
    store,
    strip: createElement(PresenceStrip, { store }),
    overlay: createElement(PresenceOverlay, { store }),
    dispose(): void {
      removeLayer();
      removePane();
      removeCommands();
      store.dispose();
    }
  };
}
