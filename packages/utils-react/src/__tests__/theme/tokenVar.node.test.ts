import { describe, it, expect } from 'vitest';

import { tokenVar } from '../../theme/tokenVar';
import { defaultTheme, SERIES_COUNT } from '../../theme/defaultTheme';

describe('tokenVar', () => {
  it('reads the token with the light default as its fallback', () => {
    expect(tokenVar('color-base-300')).toBe(`var(--sxl-color-base-300, ${defaultTheme.light['color-base-300']})`);
  });

  it('numbers the series one-based and rotates past the end', () => {
    const series = defaultTheme.light['color-series']!;
    expect(tokenVar('color-series', 0)).toBe(`var(--sxl-color-series-1, ${series[0]})`);
    expect(tokenVar('color-series', SERIES_COUNT + 2)).toBe(`var(--sxl-color-series-3, ${series[2]})`);
  });
});
