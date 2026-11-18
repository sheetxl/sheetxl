import { type IChart, type IShapeStyle, type ITextBoxStyle } from '@sheetxl/sdk';

import { type FormatField, type FormatTarget, type FormatTargetTab } from '../../format';

import { elementLabel, type Translate } from '../pane/ChartPaneModel';

/** What a chart element's format is built with. */
export interface ChartElementFormatContext {
  chart: IChart;
  t: Translate;
}

/**
 * Answers the tabs the format editor shows for one chart element: the standard ones its kind has
 * (fill and line, text) and its own options.
 */
export type ChartElementFormat<E extends IChart.IElement = IChart.IElement> = (element: E, context: ChartElementFormatContext) => FormatTargetTab[];

/** The keys of the tabs the built-in chart formats use; a format that reuses one shares its place in the strip. */
export const ChartFormatTab = {
  FillLine: 'fillLine',
  Text: 'text',
  /** An axis's labels: where they sit, what they show and how they read, with their font. */
  Labels: 'labels',
  Marker: 'marker',
  Label: 'label',
  Options: 'options'
} as const;

const formats = new Map<string, ChartElementFormat<any>>();

/**
 * Registers the format of one type of chart element (`IChart.IElement.getElementType()`), replacing
 * the one registered before. Returns a function that puts the earlier one back.
 *
 * @remarks
 * A format answers for every element of the type; one whose tabs depend on how a series is drawn
 * reads the series' chart type from the element.
 */
export function registerChartElementFormat<E extends IChart.IElement = IChart.IElement>(elementType: string, format: ChartElementFormat<E>): () => void {
  const before = formats.get(elementType);
  formats.set(elementType, format);
  return () => {
    if (formats.get(elementType) !== format) return;
    if (before) formats.set(elementType, before); else formats.delete(elementType);
  };
}

/** What the format editor is shown for a chart: the target, the element it is of, and a tab to open on. */
export interface ChartFormatResolution {
  target: FormatTarget;
  element: IChart.IElement;
  /** The tab the selected element is, where it is a part of the target (a point's label, a series' marker). */
  tab?: string;
}

/**
 * Resolves what the format editor formats for `chart` with `active` selected in it.
 *
 * @remarks
 * Nothing selected is the chart area. A part with no format of its own formats what it is part of,
 * on its tab: a marker is its series' or its point's Marker, and a point's label is its point's
 * Label.
 */
export const resolveChartFormat = (chart: IChart, active: IChart.IElement | null, t: Translate): ChartFormatResolution => {
  let element: IChart.IElement = active ?? chart.getChartArea();
  let tab: string | undefined;
  const type = element.getElementType();
  const parent = element.getParent();
  if (type === 'marker' && parent) {
    element = parent;
    tab = ChartFormatTab.Marker;
  } else if (type === 'dataLabel' && parent?.getElementType() === 'point') {
    element = parent;
    tab = ChartFormatTab.Label;
  }
  const format = formats.get(element.getElementType());
  return {
    element,
    tab,
    target: {
      id: `${chart.getId()}:${element.getPath()}`,
      title: elementLabel(t, element),
      disabled: chart.isReadOnly(),
      tabs: format ? format(element, { chart, t }) : styleTabs(t, (element as any).getStyle?.())
    }
  };
};

const flag = (key: string, label: string, get: () => boolean, set: (value: boolean) => void, base?: Partial<FormatField.Base>): FormatField =>
  ({ type: 'flag', key, label, get, set, ...base });

/** A tab of `fields`, or none when there are none. */
const tabOf = (key: string, label: string, fields: () => FormatField[]): FormatTargetTab[] => fields().length > 0 ? [{ key, label, fields }] : [];

const fillLineFields = (t: Translate, style: IShapeStyle, options?: { lineOnly?: boolean, key?: string, heading?: string }): FormatField[] => {
  const key = options?.key ?? '';
  const out: FormatField[] = [];
  if (!options?.lineOnly) out.push({ type: 'fill', key: `${key}fill`, label: t('shape.pane.fill'), heading: options?.heading, style });
  out.push({ type: 'line', key: `${key}line`, label: t('shape.pane.line'), heading: options?.lineOnly ? options?.heading : undefined, style });
  return out;
};

/**
 * The standard tabs of what an element is drawn with: its fill and line, or its line alone, and its
 * text where it has any.
 */
const styleTabs = (t: Translate, style: IShapeStyle | undefined, options?: { lineOnly?: boolean, textOnly?: boolean }): FormatTargetTab[] => {
  if (!style) return [];
  const tabs: FormatTargetTab[] = [];
  if (!options?.textOnly) {
    tabs.push({
      key: ChartFormatTab.FillLine,
      label: options?.lineOnly ? t('format.tab.line') : t('format.tab.fillLine'),
      fields: () => fillLineFields(t, style, options)
    });
  }
  if ((style as ITextBoxStyle).isITextBoxStyle) {
    tabs.push({
      key: ChartFormatTab.Text,
      label: t('format.tab.text'),
      fields: () => [{ type: 'font', key: 'font', label: t('chart.pane.text'), font: (style as ITextBoxStyle).getFont() }]
    });
  }
  return tabs;
};

const optionsTab = (t: Translate, fields: () => FormatField[]): FormatTargetTab[] => tabOf(ChartFormatTab.Options, t('format.tab.options'), fields);

const sideLabels = (t: Translate): Record<string, string> => ({
  top: t('chart.pane.side.top'), bottom: t('chart.pane.side.bottom'), left: t('chart.pane.side.left'), right: t('chart.pane.side.right')
});

const LEGEND_POSITIONS: readonly IChart.LegendPosition[] = ['top', 'bottom', 'left', 'right', 'corner'];
const LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'insideEnd', 'insideBase', 'outsideEnd', 'left', 'right', 'top', 'bottom', 'bestFit'];
const TRENDLINE_TYPES: readonly IChart.TrendlineType[] = ['linear', 'exponential', 'logarithmic', 'polynomial', 'power', 'movingAverage'];
const ERROR_BAR_TYPES: readonly IChart.ErrorBarsType[] = ['fixedValue', 'percent', 'stDev', 'stError'];
const ERROR_BAR_INCLUDES: readonly IChart.ErrorBarsInclude[] = ['both', 'plusValues', 'minusValues'];
const MARKER_SYMBOLS: readonly IChart.MarkerSymbol[] = ['automatic', 'none', 'square', 'diamond', 'triangle', 'x', 'star', 'dot', 'dash', 'circle', 'plus'];

const TICK_MARKS: readonly IChart.AxisTickMark[] = ['none', 'inside', 'outside', 'cross'];
const TICK_LABEL_POSITIONS: readonly IChart.AxisTickLabelPosition[] = ['nextToAxis', 'high', 'low', 'none'];
const DISPLAY_UNITS: readonly IChart.AxisDisplayUnit[] = [
  'none', 'hundreds', 'thousands', 'tenThousands', 'hundredThousands', 'millions', 'tenMillions', 'hundredMillions', 'billions', 'trillions', 'custom'
];
const SCALE_TYPES: readonly IChart.AxisScaleType[] = ['linear', 'logarithmic'];
const TIME_UNITS: readonly IChart.AxisTimeUnit[] = ['days', 'months', 'years'];
const CATEGORY_TYPES: readonly IChart.AxisCategoryType[] = ['automatic', 'textAxis', 'dateAxis'];
const SEPARATORS: readonly string[] = [', ', '; ', '. ', '\n', ' '];

const BAR_LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'insideEnd', 'insideBase', 'outsideEnd'];
const STACKED_BAR_LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'insideEnd', 'insideBase'];
const POINT_LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'left', 'right', 'top', 'bottom'];
const PIE_LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'insideEnd', 'outsideEnd', 'bestFit'];

/**
 * The places a label may sit on a series of `type`, as the chart takes them: none on an area, a
 * doughnut, a radar, a surface or a 3-D bar, line or area; every one for a type not known here.
 */
const labelPositionsOf = (type: string): readonly IChart.DataLabelPosition[] => {
  if (/OfPie$/.test(type) || /^(pie|3DPie)/.test(type)) return PIE_LABEL_POSITIONS;
  if (/^(3D|area|doughnut|radar|surface)/.test(type)) return [];
  if (/^(column|bar)Stacked/.test(type)) return STACKED_BAR_LABEL_POSITIONS;
  if (/^(column|bar)/.test(type)) return BAR_LABEL_POSITIONS;
  if (/^(line|stock|xyscatter|bubble)/.test(type)) return POINT_LABEL_POSITIONS;
  return LABEL_POSITIONS;
};

/** How the series of a type are put together, with the type's name less that: `columnStacked100` is `column`, `percentStacked`. */
type Stacking = 'standard' | 'stacked' | 'percentStacked';
const STACKINGS: readonly Stacking[] = ['standard', 'stacked', 'percentStacked'];
const stackingOf = (type: string): { base: string, stacking: Stacking } | null => {
  const match = /^(column|bar|lineMarkers|line|area)(Clustered|Stacked100|Stacked)?$/.exec(type);
  if (!match) return null;
  return { base: match[1], stacking: match[2] === 'Stacked100' ? 'percentStacked' : match[2] === 'Stacked' ? 'stacked' : 'standard' };
};
const withStacking = (base: string, stacking: Stacking): string =>
  stacking === 'stacked' ? `${base}Stacked` : stacking === 'percentStacked' ? `${base}Stacked100` : /^(column|bar)$/.test(base) ? `${base}Clustered` : base;

/** Which way text is turned: left to the chart where it may be, at an angle, or its letters stacked; then the angle. */
const directionFields = (
  t: Translate, automatic: boolean,
  get: () => number | 'vertical' | 'auto', set: (orientation: number | 'vertical' | 'auto') => void
): FormatField[] => {
  const orientation = get();
  const fields: FormatField[] = [{
    type: 'choice', key: 'direction', label: t('chart.format.labels.direction'),
    options: automatic ? ['auto', 'angle', 'vertical'] : ['angle', 'vertical'],
    labels: {
      auto: t('chart.format.labels.direction.auto'), angle: t('chart.format.labels.direction.angle'),
      vertical: t('chart.format.labels.direction.vertical')
    },
    get: () => typeof orientation === 'number' ? 'angle' : orientation,
    set: (direction) => { set(direction === 'angle' ? 0 : direction as 'vertical' | 'auto'); }
  }];
  if (typeof orientation === 'number') {
    fields.push({ type: 'number', key: 'angle', label: t('chart.format.labels.angle'), min: -90, max: 90, get: () => orientation, set: (angle) => { if (angle !== null) set(angle); } });
  }
  return fields;
};

/** Whether a series of `type` is drawn as a line with a marker at each point, and so has no fill of its own. */
const isLineDrawn = (type: string): boolean => /^(line|xyscatter|radar)/.test(type) && type !== 'radarFilled';

/** A marker's symbol and size, then what it is drawn with: a series', or one point's over it. */
const markerFields = (t: Translate, marker: IChart.IMarker): FormatField[] => [
  {
    type: 'choice', key: 'symbol', label: t('chart.pane.marker.symbol'), options: MARKER_SYMBOLS,
    labels: {
      automatic: t('chart.pane.marker.automatic'), none: t('chart.pane.marker.none'), square: t('chart.pane.marker.square'),
      diamond: t('chart.pane.marker.diamond'), triangle: t('chart.pane.marker.triangle'), x: t('chart.pane.marker.x'),
      star: t('chart.pane.marker.star'), dot: t('chart.pane.marker.dot'), dash: t('chart.pane.marker.dash'),
      circle: t('chart.pane.marker.circle'), plus: t('chart.pane.marker.plus')
    },
    get: () => marker.getSymbol(), set: symbol => { marker.setSymbol(symbol as IChart.MarkerSymbol); }
  },
  { type: 'number', key: 'size', label: t('chart.pane.marker.size'), min: 2, max: 72, get: () => marker.getSize(), set: size => { if (size !== null) marker.setSize(size); } },
  ...fillLineFields(t, marker.getStyle(), { key: 'marker.' })
];

const markerTab = (t: Translate, marker: IChart.IMarker): FormatTargetTab =>
  ({ key: ChartFormatTab.Marker, label: t('chart.format.tab.marker'), fields: () => markerFields(t, marker) });

/**
 * What a label shows and where it sits: a series' labels, or one point's over them. `type` is how
 * the series is drawn, which says where a label may sit and what it may show.
 */
const labelContentFields = (t: Translate, labels: IChart.IDataLabels | IChart.IDataLabel, type: string): FormatField[] => {
  const all = (labels as IChart.IDataLabels).isIDataLabels ? labels as IChart.IDataLabels : null;
  const fields: FormatField[] = [
    flag('value', t('chart.pane.labels.value'), () => labels.getShowValue(), show => { labels.setShowValue(show); }),
    flag('category', t('chart.pane.labels.category'), () => labels.getShowCategoryName(), show => { labels.setShowCategoryName(show); }),
    flag('series', t('chart.pane.labels.series'), () => labels.getShowSeriesName(), show => { labels.setShowSeriesName(show); })
  ];
  // A share of the whole is a pie's or a doughnut's to show; the chart refuses it elsewhere.
  if (/^(pie|doughnut|3DPie|combo)/.test(type) || /OfPie$/.test(type) || labels.getShowPercentage()) {
    fields.push(flag('percentage', t('chart.pane.labels.percentage'), () => labels.getShowPercentage(), show => { labels.setShowPercentage(show); }));
  }
  if (all && /^bubble/.test(type)) {
    fields.push(flag('bubbleSize', t('chart.format.labels.bubbleSize'), () => all.getShowBubbleSize(), show => { all.setShowBubbleSize(show); }));
  }
  fields.push(flag('legendKey', t('chart.pane.labels.legendKey'), () => labels.getShowLegendKey(), show => { labels.setShowLegendKey(show); }));
  if (all) {
    fields.push({
      type: 'formula', key: 'fromCells', label: t('chart.format.labels.fromCells'),
      get: () => all.getValueFromCellsFormula() ?? '', set: text => { all.setValueFromCells(text.trim().replace(/^=/, '') || null); }
    });
    const separator = all.getSeparator();
    fields.push({
      type: 'choice', key: 'separator', label: t('chart.format.labels.separator'),
      options: SEPARATORS.includes(separator) ? SEPARATORS : [separator, ...SEPARATORS],
      labels: {
        ', ': t('chart.format.labels.separator.comma'), '; ': t('chart.format.labels.separator.semicolon'),
        '. ': t('chart.format.labels.separator.period'), '\n': t('chart.format.labels.separator.newLine'),
        ' ': t('chart.format.labels.separator.space')
      },
      get: () => separator, set: next => { all.setSeparator(next); }
    });
  }
  const position = labels.getPosition();
  const offered = labelPositionsOf(type);
  if (offered.length > 0) {
    fields.push({
      type: 'choice', key: 'position', label: t('chart.pane.position'), options: offered.includes(position) ? offered : [position, ...offered],
      labels: {
        ...sideLabels(t),
        center: t('chart.pane.labels.center'), insideEnd: t('chart.pane.labels.insideEnd'), insideBase: t('chart.pane.labels.insideBase'),
        outsideEnd: t('chart.pane.labels.outsideEnd'), bestFit: t('chart.pane.labels.bestFit')
      },
      get: () => position, set: next => { labels.setPosition(next as IChart.DataLabelPosition); }
    });
  }
  if (all) fields.push(...directionFields(t, false, () => all.getTextOrientation(), (orientation) => { if (orientation !== 'auto') all.setTextOrientation(orientation); }));
  // Emptied, the labels take the format of the values they show.
  fields.push({
    type: 'text', key: 'numberFormat', label: t('chart.pane.numberFormat'), heading: t('chart.format.labels.number'),
    get: () => labels.getNumberFormat() ?? '', set: format => { labels.setNumberFormat(format || null); }
  });
  if (all) fields.push(flag('linked', t('chart.format.labels.linked'), () => all.getLinkNumberFormat(), linked => { all.setLinkNumberFormat(linked); }));
  return fields;
};

/** An axis's scale and where it stands: the fields of its Options, by what the axis measures. What its labels show is with its labels. */
const axisOptionFields = (t: Translate, axis: IChart.IAxis): FormatField[] => {
  const kind = axis.getKind();
  const fields: FormatField[] = [];
  // A number left empty is the axis's to work out from what it plots.
  const auto = t('chart.format.auto');
  const timeUnits = { days: t('chart.format.axis.timeUnit.days'), months: t('chart.format.axis.timeUnit.months'), years: t('chart.format.axis.timeUnit.years') };
  if (kind === 'category' || kind === 'date') {
    fields.push({
      type: 'choice', key: 'categoryType', label: t('chart.format.axis.type'), options: CATEGORY_TYPES,
      labels: {
        automatic: t('chart.format.axis.type.automatic'), textAxis: t('chart.format.axis.type.textAxis'),
        dateAxis: t('chart.format.axis.type.dateAxis')
      },
      get: () => axis.getCategoryType(), set: type => { axis.setCategoryType(type as IChart.AxisCategoryType); }
    });
  }
  if (kind === 'value') {
    fields.push(
      { type: 'number', key: 'minimum', label: t('chart.pane.minimum'), heading: t('chart.format.axis.bounds'), row: 'bounds', min: -1e15, max: 1e15, decimals: true, auto, get: () => axis.isMinimumAuto() ? null : axis.getMinimum(), set: value => { axis.setMinimum(value ?? 'auto'); } },
      { type: 'number', key: 'maximum', label: t('chart.pane.maximum'), row: 'bounds', min: -1e15, max: 1e15, decimals: true, auto, get: () => axis.isMaximumAuto() ? null : axis.getMaximum(), set: value => { axis.setMaximum(value ?? 'auto'); } },
      { type: 'number', key: 'majorUnit', label: t('chart.format.axis.major'), heading: t('chart.format.axis.units'), row: 'units', min: 0, max: 1e15, decimals: true, auto, get: () => axis.isMajorUnitAuto() ? null : axis.getMajorUnit(), set: value => { axis.setMajorUnit(value ?? 'auto'); } },
      { type: 'number', key: 'minorUnit', label: t('chart.format.axis.minor'), row: 'units', min: 0, max: 1e15, decimals: true, auto, get: () => axis.isMinorUnitAuto() ? null : axis.getMinorUnit(), set: value => { axis.setMinorUnit(value ?? 'auto'); } }
    );
  }
  if (kind === 'date') {
    // A date axis counts its units in days, months or years: the count and what is counted are set together.
    fields.push(
      { type: 'number', key: 'majorUnit', label: t('chart.format.axis.major'), heading: t('chart.format.axis.units'), row: 'major', min: 1, max: 1e6, auto, get: () => axis.isMajorUnitAuto() ? null : axis.getMajorUnit(), set: value => { axis.setMajorUnit(value ?? 'auto'); } },
      { type: 'choice', key: 'majorTimeUnit', label: t('chart.format.axis.majorIn'), row: 'major', options: TIME_UNITS, labels: timeUnits, get: () => axis.getMajorTimeUnitScale() ?? 'days', set: unit => { axis.setMajorTimeUnitScale(unit as IChart.AxisTimeUnit); } },
      { type: 'number', key: 'minorUnit', label: t('chart.format.axis.minor'), row: 'minor', min: 1, max: 1e6, auto, get: () => axis.isMinorUnitAuto() ? null : axis.getMinorUnit(), set: value => { axis.setMinorUnit(value ?? 'auto'); } },
      { type: 'choice', key: 'minorTimeUnit', label: t('chart.format.axis.minorIn'), row: 'minor', options: TIME_UNITS, labels: timeUnits, get: () => axis.getMinorTimeUnitScale() ?? 'days', set: unit => { axis.setMinorTimeUnitScale(unit as IChart.AxisTimeUnit); } },
      { type: 'choice', key: 'baseTimeUnit', label: t('chart.format.axis.base'), options: TIME_UNITS, labels: timeUnits, get: () => axis.getBaseTimeUnit() ?? 'days', set: unit => { axis.setBaseTimeUnit(unit as IChart.AxisTimeUnit); } }
    );
  }
  if (kind !== 'series') {
    // Where the axis that crosses this one stands along it. A date axis's own value is a date, which this has no field for.
    const crosses = axis.getCrosses();
    const offered: readonly IChart.AxisCrosses[] = kind === 'date' ? ['automatic', 'maximum'] : ['automatic', 'maximum', 'minimum', 'custom'];
    fields.push({
      type: 'choice', key: 'crosses', label: t('chart.format.axis.crosses'), options: offered.includes(crosses) ? offered : [crosses, ...offered],
      labels: {
        automatic: t('chart.format.axis.crosses.automatic'), maximum: t('chart.format.axis.crosses.maximum'),
        minimum: t('chart.format.axis.crosses.minimum'), custom: t('chart.format.axis.crosses.custom')
      },
      get: () => crosses, set: next => { axis.setCrosses(next as IChart.AxisCrosses); }
    });
    if (crosses === 'custom' && kind === 'value') {
      fields.push({ type: 'number', key: 'crossesAt', label: t('chart.format.axis.crossesAt'), min: -1e15, max: 1e15, decimals: true, get: () => axis.getCrossesAt() ?? 0, set: value => { if (value !== null) axis.setCrossesAt(value); } });
    } else if (crosses === 'custom' && kind === 'category') {
      fields.push({ type: 'number', key: 'crossesAt', label: t('chart.format.axis.crossesAtCategory'), min: 1, max: 1e6, get: () => axis.getCrossesAt() ?? 1, set: value => { if (value !== null) axis.setCrossesAt(value); } });
    }
  }
  if (kind === 'category' || kind === 'date') {
    fields.push({
      type: 'choice', key: 'between', label: t('chart.format.axis.position'), options: ['onTicks', 'between'],
      labels: { onTicks: t('chart.format.axis.position.onTicks'), between: t('chart.format.axis.position.between') },
      get: () => axis.getIsBetweenCategories() ? 'between' : 'onTicks', set: position => { axis.setIsBetweenCategories(position === 'between'); }
    });
  }
  if (kind === 'value') {
    const scale = axis.getScaleType();
    fields.push({
      type: 'choice', key: 'scaleType', label: t('chart.format.axis.scale'), options: SCALE_TYPES,
      labels: { linear: t('chart.format.axis.scale.linear'), logarithmic: t('chart.format.axis.scale.logarithmic') },
      get: () => scale, set: next => { axis.setScaleType(next as IChart.AxisScaleType); }
    });
    if (scale === 'logarithmic') {
      fields.push({ type: 'number', key: 'logBase', label: t('chart.format.axis.logBase'), min: 2, max: 1000, decimals: true, get: () => axis.getLogBase(), set: base => { if (base !== null) axis.setLogBase(base); } });
    }
  }
  fields.push(flag('reverse', t('chart.pane.reverse'), () => axis.getReversePlotOrder(), reverse => { axis.setReversePlotOrder(reverse); }));
  const tickLabels = {
    none: t('chart.format.axis.tick.none'), inside: t('chart.format.axis.tick.inside'),
    outside: t('chart.format.axis.tick.outside'), cross: t('chart.format.axis.tick.cross')
  };
  fields.push(
    { type: 'choice', key: 'majorTickMark', label: t('chart.format.axis.majorTick'), heading: t('chart.format.axis.tickMarks'), row: 'ticks', options: TICK_MARKS, labels: tickLabels, get: () => axis.getMajorTickMark(), set: mark => { axis.setMajorTickMark(mark as IChart.AxisTickMark); } },
    { type: 'choice', key: 'minorTickMark', label: t('chart.format.axis.minorTick'), row: 'ticks', options: TICK_MARKS, labels: tickLabels, get: () => axis.getMinorTickMark(), set: mark => { axis.setMinorTickMark(mark as IChart.AxisTickMark); } }
  );
  if (kind === 'category') {
    fields.push({ type: 'number', key: 'tickMarkSpacing', label: t('chart.format.axis.tickMarkSpacing'), min: 1, max: 1e6, auto, get: () => axis.getTickMarkSpacing(), set: spacing => { axis.setTickMarkSpacing(spacing); } });
  }
  return fields;
};

/**
 * An axis's labels: where they sit, what they show (every level of a category, numbers in a unit
 * and a format) and which way they read, then their font.
 */
const axisLabelFields = (t: Translate, axis: IChart.IAxis): FormatField[] => {
  const kind = axis.getKind();
  const fields: FormatField[] = [{
    type: 'choice', key: 'tickLabelPosition', label: t('chart.format.labels.position'), options: TICK_LABEL_POSITIONS,
    labels: {
      nextToAxis: t('chart.format.labels.position.nextToAxis'), high: t('chart.format.labels.position.high'),
      low: t('chart.format.labels.position.low'), none: t('chart.format.labels.position.none')
    },
    get: () => axis.getTickLabelPosition(), set: position => { axis.setTickLabelPosition(position as IChart.AxisTickLabelPosition); }
  }];
  if (kind === 'category' || kind === 'date') {
    fields.push({ type: 'number', key: 'offset', label: t('chart.format.labels.offset'), min: 0, max: 1000, get: () => axis.getOffset() ?? 100, set: offset => { if (offset !== null) axis.setOffset(offset); } });
  }
  if (kind === 'category') {
    fields.push({ type: 'number', key: 'tickLabelSpacing', label: t('chart.format.labels.interval'), min: 1, max: 1e6, auto: t('chart.format.auto'), get: () => axis.getTickLabelSpacing(), set: spacing => { axis.setTickLabelSpacing(spacing); } });
  }
  if (kind === 'category') {
    fields.push(flag('multiLevel', t('chart.format.axis.multiLevel'), () => axis.getMultiLevel(), multiLevel => { axis.setMultiLevel(multiLevel); }));
  }
  fields.push(...directionFields(t, true, () => axis.getTextOrientation(), (orientation) => { axis.setTextOrientation(orientation); }));
  if (kind !== 'series') {
    // Emptied, the labels take the format of the cells the chart plots.
    fields.push(
      {
        type: 'text', key: 'numberFormat', label: t('chart.pane.numberFormat'), heading: t('chart.format.labels.number'),
        get: () => axis.getNumberFormat() ?? '',
        set: format => { if (format) axis.setNumberFormat(format); else axis.setLinkNumberFormat(true); }
      },
      flag('linked', t('chart.format.labels.linked'), () => axis.getLinkNumberFormat(), linked => { axis.setLinkNumberFormat(linked); })
    );
  }
  if (kind === 'value') {
    const unit = axis.getDisplayUnit();
    fields.push({
      type: 'choice', key: 'displayUnit', label: t('chart.format.axis.displayUnits'), options: DISPLAY_UNITS,
      labels: {
        none: t('chart.format.axis.displayUnit.none'), hundreds: t('chart.format.axis.displayUnit.hundreds'),
        thousands: t('chart.format.axis.displayUnit.thousands'), tenThousands: t('chart.format.axis.displayUnit.tenThousands'),
        hundredThousands: t('chart.format.axis.displayUnit.hundredThousands'), millions: t('chart.format.axis.displayUnit.millions'),
        tenMillions: t('chart.format.axis.displayUnit.tenMillions'), hundredMillions: t('chart.format.axis.displayUnit.hundredMillions'),
        billions: t('chart.format.axis.displayUnit.billions'), trillions: t('chart.format.axis.displayUnit.trillions'),
        custom: t('chart.format.axis.displayUnit.custom')
      },
      get: () => unit, set: next => { axis.setDisplayUnit(next as IChart.AxisDisplayUnit); }
    });
    if (unit === 'custom') {
      fields.push({ type: 'number', key: 'customDisplayUnit', label: t('chart.format.axis.customDisplayUnit'), min: 1, max: 1e15, decimals: true, get: () => axis.getCustomDisplayUnit(), set: value => { if (value !== null) axis.setCustomDisplayUnit(value); } });
    }
    if (unit !== 'none') {
      fields.push(flag('showDisplayUnitLabel', t('chart.format.axis.showDisplayUnitLabel'), () => axis.getShowDisplayUnitLabel(), show => { axis.setShowDisplayUnitLabel(show); }));
    }
  }
  fields.push({ type: 'font', key: 'font', label: t('chart.pane.text'), font: axis.getStyle().getFont() });
  return fields;
};

const linesFormat: ChartElementFormat<IChart.ILines> = (lines, { t }) => styleTabs(t, lines.getStyle(), { lineOnly: true });

const titleFormat: ChartElementFormat<IChart.ITitle> = (title, { t }) => [
  ...styleTabs(t, title.getStyle?.()),
  ...optionsTab(t, () => [flag('overlay', t('chart.pane.overlay'), () => title.getOverlay(), overlay => { title.setOverlay(overlay); })])
];

/** Who else a series' group settings belong to, named, or `undefined` when it is alone. */
const sharedWith = (chart: IChart, series: IChart.ISeries, t: Translate): string | undefined => {
  const all = chart.getSeries();
  const name = (each: IChart.ISeries): string => each.getName() ?? t('chart.pane.seriesDefault', { index: all.indexOf(each) + 1 });
  const group = chart.getGroups().find(candidate => candidate.getSeries().includes(series));
  const others = (group?.getSeries() ?? []).filter(other => other !== series).map(name);
  return others.length > 0 ? t('chart.pane.sharedWith', { names: others.join(', ') }) : undefined;
};

let registered = false;

/**
 * Registers the formats of the chart elements this package knows, once. A host's own
 * {@link registerChartElementFormat} for a type, made before or after, is not replaced by a second call.
 */
export function registerChartElementFormats(): void {
  if (registered) return;
  registered = true;
  const add = <E extends IChart.IElement>(type: string, format: ChartElementFormat<E>): void => {
    if (!formats.has(type)) formats.set(type, format);
  };

  add<IChart.IChartArea>('chartArea', (area, { t }) => [
    ...styleTabs(t, area.getStyle()),
    ...optionsTab(t, () => [flag('roundedCorners', t('chart.pane.roundedCorners'), () => area.getRoundedCorners(), rounded => { area.setRoundedCorners(rounded); })])
  ]);

  add<IChart.IPlotArea>('plotArea', (area, { t }) => styleTabs(t, area.getStyle()));

  add<IChart.ITitle>('title', titleFormat);
  add<IChart.ITitle>('axisTitle', titleFormat);

  add<IChart.ILegend>('legend', (legend, { t }) => [
    ...styleTabs(t, legend.getStyle?.()),
    ...optionsTab(t, () => [
      {
        type: 'choice', key: 'position', label: t('chart.pane.position'), options: LEGEND_POSITIONS,
        labels: { ...sideLabels(t), corner: t('chart.pane.side.corner') },
        get: () => legend.getPosition(), set: position => { legend.setPosition(position as IChart.LegendPosition); }
      },
      flag('overlay', t('chart.pane.overlay'), () => legend.getOverlay(), overlay => { legend.setOverlay(overlay); })
    ])
  ]);

  // An entry has text of its own and nothing else: its key is its series'.
  add<IChart.ILegendEntry>('legendEntry', (entry, { t }) => styleTabs(t, entry.getStyle(), { textOnly: true }));

  add<IChart.IDataTable>('dataTable', (table, { t }) => [
    ...styleTabs(t, table.getStyle?.()),
    ...optionsTab(t, () => [
      flag('legendKey', t('chart.pane.labels.legendKey'), () => table.getShowLegendKey(), show => { table.setShowLegendKey(show); }),
      flag('horizontal', t('chart.pane.table.horizontal'), () => table.getShowHorizontalBorder(), show => { table.setShowHorizontalBorder(show); }),
      flag('vertical', t('chart.pane.table.vertical'), () => table.getShowVerticalBorder(), show => { table.setShowVerticalBorder(show); }),
      flag('outline', t('chart.pane.table.outline'), () => table.getShowOutlineBorder(), show => { table.setShowOutlineBorder(show); })
    ])
  ]);

  // An axis's labels are a part of it with a tab of their own, as a series' marker is: all of its text is theirs.
  add<IChart.IAxis>('axis', (axis, { t }) => [
    ...styleTabs(t, axis.getStyle?.()).filter(tab => tab.key !== ChartFormatTab.Text),
    { key: ChartFormatTab.Labels, label: t('chart.format.tab.labels'), fields: () => axisLabelFields(t, axis) },
    ...optionsTab(t, () => axisOptionFields(t, axis))
  ]);

  add<IChart.IGridlines>('gridlines', (gridlines, { t }) => styleTabs(t, gridlines.getStyle?.(), { lineOnly: true }));

  add<IChart.ISeries>('series', (series, { chart, t }) => {
    const type = series.getChartType();
    const tabs = styleTabs(t, series.getStyle(), { lineOnly: isLineDrawn(type) });
    if (isLineDrawn(type)) tabs.push(markerTab(t, series.getMarker()));
    tabs.push(...optionsTab(t, () => {
      const shared = sharedWith(chart, series, t);
      const fields: FormatField[] = [];
      // How a type's series are put together is every series' at once, and offered while they are all drawn one way.
      const stacking = chart.getChartType() === type ? stackingOf(type) : null;
      if (stacking) {
        const clustered = /^(column|bar)$/.test(stacking.base);
        fields.push({
          type: 'choice', key: 'stacking', label: t('chart.format.series.stacking'), shared, options: STACKINGS,
          labels: {
            standard: clustered ? t('chart.format.series.stacking.clustered') : t('chart.format.series.stacking.standard'),
            stacked: t('chart.format.series.stacking.stacked'), percentStacked: t('chart.format.series.stacking.percentStacked')
          },
          get: () => stacking.stacking, set: next => { chart.setChartType(withStacking(stacking.base, next as Stacking)); }
        });
      }
      if (series.getOverlap() !== null) {
        fields.push({ type: 'number', key: 'overlap', label: t('chart.pane.overlap'), row: 'gap', shared, min: -100, max: 100, get: () => series.getOverlap() ?? 0, set: value => { if (value !== null) series.setOverlap(value); } });
      }
      if (series.getGapWidth() !== null) {
        fields.push({ type: 'number', key: 'gapWidth', label: t('chart.pane.gapWidth'), row: 'gap', shared, min: 0, max: 500, get: () => series.getGapWidth() ?? 0, set: value => { if (value !== null) series.setGapWidth(value); } });
      }
      if (/^(line|xyscatter)/.test(type)) fields.push(flag('smooth', t('chart.pane.smooth'), () => series.getSmooth(), smooth => { series.setSmooth(smooth); }));
      return fields;
    }));
    return tabs;
  });

  // What a point may state is its series' type's to say: a waterfall's states one thing, that it is a total.
  add<IChart.IPoint>('point', (point, { t }) => {
    const series = point.getParent() as IChart.ISeries;
    const type = series.getChartType();
    if (/^waterfall/.test(type)) {
      return optionsTab(t, () => [flag('isTotal', t('chart.pane.isTotal'), () => point.getIsTotal(), total => { point.setIsTotal(total); })]);
    }
    const tabs = styleTabs(t, point.getStyle(), { lineOnly: isLineDrawn(type) });
    if (isLineDrawn(type)) tabs.push(markerTab(t, point.getMarker()));
    const label = point.getDataLabel();
    tabs.push({
      key: ChartFormatTab.Label,
      label: t('chart.format.tab.label'),
      fields: () => [
        flag('hasLabel', t('chart.format.showLabel'), () => point.getHasDataLabel(), shown => { point.setHasDataLabel(shown); }),
        { type: 'text', key: 'text', label: t('chart.pane.titleText'), get: () => label.getText() ?? '', set: text => { label.setText(text || null); } },
        ...labelContentFields(t, label, type),
        ...(((label.getStyle?.() as ITextBoxStyle | undefined)?.isITextBoxStyle)
          ? [{ type: 'font', key: 'label.font', label: t('chart.pane.text'), font: (label.getStyle() as ITextBoxStyle).getFont() } satisfies FormatField]
          : []),
        ...(label.getStyle?.() ? fillLineFields(t, label.getStyle(), { key: 'label.' }) : [])
      ]
    });
    tabs.push(...optionsTab(t, () => {
      const fields: FormatField[] = [];
      if (/^(pie|doughnut|3DPie)/.test(type) || /OfPie$/.test(type)) {
        fields.push({ type: 'number', key: 'explosion', label: t('chart.pane.explosion'), min: 0, max: 400, get: () => point.getExplosion(), set: explosion => { if (explosion !== null) point.setExplosion(explosion); } });
      }
      if (/^(column|bar|bubble)/.test(type)) {
        fields.push(flag('invertIfNegative', t('chart.pane.invertIfNegative'), () => point.getInvertIfNegative(), invert => { point.setInvertIfNegative(invert); }));
      }
      return fields;
    }));
    return tabs;
  });

  // A series' labels, and the chart's (every series' at once).
  add<IChart.IDataLabels>('dataLabels', (labels, { chart, t }) => {
    const parent = labels.getParent();
    const type = parent?.getElementType() === 'series' ? (parent as IChart.ISeries).getChartType() : chart.getChartType();
    return [
      ...styleTabs(t, labels.getStyle?.()),
      ...optionsTab(t, () => labelContentFields(t, labels, type))
    ];
  });

  add<IChart.ITrendline>('trendline', (trendline, { t }) => [
    ...styleTabs(t, trendline.getStyle?.(), { lineOnly: true }),
    ...optionsTab(t, () => [
      {
        type: 'choice', key: 'type', label: t('chart.pane.trendline.type'), options: TRENDLINE_TYPES,
        labels: {
          linear: t('chart.pane.trendline.linear'), exponential: t('chart.pane.trendline.exponential'), logarithmic: t('chart.pane.trendline.logarithmic'),
          polynomial: t('chart.pane.trendline.polynomial'), power: t('chart.pane.trendline.power'), movingAverage: t('chart.pane.trendline.movingAverage')
        },
        get: () => trendline.getType(), set: type => { trendline.setType(type as IChart.TrendlineType); }
      },
      flag('equation', t('chart.pane.trendline.equation'), () => trendline.getShowEquation(), show => { trendline.setShowEquation(show); }),
      flag('rSquared', t('chart.pane.trendline.rSquared'), () => trendline.getShowRSquared(), show => { trendline.setShowRSquared(show); }),
      { type: 'number', key: 'forward', label: t('chart.pane.trendline.forward'), row: 'periods', min: 0, max: 1e6, decimals: true, get: () => trendline.getForwardPeriod(), set: value => { if (value !== null) trendline.setForwardPeriod(value); } },
      { type: 'number', key: 'backward', label: t('chart.pane.trendline.backward'), row: 'periods', min: 0, max: 1e6, decimals: true, get: () => trendline.getBackwardPeriod(), set: value => { if (value !== null) trendline.setBackwardPeriod(value); } }
    ])
  ]);

  add<IChart.ITrendlineLabel>('trendlineLabel', (label, { t }) => styleTabs(t, label.getStyle?.()));

  add<IChart.IErrorBars>('errorBars', (bars, { t }) => [
    ...styleTabs(t, bars.getStyle?.(), { lineOnly: true }),
    ...optionsTab(t, () => {
      const fields: FormatField[] = [{
        type: 'choice', key: 'type', label: t('chart.pane.errorBars.type'), options: ERROR_BAR_TYPES,
        labels: { fixedValue: t('chart.pane.errorBars.fixedValue'), percent: t('chart.pane.errorBars.percent'), stDev: t('chart.pane.errorBars.stDev'), stError: t('chart.pane.errorBars.stError') },
        get: () => bars.getType() === 'custom' ? 'fixedValue' : bars.getType(), set: type => { bars.setType(type as IChart.ErrorBarsType); }
      }];
      if (bars.getAmount() !== null) {
        fields.push({ type: 'number', key: 'amount', label: t('chart.pane.errorBars.amount'), min: 0, max: 1e15, decimals: true, get: () => bars.getAmount() ?? 0, set: value => { if (value !== null) bars.setAmount(value); } });
      }
      fields.push(
        {
          type: 'choice', key: 'include', label: t('chart.pane.errorBars.direction'), options: ERROR_BAR_INCLUDES,
          labels: { both: t('chart.pane.errorBars.both'), plusValues: t('chart.pane.errorBars.plus'), minusValues: t('chart.pane.errorBars.minus') },
          get: () => bars.getInclude(), set: include => { bars.setInclude(include as IChart.ErrorBarsInclude); }
        },
        flag('cap', t('chart.pane.errorBars.cap'), () => bars.getEndStyleCap(), cap => { bars.setEndStyleCap(cap); })
      );
      return fields;
    })
  ]);

  // The bars that rose and the bars that fell are drawn each their own way.
  add<IChart.IUpDownBars>('upDownBars', (bars, { t }) => [
    { key: 'upBars', label: t('chart.pane.upBars'), fields: () => fillLineFields(t, bars.getUpBarsStyle(), { key: 'up.' }) },
    { key: 'downBars', label: t('chart.pane.downBars'), fields: () => fillLineFields(t, bars.getDownBarsStyle(), { key: 'down.' }) }
  ]);

  add<IChart.ILines>('hiLoLines', linesFormat);
  add<IChart.ILines>('dropLines', linesFormat);
  add<IChart.ILines>('seriesLines', linesFormat);
}
