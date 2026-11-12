import React, { useState } from 'react';

import { ChartKinds, type ChartKind, type ChartLayout, type IChart } from '@sheetxl/sdk';

import { ChartElement, ChartPaintKinds, type ChartPaintKind } from '@sheetxl/react';

import { useChartBook } from './useChartBook';

import { asStory } from '../../components';

/**
 * **A kind of your own.** A "lollipop" chart: a stem from the axis to each value with a dot on
 * top. Two registrations make it: a `ChartKind` in the sdk says where the stems go (the chrome,
 * axes and legend are the layout's, as for a column chart), and a `ChartPaintKind` in react says
 * how ECharts draws what the layout answered. The chart is added as `custom:lollipop`, and
 * retyped to a column chart and back like any other.
 */

interface Stem { series: number; x: number; y0: number; y1: number }
interface Lollipops { stems: Stem[]; radius: number }

/** The sdk side: each value's stem in px, in a custom group layout the painter reads. */
const LollipopKind: ChartKind = {
  types: ['custom:lollipop'],
  coordinates: 'cartesian',
  layout: (group, context) => {
    const { category, value } = context.roles!;
    const scale = context.scale(value);
    const base = context.yOf(scale, value, context.crossValue(category, scale));
    const n = group.series.length;
    const stems: Stem[] = [];
    group.series.forEach((series, s) => series.values.forEach((v, k) => {
      const slot = context.pointSlot(category, k);
      if (v === null || slot === null) return;
      // Series side by side about the category's center, 6 pt apart.
      const x = context.xOf(category, slot) + (s - (n - 1) / 2) * 6;
      stems.push({ series: s, x: context.at(x), y0: context.at(base), y1: context.at(context.yOf(scale, value, v)) });
    }));
    const { inner } = context;
    return {
      type: 'custom',
      kind: 'lollipop',
      axisIds: [category.id, value.id],
      plot: { x: context.at(inner.x), y: context.at(inner.y), width: context.px(inner.width), height: context.px(inner.height) },
      series: group.series.map((series) => ({ ...context.base(series), marker: null })),
      data: { stems, radius: context.px(4) } satisfies Lollipops
    };
  }
};

/** The react side: a line and a circle per stem, in the series' fill, and a dot for the legend key. */
const LollipopPaint: ChartPaintKind = {
  types: ['custom:lollipop'],
  graphic: (group, context) => {
    if (group.type !== 'custom') return [];
    const { stems, radius } = group.data as Lollipops;
    return stems.flatMap((stem) => {
      const fill = context.paint((group as ChartLayout.CustomGroupLayout).series[stem.series].fill);
      return [
        { type: 'line', silent: true, z: 2, shape: { x1: stem.x, y1: stem.y0, x2: stem.x, y2: stem.y1 }, style: { stroke: fill, lineWidth: 2 } },
        { type: 'circle', silent: true, z: 3, shape: { cx: stem.x, cy: stem.y1, r: radius }, style: { fill } }
      ];
    });
  },
  legendKey: (_entry, series, _group, key, context) => [{
    type: 'circle', silent: true, z: 50,
    shape: { cx: key.x + key.width / 2, cy: key.y + key.height / 2, r: key.height / 2 },
    style: { fill: context.paint(series.fill) }
  }]
};

ChartKinds.register(LollipopKind);
ChartPaintKinds.register(LollipopPaint);

const Template: React.FC = () => {
  const book = useChartBook('custom:lollipop', (chart) => chart.getTitle().setText('A lollipop chart'));
  const [type, setType] = useState<string>('custom:lollipop');
  if (!book) return <div style={{ padding: 12 }}>making the workbook…</div>;
  const { chart } = book;
  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>type{' '}
          <select value={type} onChange={(e) => { setType(e.target.value); chart.setChartType(e.target.value as IChart.Type | string); }}>
            <option value="custom:lollipop">custom:lollipop</option>
            <option value="columnClustered">columnClustered</option>
            <option value="line">line</option>
          </select>
        </label>
        <span style={{ color: '#888' }}>getChartType() → {chart.getChartType()}</span>
      </div>
      <ChartElement chart={chart} width={560} height={320} style={{ border: '1px solid #ddd' }} />
    </div>
  );
};

export const CustomKind = asStory(Template);
CustomKind.storyName = 'A custom kind';

const Story = {
  title: 'Charts',
  component: CustomKind,
};
export default Story;
