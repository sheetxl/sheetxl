import React, { useState } from 'react';
import { createPortal } from 'react-dom';

import { type RangeCoords } from '@sheetxl/utils';

import {
  Layer, RangeRect, StickyAnchor, StickyPortal,
  type StickyState, type GridBoundary, type GridFloatSide, type GridWhenOff
} from '@sheetxl/grid-react';

import { asStory, ScrollableGrid as Grid, sharedCellRenderer } from '../../components';

/**
 * **Float.Fit — the float collides with the GRID, not the browser window.**
 *
 * `boundary` answers exactly one question: *where may this thing live*. It is **one rect**, and it is
 * both the anchor's clip / clamp boundary and the rect `flip` / `shift` collide against. All three
 * candidates are outlined at once so the nesting is visible — the active one is solid, and the float
 * must never cross it:
 *
 * | | outline | is |
 * | --- | --- | --- |
 * | **`pane`** | green | just the owner pane's box — straddle the freeze and watch it change as ownership moves |
 * | **`data`** | blue | the union of the panes' CELL areas: headers and scrollbars excluded (default) |
 * | **`viewport`** | red | the browser window — the opt-out, for a float allowed over grid chrome |
 *
 * The grid is deliberately inset from the window so the three are far apart. Scroll the marked range to
 * the right edge: under `data` the float **flips** to the other side of the cell rather than painting
 * over the scrollbar; under `viewport` it hangs out over the chrome and only flips at the window edge.
 *
 * Two more toggles prove the anchor tracks **without an rAF poll**:
 * - **gutter** opens a panel beside the grid — a pure layout shift, no scroll, no resize. The float
 *   follows because the virtual reference carries a `contextElement` for Floating UI's layout-shift
 *   observer to watch.
 * - **page** puts the grid inside a scrolling ancestor. Scrolling it fires no grid event at all; the
 *   float follows through that same `contextElement`'s ancestor-scroll listener.
 *
 * Grid-INTERNAL scroll (wheel, thumb, keyboard, a touch fling and its momentum carry) is the one
 * movement no DOM event can express; that one rides the viewport store's per-frame tick.
 */

const RANGE: RangeCoords = { rowStart: 8, colStart: 10, rowEnd: 10, colEnd: 12 };

const BOUNDARIES: GridBoundary[] = ['pane', 'data', 'viewport'];
const SIDES: GridFloatSide[] = ['t', 'r', 'b', 'l'];

const BOUNDARY_COLOR: Record<string, string> = {
  pane: 'rgb(0,150,60)',
  data: 'rgb(0,90,220)',
  viewport: 'rgb(190,0,150)'
};

/**
 * One boundary drawn where it actually is. Uses only public API — a `StickyAnchor` on the same range,
 * whose child reads `getBoundaryRect()` and paints it. The float must stay inside the ACTIVE one.
 */
const BoundaryOutline: React.FC<{ boundary: GridBoundary; active: boolean }> = (props) => {
  const { boundary, active } = props;
  const color = BOUNDARY_COLOR[String(boundary)];
  return (
    <StickyAnchor anchor={{ range: RANGE }} boundary={boundary} whenOff="clamp">
      {(state: StickyState) => {
        const r = state.getBoundaryRect();
        return createPortal(
          <div style={{
            position: 'fixed', left: r.left, top: r.top, width: r.width, height: r.height,
            border: `${active ? 3 : 1}px ${active ? 'solid' : 'dashed'} ${color}`,
            opacity: active ? 0.9 : 0.45,
            pointerEvents: 'none', zIndex: 1249, boxSizing: 'border-box'
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, font: '10px/1.4 monospace', color: 'white',
              background: color, padding: '1px 4px', opacity: active ? 1 : 0.5
            }}>
              {String(boundary)} {Math.round(r.width)}×{Math.round(r.height)}
            </div>
          </div>,
          document.body
        );
      }}
    </StickyAnchor>
  );
};

interface StoryArgs {
  columnCount: number;
  rowCount: number;
  freezeTop: number;
  freezeLeft: number;
}

const Template: React.FC<StoryArgs> = (props) => {
  const { columnCount, rowCount, freezeTop, freezeLeft, ...rest } = props;
  const [boundary, setBoundary] = useState<GridBoundary>('data');
  const [side, setSide] = useState<GridFloatSide>('r');
  const [whenOff, setWhenOff] = useState<GridWhenOff>('clamp');
  const [gutter, setGutter] = useState<boolean>(false);
  const [paged, setPaged] = useState<boolean>(false);

  const btn = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '2px 8px', font: '12px monospace', cursor: 'pointer',
    background: active ? (color ?? 'rgb(0,120,215)') : '#eee', color: active ? 'white' : '#333',
    border: '1px solid #bbb', borderRadius: 3
  });

  const grid = (
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
      <Layer key="range">
        <RangeRect range={RANGE} stroke="rgb(0,120,215)" alignWidth={2} fill="rgba(0,120,215,0.10)" />
      </Layer>
      <Layer key="bounds">
        {BOUNDARIES.map((b) =>
          <BoundaryOutline key={String(b)} boundary={b} active={b === boundary} />)}
      </Layer>
      <Layer key="float">
        <StickyPortal
          anchor={{ range: RANGE }}
          placement={{ side, align: 'start' }}
          boundary={boundary}
          whenOff={whenOff}
          offset={6}
        >
          {(state: StickyState) => (
            <div style={{
              width: 180, font: '11px/1.5 system-ui, sans-serif', color: 'white',
              background: BOUNDARY_COLOR[String(boundary)] ?? 'rgb(0,120,215)',
              padding: '6px 10px', borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none'
            }}>
              <div style={{ fontWeight: 600 }}>boundary: {String(boundary)}</div>
              <div style={{ opacity: 0.85 }}>
                owner={String(state.owner)}
                {state.slid ? ` · slid ${Math.round(state.slid.distance)}px` : ''}
                {state.outOfView ? ' · outOfView' : ''}
              </div>
            </div>
          )}
        </StickyPortal>
      </Layer>
    </Grid>
  );

  return (
    <div className="storybook-container">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: 6 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 6px', flexWrap: 'wrap' }}>
          <span style={{ font: '12px monospace' }}>boundary:</span>
          {BOUNDARIES.map((b) =>
            <button
              key={String(b)}
              style={btn(b === boundary, BOUNDARY_COLOR[String(b)])}
              onClick={() => setBoundary(b)}
            >
              {String(b)}
            </button>)}
          <span style={{ font: '12px monospace', marginLeft: 6 }}>side:</span>
          {SIDES.map((s) => <button key={s} style={btn(s === side)} onClick={() => setSide(s)}>{s}</button>)}
          <span style={{ font: '12px monospace', marginLeft: 6 }}>whenOff:</span>
          {(['hide', 'clamp'] as GridWhenOff[]).map((w) =>
            <button key={w} style={btn(w === whenOff)} onClick={() => setWhenOff(w)}>{w}</button>)}
          <button style={{ ...btn(gutter), marginLeft: 6 }} onClick={() => setGutter((v) => !v)}>gutter</button>
          <button style={btn(paged)} onClick={() => setPaged((v) => !v)}>page</button>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 8 }}>
          {gutter ? (
            <div style={{
              width: 260, flex: 'none', background: '#f3f4f6', border: '1px solid #ddd',
              font: '12px/1.6 system-ui, sans-serif', color: '#555', padding: 10
            }}>
              A panel opening beside the grid — the grid MOVES with no scroll and no resize of its own.
              The float must follow.
            </div>
          ) : null}
          {paged ? (
            // A real scrolling ancestor: scrolling it fires no grid event whatsoever.
            <div style={{ flex: 1, minWidth: 0, overflow: 'auto', border: '1px dashed #999' }}>
              <div style={{ height: 400, font: '12px/1.6 system-ui, sans-serif', color: '#777', padding: 10 }}>
                Scroll down — the grid is below.
              </div>
              {/* Inset so `data` sits well inside `viewport` and the two collide differently. */}
              <div style={{ height: 420, paddingRight: 240 }}>{grid}</div>
              <div style={{ height: 400 }} />
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 0, paddingRight: 240, paddingBottom: 110 }}>{grid}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Fit = asStory(Template);
Fit.args = { columnCount: 80, rowCount: 200, freezeTop: 4, freezeLeft: 3 };
Fit.storyName = 'Fit (boundary / flip / shift)';

const Story = {
  title: 'Float',
  component: Fit,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
