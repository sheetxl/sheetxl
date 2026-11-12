import React, { useCallback, useState } from 'react';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Grid, Draggable, Layer, VirtualDiv, DefaultCellRenderer,
  type CellRendererProps
} from '@sheetxl/grid-react';

import { asStory } from '../../components';

interface StoryArgs {
  columnCount: number;
  rowCount: number;
}

const INITIAL_RANGE: RangeCoords = { rowStart: 2, colStart: 1, rowEnd: 6, colEnd: 4 };

/**
 * `Draggable` makes **any** content draggable — not just a `RangeRect` outline. Here it wraps a
 * custom HTML widget (a "sticky note") hosted in a `VirtualDiv`. The **header** is the drag handle: it has
 * `pointer-events: none`, so a press falls through to the move grip beneath and slides the note live.
 * The **body** is ordinary selectable text: it re-enables `pointer-events` and `stopPropagation`s its
 * pointerdown, so it does NOT drag (the one escape hatch from the grip's fall-through dispatch). The
 * card lifts with a shadow while dragging. Because the widget is just composed `children`, the same
 * wrapper would make a chart, an image, or an annotation draggable.
 */
const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, ...rest } = props;

  const [range, setRange] = useState<RangeCoords>(INITIAL_RANGE);
  const [dragging, setDragging] = useState(false);

  const renderCells = useCallback((cellProps: CellRendererProps) => {
    const { key, ...cellRest } = cellProps;
    return <DefaultCellRenderer key={key} {...cellRest} />;
  }, []);

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 6px' }}>
          Drag the note anywhere — it follows the pointer live. <strong>range</strong>{' '}
          ({range.rowStart},{range.colStart})…({range.rowEnd},{range.colEnd})
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          style={{ flex: '1 1 100%', border: '1px solid black' }}
          renderCells={renderCells}
          showGridLines={true}
        >
          {/* One Layer for the note feature (law 4: grid children are Layers). */}
          <Layer key="note">
            <Draggable
              range={range}
              // Drives the drag affordance (shadow/scale). Use onDragStateChange, NOT onDragStart+onDragEnd:
              // onDragEnd fires only on an actual move, so a press-with-no-move would never clear `dragging`
              // and the shadow would stay lit. onDragStateChange fires true on press / false on release, always.
              onDragStateChange={setDragging}
              onDragMove={(to) => setRange(to)}
            >
            {/* The widget card — a VirtualDiv (a real div placed at the range). The card + header are
                pointer-events:none, so a press there falls through to the move grip beneath — grab the
                header to slide the note. The body (below) opts back into pointer-events and stops
                propagation, so it's regular selectable text, not a handle. */}
            <VirtualDiv
              range={range}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#FFF8C5',
                border: '1px solid #E6D88A',
                boxShadow: dragging
                  ? '0 10px 24px rgba(0,0,0,0.28)'
                  : '0 2px 6px rgba(0,0,0,0.18)',
                transform: dragging ? 'scale(1.02)' : 'scale(1)',
                // Only the shadow transitions; `transform` now also carries placement (VirtualDiv
                // composes it), so transitioning it would make the drag lag behind the pointer.
                transition: 'box-shadow 120ms ease',
                font: '13px/1.4 system-ui, sans-serif',
                color: '#5C4A00',
                pointerEvents: 'none'
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  background: '#F4E58A',
                  borderBottom: '1px solid #E6D88A',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span style={{ fontSize: 14 }}>📌</span> Sticky note
              </div>
              {/* Regular selectable content — NOT a drag handle. stopPropagation (the one consume signal)
                  keeps the pointerdown from continuing down the stack to the grip beneath;
                  userSelect re-enables text selection (the grid root sets user-select:none). */}
              <div
                style={{ padding: '8px 10px', flex: '1 1 auto', pointerEvents: 'auto', userSelect: 'text', cursor: 'text' }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Grab the header to move me. This body is just regular selectable text.
              </div>
            </VirtualDiv>
            </Draggable>
          </Layer>
        </Grid>
      </div>
    </div>
  );
};

export const MovableWidget = asStory(Template);
MovableWidget.args = { columnCount: 20, rowCount: 20 };
MovableWidget.storyName = 'Movable widget';

const Story = {
  title: 'Layers',
  component: MovableWidget,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
