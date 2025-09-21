import React from 'react';

/**
 * Special icon when DynamicIconService returns an invalid state.
 */
export const ErrorIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg {...props}>
      <path/>
    </svg>
  );
}