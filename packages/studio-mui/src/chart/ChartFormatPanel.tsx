import type React from 'react';
import { memo, useEffect, useReducer, useState } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControl } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';

import {
  IFill, type ICell, type IChart, type IColor, type IShapeStyle, type IStroke, type IStyleCollection, type IFont,
  type IFontStyle, type ITextBoxStyle, type IWorksheet
} from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { type MovablePaneProps, useGridColorScheme } from '@sheetxl/react';

import { ColorPopupButton } from '../color';
import {
  FillPanel, type FillSelection, LinePanel, type LineSelection, FormatNumberField, FormatRow, FormatSection, panelSx
} from '../format';

type Translate = ReturnType<typeof useTranslator>;

/** A heading over one of the pane's parts. */
const PartTitle = (props: { children: React.ReactNode }): React.ReactElement => (
  <Typography variant="subtitle2" component="div">{props.children}</Typography>
);

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
    case 'series': return t('chart.pane.element.series', { name: (element as IChart.ISeries).getName() ?? '' });
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

/** The color the style's line takes with its own color handed back: what the element draws with by default. */
const autoLineColor = (style: IShapeStyle, styles: IStyleCollection): IColor => {
  const fill = style.getStroke().getFill();
  if (fill.getType() === IFill.Type.Solid) return (fill as IFill.ISolid).getColor();
  return styles.getNormal().getFont().getColor();
};

/**
 * Excel's Fill & Line for one chart style: the format pane's own controls, bound to the element.
 *
 * @remarks
 * The sections here are not memoized: an element and its styles are the same objects across edits,
 * so a section is redrawn with the pane, which redraws on every change to the chart.
 */
const StyleSection = (props: { style: IShapeStyle, sheet: IWorksheet, disabled: boolean, label?: string }): React.ReactElement => {
  const { style, sheet, disabled, label } = props;
  const t = useTranslator();
  const styles = sheet.getStyles();
  const darkMode = useGridColorScheme() === 'dark';
  const fill: FillSelection = {
    fill: style.getFill(),
    styles,
    schemeLookup: styles.schemeLookup(),
    darkMode,
    disabled,
    createCell: (update: ICell.Update): ICell | null => sheet.createCell(update),
    applyFill: (update: IFill.Update, description?: string): void => { style.setFill(update, { description }); },
  };
  const line: LineSelection = {
    stroke: style.getStroke(),
    stated: style.toJSON()?.stroke ?? null,
    autoColor: autoLineColor(style, styles),
    styles,
    schemeLookup: styles.schemeLookup(),
    darkMode,
    disabled,
    applyStroke: (update: IStroke.Modifiers | null, description?: string): void => { style.setStroke(update, { description }); },
  };
  return (
    <>
      {label ? <PartTitle>{label}</PartTitle> : null}
      <PartTitle>{t('shape.pane.fill')}</PartTitle>
      <FillPanel selection={fill}/>
      <PartTitle>{t('shape.pane.line')}</PartTitle>
      <LinePanel selection={line}/>
    </>
  );
};

/** A dropdown of `options`, each by its label. */
const Choice = <T extends string,>(props: {
  label: string, value: T, options: readonly T[], labels: Readonly<Record<string, string>>, disabled: boolean, onChange: (value: T) => void
}): React.ReactElement => (
  <FormControl size="small" fullWidth disabled={props.disabled}>
    <InputLabel>{props.label}</InputLabel>
    <Select label={props.label} value={props.value} onChange={event => props.onChange(event.target.value as T)}>
      {props.options.map(option => <MenuItem key={option} value={option}>{props.labels[option] ?? option}</MenuItem>)}
    </Select>
  </FormControl>
);

const Flag = (props: { label: string, checked: boolean, disabled: boolean, onChange: (checked: boolean) => void }): React.ReactElement => (
  <FormControlLabel
    label={props.label}
    disabled={props.disabled}
    control={<Checkbox size="small" checked={props.checked} onChange={event => props.onChange(event.target.checked)}/>}
  />
);

/** A text that writes when it is committed: on Enter, or when it loses focus. */
const CommitText = (props: { label: string, value: string, disabled: boolean, onCommit: (value: string) => void }): React.ReactElement => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft !== null && draft !== props.value) props.onCommit(draft);
    setDraft(null);
  };
  return (
    <TextField
      size="small"
      fullWidth
      label={props.label}
      disabled={props.disabled}
      value={draft ?? props.value}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
    />
  );
};

const UNDERLINES: readonly IFont.UnderlineStyle[] = ['none', 'single', 'double'];
const STRIKES: readonly IFont.StrikeStyle[] = ['none', 'single', 'double'];

/** An element's font: Excel's Font for chart text. */
const FontSection = (props: { font: IFontStyle, styles: IStyleCollection, disabled: boolean, run: (apply: () => void) => void }): React.ReactElement => {
  const { font, styles, disabled, run } = props;
  const t = useTranslator();
  const darkMode = useGridColorScheme() === 'dark';
  const recentColors = useCallbackRef(() => styles.recentColors(), [styles]);
  const color: IColor = font.getColor();
  const lines = { none: t('chart.pane.text.lineNone'), single: t('chart.pane.text.lineSingle'), double: t('chart.pane.text.lineDouble') };
  return (
    <>
      <PartTitle>{t('chart.pane.text')}</PartTitle>
      <FormatSection>
        <CommitText label={t('format.fontFamily')} value={font.getFamily()} disabled={disabled} onCommit={family => run(() => font.setFamily(family || null))}/>
      </FormatSection>
      <FormatSection>
        <FormatRow>
          <FormatNumberField
            label={t('format.fontSize')} value={font.getSize()} min={1} max={400} step={1} decimals width={96} disabled={disabled}
            onChange={size => run(() => font.setSize(size))}
          />
          <ColorPopupButton
            icon="text.colored"
            disabled={disabled}
            darkMode={darkMode}
            compareRGB={true}
            selectedColor={color}
            onSelectColor={(next: IColor | null, isCustom?: boolean) => {
              if (next && isCustom) styles.addRecentColor(next);
              run(() => font.setColor(next ? next.toString() : null));
            }}
            propsPanel={{ disableAlpha: true, schemeLookup: styles.schemeLookup(), recentColors }}
          />
        </FormatRow>
      </FormatSection>
      <FormatSection>
        <FormatRow>
          <Flag label={t('chart.pane.text.bold')} checked={font.getBold()} disabled={disabled} onChange={bold => run(() => font.setBold(bold))}/>
          <Flag label={t('chart.pane.text.italic')} checked={font.getItalic()} disabled={disabled} onChange={italic => run(() => font.setItalic(italic))}/>
        </FormatRow>
      </FormatSection>
      <FormatSection>
        <FormatRow>
          <Choice label={t('chart.pane.text.underline')} value={UNDERLINES.includes(font.getUnderline()) ? font.getUnderline() : 'single'}
            options={UNDERLINES} labels={lines} disabled={disabled} onChange={underline => run(() => font.setUnderline(underline))}/>
          <Choice label={t('chart.pane.text.strike')} value={font.getStrike()} options={STRIKES} labels={lines} disabled={disabled}
            onChange={strike => run(() => font.setStrike(strike))}/>
        </FormatRow>
      </FormatSection>
    </>
  );
};

const LEGEND_POSITIONS: readonly IChart.LegendPosition[] = ['top', 'bottom', 'left', 'right', 'corner'];
const LABEL_POSITIONS: readonly IChart.DataLabelPosition[] = ['center', 'insideEnd', 'insideBase', 'outsideEnd', 'left', 'right', 'top', 'bottom', 'bestFit'];
const TRENDLINE_TYPES: readonly IChart.TrendlineType[] = ['linear', 'exponential', 'logarithmic', 'polynomial', 'power', 'movingAverage'];
const ERROR_BAR_TYPES: readonly IChart.ErrorBarsType[] = ['fixedValue', 'percent', 'stDev', 'stError'];
const ERROR_BAR_INCLUDES: readonly IChart.ErrorBarsInclude[] = ['both', 'plusValues', 'minusValues'];

/** What an element sets of its own, beyond its fill, line and text: Excel's Options for it. */
const OptionsSection = (props: { element: IChart.IElement, disabled: boolean, run: (apply: () => void) => void }): React.ReactElement | null => {
  const { element, disabled, run } = props;
  const t = useTranslator();
  const flag = (label: string, checked: boolean, set: (checked: boolean) => void): React.ReactElement => (
    <Flag label={label} checked={checked} disabled={disabled} onChange={checked => run(() => set(checked))}/>
  );
  const rows: React.ReactNode[] = [];
  const as = <T,>(): T => element as unknown as T;
  switch (element.getElementType()) {
    case 'chartArea': {
      const area = as<IChart.IChartArea>();
      rows.push(flag(t('chart.pane.roundedCorners'), area.getRoundedCorners(), rounded => area.setRoundedCorners(rounded)));
      break;
    }
    case 'title':
    case 'axisTitle': {
      const title = as<IChart.ITitle>();
      rows.push(flag(t('chart.pane.visible'), title.getVisible(), visible => title.setVisible(visible)));
      rows.push(<CommitText key="text" label={t('chart.pane.titleText')} value={title.getText() ?? ''} disabled={disabled} onCommit={text => run(() => title.setText(text || null))}/>);
      rows.push(flag(t('chart.pane.overlay'), title.getOverlay(), overlay => title.setOverlay(overlay)));
      break;
    }
    case 'legend': {
      const legend = as<IChart.ILegend>();
      rows.push(flag(t('chart.pane.visible'), legend.getVisible(), visible => legend.setVisible(visible)));
      rows.push(<Choice key="position" label={t('chart.pane.position')} value={legend.getPosition()} options={LEGEND_POSITIONS} disabled={disabled}
        labels={{ top: t('chart.pane.side.top'), bottom: t('chart.pane.side.bottom'), left: t('chart.pane.side.left'), right: t('chart.pane.side.right'), corner: t('chart.pane.side.corner') }}
        onChange={position => run(() => legend.setPosition(position))}/>);
      rows.push(flag(t('chart.pane.overlay'), legend.getOverlay(), overlay => legend.setOverlay(overlay)));
      break;
    }
    case 'axis': {
      const axis = as<IChart.IAxis>();
      rows.push(flag(t('chart.pane.visible'), axis.getVisible(), visible => axis.setVisible(visible)));
      rows.push(flag(t('chart.pane.reverse'), axis.getReversePlotOrder(), reverse => axis.setReversePlotOrder(reverse)));
      if (axis.getKind() === 'value') {
        const bound = (label: string, value: number | null, set: (value: number) => void): React.ReactElement => (
          <FormatNumberField key={label} label={label} value={value ?? 0} min={-1e15} max={1e15} decimals width={120} disabled={disabled} onChange={next => run(() => set(next))}/>
        );
        rows.push(<FormatRow key="bounds">{bound(t('chart.pane.minimum'), axis.getMinimum(), value => axis.setMinimum(value))}{bound(t('chart.pane.maximum'), axis.getMaximum(), value => axis.setMaximum(value))}</FormatRow>);
        rows.push(<CommitText key="format" label={t('chart.pane.numberFormat')} value={axis.getNumberFormat() ?? ''} disabled={disabled} onCommit={format => run(() => format ? axis.setNumberFormat(format) : axis.setLinkNumberFormat(true))}/>);
      }
      break;
    }
    case 'gridlines':
    case 'upDownBars':
    case 'hiLoLines':
    case 'dropLines':
    case 'seriesLines': {
      const part = as<{ getVisible(): boolean, setVisible(visible: boolean): unknown }>();
      rows.push(flag(t('chart.pane.visible'), part.getVisible(), visible => part.setVisible(visible)));
      break;
    }
    case 'series': {
      const series = as<IChart.ISeries>();
      rows.push(flag(t('chart.pane.secondaryAxis'), series.getAxisGroup() === 'secondary', secondary => series.setAxisGroup(secondary ? 'secondary' : 'primary')));
      const gap = series.getGapWidth();
      const overlap = series.getOverlap();
      if (gap !== null || overlap !== null) {
        rows.push(
          <FormatRow key="gap">
            {overlap !== null ? <FormatNumberField label={t('chart.pane.overlap')} value={overlap} min={-100} max={100} width={96} disabled={disabled} onChange={value => run(() => series.setOverlap(value))}/> : null}
            {gap !== null ? <FormatNumberField label={t('chart.pane.gapWidth')} value={gap} min={0} max={500} width={96} disabled={disabled} onChange={value => run(() => series.setGapWidth(value))}/> : null}
          </FormatRow>
        );
      }
      if (/^(line|xyscatter)/.test(series.getChartType())) rows.push(flag(t('chart.pane.smooth'), series.getSmooth(), smooth => series.setSmooth(smooth)));
      break;
    }
    case 'dataLabels':
    case 'dataLabel': {
      const labels = as<IChart.IDataLabel & IChart.IDataLabels>();
      rows.push(flag(t('chart.pane.visible'), labels.getVisible(), visible => labels.setVisible(visible)));
      rows.push(flag(t('chart.pane.labels.value'), labels.getShowValue(), show => labels.setShowValue(show)));
      rows.push(flag(t('chart.pane.labels.category'), labels.getShowCategoryName(), show => labels.setShowCategoryName(show)));
      rows.push(flag(t('chart.pane.labels.series'), labels.getShowSeriesName(), show => labels.setShowSeriesName(show)));
      rows.push(flag(t('chart.pane.labels.percentage'), labels.getShowPercentage(), show => labels.setShowPercentage(show)));
      rows.push(flag(t('chart.pane.labels.legendKey'), labels.getShowLegendKey(), show => labels.setShowLegendKey(show)));
      rows.push(<Choice key="position" label={t('chart.pane.position')} value={labels.getPosition()} options={LABEL_POSITIONS} disabled={disabled}
        labels={{
          center: t('chart.pane.labels.center'), insideEnd: t('chart.pane.labels.insideEnd'), insideBase: t('chart.pane.labels.insideBase'),
          outsideEnd: t('chart.pane.labels.outsideEnd'), left: t('chart.pane.side.left'), right: t('chart.pane.side.right'),
          top: t('chart.pane.side.top'), bottom: t('chart.pane.side.bottom'), bestFit: t('chart.pane.labels.bestFit')
        }}
        onChange={position => run(() => labels.setPosition(position))}/>);
      break;
    }
    case 'trendline': {
      const trendline = as<IChart.ITrendline>();
      rows.push(<Choice key="type" label={t('chart.pane.trendline.type')} value={trendline.getType()} options={TRENDLINE_TYPES} disabled={disabled}
        labels={{
          linear: t('chart.pane.trendline.linear'), exponential: t('chart.pane.trendline.exponential'), logarithmic: t('chart.pane.trendline.logarithmic'),
          polynomial: t('chart.pane.trendline.polynomial'), power: t('chart.pane.trendline.power'), movingAverage: t('chart.pane.trendline.movingAverage')
        }}
        onChange={type => run(() => trendline.setType(type))}/>);
      rows.push(flag(t('chart.pane.trendline.equation'), trendline.getShowEquation(), show => trendline.setShowEquation(show)));
      rows.push(flag(t('chart.pane.trendline.rSquared'), trendline.getShowRSquared(), show => trendline.setShowRSquared(show)));
      rows.push(
        <FormatRow key="periods">
          <FormatNumberField label={t('chart.pane.trendline.forward')} value={trendline.getForwardPeriod()} min={0} max={1e6} decimals width={96} disabled={disabled} onChange={value => run(() => trendline.setForwardPeriod(value))}/>
          <FormatNumberField label={t('chart.pane.trendline.backward')} value={trendline.getBackwardPeriod()} min={0} max={1e6} decimals width={96} disabled={disabled} onChange={value => run(() => trendline.setBackwardPeriod(value))}/>
        </FormatRow>
      );
      break;
    }
    case 'errorBars': {
      const bars = as<IChart.IErrorBars>();
      rows.push(flag(t('chart.pane.visible'), bars.getVisible(), visible => bars.setVisible(visible)));
      rows.push(<Choice key="type" label={t('chart.pane.errorBars.type')} value={bars.getType() === 'custom' ? 'fixedValue' : bars.getType()} options={ERROR_BAR_TYPES} disabled={disabled}
        labels={{ fixedValue: t('chart.pane.errorBars.fixedValue'), percent: t('chart.pane.errorBars.percent'), stDev: t('chart.pane.errorBars.stDev'), stError: t('chart.pane.errorBars.stError') }}
        onChange={type => run(() => bars.setType(type))}/>);
      const amount = bars.getAmount();
      if (amount !== null) rows.push(<FormatNumberField key="amount" label={t('chart.pane.errorBars.amount')} value={amount} min={0} max={1e15} decimals width={120} disabled={disabled} onChange={value => run(() => bars.setAmount(value))}/>);
      rows.push(<Choice key="include" label={t('chart.pane.errorBars.direction')} value={bars.getInclude()} options={ERROR_BAR_INCLUDES} disabled={disabled}
        labels={{ both: t('chart.pane.errorBars.both'), plusValues: t('chart.pane.errorBars.plus'), minusValues: t('chart.pane.errorBars.minus') }}
        onChange={include => run(() => bars.setInclude(include))}/>);
      rows.push(flag(t('chart.pane.errorBars.cap'), bars.getEndStyleCap(), cap => bars.setEndStyleCap(cap)));
      break;
    }
    case 'dataTable': {
      const table = as<IChart.IDataTable>();
      rows.push(flag(t('chart.pane.visible'), table.getVisible(), visible => table.setVisible(visible)));
      rows.push(flag(t('chart.pane.labels.legendKey'), table.getShowLegendKey(), show => table.setShowLegendKey(show)));
      rows.push(flag(t('chart.pane.table.horizontal'), table.getShowHorizontalBorder(), show => table.setShowHorizontalBorder(show)));
      rows.push(flag(t('chart.pane.table.vertical'), table.getShowVerticalBorder(), show => table.setShowVerticalBorder(show)));
      rows.push(flag(t('chart.pane.table.outline'), table.getShowOutlineBorder(), show => table.setShowOutlineBorder(show)));
      break;
    }
    default:
      break;
  }
  if (rows.length === 0) return null;
  return (
    <>
      <PartTitle>{t('chart.pane.options')}</PartTitle>
      <Box sx={{ ...panelSx, gap: 1 }}>{rows.map((row, i) => <Box key={i}>{row}</Box>)}</Box>
    </>
  );
};

/**
 * The body of the format pane for a chart: Excel's Format pane for one chart element at a time,
 * chosen from the chart's elements as its Chart Elements list offers them.
 *
 * @remarks
 * Each element shows its fill and line (the format pane's own Fill and Line controls, bound to the
 * element's style), its text style where it has text, and its own options. Every control writes
 * through the element's setters, one step to undo each; what a chart refuses is said under the
 * picker.
 */
export const ChartFormatPanel = memo((props: MovablePaneProps) => {
  const { movable, sheet } = props;
  const t = useTranslator();
  const chart = movable.getContent<IChart>();

  // Live apply: what the pane shows follows what it just wrote, and any other write to the chart.
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => chart.addListeners({ onAnyChange: refresh }), [chart]);

  // The pane shows the element selected in the chart (a press on a series, a point…); with none,
  // the one last chosen here, the chart area to start. Choosing here selects in the chart too.
  const selection = sheet.getView().getChartElementSelection();
  useEffect(() => selection.addListeners({ onChange: refresh }), [selection]);
  const [path, setPath] = useState<string>('chartArea');
  const [error, setError] = useState<string | null>(null);
  const selected = selection.getChart() === chart ? selection.getActive() : null;
  const element = selected ?? chart.getElement(path) ?? chart.getChartArea();
  const choose = (next: string): void => {
    setPath(next);
    setError(null);
    const chosen = chart.getElement(next);
    if (chosen && chosen.getElementType() !== 'chartArea') selection.select([chosen]);
    else selection.clear();
  };
  const elements = chart.getElements();
  // The chosen element stays offered while it is chosen, shown or not, so hiding it does not lose it.
  const offered = elements.includes(element) ? elements : [...elements, element];
  const disabled = chart.isReadOnly();

  const run = useCallbackRef((apply: () => void) => {
    try {
      apply();
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const style = element.getStyle?.();
  const font = (style as ITextBoxStyle | undefined)?.isITextBoxStyle ? (style as ITextBoxStyle).getFont() : null;
  // A legend entry's fill and line are the legend's: Excel offers its Text Options alone.
  const shape = element.getElementType() === 'legendEntry' ? null : style;
  const upDown = element.getElementType() === 'upDownBars' ? element as IChart.IUpDownBars : null;

  return (
    <Box sx={{ ...panelSx, gap: 2, paddingTop: (theme: Theme) => theme.spacing(1) }}>
      <FormControl size="small" fullWidth>
        <InputLabel>{t('chart.pane.element')}</InputLabel>
        <Select
          label={t('chart.pane.element')}
          value={element.getPath()}
          onChange={(event) => choose(event.target.value)}
        >
          {offered.map(item => <MenuItem key={item.getPath()} value={item.getPath()}>{elementLabel(t, item)}</MenuItem>)}
        </Select>
      </FormControl>
      {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
      <OptionsSection key={`options:${element.getPath()}`} element={element} disabled={disabled} run={run}/>
      {font ? <FontSection key={`text:${element.getPath()}`} font={font} styles={sheet.getStyles()} disabled={disabled} run={run}/> : null}
      {shape ? <StyleSection key={`style:${element.getPath()}`} style={shape} sheet={sheet} disabled={disabled}/> : null}
      {upDown ? (
        <>
          <StyleSection key="up" style={upDown.getUpBarsStyle()} sheet={sheet} disabled={disabled} label={t('chart.pane.upBars')}/>
          <StyleSection key="down" style={upDown.getDownBarsStyle()} sheet={sheet} disabled={disabled} label={t('chart.pane.downBars')}/>
        </>
      ) : null}
    </Box>
  );
});

ChartFormatPanel.displayName = 'ChartFormatPanel';
