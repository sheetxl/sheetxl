import { describe, it, expect } from 'vitest';

import { camelToPrettyCase } from '../../utils/CommonUtils';

describe('camelToPrettyCase', () => {
  it('starts a word at each capital after a lowercase letter or a digit, and capitalizes the first', () => {
    expect(camelToPrettyCase('camelCaseString')).toBe('Camel Case String');
    expect(camelToPrettyCase('MemAvail')).toBe('Mem Avail');
    expect(camelToPrettyCase('top10Items')).toBe('Top10 Items');
    expect(camelToPrettyCase('x')).toBe('X');
  });

  it('keeps an acronym one word, splitting only before the word that follows it', () => {
    expect(camelToPrettyCase('OSVersion')).toBe('OS Version');
    expect(camelToPrettyCase('myURL')).toBe('My URL');
    expect(camelToPrettyCase('AVERAGE')).toBe('AVERAGE');
    expect(camelToPrettyCase('RUN_REPORT')).toBe('RUN_REPORT');
  });

  it('leaves text that is already words alone', () => {
    expect(camelToPrettyCase('Exact match or next smaller item')).toBe('Exact match or next smaller item');
  });

  it('answers an empty string for nothing', () => {
    expect(camelToPrettyCase(null)).toBe('');
    expect(camelToPrettyCase('')).toBe('');
  });
});
