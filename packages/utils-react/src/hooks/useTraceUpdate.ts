import { useEffect, useRef } from 'react';

export function useTraceUpdate(props: any, enabled: boolean=true) {
  const prev = useRef(props);
  useEffect(() => {
    if (enabled) {
      const changedProps = Object.entries(props).reduce((ps: Record<string, [any, any]>, [k, v]) => {
        if (prev.current[k] !== v) {
          ps[k] = [prev.current[k], v];
        }
        return ps;
      }, {} as Record<string, [any, any]>);
      if (Object.keys(changedProps).length > 0) {
        console.log('Changed props:', changedProps);
      }
    }
    prev.current = props;
  });
}