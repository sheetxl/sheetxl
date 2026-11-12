import React, { useEffect, useMemo, useState } from 'react';

import { type IChart } from '@sheetxl/sdk';

import { ChartElement } from '@sheetxl/react';

import { useChartBook } from './useChartBook';

import { asStory } from '../../components';

/**
 * **A chart outside a layer.** `ChartElement` draws any `IChart` in a plain `div`: no sheet view,
 * no movable, no frame. The chart here lives in a workbook (its cells are the data table), and the
 * element follows it: change the type, the title or the legend through the API, or shuffle the
 * cells it plots, and it repaints. The same chart is drawn twice at two sizes, since the element is
 * a view of the chart, laid out at its own box.
 */

const TYPES: IChart.Type[] = [
  'columnClustered', 'columnStacked', 'columnStacked100', 'barClustered', 'barStacked',
  'line', 'lineMarkers', 'lineStacked', 'area', 'areaStacked', 'pie', 'doughnut', 'radar', 'radarFilled'
];
const LEGENDS: IChart.LegendPosition[] = ['right', 'left', 'top', 'bottom', 'corner'];

const Template: React.FC = () => {
  const book = useChartBook('columnClustered', (chart) => chart.getTitle().setText('Sales by month'));
  const [type, setType] = useState<IChart.Type>('columnClustered');
  const [legend, setLegend] = useState<IChart.LegendPosition>('right');
  const [title, setTitle] = useState('Sales by month');
  const [width, setWidth] = useState(560);
  const [height, setHeight] = useState(320);

  // The sheet view's chart element selection: what a press in the element selects.
  const selection = useMemo(() => book?.sheet.getView().getChartElementSelection() ?? null, [book]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  useEffect(() => selection?.addListeners({ onChange: () => setSelectedPath(selection.getActive()?.getPath() ?? null) }), [selection]);

  if (!book) return <div style={{ padding: 12 }}>making the workbook…</div>;
  const { chart, sheet } = book;

  const shuffle = (): void => {
    const rows = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => Math.round(5 + Math.random() * 30)));
    sheet.getRange('B2:D5').setValues(rows);
  };

  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>type{' '}
          <select value={type} onChange={(e) => { const next = e.target.value as IChart.Type; setType(next); chart.setChartType(next); }}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>legend{' '}
          <select value={legend} onChange={(e) => { const next = e.target.value as IChart.LegendPosition; setLegend(next); chart.getLegend().setPosition(next); }}>
            {LEGENDS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>title{' '}
          <input value={title} onChange={(e) => { setTitle(e.target.value); chart.getTitle().setText(e.target.value || null); }} />
        </label>
        <label>width <input type="range" min={200} max={900} value={width} onChange={(e) => setWidth(Number(e.target.value))} /> {width}</label>
        <label>height <input type="range" min={120} max={600} value={height} onChange={(e) => setHeight(Number(e.target.value))} /> {height}</label>
        <button onClick={shuffle}>shuffle the cells</button>
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <figure style={{ margin: 0 }}>
          <ChartElement chart={chart} width={width} height={height} selection={selection} style={{ border: '1px solid #ddd' }} />
          <figcaption style={{ color: '#888', marginTop: 4 }}>
            press an element to select it (a series first, then its point); selected: {selectedPath ?? 'nothing'}
          </figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          <ChartElement chart={chart} width={240} height={144} style={{ border: '1px solid #ddd' }} />
          <figcaption style={{ color: '#888', marginTop: 4 }}>the same chart, 240 × 144</figcaption>
        </figure>
      </div>
    </div>
  );
};

export const Element = asStory(Template);
Element.storyName = 'Outside a layer';

const Story = {
  title: 'Charts',
  component: Element,
};
export default Story;
