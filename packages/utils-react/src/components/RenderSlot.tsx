import type React from 'react';

/**
 * A render slot: given its props, returns what to draw. Hooks are allowed — a host mounts the slot through
 * {@link RenderSlot}, so they belong to that component.
 */
export type RenderSlotFn<P> = (props: P) => React.ReactNode;

export interface RenderSlotProps<P> {
  /** The slot's renderer. `null` or `undefined` renders nothing. */
  render: RenderSlotFn<P> | null | undefined;
  /** Handed to `render`. */
  props: P;
}

/**
 * Mounts a render slot as its own component, so a renderer may call hooks however (and wherever) the host
 * renders it — inside a `useMemo`, a conditional, or a portal built in an effect.
 *
 * @remarks
 * Its type never changes, so an inline arrow passed as `render` does not remount it. A renderer's hooks
 * therefore persist across renderers: swapping between two renderers that call different hooks breaks the
 * hook order, the same as a component that changes the hooks it calls. Give the slot a `key` per renderer
 * if a host must swap them.
 *
 * Draw functions on a hot path (`renderCell`) are called directly, not through a slot, and must not call
 * hooks.
 *
 * @example
 * ```tsx
 * <RenderSlot render={renderCommentCard} props={{ sheet, coords, comment }} />
 * ```
 */
export const RenderSlot = <P,>(slot: RenderSlotProps<P>): React.ReactNode => {
  const { render, props } = slot;
  return render ? render(props) : null;
};
