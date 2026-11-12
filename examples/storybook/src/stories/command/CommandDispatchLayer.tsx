import React from 'react';

import { Command } from '@sheetxl/utils-react';

import { Layer } from '@sheetxl/grid-react';

/**
 * The grid's terminal command keystroke dispatcher, ON the Stage's **synthetic** responder chain —
 * the dispatch law's "the dispatcher is the terminal handler" without mixing a native listener into
 * the grid's (otherwise synthetic) dispatch. A very-low-`zIndex` `Layer` (a pure event tap — it
 * renders no DOM), so the z-ordered layers are offered keys first (top-z down); whatever they don't
 * consume (`stopPropagation`) reaches here last and resolves up the command hierarchy via
 * `resolver.dispatchKey`.
 *
 * Pair with `<CommandAnchorProvider keyBindings={false}>` so the resolver does NOT also native-attach.
 * Drop it as a grid child (so it renders per pane, into each pane's responder chain).
 */
export const CommandDispatchLayer: React.FC = () => {
  const resolver = Command.useCommandResolver();
  if (!resolver) return null;
  // A Layer at the floor z: its tap registers the dispatcher last in the chain. Non-visual — the
  // z-slot and the keydown tap are the whole component.
  return <Layer zIndex={-1_000_000} onKeyDown={(e) => { resolver.dispatchKey(e); }} />;
};
