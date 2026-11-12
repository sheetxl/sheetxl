import { createContext, useContext, useSyncExternalStore } from 'react';

import { type FloatReference } from './useFloatStack';
import { type FloatRoot } from './_FloatUtils';

/**
 * Carries the current {@link FloatReference} down the React tree (including
 * across portals) so that nested floats can discover their logical parent
 * without prop drilling.
 *
 * `null` means "no ancestor float" and {@link useFloatStack} resolves this to
 * the global root.
 *
 * @remarks
 * React context propagates through `createPortal`, so a float that renders its
 * surface into a portal still provides this to the content rendered inside it.
 */
const FloatStackContext = createContext<FloatReference | null>(null);

/**
 * Provides the current {@link FloatReference} to descendants.
 *
 * {@link useFloatStack} wraps its own popup content with this automatically, so
 * nested popup buttons inherit their parent float. Ambient (non-popup) floats
 * that render their children inline (e.g. a toolbar) should wrap those children
 * with this provider explicitly.
 */
export const FloatStackProvider = FloatStackContext.Provider;

/**
 * Returns the {@link FloatReference} of the enclosing region (i.e. the float
 * this component is rendered inside), or `null` when there is no ancestor float.
 *
 * @remarks
 * This is the float you would nest under, so from a child's perspective it is
 * the "parent". A component that owns a float (via {@link useFloatStack}) gets
 * its own reference from that hook; `useFloat` returns the one *above* it.
 *
 * Use this in any component that needs the enclosing float without owning one —
 * e.g. a menu item calling `closeChild()` on hover to dismiss an open sibling
 * submenu. Such components are not reached by props, only by context.
 */
export const useFloat = (): FloatReference | null => {
  return useContext(FloatStackContext);
};

const noSubscribe = (): (() => void) => () => {};

/**
 * Whether a popup (a menu, a picker, a panel) is showing that this component is not inside (reactive).
 *
 * @remarks
 * For transient UI that stands aside while the user is in a popup. Content of the popup itself reads
 * `false`, so a tooltip belonging to the menu still shows. A float with no popup (a toolbar) does not count.
 */
export const useFloatPopupOpen = (): boolean => {
  const enclosing = useFloat();
  const root = enclosing?.getRoot() as FloatRoot | undefined;
  return useSyncExternalStore(
    root?.subscribeOpenPopups ?? noSubscribe,
    () => root?.isPopupOpenOutside(enclosing) ?? false,
    () => false
  );
};
