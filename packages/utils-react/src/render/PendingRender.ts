import React, { createContext, useContext, useEffect } from 'react';

const pendingByScope = new WeakMap<object, Set<Promise<void>>>();

/**
 * Drawing that finishes after its first paint: a picture whose bytes are still coming, a chart
 * still laying out. A view holds its scope open while it draws; a capture of the scope (a
 * screenshot, an export) waits on {@link whenRenderSettled} before it reads the screen.
 *
 * @remarks
 * A scope is any object the work belongs to, usually the workbook. A view finds it from the
 * nearest {@link PendingRenderScope}, so it need not know what it belongs to. Only views that have
 * rendered can hold it open: render what is to be captured first.
 */
export namespace PendingRender {
  /**
   * Holds `scope` open until the returned release is called. Releasing twice is harmless.
   *
   * @returns The release.
   */
  export function begin(scope: object): () => void {
    let pending = pendingByScope.get(scope);
    if (!pending) {
      pending = new Set();
      pendingByScope.set(scope, pending);
    }
    let done: () => void = () => {};
    const drawn = new Promise<void>((resolve) => { done = resolve; });
    pending.add(drawn);
    let released = false;
    const held = pending;
    return (): void => {
      if (released) return;
      released = true;
      held.delete(drawn);
      done();
    };
  }

  /** Whether anything holds `scope` open. */
  export function isPending(scope: object): boolean {
    return (pendingByScope.get(scope)?.size ?? 0) > 0;
  }
}

/**
 * Resolves once nothing holds `scope` open, including drawing that starts while it waits. Wait for
 * the next paint after it before reading the screen.
 */
export const whenRenderSettled = async (scope: object): Promise<void> => {
  const pending = pendingByScope.get(scope);
  while (pending && pending.size > 0) await Promise.allSettled([...pending]);
};

const ScopeContext = createContext<object | null>(null);

/** Props for {@link PendingRenderScope}. */
export interface PendingRenderScopeProps {
  /** What the drawing below belongs to, usually the workbook; `null` for none. */
  scope: object | null;
  children?: React.ReactNode;
}

/** Names the scope the drawing below holds open with {@link usePendingRender}. */
export const PendingRenderScope = (props: PendingRenderScopeProps): React.ReactElement => {
  return React.createElement(ScopeContext.Provider, { value: props.scope }, props.children);
};

/**
 * Holds the scope open while `pending` is `true`, for {@link whenRenderSettled}; released when it
 * turns `false` or the component unmounts.
 *
 * @param scope The scope; the nearest {@link PendingRenderScope}'s when omitted. With neither,
 *   nothing is held.
 */
export const usePendingRender = (pending: boolean, scope?: object | null): void => {
  const fromContext = useContext(ScopeContext);
  const held = scope === undefined ? fromContext : scope;
  useEffect(() => {
    if (!held || !pending) return undefined;
    return PendingRender.begin(held);
  }, [held, pending]);
};
