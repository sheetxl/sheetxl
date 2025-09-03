//@ts-nocheck

import React from 'react';

import {
 ChartColumnIcon, ChartColumnStackedIcon, ChartColumnStackedPercentIcon,
 ChartLineIcon, ChartLineStackedIcon, ChartLineStackedPercentIcon,
 ChartLineMarkersIcon, ChartLineStackedMarkersIcon, ChartLineStackedPercentMarkersIcon,
 ChartPieIcon, ChartPieDoughnutIcon, ChartBarIcon, ChartBarStackedIcon,
 ChartBarStackedPercentIcon, ChartAreaIcon, ChartAreaStackedIcon, ChartAreaStackedPercentIcon,
 ChartScatterMarkersIcon, ChartScatterLinesMarkersSmoothIcon, ChartScatterLinesSmoothIcon,
 ChartScatterLinesMarkersIcon, ChartScatterLinesIcon, ChartBubbleIcon, ChartBubble3DIcon
} from '@sheetxl/react'

import TemplateColumn from './templates/column-template.json';
import TemplateColumnStacked from './templates/column-stacked-template.json';
import TemplateColumnStackedPercent from './templates/column-stacked-percent-template.json';

import TemplateLine from './templates/line-template.json';
import TemplateLineStacked from './templates/line-stacked-template.json';
import TemplateLineStackedPercent from './templates/line-stacked-percent-template.json';

import TemplateLineMarkers from './templates/line-markers-template.json';
import TemplateLineStackedMarkers from './templates/line-stacked-markers-template.json';
import TemplateLineStackedPercentMarkers from './templates/line-stacked-percent-markers-template.json';

import TemplatePie from './templates/pie-template.json';
import TemplatePieDoughnut from './templates/pie-doughnut-template.json';

import TemplateBar from './templates/bar-template.json';
import TemplateBarStacked from './templates/bar-stacked-template.json';
import TemplateBarStackedPercent from './templates/bar-stacked-percent-template.json';

import TemplateArea from './templates/area-template.json';
import TemplateAreaStacked from './templates/area-stacked-template.json';
import TemplateAreaStackedPercent from './templates/area-stacked-percent-template.json';

import TemplateScatterMarkers from './templates/scatter-markers-template.json';

import TemplateScatterLinesMarkersSmooth from './templates/scatter-lines-markers-smooth-template.json';
import TemplateScatterLinesSmooth from './templates/scatter-lines-smooth-template.json';
import TemplateScatterLinesMarkers from './templates/scatter-lines-markers-template.json';
import TemplateScatterLines from './templates/scatter-lines-template.json';

export const PresetChartType = {
  Column: 'column',
  ColumnStacked: 'columnStacked',
  ColumnStackedPercent: 'columnStackedPercent',
  Line: 'line',
  LineStacked: 'lineStacked',
  LineStackedPercent: 'lineStackedPercent',
  LineMarkers: 'lineMarkers',
  LineStackedMarkers: 'lineStackedMarkers',
  LineStackedPercentMarkers: 'lineStackedPercentMarkers',
  Pie: 'pie',
  PieDoughnut: 'pieDoughnut',
  Bar: 'bar',
  BarStacked: 'barStacked',
  BarStackedPercent: 'barStackedPercent',
  Area: 'area',
  AreaStacked: 'areaStacked',
  AreaStackedPercent: 'areaStackedPercent',
  ScatterMarkers: 'scatterMarkers',
  ScatterLinesMarkersSmooth: 'scatterLinesMarkersSmooth',
  ScatterLinesMarkers: 'scatterLinesMarkers',
  ScatterLinesSmooth: 'scatterLinesSmooth',
  ScatterLines: 'scatterLines',
  Bubble: 'bubble',
  Bubble3D: 'bubble3D'
} as const;
export type PresetChartType = typeof PresetChartType[keyof typeof PresetChartType];

export interface ChartTypeDescriptor {
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;//JSX.IntrinsicElements | React.JSXElementConstructor<SvgIconProps>;
  description: string;
  template: any;
}

const chartTypeDescriptors = new Map<PresetChartType, ChartTypeDescriptor>();

chartTypeDescriptors.set(PresetChartType.Column, {
  Icon: ChartColumnIcon,
  description: 'Column Chart',
  template: TemplateColumn,
});
chartTypeDescriptors.set(PresetChartType.ColumnStacked, {
  Icon: ChartColumnStackedIcon,
  description: 'Stacked Column Chart',
  template: TemplateColumnStacked,
});
chartTypeDescriptors.set(PresetChartType.ColumnStackedPercent, {
  Icon: ChartColumnStackedPercentIcon,
  description: 'Stacked Percentage Column Chart',
  template: TemplateColumnStackedPercent,
});
chartTypeDescriptors.set(PresetChartType.Line, {
  Icon: ChartLineIcon,
  description: 'Line Chart',
  template: TemplateLine,
});
chartTypeDescriptors.set(PresetChartType.LineStacked, {
  Icon: ChartLineStackedIcon,
  description: 'Stacked Line Chart',
  template: TemplateLineStacked,
});
chartTypeDescriptors.set(PresetChartType.LineStackedPercent, {
  Icon: ChartLineStackedPercentIcon,
  description: 'Stacked Percentage Line Chart',
  template: TemplateLineStackedPercent,
});
chartTypeDescriptors.set(PresetChartType.LineMarkers, {
  Icon: ChartLineMarkersIcon,
  description: 'Line with Markers Chart',
  template: TemplateLineMarkers,
});
chartTypeDescriptors.set(PresetChartType.LineStackedMarkers, {
  Icon: ChartLineStackedMarkersIcon,
  description: 'Line Stacked with Markers Chart',
  template: TemplateLineStackedMarkers,
});
chartTypeDescriptors.set(PresetChartType.LineStackedPercentMarkers, {
  Icon: ChartLineStackedPercentMarkersIcon,
  description: 'Line Percentage with Markers Chart',
  template: TemplateLineStackedPercentMarkers,
});
chartTypeDescriptors.set(PresetChartType.Pie, {
  Icon: ChartPieIcon,
  description: 'Pie Chart',
  template: TemplatePie,
});
chartTypeDescriptors.set(PresetChartType.PieDoughnut, {
  Icon: ChartPieDoughnutIcon,
  description: 'Pie Doughnut Chart',
  template: TemplatePieDoughnut,
});
chartTypeDescriptors.set(PresetChartType.Bar, {
  Icon: ChartBarIcon,
  description: 'Bar Chart',
  template: TemplateBar,
});
chartTypeDescriptors.set(PresetChartType.BarStacked, {
  Icon: ChartBarStackedIcon,
  description: 'Bar Stacked Chart',
  template: TemplateBarStacked,
});
chartTypeDescriptors.set(PresetChartType.BarStackedPercent, {
  Icon: ChartBarStackedPercentIcon,
  description: 'Bar Percent Chart',
  template: TemplateBarStackedPercent,
});
chartTypeDescriptors.set(PresetChartType.Area, {
  Icon: ChartAreaIcon,
  description: 'Area Chart',
  template: TemplateArea,
});
chartTypeDescriptors.set(PresetChartType.AreaStacked, {
  Icon: ChartAreaStackedIcon,
  description: 'Stacked Area Chart',
  template: TemplateAreaStacked,
});
chartTypeDescriptors.set(PresetChartType.AreaStackedPercent, {
  Icon: ChartAreaStackedPercentIcon,
  description: 'Percentage Area Chart',
  template: TemplateAreaStackedPercent,
});
chartTypeDescriptors.set(PresetChartType.ScatterMarkers, {
  Icon: ChartScatterMarkersIcon,
  description: 'Scatter Chart with Markers',
  template: TemplateScatterMarkers,
});
chartTypeDescriptors.set(PresetChartType.ScatterLinesMarkersSmooth, {
  Icon: ChartScatterLinesMarkersSmoothIcon,
  description: 'Scatter Chart with Markers and Smooth Lines',
  template: TemplateScatterLinesMarkersSmooth,
});
chartTypeDescriptors.set(PresetChartType.ScatterLinesMarkers, {
  Icon: ChartScatterLinesMarkersIcon,
  description: 'Scatter Chart with Markers and Lines',
  template: TemplateScatterLinesMarkers,
});
chartTypeDescriptors.set(PresetChartType.ScatterLinesSmooth, {
  Icon: ChartScatterLinesSmoothIcon,
  description: 'Scatter Chart with Smooth Lines',
  template: TemplateScatterLinesSmooth,
});
chartTypeDescriptors.set(PresetChartType.ScatterLines, {
  Icon: ChartScatterLinesIcon,
  description: 'Scatter Chart with Lines',
  template: TemplateScatterLines,
});
chartTypeDescriptors.set(PresetChartType.Bubble, {
  Icon: ChartBubbleIcon,
  description: 'Bubble Chart',
  template: null
});
chartTypeDescriptors.set(PresetChartType.Bubble3D, {
  Icon: ChartBubble3DIcon,
  description: '3D Bubble Chart',
  template: null
});

export const presetChartTypeDescriptor = (presetType: PresetChartType): ChartTypeDescriptor => {
  return chartTypeDescriptors.get(presetType);
}
