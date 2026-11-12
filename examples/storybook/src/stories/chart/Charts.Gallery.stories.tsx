import React, { useEffect, useState } from 'react';

import { type IChart } from '@sheetxl/sdk';

import { ChartElement } from '@sheetxl/react';

import { newBook, sourceOf } from './useChartBook';

import { asStory } from '../../components';

/**
 * **Every type of Excel's gallery**, from the same cells, each drawn by a `ChartElement` in a
 * tile. One workbook holds them all: category types chart the months table, scatters the X/Y
 * columns, bubbles the X/Y/Size columns, stocks the dated prices. The 3-D forms are drawn flat,
 * the surfaces as contours, and the 2016 types as a placeholder saying so.
 */

const GALLERY: { family: string, types: IChart.Type[] }[] = [
  { family: 'column', types: ['columnClustered', 'columnStacked', 'columnStacked100', '3DColumnClustered', '3DColumnStacked', '3DColumnStacked100', '3DColumn'] },
  { family: 'line', types: ['line', 'lineStacked', 'lineStacked100', 'lineMarkers', 'lineMarkersStacked', 'lineMarkersStacked100', '3DLine'] },
  { family: 'pie', types: ['pie', 'pieExploded', '3DPie', '3DPieExploded', 'pieOfPie', 'barOfPie', 'doughnut', 'doughnutExploded'] },
  { family: 'bar', types: ['barClustered', 'barStacked', 'barStacked100', '3DBarClustered', '3DBarStacked', '3DBarStacked100'] },
  { family: 'area', types: ['area', 'areaStacked', 'areaStacked100', '3DArea', '3DAreaStacked', '3DAreaStacked100'] },
  { family: 'scatter and bubble', types: ['xyscatter', 'xyscatterSmooth', 'xyscatterSmoothNoMarkers', 'xyscatterLines', 'xyscatterLinesNoMarkers', 'bubble', 'bubble3DEffect'] },
  { family: 'stock', types: ['stockHLC', 'stockOHLC', 'stockVHLC', 'stockVOHLC'] },
  { family: 'surface', types: ['surface', 'surfaceWireframe', 'surfaceTopView', 'surfaceTopViewWireframe'] },
  { family: 'radar', types: ['radar', 'radarMarkers', 'radarFilled'] },
  { family: '2016', types: ['treemap', 'sunburst', 'histogram', 'pareto', 'boxwhisker', 'waterfall', 'funnel', 'regionMap'] }
];
const COUNT = GALLERY.reduce((n, family) => n + family.types.length, 0);

interface Made { type: IChart.Type; chart: IChart | null; error?: string }

const Template: React.FC = () => {
  const [families, setFamilies] = useState<{ family: string; made: Made[] }[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { sheet } = newBook();
      const out: { family: string; made: Made[] }[] = [];
      for (const { family, types } of GALLERY) {
        const made: Made[] = [];
        for (const type of types) {
          try {
            const chart = await sheet.getCharts().add(sourceOf(type), { type });
            chart.getTitle().setText(type);
            made.push({ type, chart });
          } catch (error: unknown) {
            made.push({ type, chart: null, error: (error as Error).message });
          }
        }
        out.push({ family, made });
      }
      if (live) setFamilies(out);
    })();
    return () => { live = false; };
  }, []);

  if (!families) return <div style={{ padding: 12 }}>making {COUNT} charts…</div>;
  return (
    <div style={{ padding: 12, font: '12px system-ui, sans-serif' }}>
      {families.map(({ family, made }) => (
        <section key={family} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '8px 0', font: '600 13px system-ui, sans-serif' }}>{family}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {made.map(({ type, chart, error }) => (
              <figure key={type} style={{ margin: 0, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
                {chart ? <ChartElement chart={chart} width="100%" height={180} /> : <div style={{ height: 180, color: '#b00020' }}>{error}</div>}
                <figcaption style={{ marginTop: 4 }}>{type}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export const Gallery = asStory(Template);
Gallery.storyName = 'Every gallery type';

const Story = {
  title: 'Charts',
  component: Gallery,
};
export default Story;
