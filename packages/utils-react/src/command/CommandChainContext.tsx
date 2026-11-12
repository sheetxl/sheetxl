import { createContext, useContext } from 'react';

import { type RemoveListener } from '@sheetxl/utils';

import { type CommandScope } from './CommandScope';

/**
 * A **z-ordered command-parent chain** a declarative scope can join — the *mechanism 1* seam for **#5**
 * (design/COMMAND-DESIGN.md §"Layered resolver"): grid layers are DOM siblings but must resolve as a
 * command-parent chain ordered by z. `register` slots `scope` into the chain at `order` (higher = deeper =
 * wins the cascade) with **reparent-on-insert**, and returns an unregister. A pane's {@link LayerActivation}
 * is the concrete implementation; this interface is what a chain-aware {@link CommandScopeProvider} needs,
 * so `utils-react` stays free of any grid dependency.
 */
export interface CommandChain {
  /** Join `scope` to the chain at `order` (reparent-on-insert). Returns an unregister that re-chains the rest. */
  register(scope: CommandScope, order: number): RemoveListener;
}

/**
 * The ambient z-chain a layer's {@link CommandScopeProvider} joins, or `null` **outside** a chain — the
 * ordinary case where a provider parents to its React ancestor scope. Provided **per pane** (by the grid's
 * `wrapPane` seam). A `CommandScopeProvider` that joins a chain provides `null` to its own descendants, so
 * nested features parent normally rather than re-joining.
 */
export const CommandChainContext = createContext<CommandChain | null>(null);

/** The ambient {@link CommandChain}, or `null` outside a chain-providing region (a pane). */
export function useCommandChain(): CommandChain | null {
  return useContext(CommandChainContext);
}

/**
 * The ambient **order** (a layer's z) a {@link CommandScopeProvider} joins the {@link CommandChain} at. `0`
 * outside a stacking context. A layer supplies its own z via the `order` prop (its `useLayer().zIndex`) which
 * takes precedence over this context — the one grid-aware value, kept out of `utils-react`.
 */
export const CommandOrderContext = createContext<number>(0);

/** The ambient join order (a layer's z), or `0` outside a stacking context. */
export function useCommandOrder(): number {
  return useContext(CommandOrderContext);
}
