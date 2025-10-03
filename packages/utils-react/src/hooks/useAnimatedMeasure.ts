import { useRef, useEffect, useCallback, useReducer, useState } from 'react';
import { useMeasure } from 'react-use';

// in react-use. import is giving error
// import { type UseMeasureRect } from 'react-use';
declare type UseMeasureRect = Pick<DOMRectReadOnly, 'x' | 'y' | 'top' | 'left' | 'right' | 'bottom' | 'height' | 'width'>;

const STILLNESS_THRESHOLD = 3; // frames of no movement to consider animation stopped
const BOUNDS_THRESHOLD = 0.5; // threshold for considering bounds changed (pixels)
const MAX_HIERARCHY_DEPTH = 50; // maximum parent elements to monitor for animations

/** Convert DOMRect to UseMeasureRect format */
const rectToMeasureRect = (rect: DOMRect): UseMeasureRect => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
  top: rect.top,
  left: rect.left,
  right: rect.right,
  bottom: rect.bottom
});

export interface UseAnimatedMeasureOptions {
  /** Threshold in pixels for detecting bounds changes (default: 0.1) */
  threshold?: number;
  /** Number of frames without movement to consider animation stopped (default: 3) */
  stillnessThreshold?: number;
  /** Maximum parent elements to monitor for animations (default: 50) */
  maxHierarchyDepth?: number;
}

/**
 * Enhanced version of useMeasure that provides real-time measurements during animations.
 *
 * Use for components that don't sit within the component hierarchy but could be animated.
 * (for examples portal elements; menus, tooltips)
 *
 * Unlike the standard useMeasure hook which relies on ResizeObserver (which doesn't trigger
 * during CSS transform animations), this hook actively monitors element bounds using
 * requestAnimationFrame and CSS animation/transition events.
 *
 * @remarks
 * - Monitors all bounds properties: x, y, width, height, top, left, right, bottom
 * - Detects animations on the element itself and all parent elements
 * - Uses both position polling and event-based detection for optimal performance
 * - Automatically stops monitoring when animations complete to save resources
 *
 * @example
 * ```tsx
 * const [ref, bounds] = useAnimatedMeasure<HTMLDivElement>();
 *
 * return (
 *   <div ref={ref} style={{ transform: 'translateX(100px)' }}>
 *     Position: {bounds?.x}, {bounds?.y}
 *   </div>
 * );
 * ```
 */
export function useAnimatedMeasure<T extends Element = HTMLDivElement>(
  options: UseAnimatedMeasureOptions = {}
) {
  const {
    threshold = BOUNDS_THRESHOLD,
    stillnessThreshold = STILLNESS_THRESHOLD,
    maxHierarchyDepth = MAX_HIERARCHY_DEPTH
  } = options;
  const [ref, bounds] = useMeasure<T>();
  const elementRef = useRef<T | null>(null);
  const [_, forceRender] = useReducer((s: number) => s + 1, 0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastRectRef = useRef({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 });

  // Enhanced ref that captures the element and forwards to useMeasure
  const enhancedRef = useCallback((node: T | null) => {
    elementRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    }
  }, [ref]);

  const [enhancedBounds, setEnhancedBounds] = useState<UseMeasureRect | null>(bounds);

  // Update enhanced bounds when standard bounds change (for non-animated cases)
  useEffect(() => {
    if (bounds && !enhancedBounds) {
      // console.log('🎨 Enhanced bounds set:', bounds);
      setEnhancedBounds(bounds);
    }
  }, [bounds, enhancedBounds]);

  // Generic animation detection using position changes
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let isAnimating = false;
    let stillnessCounter = 0;

    const detectAnimation = () => {
      if (!element) return;

      // Monitor all bounds properties for changes (position, size, and computed bounds)
      const rect = element.getBoundingClientRect();
      const lastRect = lastRectRef.current;

      // Check if any bounds property has changed beyond the threshold
      const hasMovement =
        Math.abs(rect.x - lastRect.x) > threshold ||
        Math.abs(rect.y - lastRect.y) > threshold ||
        Math.abs(rect.width - lastRect.width) > threshold ||
        Math.abs(rect.height - lastRect.height) > threshold;

      if (hasMovement) {
        if (!isAnimating) {
          // Animation just started
          isAnimating = true;
          // console.log('🎬 useAnimated - invalidating measurements');
          setEnhancedBounds(rectToMeasureRect(rect));
          forceRender();
        }
        stillnessCounter = 0;
      } else {
        stillnessCounter++;
      }

      // If no movement for several frames, consider animation stopped
      if (isAnimating && stillnessCounter >= stillnessThreshold) {
        isAnimating = false;
        // console.log('🛑 Animation stopped - final measurement update');
        setEnhancedBounds(rectToMeasureRect(rect));
        forceRender();
      }

      lastRectRef.current = rectToMeasureRect(rect);

      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(detectAnimation);
    };

    // Start monitoring
    animationFrameRef.current = requestAnimationFrame(detectAnimation);

    // Also listen for CSS animation/transition events for immediate detection
    const handleAnimationStart = (e: AnimationEvent | TransitionEvent) => {
      // const target = e.target as Element;
      // console.log('🎭 CSS animation/transition started on:', target.tagName, target.className);
      isAnimating = true;
      forceRender();
    };

    const handleAnimationEnd = (e: AnimationEvent | TransitionEvent) => {
      // const target = e.target as Element;
      // console.log('🎭 CSS animation/transition ended on:', target.tagName, target.className);
      isAnimating = false;
      stillnessCounter = stillnessThreshold; // Force stop detection
      forceRender();
    };

    // Listen on the element and its entire ancestor hierarchy to catch animations
    let currentElement: Element | null = element;
    const elementsToCleanup: Element[] = [];

    // Walk up the entire hierarchy to the document root
    while (currentElement && currentElement !== document.documentElement) {
      currentElement.addEventListener('animationstart', handleAnimationStart, true);
      currentElement.addEventListener('animationend', handleAnimationEnd, true);
      currentElement.addEventListener('transitionstart', handleAnimationStart, true);
      currentElement.addEventListener('transitionend', handleAnimationEnd, true);

      elementsToCleanup.push(currentElement);
      currentElement = currentElement.parentElement;

      // Safety limit to prevent infinite loops
      if (elementsToCleanup.length > maxHierarchyDepth) break;
    }

    // console.log('👀 Monitoring animations on:', elementsToCleanup);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      elementsToCleanup.forEach(el => {
        el.removeEventListener('animationstart', handleAnimationStart, true);
        el.removeEventListener('animationend', handleAnimationEnd, true);
        el.removeEventListener('transitionstart', handleAnimationStart, true);
        el.removeEventListener('transitionend', handleAnimationEnd, true);
      });
    };
  }, [_, bounds, threshold, stillnessThreshold, maxHierarchyDepth]);

  return [enhancedRef, enhancedBounds] as const;
}
