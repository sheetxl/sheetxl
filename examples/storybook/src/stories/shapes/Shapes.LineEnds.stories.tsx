import React, { useState } from 'react';

import { IStroke, type IShape } from '@sheetxl/sdk';

import { ShapeBox } from './ShapeBox';

import { asStory } from '../../components';

/**
 * **Line ends.** Every DrawingML end type at every size, on three line widths, at both ends of an
 * open preset. The line is trimmed under each end and the end is filled with the stroke's color,
 * the way PowerPoint draws them (design §10); a closed preset shows nothing, as in Excel.
 */

const TYPES: IStroke.LineEndType[] = ['triangle', 'stealth', 'diamond', 'oval', 'arrow'];
const SIZES: IStroke.LineEndSize[] = ['sm', 'med', 'lg'];
const WIDTHS = [1, 3, 8];
const SHAPES = ['straightConnector1', 'line', 'bentConnector3', 'curvedConnector3', 'arc', 'rect'];
const CAPS: IStroke.LineCap[] = ['butt', 'round', 'square'] as IStroke.LineCap[];

const PT_PER_PX = 72 / 96;

const Template: React.FC = () => {
  const [shape, setShape] = useState('straightConnector1');
  const [cap, setCap] = useState<IStroke.LineCap>(CAPS[0]);
  const [headless, setHeadless] = useState(false);
  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'center' }}>
        <label>Shape <select value={shape} onChange={(e) => setShape(e.target.value)}>
          {SHAPES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <label>Cap <select value={cap} onChange={(e) => setCap(e.target.value as IStroke.LineCap)}>
          {CAPS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select></label>
        <label><input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} /> tail only</label>
      </div>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th />
            {WIDTHS.map((w) => SIZES.map((s) => <th key={`${w}-${s}`} style={{ fontWeight: 'normal', color: '#555' }}>{w}px {s}</th>))}
          </tr>
        </thead>
        <tbody>
          {TYPES.map((type) => (
            <tr key={type}>
              <th style={{ textAlign: 'right', paddingRight: 8, fontWeight: 'normal' }}>{type}</th>
              {WIDTHS.map((width) => SIZES.map((size) => {
                const stroke = {
                  width: width * PT_PER_PX, fill: { type: 'solid', color: '#2f5597' }, lineCap: cap,
                  tailType: type, tailWidth: size, tailLength: size,
                  ...(headless ? {} : { headType: type, headWidth: size, headLength: size }),
                } as unknown as IShape.JSON['stroke'];
                return (
                  <td key={`${width}-${size}`} style={{ padding: 8, border: '1px solid #eee' }}>
                    <ShapeBox name={shape} width={120} height={60} stroke={stroke} strokeWidth={width} />
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const LineEnds = asStory(Template);
LineEnds.storyName = 'Line ends';

const Story = {
  title: 'Shapes',
  component: LineEnds,
};
export default Story;
