import React, { useMemo, useState } from 'react';

import { IGeometry } from '@sheetxl/sdk';

import { GeometryPaths } from './ShapeBox';
import { useShapeGeometry } from './useShapeGeometry';

import { asStory } from '../../components';

/**
 * **Every DrawingML preset shape** (187) at its default adjustments, at three aspect ratios. Each
 * tile asks a shape for its geometry and draws what `forEachPath` visits; nothing else of a
 * spreadsheet is involved.
 *
 * Each tile shows the preset name and how many adjustment handles it declares. Type in the filter
 * to narrow by name.
 */

const EXTENTS: { label: string; w: number; h: number }[] = [
  { label: 'square', w: 96, h: 96 },
  { label: 'wide', w: 144, h: 72 },
  { label: 'tall', w: 60, h: 120 },
];

const PRESETS: readonly string[] = Object.values(IGeometry.Preset);

const Tile: React.FC<{ name: string; w: number; h: number }> = ({ name, w, h }) => {
  const geometry = useShapeGeometry({ geometry: name }, w, h);
  let handles = 0;
  geometry?.forEachHandle(() => { handles++; });
  return (
    <figure style={{ margin: 0, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
      <div style={{ height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={w} height={h} overflow="visible" style={{ display: 'block' }}>
          {geometry ? <GeometryPaths geometry={geometry} /> : null}
        </svg>
      </div>
      <figcaption style={{ textAlign: 'center', marginTop: 4 }}>
        {name}{handles ? <span style={{ color: '#888' }}> · {handles} handle{handles > 1 ? 's' : ''}</span> : null}
      </figcaption>
    </figure>
  );
};

const Template: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [extent, setExtent] = useState(0);
  const names = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? PRESETS.filter((n) => n.toLowerCase().includes(f)) : PRESETS;
  }, [filter]);
  const { w, h } = EXTENTS[extent];
  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="filter by name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {EXTENTS.map((e, i) => (
          <label key={e.label}>
            <input type="radio" name="extent" checked={extent === i} onChange={() => setExtent(i)} /> {e.label}
          </label>
        ))}
        <span>{names.length} of {PRESETS.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {names.map((name) => <Tile key={name} name={name} w={w} h={h} />)}
      </div>
    </div>
  );
};

export const Presets = asStory(Template);
Presets.storyName = 'All presets';

const Story = {
  title: 'Shapes',
  component: Presets,
};
export default Story;
