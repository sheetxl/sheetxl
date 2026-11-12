import React, { useMemo } from 'react';

import { useBoundSyncExternalStore } from '@sheetxl/utils-react';
import { List, DefaultSelection } from '@sheetxl/grid-react';

import { asStory } from '../../components';

interface StoryArgs {
  itemCount: number;
  itemHeight: number;
}

/**
 * A virtualized single-select **list** dogfooding the `Grid` (one full-width column, no gridlines).
 *
 * Try it:
 * - **Scroll** through 100k items — only the visible rows render (tiled cell cache).
 * - **Click** a row or use **Arrow Up/Down** to move the selection; the highlight is the grid's
 *   `SelectionLayer`. The selection model is the story's — the readout reads it directly.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { itemCount, itemHeight } = props;

  const items = useMemo(
    () => Array.from({ length: itemCount }, (_, i) => `Item ${i + 1}`),
    [itemCount]
  );

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: Math.max(0, itemCount - 1), colEnd: 0 })
  }), [itemCount]);
  const active = useBoundSyncExternalStore(selection, (s) => s.getSelection()).cell.rowIndex;

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
          active: {active} · {items[active]}
        </div>
        <List
          itemCount={itemCount}
          itemHeight={itemHeight}
          selection={selection}
          renderItem={(i) => items[i]}
          style={{ flex: '1 1 100%', width: 280, border: '1px solid #ccc' }}
        />
      </div>
    </div>
  );
};

export const Basic = asStory(Template);
Basic.args = {
  itemCount: 100000,
  itemHeight: 24
};
Basic.storyName = 'Basic';

const Story = {
  title: 'List',
  component: List,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
