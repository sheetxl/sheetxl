import type React from 'react';
import { memo, useMemo, useRef, useState } from 'react';

import {
  Box, Checkbox, Divider, FormControl, FormControlLabel, FormLabel, InputLabel, MenuItem,
  Radio, RadioGroup, Select, TextField, Typography
} from '@mui/material';
import { type SelectChangeEvent, type Theme } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IRange, type ICellRange, type IAutoFill } from '@sheetxl/sdk';
// `AutoFill` as a VALUE - the namespace carries the preset registry the Type list is built from.
import { AutoFill } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { AUTO_FILL_PRESET_LABELS, type CommandContext } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

export interface FillSeriesDialogProps
  extends InputDialogProps<CommandContext.FillSeriesOptions, CommandContext.FillSeries> {};

/** A cell the fill leaves empty — past a stop value, or a gap in the template. */
const BLANK_MARK = '\u2013';

/**
 * An outlined input insets its own text by its horizontal padding (`MuiOutlinedInput-input`,
 * `8.5px 14px` at `size="small"`), so a row sitting at the container's edge lines up with the
 * BORDERS above it and not with the text inside them — close enough to read as a mistake. The same
 * constant, for the same reason, as the sort dialog's caption row.
 */
const INPUT_TEXT_INSET = '14px';

/** The hairline either side of the header's arrow, taking up whatever room is left. */
const PREVIEW_RULE = {
  flex: '1 1 auto',
  minWidth: (theme: Theme) => theme.spacing(1),
  height: '1px',
  backgroundColor: (theme: Theme) => theme.palette.divider
} as const;

/**
 * Roughly how many characters of preview fit on the dialog's one line.
 *
 * @remarks
 * A budget rather than a measurement: the dialog is a fixed width and the row is `body2`, and the
 * alternative is measuring text in order to decide how much text to measure. It is tuned to digits,
 * which is what a filled series mostly is; wider text overruns and is cut by `noWrap` — which is
 * why the LAST value is a separate element that the cut cannot reach.
 */
const PREVIEW_BUDGET = 64;

/**
 * The Type dropdown: the preset ids this dialog lists, in runs separated by a divider.
 *
 * @remarks
 * Excel is a Type radio group crossed with a Date-unit one, meaningful only as a pair. Our date
 * units are already separate fill types, so the grid collapses into one list.
 *
 * The runs are ordered by how much a type asks of the values — the two that take no options, then
 * the numeric series, then the date ones — and separated by a rule rather than headed by a label.
 * A heading reads as enabled while the entries under it are greyed, which says the opposite of what
 * is true. (A per-type icon would say it better still; that waits on the scalar-type icon set.)
 *
 * `linear.trend` / `growth.trend` are deliberately absent: the dialog carries a **Trend** checkbox,
 * so the same two types serve both. Those presets are for the fill menu, where there is no checkbox
 * to carry it — which is why the ORDER and the membership live here, with the surface, and not with
 * the registry.
 */
const TYPE_RUNS: readonly (readonly string[])[] = Object.freeze([
  Object.freeze([AutoFill.Presets.Copy.id, AutoFill.Presets.Series.id]),
  Object.freeze([AutoFill.Presets.Linear.id, AutoFill.Presets.Growth.id]),
  /* Largest unit first, which is also the order a template is DETECTED at — so the entry the
     dialog opens on is the first one in the run that could have claimed it. */
  Object.freeze([
    AutoFill.Presets.DateYears.id,
    AutoFill.Presets.DateMonthEnd.id,
    AutoFill.Presets.DateMonths.id,
    AutoFill.Presets.DateWeekdays.id,
    AutoFill.Presets.DateDays.id
  ])
]);

/** The directions a selection can be filled in, and the word Excel uses for each. */
const DIRECTIONS: readonly { direction: IRange.Direction, label: string }[] = Object.freeze([
  /* Excel's own words: a series "in columns" runs DOWN one. */
  { direction: IRange.Direction.Down, label: messageKey('fillSeries.columns') },
  { direction: IRange.Direction.Right, label: messageKey('fillSeries.rows') }
]);

/**
 * Excel's `Series…` — the fill types, the step and stop values, and which way the series runs.
 *
 * @remarks
 * Two things Excel leaves you to guess at are shown here instead: WHICH cells the series is read
 * from (its dialog always seeds from the first cell and never says so; ours takes the leading
 * contentful run, so it matters more), and what the current settings would actually produce.
 */
export const FillSeriesDialog = memo<FillSeriesDialogProps>((props: FillSeriesDialogProps) => {
  const {
    initialValue,
    context,
    onInput,
    onDone: propOnDone,
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();

  /* Read ONCE. The context is the selection the command opened on, and it must not shift under an
     open dialog. */
  const refContext = useRef<CommandContext.FillSeries | undefined>(context?.());
  const fillContext = refContext.current;

  const [options, setOptions] = useState<CommandContext.FillSeriesOptions>(() => ({
    presetId: initialValue?.presetId ?? AutoFill.Presets.Copy.id,
    direction: initialValue?.direction ?? IRange.Direction.Down,
    trend: initialValue?.trend,
    stepValue: initialValue?.stepValue,
    stopValue: initialValue?.stopValue
  }));

  const isVertical = options.direction === IRange.Direction.Down
    || options.direction === IRange.Direction.Up;

  /**
   * What applies in EACH direction, asked once.
   *
   * @remarks
   * Which types apply is a question about the selection's lines, so it changes with the direction —
   * and a direction that offers nothing has no room to fill at all (a single column can not fill
   * across), which is what disables its radio rather than letting the choice grey the whole dialog.
   */
  const offeredBy = useMemo((): ReadonlyMap<IRange.Direction, ReadonlySet<string>> => {
    const retValue = new Map<IRange.Direction, ReadonlySet<string>>();
    for (let i=0; i<DIRECTIONS.length; i++) {
      const direction = DIRECTIONS[i].direction;
      retValue.set(direction, new Set(fillContext?.offered(direction) ?? []));
    }
    return retValue;
  }, [fillContext]);

  const offered: ReadonlySet<string> = offeredBy.get(options.direction) ?? new Set();
  const canFill = offered.has(options.presetId);

  const preset: IAutoFill.Preset | undefined = AutoFill.getPreset(options.presetId);
  const filler = preset?.filler;
  const isTrend = options.trend === true && filler?.supportsTrend === true;
  /* A fit has no step to take and nothing to stop, so neither field is offered while it is on —
     Excel leaves both live under Trend and then pays them no attention. */
  const showStep = filler?.supportsStep === true && !isTrend;
  const showStop = filler?.supportsStop === true && !isTrend;

  const update = useCallbackRef((changes: Partial<CommandContext.FillSeriesOptions>): void => {
    setOptions((was: CommandContext.FillSeriesOptions): CommandContext.FillSeriesOptions => {
      const next = { ...was, ...changes };
      /* A type that cannot fit drops the checkbox rather than carrying a setting no field shows. */
      if (AutoFill.getPreset(next.presetId)?.filler.supportsTrend !== true) next.trend = undefined;
      return next;
    });
  }, []);

  const handleDirection = useCallbackRef((_e: React.ChangeEvent<HTMLInputElement>, value: string): void => {
    const direction = value as IRange.Direction;
    /* A choice the new direction cannot honor falls back to one it can, rather than sitting there
       greyed. */
    const applies = offeredBy.get(direction);
    const presetId = applies?.has(options.presetId)
      ? options.presetId
      : (TYPE_RUNS.flat().find((id: string): boolean => applies?.has(id) === true) ?? options.presetId);
    update({ direction, presetId });
  }, [offeredBy, options.presetId, update]);

  const handleType = useCallbackRef((e: SelectChangeEvent<string>): void => {
    update({ presetId: e.target.value });
  }, [update]);

  /** An empty field is "not given", which is not the same as a zero — a zero step is a real step. */
  const numberOrUndefined = (text: string): number | undefined =>
    text.trim() === '' || isNaN(Number(text)) ? undefined : Number(text);

  /** The cells the fill reads and the cells it covers — neither is the selection, so both are shown. */
  const ranges: CommandContext.FillSeriesRanges | null = useMemo(
    (): CommandContext.FillSeriesRanges | null => fillContext?.resolve(options.direction) ?? null,
    [fillContext, options.direction]
  );

  /**
   * What the fill would WRITE, as far as one line goes.
   *
   * @remarks
   * As many values from the start as fit, then the last one — the last is what a long fill is
   * judged by, and the run up to it is what says how it gets there. A fill short enough to show
   * whole gets no ellipsis, because nothing is hidden.
   *
   * The template's own values are not shown: they are on the sheet, two lines above the dialog, and
   * the address in the header already says which they are. The room is better spent on the answer.
   *
   * Cells are computed on demand, so this reads the dozen it prints rather than the whole fill.
   */
  const preview = useMemo((): { leading: string, tail: string } | null => {
    if (!fillContext || !canFill || !ranges || ranges.size <= 0) return null;
    let projected: ICellRange | null = null;
    try { projected = fillContext.preview(options); } catch (error: any) { return null; }
    if (!projected) return null;
    const coords = projected.getCoords();
    const at = (offset: number): string => {
      const address = isVertical
        ? { rowIndex: coords.rowStart + offset, colIndex: coords.colStart }
        : { rowIndex: coords.rowStart, colIndex: coords.colStart + offset };
      /* `hideStringPrefix` because this is UI: the default single-quote prefix annotates the TYPE,
         which is right for a clipboard and wrong for showing what a cell will read. */
      return projected!.getCell(address).getText({ hideStringPrefix: true }) || BLANK_MARK;
    };

    const size = ranges.size;
    const last = at(size - 1);
    if (size === 1) return { leading: '', tail: last };
    /* The last value is always shown, so the room it needs comes off the budget first. */
    const budget = PREVIEW_BUDGET - last.length - 3;
    const leading: string[] = [];
    let used = 0;
    for (let i=0; i<size-1; i++) {
      const text = at(i);
      const cost = text.length + (i === 0 ? 0 : 2);
      if (used + cost > budget) break;
      leading.push(text);
      used += cost;
    }
    /* Nothing elided when the whole fill fit, so it reads as a list rather than as a jump. */
    const shownAll = leading.length === size - 1;
    return {
      leading: leading.join(', '),
      tail: `${leading.length === 0 ? '' : (shownAll ? ', ' : ' … ')}${last}`
    };
  }, [fillContext, canFill, options, isVertical, ranges]);

  const handleDone = useCallbackRef((option?: OptionInput): void => {
    const applied = option === 'Fill' ? options : undefined;
    onInput?.(applied);
    propOnDone?.(applied);
  }, [options, onInput, propOnDone]);

  const typeItems = useMemo((): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    for (let i=0; i<TYPE_RUNS.length; i++) {
      /* A rule between the runs, and never a leading or trailing one. */
      if (i > 0) items.push(<Divider key={`divider:${i}`} component="li" />);
      const run = TYPE_RUNS[i];
      for (let j=0; j<run.length; j++) {
        const id = run[j];
        items.push(
          /* Listed even where it does not apply: a dropdown whose length changed with the
             selection would be a different control each time it opened. */
          <MenuItem key={id} value={id} disabled={!offered.has(id)}>
            {t(AUTO_FILL_PRESET_LABELS[id])}
          </MenuItem>
        );
      }
    }
    return items;
  }, [offered, t]);

  const numberField = (
    className: string, label: string, placeholder: string,
    value: number | undefined, onValue: (next: number | undefined) => void
  ): React.ReactNode => (
    <TextField
      size="small"
      fullWidth
      className={className}
      label={t(label)}
      placeholder={t(placeholder)}
      value={value ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValue(numberOrUndefined(e.target.value))}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { spellCheck: false, autoComplete: 'off', inputMode: 'decimal' }
      }}
      onContextMenu={(e: React.MouseEvent) => { e.stopPropagation(); }}
    />
  );

  return (
    <OptionsDialog
      title={t('fillSeries.title')}
      options={[
        { id: 'Fill', label: () => t('fillSeries.action'), disabled: () => !canFill },
        'Cancel'
      ]}
      onDone={handleDone}
      sx={{
        /* Fixed rather than fitted: the fields come and go with the chosen type — Trend takes both
           the step and the stop away — and a dialog that resized under the pointer while the user
           was reading it would be worse than one with a little slack in it. */
        width: '440px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: (theme: Theme) => theme.spacing(2)
        }}
      >
        <FormControl>
          <FormLabel sx={{ fontSize: '0.75rem' }}>{t('fillSeries.seriesIn')}</FormLabel>
          <RadioGroup
            row
            className="sxl-fillSeries-direction"
            value={options.direction}
            onChange={handleDirection}
          >
            {DIRECTIONS.map((entry): React.ReactNode => (
              <FormControlLabel
                key={entry.direction}
                value={entry.direction}
                control={<Radio size="small" />}
                label={t(entry.label)}
                /* One cell deep that way is nowhere to fill, so the choice is not offered at all —
                   picking it would otherwise grey every type and the action with them. */
                disabled={offeredBy.get(entry.direction)?.size === 0}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <FormControl size="small" fullWidth className="sxl-fillSeries-type">
          <InputLabel id="sxl-fillSeries-type-label">{t('fillSeries.type')}</InputLabel>
          <Select
            labelId="sxl-fillSeries-type-label"
            value={canFill ? options.presetId : ''}
            label={t('fillSeries.type')}
            onChange={handleType}
            className="autoFocus"
          >
            {typeItems}
          </Select>
        </FormControl>

        {filler?.supportsTrend === true && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={isTrend}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  update({ trend: e.target.checked ? true : undefined })}
              />
            }
            label={t('fillSeries.trend')}
            className="sxl-fillSeries-trend"
            sx={{ marginTop: (theme: Theme) => theme.spacing(-1) }}
          />
        )}

        {(showStep || showStop) && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: (theme: Theme) => theme.spacing(1.5)
            }}
          >
            {showStep && numberField(
              'sxl-fillSeries-step',
              messageKey('fillSeries.stepValue'),
              /* Blank does not mean zero: it means the step is read off the selection, which for a
                 lone seed is one and for `1, 5` is four. The preview below says what that produces. */
              messageKey('fillSeries.stepAuto'),
              options.stepValue, (next) => update({ stepValue: next })
            )}
            {showStop && numberField(
              'sxl-fillSeries-stop',
              messageKey('fillSeries.stopValue'),
              /* Blank here means unbounded, which is a different nothing from the step's. */
              messageKey('fillSeries.stopNone'),
              options.stopValue, (next) => update({ stopValue: next })
            )}
          </Box>
        )}

        {/* What the fill reads and what it writes, headed by the two addresses, then the values it
            would produce. No caption: the header IS the description. The addresses are worth the
            room because the template is the selection's leading CONTENTFUL part, so it moves when a
            second seed value is typed and nothing else on screen would say so. */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '2.75em',
            paddingLeft: INPUT_TEXT_INSET,
            paddingRight: INPUT_TEXT_INSET
          }}
        >
          <Box
            className="sxl-fillSeries-ranges"
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: (theme: Theme) => theme.spacing(0.75),
              color: (theme: Theme) => theme.palette.text.secondary
            }}
          >
            <Typography variant="caption" noWrap>{ranges?.template ?? ''}</Typography>
            {/* A rule either side, so the arrow sits between the two addresses rather than against
                one of them, and the row reads as one span from where it reads to where it writes. */}
            <Box sx={PREVIEW_RULE} />
            <Typography variant="caption" sx={{ lineHeight: 1 }}>{'\u2192'}</Typography>
            <Box sx={PREVIEW_RULE} />
            <Typography variant="caption" noWrap>{ranges?.destination ?? ''}</Typography>
          </Box>
          {preview ? (
            <Box
              className="sxl-fillSeries-preview"
              sx={{ display: 'flex', flexDirection: 'row', fontVariantNumeric: 'tabular-nums' }}
            >
              <Typography variant="body2" component="div" noWrap sx={{ minWidth: 0 }}>
                {preview.leading}
              </Typography>
              {/* Its own element, so where the fill LANDS is not what the overflow eats. */}
              <Typography variant="body2" component="div" noWrap sx={{ flex: '0 0 auto' }}>
                {preview.tail}
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="body2" component="div" noWrap
              className="sxl-fillSeries-previewNone"
              sx={{ color: (theme: Theme) => theme.palette.text.disabled }}
            >
              {t('fillSeries.previewNone')}
            </Typography>
          )}
        </Box>
      </Box>
    </OptionsDialog>
  );
});

export default FillSeriesDialog;
