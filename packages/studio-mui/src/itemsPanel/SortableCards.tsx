import type React from 'react';
import { memo, useMemo, useRef } from 'react';

import clsx from 'clsx';

import {
  DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type Modifier
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS, useIsomorphicLayoutEffect } from '@dnd-kit/utilities';

import { Box } from '@mui/material';
import { type Theme } from '@mui/material';

export interface SortableCardsProps {
  /**
   * The card ids, in display order. Must match the `id` each {@link SortableCard} was given.
   */
  ids: string[];
  /**
   * Called on drop with the display indices. The model write; the list re-renders from it.
   */
  onMove: (indexFrom: number, indexTo: number) => void;
  /**
   * The scrollable list container, to scope auto-scroll — dnd-kit otherwise offers the document
   * scrolling element as a scroll target and will scroll the page on drag.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

/** Marks a card wrapper for {@link useReorderFlip} and the drag bounds; the value is the card's stable id. */
const FLIP_ATTR = 'data-sxl-flip';

/** The vertical extent the resting cards occupy, in the frame dnd-kit measures the dragged node in. */
interface CardBounds {
  top: number;
  bottom: number;
}

/* Measured at drag start, from the cards themselves: the list container is not the right bound —
   it can hold more than the cards (the sort dialog's "then by" row sits after them, inside the
   scroller), and a container restriction would let the drag run out over that. Taken once rather
   than live so it stays in the same frame as `draggingNodeRect`, which dnd-kit also measures at
   drag start and does not shift when the list auto-scrolls. */
const measureCardBounds = (container: HTMLElement | null): CardBounds | null => {
  if (!container) return null;
  const cards = container.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`);
  if (cards.length === 0) return null;
  let top = Infinity;
  let bottom = -Infinity;
  for (let i=0; i<cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    if (rect.top < top) top = rect.top;
    if (rect.bottom > bottom) bottom = rect.bottom;
  }
  return { top, bottom };
};

/**
 * Drag-reorder context for an {@link ItemsPanel} card list.
 *
 * @remarks
 * Deliberately leaner than the TabStrip `Sortable`: a vertical list dragging inside its own
 * scroll container needs no `DragOverlay` — the card never leaves its `@scope` root, so none of
 * the portal/theme-scope carrying applies. The drag is restricted to the vertical axis and the
 * list bounds instead.
 */
export const SortableCards = memo((props: SortableCardsProps) => {
  const { ids, onMove, scrollRef, children } = props;

  const sensors = useSensors(
    // The distance constraint is what keeps the card's interactive content working: a click that
    // never travels never becomes a drag, so click-to-edit titles and the action buttons are
    // untouched.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch holds briefly first, so plain swipes still scroll the list.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  );

  const refBounds = useRef<CardBounds | null>(null);
  const modifiers = useMemo<Modifier[]>(() => {
    // The drag stops where the resting cards sit: no further up than the first, or down than the last.
    const restrictToCards: Modifier = ({ draggingNodeRect, transform }) => {
      const bounds = refBounds.current;
      if (!draggingNodeRect || !bounds) return transform;
      if (draggingNodeRect.top + transform.y < bounds.top) {
        return { ...transform, y: bounds.top - draggingNodeRect.top };
      }
      if (draggingNodeRect.bottom + transform.y > bounds.bottom) {
        return { ...transform, y: bounds.bottom - draggingNodeRect.bottom };
      }
      return transform;
    };
    return [restrictToVerticalAxis, restrictToCards];
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={modifiers}
      onDragStart={() => { refBounds.current = measureCardBounds(scrollRef.current); }}
      onDragCancel={() => { refBounds.current = null; }}
      autoScroll={{
        canScroll: (element: Element) => {
          // Only auto-scroll the list's own container — never the page itself. (Same guard as the
          // TabStrip: the webview document can be scrolled programmatically even when
          // overflow:hidden, so without this a drag can shift the whole <html> element.)
          if (
            element === document.scrollingElement ||
            element === document.documentElement ||
            element === document.body
          ) {
            return false;
          }
          const container = scrollRef.current;
          return !!container && (element === container || element.contains(container));
        }
      }}
      onDragEnd={(event: DragEndEvent) => {
        refBounds.current = null;
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const indexFrom = ids.indexOf(String(active.id));
        const indexTo = ids.indexOf(String(over.id));
        if (indexFrom === -1 || indexTo === -1 || indexFrom === indexTo) return;
        onMove(indexFrom, indexTo);
      }}
    >
      <SortableContext
        items={ids}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
});

SortableCards.displayName = 'SortableCards';

/**
 * FLIP-animates the cards through non-drag layout changes: the move up/down buttons, and the
 * shifts around an add or delete.
 *
 * @param container The list container the card wrappers live in.
 * @param enabled Off = no tracking at all (the `dragReorder` flag).
 * @param skipNext Set before a model write to hand that one layout change to dnd-kit instead —
 * a drop is animated by `useSortable` itself (`wasDragging`), and a second animation on top of
 * it would fight it.
 *
 * @remarks
 * dnd-kit's own layout-change animation (`animateLayoutChanges: () => true`) is NOT used for
 * this, deliberately: it sets the inverted transform in a layout effect and clears it in a
 * passive effect, assuming the browser paints in between. A reorder here produces more than one
 * change event, and the follow-up render flushes those effects before paint — both transform
 * states then collapse into a single style pass and no animation plays (intermittently, since it
 * is a race). This version is immune: it writes both states imperatively with a forced style
 * flush between them, so the browser is guaranteed to see the offset start position.
 *
 * Positions are read via `offsetTop`, which ignores transforms — re-running mid-animation (or
 * mid-drag, where dnd-kit is transforming the cards) sees the stable layout and does nothing.
 */
export function useReorderFlip(
  container: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  skipNext: React.RefObject<boolean>
): void {
  const previousTops = useRef<Map<string, number>>(new Map());

  // No dependency array: runs after every commit, diffing layout positions against the last pass.
  useIsomorphicLayoutEffect(() => {
    if (!enabled || !container.current) {
      previousTops.current = new Map();
      return;
    }
    const previous = previousTops.current;
    const next = new Map<string, number>();
    const moved: { element: HTMLElement; delta: number }[] = [];
    const elements = container.current.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`);
    for (let i=0; i<elements.length; i++) {
      const element = elements[i];
      const id = element.getAttribute(FLIP_ATTR)!;
      const top = element.offsetTop;
      next.set(id, top);
      const previousTop = previous.get(id);
      if (previousTop !== undefined && previousTop !== top) {
        moved.push({ element, delta: previousTop - top });
      }
    }
    previousTops.current = next;
    if (moved.length === 0) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    for (const { element, delta } of moved) {
      element.style.transition = 'none';
      element.style.transform = `translateY(${delta}px)`;
    }
    // The step React effect timing cannot guarantee: commit the offset start state NOW.
    void container.current.offsetHeight;
    for (const { element } of moved) {
      element.style.transition = 'transform 200ms ease';
      element.style.transform = '';
      element.addEventListener('transitionend', function onEnd() {
        element.style.transition = '';
        element.removeEventListener('transitionend', onEnd);
      });
    }
  });
}

export interface SortableCardProps {
  /**
   * Stable id, the same one used as the React key.
   */
  id: string;
  /**
   * Read-only card — listed and displaced by drags, but not draggable itself.
   */
  disabled?: boolean;
  children: React.ReactNode;
}

/** Drag must never start from the card's own controls — a drag inside a text field is a text
 *  selection. `[role="combobox"]` covers the MUI `Select`, whose activator is a plain `div`. */
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a[href], [contenteditable="true"], [role="combobox"]';

/**
 * Sortable wrapper around one {@link ItemCard}. The card itself stays drag-unaware; this wrapper
 * owns the dnd-kit node ref, transform and activation listeners.
 */
export const SortableCard = memo((props: SortableCardProps) => {
  const { id, disabled, children } = props;

  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    listeners
  } = useSortable({
    id,
    disabled
    // Default animateLayoutChanges on purpose: dnd-kit animates drag/drop layout changes only,
    // and useReorderFlip owns every other reorder — see its remarks.
  });

  const filteredListeners = useMemo(() => {
    if (!listeners) return listeners;
    const filtered: typeof listeners = {};
    for (const [name, handler] of Object.entries(listeners)) {
      filtered[name] = (event: any, ...args: any[]) => {
        const target = event?.target as HTMLElement | null;
        if (target?.closest?.(INTERACTIVE_SELECTOR)) return;
        handler(event, ...args);
      };
    }
    return filtered;
  }, [listeners]);

  return (
    <Box
      ref={setNodeRef}
      {...filteredListeners}
      {...{ [FLIP_ATTR]: id }}
      className={clsx('sxl-sortable-card', { 'sxl-dragging': isDragging, 'sxl-drag-disabled': disabled })}
      sx={{
        flex: '0 0 auto',
        // Matches the card's radius so the drag shadow follows its corners.
        borderRadius: (theme: Theme) => theme.spacing(1.25),
        boxShadow: isDragging ? 6 : undefined,
        // The whole card is the handle, so it carries the open-hand affordance. It does not
        // reach the card's own controls: each already sets the cursor its role implies (a
        // button's `pointer`, a field's caret), and those override an inherited one.
        ...(disabled ? null : {
          cursor: isDragging ? 'grabbing' : 'grab',
          // The hand closes on press, not on the 6px of travel the sensor waits for before the
          // press becomes a drag. A press that never travels just opens again on release.
          '&:active': { cursor: 'grabbing' }
        }),
        ...(isDragging ? {
          // Mid-drag the gesture owns the pointer: the card slides under it, and without this the
          // cursor would flicker back to a control's own as one passes beneath.
          '& *': { cursor: 'grabbing !important' },
          // A card's own background can be transparent (it sits on the dialog's); mid-drag it
          // passes OVER its siblings, and see-through reads as broken rather than floating.
          backgroundColor: (theme: Theme) => theme.palette.background.paper
        } : null)
      }}
      style={{
        // Translate only — the vertical strategy can emit a scale between different-height cards,
        // which would squash the dragged card.
        transform: CSS.Translate.toString(transform),
        transition,
        touchAction: 'manipulation',
        ...(isDragging ? { position: 'relative' as const, zIndex: 1 } : null)
      }}
    >
      {children}
    </Box>
  );
});

SortableCard.displayName = 'SortableCard';
