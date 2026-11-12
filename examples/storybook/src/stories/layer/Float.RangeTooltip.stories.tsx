import React, { useState } from 'react';

import { CoordUtils, type RangeCoords, type CellCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, RangeTooltipLayer, TooltipProvider, type RangeFloatTarget
} from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **`RangeTooltipLayer` + `TooltipProvider` — the tooltip group.** Three probe-driven tip layers on
 * one grid, each a `probe(coords)` that decides whether the hovered cell has something to say:
 *
 * - **Sales / Inventory** (blue) — an **interactive** card with a button: move onto it and it stays.
 * - **Notes** (green) — a plain bubble, the grid's default (`pointer-events: none`).
 * - **column A** — a plain bubble on every cell (`Row n`).
 *
 * What the group adds: **one tip at a time** (hover a blue region, then a green one — the first closes
 * with no grace), **arming** (leave a tip and re-enter another within `armedFor` — it opens after
 * `enterNextDelay`, not `enterDelay`), and **any press or key closes** the open tip (click a cell, or
 * press Escape). The timing is the provider's; the controls drive it.
 */

interface Region { range: RangeCoords; name: string; }

const CARDS: Region[] = [
  { range: { rowStart: 3, colStart: 2, rowEnd: 8, colEnd: 5 }, name: 'Sales' },
  { range: { rowStart: 12, colStart: 6, rowEnd: 16, colEnd: 10 }, name: 'Inventory' },
];
const NOTES: Region[] = [
  { range: { rowStart: 4, colStart: 8, rowEnd: 5, colEnd: 9 }, name: 'Q3 figures are provisional' },
  { range: { rowStart: 18, colStart: 2, rowEnd: 18, colEnd: 4 }, name: 'Reviewed by finance' },
];

const CARD_STYLE: React.CSSProperties = {
  font: '12px system-ui, sans-serif', background: 'white', color: '#222',
  border: '1px solid #ccc', borderRadius: 6, padding: 8, minWidth: 150,
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 6
};
const BTN: React.CSSProperties = {
  font: '12px system-ui', padding: '3px 10px', borderRadius: 4, border: '1px solid #bbb', cursor: 'pointer'
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
  enterDelay: number;
  enterNextDelay: number;
  armedFor: number;
  leaveDelay: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, enterDelay, enterNextDelay, armedFor, leaveDelay, ...rest } = props;
  const [log, setLog] = useState<string>('—');

  const probeCard = (coords: CellCoords): RangeFloatTarget<Region> | null => {
    const region = CARDS.find((r) => CoordUtils.isCellWithinRange(coords, r.range));
    return region ? { range: region.range, key: region.name, data: region } : null;
  };
  const probeNote = (coords: CellCoords): RangeFloatTarget<Region> | null => {
    const region = NOTES.find((r) => CoordUtils.isCellWithinRange(coords, r.range));
    return region ? { range: region.range, key: region.name, data: region } : null;
  };
  const probeRow = (coords: CellCoords): RangeFloatTarget<number> | null => {
    if (coords.colIndex !== 0) return null;
    return { range: CoordUtils.cellToRange(coords)!, data: coords.rowIndex + 1 };
  };

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ font: '12px monospace', padding: '4px 6px', color: '#555' }}>
          Hover a card region (blue), a note (green) or column A · one tip at a time · last action: <b>{log}</b>
        </div>
        <TooltipProvider timing={{ enterDelay, enterNextDelay, armedFor, leaveDelay }}>
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
            <Layer key="regions">
              {CARDS.map((r) => (
                <RangeRect key={r.name} range={r.range} stroke="rgb(90,90,200)" alignWidth={1.5} fill="rgba(90,90,200,0.08)" />
              ))}
              {NOTES.map((r) => (
                <RangeRect key={r.name} range={r.range} stroke="rgb(60,160,90)" alignWidth={1.5} fill="rgba(60,160,90,0.10)" />
              ))}
            </Layer>
            <RangeTooltipLayer key="cards" probe={probeCard} placement={{ side: 't' }} offset={6} interactive bubble={false}>
              {({ data, range, tipProps }) => (
                <div {...tipProps} style={{ ...CARD_STYLE, ...tipProps.style }}>
                  <b>{data.name}</b>
                  <span style={{ color: '#777' }}>
                    {range.rowEnd - range.rowStart + 1}R × {range.colEnd - range.colStart + 1}C
                  </span>
                  <button style={BTN} onClick={() => setLog(`Edit ${data.name}`)}>Edit</button>
                </div>
              )}
            </RangeTooltipLayer>
            <RangeTooltipLayer key="notes" probe={probeNote} placement={{ side: 'b', align: 'start' }} offset={4}>
              {({ data }) => data.name}
            </RangeTooltipLayer>
            <RangeTooltipLayer key="rows" probe={probeRow} placement={{ side: 'r' }} offset={4}>
              {({ data }) => `Row ${data}`}
            </RangeTooltipLayer>
          </Grid>
        </TooltipProvider>
      </div>
    </div>
  );
};

export const RangeTooltip = asStory(Template);
RangeTooltip.args = {
  columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3,
  enterDelay: 300, enterNextDelay: 0, armedFor: 800, leaveDelay: 400
};
RangeTooltip.storyName = 'Range tooltip (group: single open, arming, interactive)';

const Story = {
  title: 'Float',
  component: RangeTooltip,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
