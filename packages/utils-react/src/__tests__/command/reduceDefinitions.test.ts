import { describe, it, expect } from 'vitest';

import { type ICommandDefinition } from '../../command/ICommandDefinition';
import { reduceDefinitions } from '../../command/reduceDefinitions';

describe('reduceDefinitions (cascade, v1 override-all)', () => {
  it('override: most-specific scalar wins, with provenance (the copy case)', () => {
    const cbRoot = (): void => {};
    const cbComponent = (): void => {};
    // ordered least -> most specific
    const defs: ICommandDefinition[] = [
      { key: 'copy', label: 'Copy', icon: 'copyIcon', callback: cbRoot }, // root scope
      { key: 'copy', callback: cbComponent }                              // focused component
    ];
    const r = reduceDefinitions('copy', defs);
    expect(r.props.callback).toBe(cbComponent); // component wins execute
    expect(r.props.label).toBe('Copy');         // inherited from root (not re-contributed)
    expect(r.props.icon).toBe('copyIcon');
    expect(r.contributedBy.callback).toBe(1);
    expect(r.contributedBy.label).toBe(0);
  });

  it('accumulate: disabledReasons stack most-specific-first', () => {
    const defs: ICommandDefinition[] = [
      { key: 'copy', disabledReasons: ['workbook read-only'] }, // least specific
      { key: 'copy', disabledReasons: ['sheet is protected'] }  // most specific
    ];
    const r = reduceDefinitions('copy', defs);
    expect(r.props.disabledReasons).toEqual(['sheet is protected', 'workbook read-only']);
    expect(r.contributedBy.disabledReasons).toBe(1); // most-specific contributor
  });

  it('accumulate: tags stack across scopes too', () => {
    const defs: ICommandDefinition[] = [
      { key: 'paste', tags: ['clipboard'] },
      { key: 'paste', tags: ['mutator'] }
    ];
    const r = reduceDefinitions('paste', defs);
    expect(r.props.tags).toEqual(['mutator', 'clipboard']);
  });

  it('undefined is ignored; null is a real value (clear)', () => {
    const defs: ICommandDefinition[] = [
      { key: 'x', label: 'A' },
      { key: 'x', label: undefined },          // ignored — does not clobber 'A'
      { key: 'x', description: null as any }   // null retained (an explicit clear)
    ];
    const r = reduceDefinitions('x', defs);
    expect(r.props.label).toBe('A');
    expect('description' in r.props).toBe(true);
    expect(r.props.description).toBeNull();
  });

  it('throws when a contribution key does not match', () => {
    expect(() => reduceDefinitions('a', [{ key: 'b' }])).toThrow();
  });
});
