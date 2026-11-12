import { describe, it, expect, afterEach } from 'vitest';

import { resolveToken, resolveTokens } from '../../theme/resolveTokens';

describe('resolveTokens', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is null-safe (SSR / detached) and never throws', () => {
    expect(resolveToken(null, 'color-base-100')).toBeUndefined();
    expect(resolveToken(undefined, '--sxl-color-base-100')).toBeUndefined();
    expect(resolveTokens(null, ['color-base-100'])).toEqual({});
  });

  it('reads a token by short name (adds the --sxl- prefix)', () => {
    const el = document.createElement('div');
    el.style.setProperty('--sxl-color-base-100', '#123456');
    document.body.appendChild(el);
    expect(resolveToken(el, 'color-base-100')).toBe('#123456');
  });

  it('accepts a full custom-property name unchanged', () => {
    const el = document.createElement('div');
    el.style.setProperty('--sxl-color-primary', 'rgb(1, 2, 3)');
    document.body.appendChild(el);
    expect(resolveToken(el, '--sxl-color-primary')).toBe('rgb(1, 2, 3)');
  });

  it('batches and omits unresolved tokens', () => {
    const el = document.createElement('div');
    el.style.setProperty('--sxl-color-base-100', '#fff');
    document.body.appendChild(el);
    expect(resolveTokens(el, ['color-base-100', 'color-neutral'])).toEqual({
      'color-base-100': '#fff'
    });
  });
});
