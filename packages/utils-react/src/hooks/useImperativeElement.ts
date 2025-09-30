import {
  useRef, useImperativeHandle, DependencyList
} from 'react';

/**
 * This hook replaces useImperativeHandle for HTMLElements
 * It takes a forwardedRef and returns a new local ref
 * that should be added to the element.
 * It will then merge the attributes onto the element to create
 * an extended element.
 */
const _EmptyDeps = [];
export function useImperativeElement<R extends T, A=any, T=HTMLElement & A>(
  refForwarded: React.Ref<R>,
  attributeFn?: () => Partial<A>,
  deps: DependencyList=_EmptyDeps
): React.RefObject<R> {
  const refLocal = useRef<R>(null);
  useImperativeHandle<T, R>(refForwarded, () => {
    if (!refLocal.current) return;
    const element = refLocal.current;
    const attributes = attributeFn?.();
    if (!attributes || typeof attributes !== 'object') {
      throw new Error('attributes must return a plain object of values');
    }

    const keys = Object.keys(attributes);
    const keysLength = keys.length;
    for (let k=0; k<keysLength; k++) {
      const key = keys[k];
      const attribute = attributes[key];
      Object.defineProperty(element, key, {
        value: attribute,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    return element as R;
  }, deps);

  return refLocal;
}