import {
  useRef, useImperativeHandle, type DependencyList
} from 'react';

/**
 * This hook replaces useImperativeHandle for HTMLElements
 * It takes a forwardedRef and returns a new local ref
 * that should be added to the element.
 * It will then merge the attributes onto the element to create
 * an extended element.
 *
 * Pass `element` to extend an element rendered by another component (e.g. a parent that owns the
 * root); the returned ref is then unused. Until it is non-null the forwarded ref stays unset.
 */
const _EmptyDeps: DependencyList = [];
export function useImperativeElement<R extends T, A=any, T=HTMLElement & A>(
  refForwarded: React.Ref<R>,
  attributeFn?: () => Partial<A>,
  deps: DependencyList=_EmptyDeps,
  element?: HTMLElement | null
): React.RefObject<R> {
  const refLocal = useRef<R>(null);
  // React only runs the handle when a ref is passed, and the attributes must land on the element
  // either way: other code finds them on the DOM node, not through the ref.
  const refUnforwarded = useRef<R>(null);
  useImperativeHandle<T, R>(refForwarded ?? refUnforwarded, (): R => {
    const target = element === undefined ? refLocal.current : element;
    if (!target) return undefined as unknown as R;
    const attributes = attributeFn?.();
    if (!attributes || typeof attributes !== 'object') {
      throw new Error('attributes must return a plain object of values');
    }

    const keys = Object.keys(attributes);
    const keysLength = keys.length;
    for (let k=0; k<keysLength; k++) {
      const key = keys[k];
      const attribute = (attributes as any)[key];
      Object.defineProperty(target, key, {
        value: attribute,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    return target as R;
  }, element === undefined ? deps : [...deps, element]);

  return refLocal as React.RefObject<R>;
}