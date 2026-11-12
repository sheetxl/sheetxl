import React, { useMemo, useState } from 'react';

import { type CellCoords, type RangeCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, SelectionLayer, DefaultSelection, RangeFloatLayer,
  type IGridPane, type RangeFloatActivation, type RangeFloatTarget
} from '@sheetxl/grid-react';

import { ScrollableGrid as Grid, sharedCellRenderer, asStory } from '../../components';

/**
 * **RangeFloatLayer — one engine, pluggable activation.**
 *
 * The layer owns anchoring, activation and dismissal; the content is entirely the consumer's. Only the
 * `activateOn` prop changes between these four modes — everything else (the probe, the render-prop,
 * the anchoring) is identical.
 *
 * - **hover** — the pointer, through the shared hover intent (`openDelay` dwell, `closeDelay` grace,
 *   and moving onto the float keeps it open). This is what `RangeTooltipLayer` / `CellErrorLayer` are.
 * - **selection** — the active cell, no delay. A resting affordance rather than a transient tip: click
 *   or arrow into one of the marked regions and it appears. This is the data-validation dropdown's
 *   activation.
 * - **either** — `['hover','selection']`: EITHER opens it. Hover is the transient override, selection
 *   the resting state. Hover a region while a different one is selected: the float moves to the hovered
 *   one and falls back when you leave.
 * - **controlled** — no activation at all; the story drives `target` from the buttons below. This is
 *   the gesture-driven action popup (paste options, autofill options), whose lifetime belongs to the
 *   action, not the pointer.
 *
 * `dismiss` is a hard close, and it reads differently per activation by design: **edge-triggered** for
 * hover (drops now, a later hover re-opens) and a **level** for selection (there is no gesture to
 * re-arm it, so it stays closed while held and returns when cleared).
 *
 * The float content here is deliberately interactive — spread `floatProps` and it takes the pointer.
 */

interface RegionData {
  name: string;
  color: string;
  fill: string;
}

const REGIONS: Array<{ range: RangeCoords; data: RegionData }> = [
  { range: { rowStart: 3, colStart: 2, rowEnd: 6, colEnd: 5 }, data: { name: 'Alpha', color: 'rgb(0,120,215)', fill: 'rgba(0,120,215,0.12)' } },
  { range: { rowStart: 9, colStart: 7, rowEnd: 12, colEnd: 11 }, data: { name: 'Bravo', color: 'rgb(200,80,0)', fill: 'rgba(200,80,0,0.12)' } },
  { range: { rowStart: 16, colStart: 3, rowEnd: 18, colEnd: 9 }, data: { name: 'Charlie', color: 'rgb(0,140,90)', fill: 'rgba(0,140,90,0.12)' } }
];

const contains = (r: RangeCoords, c: CellCoords): boolean =>
  c.rowIndex >= r.rowStart && c.rowIndex <= r.rowEnd && c.colIndex >= r.colStart && c.colIndex <= r.colEnd;

/** One probe, used by BOTH activations — it is asked about the hovered cell and the active cell alike. */
const probe = (coords: CellCoords, _pane: IGridPane): RangeFloatTarget<RegionData> | null => {
  const hit = REGIONS.find((r) => contains(r.range, coords));
  return hit ? { range: hit.range, key: hit.data.name, data: hit.data } : null;
};

type Mode = 'hover' | 'selection' | 'either' | 'controlled';

const MODES: Mode[] = ['hover', 'selection', 'either', 'controlled'];

const ACTIVATION: Record<Mode, RangeFloatActivation | RangeFloatActivation[] | undefined> = {
  hover: 'hover',
  selection: 'selection',
  either: ['hover', 'selection'],
  controlled: undefined
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;
  const [mode, setMode] = useState<Mode>('hover');
  const [dismiss, setDismiss] = useState<boolean>(false);
  const [controlled, setControlled] = useState<RangeFloatTarget<RegionData> | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);

  const selection = useMemo(() => new DefaultSelection({
    getBounds: () => ({ rowStart: 0, colStart: 0, rowEnd: rowCount - 1, colEnd: columnCount - 1 }),
    initial: { cell: { rowIndex: 0, colIndex: 0 }, ranges: [], rangeIndex: -1 }
  }), [rowCount, columnCount]);

  const btn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '2px 8px', font: '12px monospace', cursor: 'pointer',
    background: active ? (color ?? 'rgb(0,120,215)') : '#eee', color: active ? 'white' : '#333',
    border: '1px solid #bbb', borderRadius: 3
  });

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 6px', flexWrap: 'wrap' }}>
          <span style={{ font: '12px monospace' }}>activateOn:</span>
          {MODES.map((m) => <button key={m} style={btn(m === mode)} onClick={() => setMode(m)}>{m}</button>)}
          <button style={{ ...btn(dismiss, 'rgb(180,0,0)'), marginLeft: 6 }} onClick={() => setDismiss((v) => !v)}>
            dismiss
          </button>
          {mode === 'controlled' ? (
            <>
              <span style={{ font: '12px monospace', marginLeft: 6 }}>target:</span>
              {REGIONS.map((r) =>
                <button
                  key={r.data.name}
                  style={btn(controlled?.key === r.data.name, r.data.color)}
                  onClick={() => setControlled({ range: r.range, key: r.data.name, data: r.data })}
                >
                  {r.data.name}
                </button>)}
              <button style={btn(controlled === null)} onClick={() => setControlled(null)}>none</button>
            </>
          ) : null}
          <span style={{ font: '12px monospace', marginLeft: 6, color: '#666' }}>
            {pressed ? `pressed: ${pressed}` : 'press the float'}
          </span>
        </div>
        <Grid
          {...rest}
          columnCount={columnCount}
          rowCount={rowCount}
          renderCells={sharedCellRenderer}
          showGridLines
          freezeTop={freezeTop}
          freezeLeft={freezeLeft}
          style={{ width: '100%', height: '100%', border: '1px solid black' }}
        >
          <SelectionLayer key="selection" selection={selection} />
          <Layer key="regions">
            {REGIONS.map((r) =>
              <RangeRect
                key={r.data.name}
                range={r.range}
                stroke={r.data.color}
                alignWidth={2}
                fill={r.data.fill}
              />)}
          </Layer>
          <RangeFloatLayer<RegionData>
            key="float"
            activateOn={ACTIVATION[mode]}
            probe={probe}
            selection={selection}
            target={mode === 'controlled' ? controlled : undefined}
            dismiss={dismiss}
            placement={{ side: 'r', align: 'start' }}
            offset={6}
          >
            {({ range, data, floatProps, state }) => (
              <div
                {...floatProps}
                onPointerDown={(e) => { e.stopPropagation(); setPressed(`${data.name} @ ${state.owner}`); }}
                style={{
                  ...floatProps.style,
                  font: '11px/1.5 system-ui, sans-serif', color: 'white', background: data.color,
                  padding: '5px 9px', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)'
                }}
              >
                <div style={{ fontWeight: 600 }}>{data.name}</div>
                <div style={{ opacity: 0.85 }}>
                  r{range.rowStart}:c{range.colStart} · owner={String(state.owner)}
                </div>
              </div>
            )}
          </RangeFloatLayer>
        </Grid>
      </div>
    </div>
  );
};

export const RangeFloat = asStory(Template);
RangeFloat.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
RangeFloat.storyName = 'RangeFloat (activation)';

const Story = {
  title: 'Float',
  component: RangeFloat,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
