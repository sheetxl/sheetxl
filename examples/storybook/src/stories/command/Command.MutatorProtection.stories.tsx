import React, { useEffect, useMemo, useState } from 'react';

import { Command } from '@sheetxl/utils-react';

import { CommandButton, rowStyle } from './CommandButton';

import { asStory } from '../../components';

const {
  CommandScope, ManualActivation, CommandScopeContext, CommandAnchorProvider, useCommands
} = Command;

type Scope = InstanceType<typeof CommandScope>;

/**
 * The rule "a `mutator` command disables when the sheet/workbook is protected" is **contributor
 * logic, not a registry feature** — `tags` is just an accumulated string array; the contributor owns
 * a *single reducer* keyed on the tag. So:
 * - a command is tagged `mutator` **once**, at the catalog (`tags: ['mutator']`) — tag at definition,
 *   never forget, no per-command effect;
 * - when protection flips, ONE pass over the mutator-tagged keys adds a `disabledReason` on a
 *   **workbook** scope (cross-cutting, above the sheet);
 * - the sheet contributes a command's **own** intrinsic reason (e.g. *Bold* needs a selection);
 * - both reasons **accumulate** (the resolved command shows them stacked, most-specific first),
 *   because `updateCommand` within one scope *overrides* — stacking requires different scopes.
 *
 * Tree (anchor pinned to `sheet`):  `root(catalog +tags) → workbook(protection reducer) → sheet(behavior +intrinsic reasons)`
 */

// Catalog: chrome + the `mutator` tag, authored ONCE. `bold`/`fill` mutate; `copy`/`zoomIn` are safe.
const CATALOG: ReadonlyArray<{ key: string; label: string; icon: string; tags?: string[] }> = [
  { key: 'bold', label: 'Bold', icon: '𝐁', tags: ['mutator'] },
  { key: 'fill', label: 'Fill', icon: '🪣', tags: ['mutator'] },
  { key: 'copy', label: 'Copy', icon: '📋' },
  { key: 'zoomIn', label: 'Zoom In', icon: '🔍' }
];
const MUTATORS = CATALOG.filter((d) => d.tags?.includes('mutator')).map((d) => d.key);

const registerDefinitions = (root: Scope): void => {
  CATALOG.forEach((d) => root.updateCommand(d.key, { label: d.label, icon: d.icon, tags: d.tags }));
};

// The cross-cutting protection reducer (contributor logic): ONE pass over the mutator-tagged keys,
// keyed on the tag read from the catalog — not a per-command effect. Lives on the workbook scope so
// it applies above any finer anchor.
const useProtectionReducer = (workbook: Scope, isProtected: boolean): void => {
  useEffect(() => {
    for (const key of MUTATORS) {
      workbook.updateCommand(key, { disabledReasons: isProtected ? ['Workbook is protected'] : [] });
    }
  }, [workbook, isProtected]);
};

// Sheet behavior: callbacks + each command's OWN intrinsic reason (Bold needs a selection). Re-runs
// when its inputs change (the definitions model's "dynamic via re-contribute").
const useSheetBehavior = (sheet: Scope, hasSelection: boolean, onRun: (key: string) => void): void => {
  useEffect(() => {
    for (const d of CATALOG) {
      const intrinsic = d.key === 'bold' && !hasSelection ? ['No selection'] : [];
      sheet.updateCommand(d.key, { callback: () => onRun(d.key), disabledReasons: intrinsic });
    }
  }, [sheet, hasSelection, onRun]);
};

// Reads a command through the resolver and shows its resolved tags + accumulated reasons.
const CommandStatus: React.FC<{ commandKey: string }> = ({ commandKey }) => {
  const [cmd] = useCommands(commandKey);
  const tags = (cmd?.getTags() ?? []) as string[];
  const reasons = cmd?.disabledReasons() ?? [];
  const disabled = cmd?.disabled() ?? true;
  return (
    <tr style={{ borderTop: '1px solid #eee' }}>
      <td style={{ padding: '4px 10px' }}>{cmd?.getLabel() ?? commandKey}</td>
      <td style={{ padding: '4px 10px', color: tags.includes('mutator') ? '#d9480f' : '#aaa' }}>{tags.join(', ') || '—'}</td>
      <td style={{ padding: '4px 10px', fontWeight: 600, color: disabled ? '#e03131' : '#2f9e44' }}>{disabled ? 'disabled' : 'enabled'}</td>
      <td style={{ padding: '4px 10px', color: '#555' }}>{reasons.length ? reasons.join('  •  ') : '—'}</td>
    </tr>
  );
};

const Template: React.FC<any> = () => {
  const [isProtected, setProtected] = useState(false);
  const [hasSelection, setHasSelection] = useState(true);
  const [last, setLast] = useState('—');

  const { root, workbook, sheet, tracker } = useMemo(() => {
    const root = new CommandScope('root');
    const workbook = root.createChild('workbook');
    const sheet = workbook.createChild('sheet');
    registerDefinitions(root);
    return { root, workbook, sheet, tracker: new ManualActivation(sheet) }; // pinned to sheet
  }, []);

  const onRun = useMemo(() => (key: string) => setLast(`executed: ${key}`), []);

  useProtectionReducer(workbook, isProtected);
  useSheetBehavior(sheet, hasSelection, onRun);

  return (
    <CommandScopeContext.Provider value={root}>
      <CommandAnchorProvider tracker={tracker}>
        <div style={{ fontFamily: 'sans-serif', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Mutator-tag → protection disable + accumulating reasons</h3>

          <div style={rowStyle}>
            <CommandButton commandKey="bold" />
            <CommandButton commandKey="fill" />
            <CommandButton commandKey="copy" />
            <CommandButton commandKey="zoomIn" />
            <span style={{ width: 1, height: 24, background: '#ddd' }} />
            <span style={{ color: '#888' }}>last: <b style={{ color: '#222' }}>{last}</b></span>
          </div>

          <div style={rowStyle}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={isProtected} onChange={(e) => setProtected(e.target.checked)} />
              Protect workbook <span style={{ color: '#888' }}>(cross-cutting reducer → all <code>mutator</code> commands)</span>
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', marginLeft: 16 }}>
              <input type="checkbox" checked={hasSelection} onChange={(e) => setHasSelection(e.target.checked)} />
              Has selection <span style={{ color: '#888' }}>(Bold's own intrinsic reason)</span>
            </label>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, maxWidth: 680, border: '1px solid #e5e5ea', borderRadius: 6 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888' }}>
                <th style={{ padding: '4px 10px' }}>command</th>
                <th style={{ padding: '4px 10px' }}>tags</th>
                <th style={{ padding: '4px 10px' }}>state</th>
                <th style={{ padding: '4px 10px' }}>disabledReasons (accumulated)</th>
              </tr>
            </thead>
            <tbody>
              {CATALOG.map((d) => <CommandStatus key={d.key} commandKey={d.key} />)}
            </tbody>
          </table>

          <div style={{ background: '#f7f7f9', border: '1px solid #e5e5ea', borderRadius: 6, padding: '10px 14px', color: '#555', fontSize: 14, lineHeight: 1.5, maxWidth: 680 }}>
            Toggle <b>Protect workbook</b> → only <i>Bold</i> and <i>Fill</i> (tagged <code>mutator</code>)
            disable with <b>"Workbook is protected"</b>; <i>Copy</i> and <i>Zoom In</i> stay enabled — the
            reducer keyed on the tag, no per-command wiring. Now also untick <b>Has selection</b> → <i>Bold</i>
            shows <b>two</b> stacked reasons (<i>No selection</i> from the sheet, <i>Workbook is protected</i>
            from the workbook) — <code>disabledReasons</code> accumulating most-specific-first across scopes.
            This is disable-block as a tag + a one-pass reducer.
          </div>
        </div>
      </CommandAnchorProvider>
    </CommandScopeContext.Provider>
  );
};

export const MutatorProtection = asStory(Template);
MutatorProtection.args = {};
MutatorProtection.storyName = 'Mutator Protection (disable reducer)';

const Story = { title: 'Commands' };
export default Story;
