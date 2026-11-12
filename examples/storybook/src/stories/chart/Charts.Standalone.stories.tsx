import React, { useRef, useState } from 'react';

import { type IChart } from '@sheetxl/sdk';

import { ChartElement, type IChartElement } from '@sheetxl/react';

import { newBook } from './useChartBook';

import { asStory } from '../../components';

/**
 * **A chart on its own, from a promise.** The least an app has to write: `getCharts().add`
 * answers a promise for the chart, and the promise goes straight into `ChartElement`. The element
 * draws the chart when it arrives and hands it back through `onChartChange`, so the app holds the
 * live chart in its own state without awaiting or suspending. No sheet view, no movable, no
 * effect. The chart stays in its workbook: retype it, retitle it, shuffle the cells it plots, or
 * ask the element for an SVG of it.
 */

const TYPES: IChart.Type[] = ['columnClustered', 'line', 'lineMarkers', 'area', 'pie', 'doughnut', 'barClustered'];

const Template: React.FC = () => {
  const [{ sheet, pending }] = useState(() => {
    const { sheet } = newBook();
    return { sheet, pending: sheet.getCharts().add('A1:D5', { type: 'columnClustered' }) };
  });
  const [chart, setChart] = useState<IChart | null>(null);
  const [type, setType] = useState<IChart.Type>('columnClustered');
  const [svg, setSvg] = useState<string | null>(null);
  const refElement = useRef<IChartElement>(null);

  const shuffle = (): void => {
    const rows = Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => Math.round(5 + Math.random() * 30)));
    sheet.getRange('B2:D5').setValues(rows);
  };

  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{chart ? 'the chart arrived' : 'waiting for the chart…'}</span>
        <label>type{' '}
          <select disabled={!chart} value={type} onChange={(e) => { const next = e.target.value as IChart.Type; setType(next); chart?.setChartType(next); }}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button disabled={!chart} onClick={() => chart?.getTitle().setText(`Retitled at ${new Date().toLocaleTimeString()}`)}>retitle</button>
        <button disabled={!chart} onClick={shuffle}>shuffle the cells</button>
        <button disabled={!chart} onClick={async () => setSvg(await refElement.current?.toSVG() ?? null)}>to SVG</button>
      </div>
      <ChartElement ref={refElement} chart={pending} onChartChange={setChart} width={560} height={320} style={{ border: '1px solid #ddd' }} />
      {svg ? (
        <details open>
          <summary>the SVG, {svg.length.toLocaleString()} characters, drawn again from the string</summary>
          <div style={{ border: '1px dashed #bbb', width: 560 }} dangerouslySetInnerHTML={{ __html: svg }} />
        </details>
      ) : null}
    </div>
  );
};

export const Standalone = asStory(Template);
Standalone.storyName = 'From a promise';

const Story = {
  title: 'Charts',
  component: Standalone,
};
export default Story;
