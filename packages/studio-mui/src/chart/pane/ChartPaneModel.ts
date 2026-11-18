
import { IFill, type ICellRange, type IChart } from '@sheetxl/sdk';

import type { useTranslator } from '@sheetxl/utils-react';

import { presetChartTypeDescriptor, PresetChartType } from '@sheetxl/react';

import { type FormatField } from '../../format';

export type Translate = ReturnType<typeof useTranslator>;

/**
 * A row of the pane: one chart element, or one that would be there once shown.
 *
 * @remarks
 * A row says that its element is there, what it reads and what it references. How the element
 * looks, and the options that are its own, are the format editor's, reached from the row.
 *
 * What a row offers says what kind it is:
 * - `always`: no control; the element is always there (the chart area, the plot area).
 * - `toggle`: shown or hidden; hiding loses nothing.
 * - `item`: one of a list; it can be removed, and a series can be put in another place.
 * - `derived`: there because something uses it (a secondary axis, a group's lines); shown or hidden.
 */
export interface ChartPaneNode {
  /** Names the row in the tree. An element drawn under several rows has an id per row. */
  id: string;
  kind: 'always' | 'toggle' | 'item' | 'derived';
  /** The row's label, short: its place in the tree says the rest. */
  label: string;
  /** The element by its whole name, as Excel's Chart Elements list gives it. */
  name: string;
  /** The element the row is of; `null` for a row of the chart as a whole. */
  element: IChart.IElement | null;
  /** Shows or hides the element. */
  toggle?: { get: () => boolean, set: (shown: boolean) => void };
  /** Removes the element from its list. */
  remove?: () => void;
  /** The element's place in its list, from 0, for a list whose rows can be put in another order. */
  order?: { get: () => number, set: (index: number) => void };
  /** The color the element is drawn in, as CSS, for the key on its header; `null` where it has no one color. */
  swatch?: () => string | null;
  /** How the element is drawn, chosen on its header. */
  type?: { get: () => string, set: (type: string) => void, options: () => readonly ChartPaneTypeOption[] };
  /** The tab of the format editor the row is of, where it is a part of its element with a tab of its own (an axis's labels). */
  tab?: string;
  /** Whether the row has nothing inside it: it does not open, and pressing it selects its element. */
  leaf?: boolean;
  /** The row's own settings. Asked for when the row opens. */
  fields: () => FormatField[];
  /** The rows and lists inside this one. Asked for when the row opens. */
  children: () => (ChartPaneNode | ChartPaneList)[];
}

/** The chart's selection as the pane's rows need it: what is selected, and a way to select. */
export interface ChartPaneSelection {
  /** The element selected in the chart, or `null`. */
  active: IChart.IElement | null;
  select: (element: IChart.IElement) => void;
  /** Selects an element and brings up the format editor on it, on `tab` where one is named. */
  format?: (element: IChart.IElement, tab?: string) => void;
}

/** A way a series can be drawn, as its header's picker offers it. */
export interface ChartPaneTypeOption {
  type: string;
  label: string;
}

/** Rows under a heading: a section of the pane, or a list inside a row that can be added to. */
export interface ChartPaneList {
  id: string;
  label: string;
  /** Adds an item and returns its row's id, for the pane to open; `addLabel` names the action. */
  add?: () => string | void;
  addLabel?: string;
  /** What is said in place of the rows while there are none. */
  empty?: string;
  items: () => ChartPaneNode[];
  readonly isList: true;
}

export const isChartPaneList = (child: ChartPaneNode | ChartPaneList): child is ChartPaneList => (child as ChartPaneList).isList === true;

/** Whether the chart's category axis runs up the side, as a bar chart's does. */
const isHorizontalBars = (chart: IChart): boolean => /^(bar|3DBar)/.test(chart.getChartType());
const isXY = (chart: IChart): boolean => /^(xyscatter|bubble)/.test(chart.getChartType());

/** An axis by Excel's name for it: `Vertical (Value) Axis`, `Secondary Horizontal (Category) Axis`… */
const axisLabel = (t: Translate, chart: IChart, path: string): string => {
  const [, group, role] = path.split('/');
  const bars = isHorizontalBars(chart);
  const horizontal = role === 'category' ? !bars : role === 'value' ? bars : true;
  const kind = role === 'series' ? t('chart.pane.axisKind.series') : isXY(chart) || role === 'value' ? t('chart.pane.axisKind.value') : t('chart.pane.axisKind.category');
  const side = horizontal ? t('chart.pane.axisSide.horizontal') : t('chart.pane.axisSide.vertical');
  const label = t('chart.pane.axis', { side, kind });
  return group === 'secondary' ? t('chart.pane.secondary', { label }) : label;
};

/** The element by the name Excel's Chart Elements list gives it. */
export const elementLabel = (t: Translate, element: IChart.IElement): string => {
  const chart = element.getChart();
  const path = element.getPath();
  const parent = element.getParent();
  const parentLabel = (): string => parent ? elementLabel(t, parent) : '';
  const last = Number(path.split('/').pop());
  switch (element.getElementType()) {
    case 'chartArea': return t('chart.pane.element.chartArea');
    case 'title': return t('chart.pane.element.title');
    case 'legend': return t('chart.pane.element.legend');
    case 'legendEntry': return t('chart.pane.element.legendEntry', { index: last + 1 });
    case 'plotArea': return t('chart.pane.element.plotArea');
    case 'dataTable': return t('chart.pane.element.dataTable');
    case 'axis': return axisLabel(t, chart, path);
    case 'axisTitle': return t('chart.pane.element.axisTitle', { axis: parentLabel() });
    case 'gridlines': return path.endsWith('minorGridlines')
      ? t('chart.pane.element.minorGridlines', { axis: parentLabel() })
      : t('chart.pane.element.majorGridlines', { axis: parentLabel() });
    case 'series': return t('chart.pane.element.series', { name: (element as IChart.ISeries).getName() ?? t('chart.pane.seriesDefault', { index: chart.getSeries().indexOf(element as IChart.ISeries) + 1 }) });
    case 'point': return t('chart.pane.element.point', { series: parentLabel(), index: last + 1 });
    case 'marker': return t('chart.pane.element.marker', { owner: parentLabel() });
    case 'dataLabels': return parent?.getElementType() === 'series' ? t('chart.pane.element.dataLabels', { series: parentLabel() }) : t('chart.pane.element.allDataLabels');
    case 'dataLabel': return t('chart.pane.element.dataLabel', { point: parentLabel() });
    case 'trendline': return t('chart.pane.element.trendline', { series: parentLabel(), index: last + 1 });
    case 'trendlineLabel': return t('chart.pane.element.trendlineLabel', { trendline: parentLabel() });
    case 'errorBars': return path.endsWith('/x') ? t('chart.pane.element.xErrorBars', { series: parentLabel() }) : t('chart.pane.element.yErrorBars', { series: parentLabel() });
    case 'chartGroup': return t('chart.pane.element.group', { index: last + 1 });
    case 'upDownBars': return t('chart.pane.element.upDownBars');
    case 'hiLoLines': return t('chart.pane.element.hiLoLines');
    case 'dropLines': return t('chart.pane.element.dropLines');
    case 'seriesLines': return t('chart.pane.element.seriesLines');
    default: return path;
  }
};


/** The axes a chart may have, in the order the pane lists them. */
const AXES: readonly (readonly ['category' | 'value' | 'series', IChart.AxisGroup])[] = [
  ['category', 'primary'], ['value', 'primary'], ['series', 'primary'], ['category', 'secondary'], ['value', 'secondary']
];

/**
 * The types one series can be given beside others: columns, bars, lines, areas, scatters, pies and
 * doughnuts. The rest (bubbles, radars, stocks, surfaces, the pies of pies and the 2016 types)
 * take the whole chart, and are the chart's to choose.
 */
const SERIES_TYPES = ([
  PresetChartType.Column, PresetChartType.ColumnStacked, PresetChartType.ColumnStackedPercent,
  PresetChartType.Line, PresetChartType.LineStacked, PresetChartType.LineStackedPercent,
  PresetChartType.LineMarkers, PresetChartType.LineStackedMarkers, PresetChartType.LineStackedPercentMarkers,
  PresetChartType.Pie, PresetChartType.PieDoughnut,
  PresetChartType.Bar, PresetChartType.BarStacked, PresetChartType.BarStackedPercent,
  PresetChartType.Area, PresetChartType.AreaStacked, PresetChartType.AreaStackedPercent,
  PresetChartType.ScatterMarkers, PresetChartType.ScatterLinesMarkersSmooth, PresetChartType.ScatterLinesMarkers,
  PresetChartType.ScatterLinesSmooth, PresetChartType.ScatterLines
] as const).map(presetChartTypeDescriptor);

/** A fill's one color as CSS, or `null` for a fill that is not one color. */
const solidCSS = (fill: IFill): string | null => fill.getType() === IFill.Type.Solid ? (fill as IFill.ISolid).getColor().toCSS() : null;

/** A formula's text without its leading `=`. */
const bare = (text: string): string => text.trim().replace(/^=/, '');

/** The types Excel draws a trendline or error bars for, by the start of their names; stacked forms take no trendline. */
const ANALYSIS_TYPES = /^(column|bar|line|area|xyscatter|bubble)/;

/**
 * The details of `chart`, declared: its sections, their rows, and each row's fields and inner rows.
 *
 * @remarks
 * Nothing here draws. Rows answer their fields and children when asked, so a closed row costs its
 * label. Every setter writes through the element's own, one step to undo each, and may throw what
 * the chart refuses.
 */
export const buildChartPane = (chart: IChart, t: Translate, selection?: ChartPaneSelection): ChartPaneList[] => {

  const flag = (key: string, label: string, get: () => boolean, set: (value: boolean) => void, base?: Partial<FormatField.Base>): FormatField =>
    ({ type: 'flag', key, label, get, set, ...base });

  /** A row with nothing inside it: an element that is there, or shown, and formatted elsewhere. */
  const leaf = (element: IChart.IElement, kind: ChartPaneNode['kind'], label: string, more?: Partial<ChartPaneNode>): ChartPaneNode => ({
    id: element.getPath(),
    kind,
    label,
    name: elementLabel(t, element),
    element,
    leaf: true,
    fields: () => [],
    children: () => [],
    ...more
  });

  /** A row for an element shown or hidden, with nothing inside it. */
  const toggleLeaf = (element: IChart.IElement & { getVisible(): boolean, setVisible(visible: boolean): unknown }, label: string, more?: Partial<ChartPaneNode>): ChartPaneNode =>
    leaf(element, 'toggle', label, { toggle: { get: () => element.getVisible(), set: shown => { element.setVisible(shown); } }, ...more });

  const titleNode = (title: IChart.ITitle, label: string): ChartPaneNode => ({
    id: title.getPath(),
    kind: 'toggle',
    label,
    name: elementLabel(t, title),
    element: title,
    toggle: { get: () => title.getVisible(), set: shown => { title.setVisible(shown); } },
    fields: () => [
      { type: 'text', key: 'text', label: t('chart.pane.titleText'), get: () => title.getText() ?? '', set: text => { title.setText(text || null); } }
    ],
    children: () => []
  });

  const axisNode = (axis: IChart.IAxis): ChartPaneNode => ({
    id: axis.getPath(),
    kind: axis.getAxisGroup() === 'secondary' ? 'derived' : 'toggle',
    label: elementLabel(t, axis),
    name: elementLabel(t, axis),
    element: axis,
    toggle: { get: () => axis.getVisible(), set: shown => { axis.setVisible(shown); } },
    fields: () => {
      // A category axis's labels are every series' on it at once: stated here, once, not on each series.
      if (axis.getKind() === 'value' || axis.getKind() === 'series' || isXY(chart)) return [];
      const group = axis.getAxisGroup();
      return [{
        type: 'formula', key: 'categories', label: t('chart.pane.categories'),
        get: () => chart.getSeries().find(series => series.getAxisGroup() === group)?.getCategoriesFormula() ?? '',
        set: text => { axis.setCategoryNames(bare(text)); }
      }];
    },
    children: () => [
      // An axis's labels are a part of it, there or not, as a series' marker is. They are not an element
      // of their own to select, so their row is the axis's: it formats the axis, on its Labels.
      leaf(axis, 'toggle', t('chart.pane.row.labels'), {
        id: `${axis.getPath()}:labels`,
        tab: 'labels',
        toggle: { get: () => axis.getTickLabelPosition() !== 'none', set: shown => { axis.setTickLabelPosition(shown ? 'nextToAxis' : 'none'); } }
      }),
      titleNode(axis.getTitle(), t('chart.pane.row.title')),
      toggleLeaf(axis.getMajorGridlines(), t('chart.pane.row.majorGridlines')),
      toggleLeaf(axis.getMinorGridlines(), t('chart.pane.row.minorGridlines'))
    ]
  });

  const seriesName = (series: IChart.ISeries): string => series.getName() ?? t('chart.pane.seriesDefault', { index: chart.getSeries().indexOf(series) + 1 });

  /** A row for something a series' whole group has (its lines, its up/down bars), listed under the series. */
  const groupPartNode = (series: IChart.ISeries, part: IChart.ILines | IChart.IUpDownBars): ChartPaneNode =>
    toggleLeaf(part, elementLabel(t, part), { id: `${series.getPath()}:${part.getPath()}`, kind: 'derived' });

  /** A row for a point that states something of its own; removing it hands the point back to its series. */
  const pointNode = (series: IChart.ISeries, point: IChart.IPoint, value: number | null): ChartPaneNode => {
    const index = point.getIndex();
    const type = series.getChartType();
    return {
      id: point.getPath(),
      kind: 'item',
      label: value === null ? t('chart.pane.row.point', { index: index + 1 }) : t('chart.pane.row.pointValue', { index: index + 1, value }),
      name: elementLabel(t, point),
      element: point,
      remove: () => { point.clear(); },
      fields: () => [],
      // The parts a point may have, each there or not: its marker where its series draws one, and its label.
      children: () => {
        if (/^waterfall/.test(type)) return [];
        const children: ChartPaneNode[] = [];
        if (hasMarkers(type)) children.push(markerNode(point.getMarker()));
        const label = point.getDataLabel();
        children.push(leaf(label, 'toggle', t('chart.pane.row.dataLabel'), {
          toggle: { get: () => point.getHasDataLabel(), set: shown => { point.setHasDataLabel(shown); } }
        }));
        return children;
      },
      leaf: /^waterfall/.test(type)
    };
  };

  /** Whether a series of `type` draws a marker at each point. */
  const hasMarkers = (type: string): boolean => /^(line|xyscatter|radar)/.test(type) && type !== 'radarFilled';

  /** A marker, there or not: a series', or one point's over it. What it looks like is its owner's Marker tab. */
  const markerNode = (marker: IChart.IMarker): ChartPaneNode => leaf(marker, 'toggle', t('chart.pane.row.marker'), {
    toggle: { get: () => marker.getSymbol() !== 'none', set: shown => { marker.setSymbol(shown ? 'automatic' : 'none'); } }
  });

  /** The types whose points are drawn one by one, and so can each be formatted on their own. */
  const POINT_TYPES = /^(column|bar|line|pie|doughnut|xyscatter|bubble|radar|waterfall)|OfPie$/;

  /**
   * A series' points that state something of their own: the list is as long as they number, not as
   * the series is. A point joins it when it is added here, or once the format editor has it state something.
   */
  const pointsList = (series: IChart.ISeries): ChartPaneList | null => {
    const points = series.getPoints();
    const items = (): ChartPaneNode[] => {
      const nodes: ChartPaneNode[] = [];
      points.forEach((value, context) => { nodes.push(pointNode(series, context.getPoint(), value)); }, { overridesOnly: true, reuseContext: true });
      return nodes;
    };
    if (!POINT_TYPES.test(series.getChartType()) && items().length === 0) return null;
    return {
      id: `${series.getPath()}/points`,
      label: t('chart.pane.row.points'),
      // The first point that states nothing becomes one of the series' own, with nothing set on it yet:
      // it is listed, selected in the chart so that it is plain which it is, and its row opens.
      add: points.getCount() > 0 ? () => {
        const point = points.add();
        selection?.select(point);
        return point.getPath();
      } : undefined,
      addLabel: t('chart.pane.addCustomPoint'),
      items,
      isList: true
    };
  };

  /** The color a series' key is drawn in: its line's where it is drawn as one, else its fill's. */
  const seriesColor = (series: IChart.ISeries): string | null => {
    const style = series.getStyle();
    const line = solidCSS(style.getStroke().getFill());
    const fill = solidCSS(style.getFill());
    return /^(line|xyscatter|radar)/.test(series.getChartType()) ? line ?? fill : fill ?? line;
  };

  const seriesTypes = (series: IChart.ISeries): ChartPaneTypeOption[] => {
    const options: ChartPaneTypeOption[] = SERIES_TYPES.map(descriptor => ({ type: descriptor.type, label: t(descriptor.description) }));
    // A type the picker does not offer (a radar's, a stock's) is still what the series is.
    const type = series.getChartType();
    if (!options.some(option => option.type === type)) options.unshift({ type, label: type });
    return options;
  };

  const seriesNode = (series: IChart.ISeries): ChartPaneNode => {
    const path = series.getPath();
    return {
      id: path,
      kind: 'item',
      label: seriesName(series),
      name: elementLabel(t, series),
      element: series,
      remove: () => { series.delete(); },
      order: { get: () => series.getPlotOrder(), set: index => { series.setPlotOrder(index); } },
      swatch: () => seriesColor(series),
      type: { get: () => series.getChartType(), set: type => { series.setChartType(type); }, options: () => seriesTypes(series) },
      fields: () => {
        const type = series.getChartType();
        const xy = /^(xyscatter|bubble)/.test(type);
        const fields: FormatField[] = [
          {
            type: 'formula', key: 'name', label: t('chart.pane.seriesName'), literal: true,
            get: () => { const formula = series.getNameFormula(); return formula ? `=${formula}` : series.getName() ?? ''; },
            set: text => { series.setName(text.trim() || null); }
          },
          {
            type: 'formula', key: 'values', label: xy ? t('chart.pane.seriesYValues') : t('chart.pane.seriesValues'),
            get: () => series.getValuesFormula() ?? '', set: text => { series.setValues(bare(text)); }
          }
        ];
        // A scatter's or bubble's x values are its own; a category series' labels are its axis's.
        if (xy) {
          fields.push({
            type: 'formula', key: 'xValues', label: t('chart.pane.seriesXValues'),
            get: () => series.getCategoriesFormula() ?? '', set: text => { series.setXAxisValues(bare(text) || null); }
          });
        }
        if (/^bubble/.test(type)) {
          fields.push({
            type: 'formula', key: 'sizes', label: t('chart.pane.seriesSizes'),
            get: () => series.getBubbleSizesFormula() ?? '', set: text => { series.setBubbleSizes(bare(text)); }
          });
        }
        fields.push(
          flag('secondaryAxis', t('chart.pane.secondaryAxis'), () => series.getAxisGroup() === 'secondary', secondary => { series.setAxisGroup(secondary ? 'secondary' : 'primary'); })
        );
        return fields;
      },
      children: () => {
        const type = series.getChartType();
        const children: (ChartPaneNode | ChartPaneList)[] = [];
        if (hasMarkers(type)) children.push(markerNode(series.getMarker()));
        children.push(toggleLeaf(series.getDataLabels(), t('chart.pane.row.dataLabels')));

        const analysis = ANALYSIS_TYPES.test(type);
        const xBars = series.getXErrorBars();
        if (/^(xyscatter|bubble)/.test(type) || xBars.getVisible()) children.push(toggleLeaf(xBars, t('chart.pane.row.xErrorBars')));
        const yBars = series.getYErrorBars();
        if (analysis || yBars.getVisible()) children.push(toggleLeaf(yBars, t('chart.pane.row.yErrorBars')));

        // What the series' group draws for all of its series: offered where the type has it, or where the file shows it.
        const lineLike = /^(line|stock)/.test(type);
        const groupPart = (part: IChart.ILines | IChart.IUpDownBars, offered: boolean): void => {
          if (offered || part.getVisible()) children.push(groupPartNode(series, part));
        };
        groupPart(series.getUpDownBars(), lineLike);
        groupPart(series.getHiLoLines(), lineLike);
        groupPart(series.getDropLines(), lineLike || /^area/.test(type));
        groupPart(series.getSeriesLines(), /^(column|bar)Stacked/.test(type) || /OfPie$/.test(type));

        const points = pointsList(series);
        if (points) children.push(points);

        const trendlines = series.getTrendlines();
        if ((analysis && !/Stacked/.test(type)) || trendlines.length > 0) {
          children.push({
            id: `${path}/trendlines`,
            label: t('chart.pane.row.trendlines'),
            add: () => { series.addChartTrendline(); },
            addLabel: t('chart.pane.addTrendline'),
            items: () => series.getTrendlines().map((trendline, index) => leaf(trendline, 'item', t('chart.pane.row.trendline', { index: index + 1 }), { remove: () => { trendline.delete(); } })),
            isList: true
          });
        }
        return children;
      }
    };
  };

  const title = chart.getTitle();
  const legend = chart.getLegend();
  const dataTable = chart.getDataTable();
  const plotArea = chart.getPlotArea();

  /** Whether any series is drawn as a line, which is what can run across a blank. */
  const drawsLines = (): boolean => chart.getSeries().some(series => /^(line|xyscatter|radar)/.test(series.getChartType()));

  /**
   * How the chart reads its cells, whatever its series: what a blank plots as, whether `#N/A` is a
   * blank, and whether hidden rows and columns are plotted. Excel's Hidden and Empty Cell Settings.
   */
  const cellsNode = (): ChartPaneNode => ({
    id: 'data/cells',
    kind: 'always',
    label: t('chart.pane.row.hiddenAndEmpty'),
    name: t('chart.pane.row.hiddenAndEmpty'),
    element: null,
    fields: () => {
      const blanks = chart.getDisplayBlanksAs();
      // A line across a blank is offered where a line is drawn, and where the chart already says so.
      const options: IChart.DisplayBlanksAs[] = ['notPlotted', 'zero'];
      if (drawsLines() || blanks === 'interplotted') options.push('interplotted');
      return [
        {
          type: 'choice', key: 'emptyCells', label: t('chart.pane.emptyCells'),
          options,
          labels: {
            notPlotted: t('chart.pane.emptyCellsAs.gaps'),
            zero: t('chart.pane.emptyCellsAs.zero'),
            interplotted: t('chart.pane.emptyCellsAs.connect')
          },
          get: () => blanks,
          set: value => { chart.setDisplayBlanksAs(value as IChart.DisplayBlanksAs); }
        },
        flag('naAsEmpty', t('chart.pane.naAsEmpty'), () => chart.getDisplayNaAsBlank(), asBlank => { chart.setDisplayNaAsBlank(asBlank); }),
        flag('hiddenCells', t('chart.pane.hiddenCells'), () => !chart.getPlotVisibleOnly(), shown => { chart.setPlotVisibleOnly(!shown); })
      ];
    },
    children: () => []
  });

  const axes = chart.getAxes();
  return [
    {
      id: 'section/data',
      label: t('chart.pane.section.data'),
      items: () => [cellsNode()],
      isList: true
    },
    {
      id: 'section/series',
      label: t('chart.pane.section.series'),
      add: () => chart.addSeries().getPath(),
      addLabel: t('chart.pane.addSeries'),
      items: () => chart.getSeries().map(seriesNode),
      isList: true
    },
    {
      id: 'section/axes',
      label: t('chart.pane.section.axes'),
      empty: t('chart.pane.noAxes'),
      items: () => AXES.map(([type, group]) => axes.getChartAxis(type, group)).filter((axis): axis is IChart.IAxis => axis !== null).map(axisNode),
      isList: true
    },
    {
      id: 'section/elements',
      label: t('chart.pane.section.elements'),
      // The chart area is the chart itself, with nothing to say but how it looks: it is formatted from the head of the pane.
      items: () => [
        titleNode(title, t('chart.pane.row.title')),
        toggleLeaf(legend, elementLabel(t, legend)),
        toggleLeaf(dataTable, elementLabel(t, dataTable)),
        leaf(plotArea, 'always', elementLabel(t, plotArea))
      ],
      isList: true
    }
  ];
};

/** The chart types a whole chart can be given from the pane: the insert gallery's. */
const CHART_TYPES = Object.values(PresetChartType).map(presetChartTypeDescriptor);

/** A range's cells as a chart states them: pinned, and with their sheet (`Sheet1!$A$1:$C$5`). */
const pinned = (range: ICellRange, sheetOf: string | null): string => {
  const address = range.getFixed(true).getAddress(false);
  if (address.includes('!') || !sheetOf) return address;
  return `${sheetOf.slice(0, sheetOf.lastIndexOf('!') + 1)}${address}`;
};

/** The chart as a whole, at the head of its details: what it is called, the cells it is made of and how it is drawn. */
export interface ChartPaneSource {
  /** The chart's name and the block of cells its series are made of. */
  fields: FormatField[];
  /**
   * Which way the block is read, and reading it the other way. Disabled while the series do not
   * make one block: there is then no other way to read.
   */
  seriesBy: { get: () => 'rows' | 'columns', switchLabel: string, disabled: boolean, switch: () => void };
  /** The chart area: the chart itself, formatted from the head of the pane. */
  area: IChart.IElement;
  /** The type every series is drawn as; `combo` once they differ. */
  type: { get: () => string, label: string, set: (type: string) => void };
}

/**
 * The head of the chart's details: its name, and the presets that write every series at once. The
 * block of cells the series are made of, which way they read it, and the type they are all drawn
 * as. Each shows what the chart is now, told from its series, and says so when they no longer
 * agree; choosing one writes every series.
 *
 * @remarks
 * Which way the block is read is not a setting of the chart, of a series or of an axis: nothing
 * stores it. It is how the block was cut into series, told again from where the series' cells are,
 * so it is offered beside the block and only while there is one.
 */
export const buildChartSource = (chart: IChart, t: Translate): ChartPaneSource => {
  const range = chart.getDataRange();
  const type = chart.getChartType();
  const descriptor = CHART_TYPES.find(each => each.type === type);
  return {
    fields: [
      { type: 'text', key: 'name', label: t('chart.pane.chartName'), get: () => chart.getName?.() ?? '', set: name => { if (name.trim()) chart.setName?.(name.trim()); } },
      {
        type: 'formula', key: 'range', label: t('chart.pane.dataRange'),
        placeholder: range ? undefined : t('chart.pane.dataRangeBySeries'),
        get: () => range ? `=${pinned(range, chart.getSeries()[0]?.getValuesFormula() ?? null)}` : '',
        set: text => { chart.setData(bare(text)); }
      }
    ],
    seriesBy: {
      get: () => chart.getSeriesBy(),
      switchLabel: t('chart.pane.switchRowColumn'),
      disabled: !range,
      switch: () => { chart.setSeriesBy(chart.getSeriesBy() === 'rows' ? 'columns' : 'rows'); }
    },
    area: chart.getChartArea(),
    type: {
      get: () => type,
      label: type === 'combo' ? t('chart.pane.chartTypeCombo') : descriptor ? t(descriptor.description) : type,
      set: next => { if (next !== type) chart.setChartType(next); }
    }
  };
};

/**
 * Returns the ids of the rows that lead to `element`'s row, outermost first and its own last, or
 * `null` when no row is the element's. An element under several rows answers the first.
 */
export const findChartPaneRow = (lists: readonly ChartPaneList[], element: IChart.IElement): string[] | null => {
  const inList = (list: ChartPaneList, trail: string[]): string[] | null => {
    for (const node of list.items()) {
      const found = inNode(node, trail);
      if (found) return found;
    }
    return null;
  };
  const inNode = (node: ChartPaneNode, trail: string[]): string[] | null => {
    const here = [...trail, node.id];
    if (node.element === element) return here;
    for (const child of node.children()) {
      const found = isChartPaneList(child) ? inList(child, here) : inNode(child, here);
      if (found) return found;
    }
    return null;
  };
  for (const list of lists) {
    const found = inList(list, []);
    if (found) return found;
  }
  return null;
};
