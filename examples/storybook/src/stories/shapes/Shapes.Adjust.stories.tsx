import React, { useMemo, useRef, useState } from 'react';

import { IGeometry } from '@sheetxl/sdk';

import { GeometryPaths } from './ShapeBox';
import { useShapeGeometry } from './useShapeGeometry';

import { asStory } from '../../components';

/**
 * **One preset, live.** Pick a shape, size it, and drag its yellow adjustment handles: each move
 * is `adjustmentsFromHandle` then `withAdjustments`, both synchronous once the geometry has
 * loaded. Connection sites are green squares; the text rectangle is dashed.
 */

const PRESETS: readonly string[] = Object.values(IGeometry.Preset);

const Template: React.FC = () => {
  const [name, setName] = useState<string>(IGeometry.Preset.RoundRect);
  const [width, setWidth] = useState(240);
  const [height, setHeight] = useState(160);
  const [adjustments, setAdjustments] = useState<Record<string, number> | null>(null);
  const refSvg = useRef<SVGSVGElement>(null);
  const refDrag = useRef<number | null>(null);

  const base = useShapeGeometry({ geometry: name }, width, height);
  const geometry = useMemo(() => (base && adjustments ? base.withAdjustments(adjustments) : base), [base, adjustments]);

  const pick = (next: string): void => { setName(next); setAdjustments(null); };

  const handles: IGeometry.IHandle[] = [];
  const connections: IGeometry.IConnection[] = [];
  geometry?.forEachHandle((h) => handles.push(h));
  geometry?.forEachConnection((c) => connections.push(c));
  const t = geometry?.getTextRect();

  const onPointerMove = (e: React.PointerEvent): void => {
    const index = refDrag.current;
    const ctm = refSvg.current?.getScreenCTM();
    if (index === null || !geometry || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    setAdjustments(geometry.adjustmentsFromHandle(index, p.x - 40, p.y - 40));
  };

  return (
    <div style={{ display: 'flex', gap: 24, padding: 12, font: '12px system-ui, sans-serif' }}>
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label>Shape <select value={name} onChange={(e) => pick(e.target.value)} style={{ width: '100%' }}>
          {PRESETS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <label>Width <input type="range" min={10} max={600} value={width} onChange={(e) => setWidth(Number(e.target.value))} /> {width}</label>
        <label>Height <input type="range" min={10} max={600} value={height} onChange={(e) => setHeight(Number(e.target.value))} /> {height}</label>
        {adjustments ? <button onClick={() => setAdjustments(null)}>reset adjustments</button> : null}
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10, color: '#555', maxHeight: 300, overflow: 'auto' }}>
          {JSON.stringify(adjustments ?? {}, null, 1)}
        </pre>
      </div>
      <svg
        ref={refSvg}
        width={width + 80}
        height={height + 80}
        style={{ border: '1px solid #ddd', overflow: 'visible', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={() => { refDrag.current = null; }}
        onPointerLeave={() => { refDrag.current = null; }}
      >
        <g transform="translate(40 40)">
          <rect width={width} height={height} fill="none" stroke="#ccc" strokeDasharray="2 2" />
          {geometry ? <GeometryPaths geometry={geometry} /> : null}
          {t ? <rect x={t.l} y={t.t} width={Math.max(0, t.r - t.l)} height={Math.max(0, t.b - t.t)} fill="none" stroke="#c00" strokeDasharray="4 2" /> : null}
          {connections.map((c) => <rect key={`c${c.index}`} x={c.x - 3} y={c.y - 3} width={6} height={6} fill="#0a0" />)}
          {handles.map((h) => (
            <circle key={`h${h.index}`} cx={h.x} cy={h.y} r={5} fill="#ffc000" stroke="#000" style={{ cursor: 'crosshair' }}
              onPointerDown={(e) => { refDrag.current = h.index; (e.target as Element).setPointerCapture?.(e.pointerId); }} />
          ))}
        </g>
      </svg>
    </div>
  );
};

export const Adjust = asStory(Template);
Adjust.storyName = 'Adjust one shape';

const Story = {
  title: 'Shapes',
  component: Adjust,
};
export default Story;
