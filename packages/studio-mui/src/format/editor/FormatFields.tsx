import type React from 'react';
import { useRef, useState } from 'react';

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
  IColor, IFill, type ICell, type IShapeStyle, type IStroke, type IStyleCollection, type IFont,
  type IFontStyle, type IWorksheet
} from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { useGridColorScheme } from '@sheetxl/react';

import { ColorPopupButton } from '../../color';
import { FormulaField } from '../../form';
import { FillPanel, type FillSelection } from '../FillPanel';
import { LinePanel, type LineSelection } from '../LinePanel';
import { FormatNumberField, FormatRow, FormatSection } from '../FormatPanelParts';

import { type FormatField } from './FormatField';

/** Runs a write, and says what the chart refused. */
export type RunEdit = (apply: () => void) => void;

/** A heading over one of a tab's or a row's parts. */
const PartTitle = (props: { children: React.ReactNode }): React.ReactElement => (
  <Typography variant="subtitle2" component="div">{props.children}</Typography>
);

/**
 * The color the style's line takes with its own handed back: its default's, which is what the
 * picker's **Automatic** swatch shows. A default with no line of a single color shows the theme's
 * text color.
 */
const autoLineColor = (style: IShapeStyle, styles: IStyleCollection): IColor => {
  const fill = style.getDefault().getStroke().getFill();
  if (fill.getType() === IFill.Type.Solid) return (fill as IFill.ISolid).getColor();
  return styles.parseColor(IColor.Scheme.Tx1);
};

/** Fill for one shape style: the Format Cells pane's own control, bound to the style. */
const FillField = (props: { style: IShapeStyle, sheet: IWorksheet, disabled: boolean }): React.ReactElement => {
  const { style, sheet, disabled } = props;
  const styles = sheet.getStyles();
  const darkMode = useGridColorScheme() === 'dark';
  const fill: FillSelection = {
    fill: style.getFill(),
    styles,
    darkMode,
    disabled,
    createCell: (update: ICell.Update): ICell | null => sheet.createCell(update),
    applyFill: (update: IFill.Update, description?: string): void => { style.setFill(update, { description }); },
  };
  return <FillPanel selection={fill}/>;
};

/** Line for one shape style. */
const LineField = (props: { style: IShapeStyle, sheet: IWorksheet, disabled: boolean }): React.ReactElement => {
  const { style, sheet, disabled } = props;
  const styles = sheet.getStyles();
  const darkMode = useGridColorScheme() === 'dark';
  const line: LineSelection = {
    stroke: style.getStroke(),
    stated: style.toJSON()?.stroke ?? null,
    autoColor: autoLineColor(style, styles),
    styles,
    darkMode,
    disabled,
    applyStroke: (update: IStroke.Modifiers | null, description?: string): void => { style.setStroke(update, { description }); },
  };
  return <LinePanel selection={line}/>;
};

/** A dropdown of `options`, each by its label. */
const Choice = (props: {
  label: string, value: string, options: readonly string[], labels: Readonly<Record<string, string>>, disabled: boolean, onChange: (value: string) => void
}): React.ReactElement => (
  <FormControl size="small" fullWidth disabled={props.disabled}>
    <InputLabel>{props.label}</InputLabel>
    <Select label={props.label} value={props.value} onChange={event => props.onChange(event.target.value)}>
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

/**
 * A number that may be left unstated: empty, it shows `auto` and states nothing. Writes when it is
 * committed, as {@link CommitText} does.
 */
const AutoNumber = (props: {
  label: string, value: number | null, auto: string, min: number, max: number, disabled: boolean, onCommit: (value: number | null) => void
}): React.ReactElement => {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = props.value === null ? '' : String(props.value);
  const commit = (): void => {
    const text = draft;
    setDraft(null);
    if (text === null || text.trim() === shown) return;
    if (text.trim() === '') { props.onCommit(null); return; }
    const value = Number(text);
    if (!Number.isNaN(value)) props.onCommit(Math.max(props.min, Math.min(props.max, value)));
  };
  return (
    <TextField
      size="small"
      label={props.label}
      placeholder={props.auto}
      disabled={props.disabled}
      value={draft ?? shown}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: 'decimal' } }}
      sx={{ flex: '1 1 0', minWidth: 0, '& input': { textAlign: 'right' } }}
    />
  );
};

/**
 * Cells, or whatever else a formula names, typed or picked from the grid. Writes when the edit is
 * done, with the text as typed.
 */
const FormulaText = (props: { label: string, value: string, literal: boolean, placeholder?: string, disabled: boolean, onCommit: (text: string) => void }): React.ReactElement => {
  // What the user has typed or picked since the field last wrote; `null` while it shows the chart's own.
  const typed = useRef<string | null>(null);
  return (
    <FormulaField
      grammar="formula"
      equals={props.literal ? 'literal' : 'optional'}
      value={props.value || null}
      changeOn="done"
      // A chart's references are pinned, as Excel writes them: `Sheet1!$B$2:$B$5`.
      pickAs="absolute"
      label={props.label}
      placeholder={props.placeholder}
      helperText={null}
      disabled={props.disabled}
      onChangeText={(text: string) => { typed.current = text; }}
      onDone={(_value, args) => {
        const text = typed.current;
        typed.current = null;
        if (text !== null && args.reason === 'accept') props.onCommit(text);
      }}
    />
  );
};

const UNDERLINES: readonly IFont.UnderlineStyle[] = ['none', 'single', 'double'];
const STRIKES: readonly IFont.StrikeStyle[] = ['none', 'single', 'double'];

/** A font: family, size, color and the styles text takes. */
const FontField = (props: { font: IFontStyle, styles: IStyleCollection, disabled: boolean, run: RunEdit }): React.ReactElement => {
  const { font, styles, disabled, run } = props;
  const t = useTranslator();
  const darkMode = useGridColorScheme() === 'dark';
  const recentColors = useCallbackRef(() => styles.recentColors(), [styles]);
  const color: IColor = font.getColor();
  const lines = { none: t('chart.pane.text.lineNone'), single: t('chart.pane.text.lineSingle'), double: t('chart.pane.text.lineDouble') };
  return (
    <>
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
            options={UNDERLINES} labels={lines} disabled={disabled} onChange={underline => run(() => font.setUnderline(underline as IFont.UnderlineStyle))}/>
          <Choice label={t('chart.pane.text.strike')} value={font.getStrike()} options={STRIKES} labels={lines} disabled={disabled}
            onChange={strike => run(() => font.setStrike(strike as IFont.StrikeStyle))}/>
        </FormatRow>
      </FormatSection>
    </>
  );
};

/** One field's control. */
const FieldControl = (props: { field: FormatField, sheet: IWorksheet, disabled: boolean, run: RunEdit }): React.ReactElement => {
  const { field, sheet, disabled, run } = props;
  switch (field.type) {
    case 'flag':
      return <Flag label={field.label} checked={field.get()} disabled={disabled} onChange={value => run(() => field.set(value))}/>;
    case 'choice':
      return <Choice label={field.label} value={field.get()} options={field.options} labels={field.labels} disabled={disabled} onChange={value => run(() => field.set(value))}/>;
    case 'number':
      if (field.auto !== undefined) {
        return (
          <AutoNumber
            label={field.label} value={field.get()} auto={field.auto} min={field.min} max={field.max} disabled={disabled}
            onCommit={value => run(() => field.set(value))}
          />
        );
      }
      return (
        <FormatNumberField
          label={field.label} value={field.get() ?? 0} min={field.min} max={field.max} decimals={field.decimals} width={field.row ? 108 : '100%'} disabled={disabled}
          onChange={value => run(() => field.set(value))}
        />
      );
    case 'text':
      return <CommitText label={field.label} value={field.get()} disabled={disabled} onCommit={value => run(() => field.set(value))}/>;
    case 'formula':
      return <FormulaText label={field.label} value={field.get()} literal={field.literal === true} placeholder={field.placeholder} disabled={disabled} onCommit={text => run(() => field.set(text))}/>;
    case 'font':
      return <><PartTitle>{field.label}</PartTitle><FontField font={field.font} styles={sheet.getStyles()} disabled={disabled} run={run}/></>;
    case 'fill':
      return <><PartTitle>{field.label}</PartTitle><FillField style={field.style} sheet={sheet} disabled={disabled}/></>;
    case 'line':
      return <><PartTitle>{field.label}</PartTitle><LineField style={field.style} sheet={sheet} disabled={disabled}/></>;
  }
};

export interface FormatFieldsProps {
  fields: readonly FormatField[];
  sheet: IWorksheet;
  disabled: boolean;
  run: RunEdit;
}

/**
 * Fields drawn in the order declared: fields of one `row` side by side, a `heading` over the field
 * that states one, and who shares a setting said once over the settings shared.
 *
 * @remarks
 * Not memoized: a field reads what it sets when drawn, and its owner redraws on every change.
 */
export const FormatFields = (props: FormatFieldsProps): React.ReactElement => {
  const { fields, sheet, disabled, run } = props;
  const out: React.ReactNode[] = [];
  let shared: string | undefined;
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.shared !== shared) {
      shared = field.shared;
      if (shared) out.push(<Typography key={`shared:${field.key}`} variant="caption" component="div" sx={{ color: 'text.secondary' }}>{shared}</Typography>);
    }
    if (field.heading) out.push(<PartTitle key={`heading:${field.key}`}>{field.heading}</PartTitle>);
    if (field.row) {
      const group: FormatField[] = [field];
      while (i + 1 < fields.length && fields[i + 1].row === field.row) group.push(fields[++i]);
      out.push(
        <FormatRow key={`row:${field.key}`}>
          {group.map(each => <FieldControl key={each.key} field={each} sheet={sheet} disabled={disabled} run={run}/>)}
        </FormatRow>
      );
      continue;
    }
    const isFlag = field.type === 'flag';
    out.push(
      <Box
        key={field.key}
        data-field={field.key}
        data-flag={isFlag ? '' : undefined}
        // Checkboxes that follow each other are one list: each brings its own room, so they sit closer than other fields do.
        sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, ...(isFlag ? { '[data-flag] + &': { marginTop: -1.5 } } : null) }}
      >
        <FieldControl field={field} sheet={sheet} disabled={disabled} run={run}/>
        {field.hint ? <Typography variant="caption" component="div" sx={{ color: 'text.secondary', marginTop: -0.5 }}>{field.hint}</Typography> : null}
      </Box>
    );
  }
  return <>{out}</>;
};
