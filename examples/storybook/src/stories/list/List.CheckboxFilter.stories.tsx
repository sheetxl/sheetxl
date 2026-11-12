import React, { useCallback, useMemo, useState } from 'react';

import { CheckboxList } from '@sheetxl/grid-react';

import { asStory } from '../../components';

interface StoryArgs {
  itemCount: number;
}

/**
 * The eventual consumer: a **table column filter** dropdown — a virtualized checkbox list over a large
 * distinct-value set, with a search box and a tri-state `(Select All)`. Built on {@link CheckboxList},
 * which owns the row rendering + toggle behavior (click, and the anchor-template Space/Enter multi-toggle).
 *
 * The point of the demo is the **orthogonality**: the list is backed by *two independent stores* — the
 * labels (`string[]`) and the checked set (`Set<number>`) — joined only at render. Selection (the focus
 * highlight / Arrow keys) is unrelated to "checked":
 * - **Space / Enter** or **click** toggles the checked store; multi-select + Space toggles the span.
 * - **Arrow Up/Down** moves the focus highlight (never the checked store).
 * - **Search** filters the *view* (a `displayIndex → sourceIndex` map); it never copies or mutates the
 *   stores. `(Select All)` still operates on the current (filtered) view.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { itemCount } = props;

  // Store #1 — the distinct values (eventually `ICell[]`, rendered through DefaultCellRenderer so
  // dates/numbers format exactly like the sheet).
  const labels = useMemo(
    () => Array.from({ length: itemCount }, (_, i) => `Value ${String(i + 1).padStart(5, '0')}`),
    [itemCount]
  );
  // Store #2 — checked source indices. Independent of selection/focus.
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const [search, setSearch] = useState<string>('');

  // The view: source indices passing the search. Stores stay authoritative — this is just a map.
  const view = useMemo<number[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return Array.from({ length: labels.length }, (_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].toLowerCase().includes(q)) out.push(i);
    }
    return out;
  }, [search, labels]);

  // CheckboxList works in *view-index* space; map each to its source index for the checked store.
  const onCheckedChange = useCallback((viewIndices: number[], value: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const vi of viewIndices) {
        const src = view[vi];
        if (src === undefined) continue;
        if (value) next.add(src); else next.delete(src);
      }
      return next;
    });
  }, [view]);

  const checkedInView = view.reduce((n, src) => n + (checked.has(src) ? 1 : 0), 0);

  return (
    <div className="storybook-container">
      <div
        style={{
          display: 'flex', flexDirection: 'column', height: '100%', width: 260,
          border: '1px solid #bbb', borderRadius: 4, overflow: 'hidden',
          fontFamily: 'Calibri, sans-serif', fontSize: 13
        }}
      >
        <div style={{ padding: 8, borderBottom: '1px solid #eee' }}>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px' }}
          />
        </div>
        <CheckboxList
          itemCount={view.length}
          itemHeight={24}
          isChecked={(viewIndex) => checked.has(view[viewIndex])}
          onCheckedChange={onCheckedChange}
          renderValue={(viewIndex) => labels[view[viewIndex]]}
          selectAllLabel="(Select All)"
          cacheToken={checked}
          style={{ flex: '1 1 100%', borderTop: '1px solid #eee' }}
        />
        <div style={{ padding: '4px 10px', borderTop: '1px solid #eee', color: '#666', fontSize: 12 }}>
          {checkedInView} / {view.length} checked{search ? ' (filtered)' : ''}
        </div>
      </div>
    </div>
  );
};

export const CheckboxFilter = asStory(Template);
CheckboxFilter.args = {
  itemCount: 50000
};
CheckboxFilter.storyName = 'Checkbox Filter';

const Story = {
  title: 'List',
  component: CheckboxList,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
