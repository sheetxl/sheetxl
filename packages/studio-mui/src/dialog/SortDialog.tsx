import type React from 'react';
import { memo, useMemo, useRef, useState } from 'react';

import {
  Box, Checkbox, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Typography
} from '@mui/material';
import { type SelectChangeEvent, type Theme } from '@mui/material';

// `ISort` as a VALUE — the namespace carries the `SortOn` constants the menu is built from.
import { IRange, Sort, ISort, type ICell, type ICellRange } from '@sheetxl/sdk';

import {
  DynamicIcon, useCallbackRef, useTranslator, type OptionInput
} from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { OptionsDialog, SimpleTooltip, type InputDialogProps } from '@sheetxl/utils-mui';

import { SortableCards, SortableCard, useReorderFlip } from '../itemsPanel/SortableCards';

export interface SortDialogProps extends InputDialogProps<ISort.RangeOptions, CommandContext.SelectedRange> {};

/**
 * One row of the dialog's list. `key` is identity for React and for the drag reorder — the level's
 * position is its priority, so it can not double as the id.
 */
interface SortLevel {
  key: string;
  /** The field offset within the sorted region, the same space as `ISort.Options.index`. */
  index: number;
  criteria: ISort.Criteria;
}

/** The sortable fields for one axis, resolved from the range's data (or its table's columns). */
interface SortFields {
  labels: string[];
  /** Field offsets, parallel to {@link labels}. Sparse: empty (and, unless asked for, hidden)
   *  fields are not listed, and the list is capped around the anchor. */
  offsets: number[];
}

/* A whole-column or whole-sheet selection spans more fields than a menu can usefully render (and
   than MUI can mount). The cap is a rendering limit only — it fills outward from the anchor, and a
   level already pointing outside it is always listed, so nothing loaded from the model becomes
   unreachable. */
const MAX_LISTED_FIELDS = 500;

/* One column geometry, shared by the caption row and every card, so the captions sit over what
   they name. The caption row also carries the card's box (padding + a transparent border) rather
   than guessing at the offset those add. */
const COLUMN_PRIORITY = { width: '64px', flex: '0 0 auto' } as const;
const COLUMN_FIELD = { flex: '1 1 0', minWidth: '120px' } as const;
const COLUMN_SORT_ON = { flex: '1 1 0', minWidth: '140px' } as const;
const COLUMN_ORDER = { width: '34px', flex: '0 0 auto', display: 'flex', justifyContent: 'center' } as const;
/* Four 28px buttons (24px icon + the 2px padding they are given). Fixed and NOT flexible, so the
   caption row's add button lands over the card's action row and neither takes grow space from the
   two dropdown columns — a `flex` spacer here would divide that space three ways, not two. */
const COLUMN_ACTIONS = {
  minWidth: '112px',
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end'
} as const;

/* An outlined input insets its text by its own horizontal padding (`MuiOutlinedInput-input`,
   `8.5px 14px` at `size="small"`). A caption sitting at the column's edge therefore reads as
   belonging to nothing; this puts it over the text it names. */
const INPUT_TEXT_INSET = '14px';

/** The caption row reads as a label row, not as fine print — dimmed rather than shrunk. */
const CAPTION_TEXT = {
  color: (theme: Theme) => theme.palette.text.secondary,
  fontWeight: 500,
  paddingLeft: INPUT_TEXT_INSET
} as const;

const CARD_BOX = {
  display: 'flex',
  alignItems: 'center',
  gap: (theme: Theme) => theme.spacing(1),
  padding: (theme: Theme) => theme.spacing(0.75, 1),
  border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
  borderRadius: (theme: Theme) => theme.spacing(1.25)
} as const;

const columnLabel = (colIndex: number): string => {
  let value = colIndex;
  let label = '';
  while (value >= 0) {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  }
  return label;
};

let _nextLevelKey: number = 0;
const newLevelKey = (): string => `level-${_nextLevelKey++}`;

const isCaseSensitive = (options: Intl.CollatorOptions | Record<string, Intl.CollatorOptions> | undefined): boolean =>
  (options as Intl.CollatorOptions)?.sensitivity === Sort.CaseSensitiveOptions.sensitivity;

export const SortDialog = memo<SortDialogProps>((props: SortDialogProps) => {
  const {
    initialValue: sortOptions,
    context,
    onInput,
    onDone: propOnDone,
    ...rest
  } = props;

  const t = useTranslator();

  /* Read ONCE. The context is the selection the command opened on, and it must not shift under an
     open dialog; capturing it also keeps the derivations below off a fresh object per render. */
  const refContext = useRef<CommandContext.SelectedRange | undefined>(context?.());
  const range: ICellRange | undefined = refContext.current?.range;
  // The cell itself, not a string — `ICell.toString()` is a debug form ("A1 => 'Name'"), which
  // `getDefaultSortCriteria` rejects as an address.
  const anchorCell: ICell.Address | undefined = refContext.current?.cell;

  const [options, setOptions] = useState<ISort.RangeOptions>(() => ({
    ...Sort.DefaultRangeOptions,
    ...sortOptions
  }));
  const [levels, setLevels] = useState<SortLevel[]>(() => {
    const sorts = sortOptions?.sorts ?? [];
    const retValue: SortLevel[] = [];
    for (let i=0; i<sorts.length; i++) {
      retValue.push({
        key: newLevelKey(),
        index: sorts[i].index ?? i,
        criteria: { ...sorts[i].criteria }
      });
    }
    // Excel always shows a level to fill in; an empty list would offer nothing to sort by.
    if (retValue.length === 0) retValue.push({ key: newLevelKey(), index: 0, criteria: {} });
    return retValue;
  });

  const axis = options.axis ?? IRange.Axis.Row;
  const isRowSort = axis === IRange.Axis.Row;

  const refList = useRef<HTMLDivElement>(null);
  const refSkipFlip = useRef<boolean>(false);
  useReorderFlip(refList, true, refSkipFlip);

  /* The field list follows the AXIS (columns for a top-to-bottom sort, rows for left-to-right) and
     the header flag, which is what turns offsets into names. Re-derived rather than carried from
     the command: the header sniff has to run again against the transposed data.

     Only fields with something in them are offered — the region runs to the selection's edge (a
     whole-sheet selection reaches XFD), and a blank column is nothing to sort by. Hidden fields
     follow the include-hidden choice. Each field is probed for its first value, so the cost is the
     number of fields walked, not the data. */
  const fields: SortFields = useMemo(() => {
    const labels: string[] = [];
    const offsets: number[] = [];
    const criteria = range?.getDefaultSortCriteria(axis, anchorCell);
    if (!criteria) return { labels, offsets };
    const sheet = range!.getWorksheet();
    const coords = criteria.coords;
    const used = sheet.getRange(coords).getUsedRange({ features: [] })?.getCoords();
    if (!used) return { labels, offsets };
    const majorStart = isRowSort ? coords.colStart : coords.rowStart;
    const majorEnd = isRowSort ? used.colEnd : used.rowEnd;
    const headers = isRowSort ? sheet.getRange(coords).getColumnHeaders() : sheet.getRange(coords).getRowHeaders();
    const includeHidden = !!options.includeHidden;
    const isListed = (major: number): boolean => {
      if (!includeHidden && headers.at(major - majorStart).isHidden()) return false;
      const probe: IRange.Coords = isRowSort
        ? { colStart: major, colEnd: major, rowStart: coords.rowStart, rowEnd: used.rowEnd }
        : { rowStart: major, rowEnd: major, colStart: coords.colStart, colEnd: used.colEnd };
      return !!sheet.getRange(probe).forEach(() => ({ break: true }), { features: [] });
    };

    /* Fill outward from the anchor, a kept field per side in turn, so the cap lands centered on
       the column the dialog opened over rather than on the region's first columns. */
    const anchorMajor = majorStart + (criteria.options.sorts?.[0]?.index ?? 0);
    const listed: number[] = [];
    let low = Math.min(anchorMajor, majorEnd);
    let high = low + 1;
    let takeLow = true;
    while (listed.length < MAX_LISTED_FIELDS) {
      const canLow = low >= majorStart;
      const canHigh = high <= majorEnd;
      if (!canLow && !canHigh) break;
      if (canLow && (takeLow || !canHigh)) {
        if (isListed(low)) { listed.push(low); takeLow = false; }
        low--;
      } else {
        if (isListed(high)) { listed.push(high); takeLow = true; }
        high++;
      }
    }
    listed.sort((a: number, b: number) => a - b);

    for (let i=0; i<listed.length; i++) {
      const offset = listed[i] - majorStart;
      const header = options.hasHeader ? criteria.headers?.get(offset) : undefined;
      offsets.push(offset);
      labels.push(header || (isRowSort
        ? t('sort.columnLabel', { name: columnLabel(coords.colStart + offset) })
        : t('sort.rowLabel', { name: `${coords.rowStart + offset + 1}` })
      ));
    }
    return { labels, offsets };
  }, [range, anchorCell, axis, isRowSort, options.hasHeader, options.includeHidden, t]);

  const labelForField = useCallbackRef((index: number): string => {
    const at = fields.offsets.indexOf(index);
    if (at !== -1) return fields.labels[at];
    // Past the render cap, or pointing outside the current axis' span.
    return isRowSort
      ? t('sort.columnLabel', { name: columnLabel(index) })
      : t('sort.rowLabel', { name: `${index + 1}` });
  }, [fields, isRowSort, t]);

  /* What refuses the sort, as a message or `null`. Reported inline AND used to disable the action —
     one source, so the button can never look live while the dialog is showing a reason it is not.

     Both cases are the same shape underneath (more levels than fields forces a repeat), but a
     three-level sort of a one-column selection is not usefully explained as "Column A twice" — the
     honest answer is that the selection has nowhere to put them. Reported, not prevented: the
     orientation toggle can turn a wide region into a one-row one, and levels that were fine a
     moment ago should say why they no longer are rather than silently vanish. */
  const refusal: string | null = useMemo(() => {
    const fieldCount = fields.offsets.length;
    if (fieldCount > 0 && levels.length > fieldCount) {
      return t('sort.tooManyLevels', { count: `${fieldCount}` });
    }
    const seen = new Set<number>();
    for (let i=0; i<levels.length; i++) {
      if (seen.has(levels[i].index)) return t('sort.duplicateField', { name: labelForField(levels[i].index) });
      seen.add(levels[i].index);
    }
    return null;
  }, [levels, fields, labelForField, t]);

  const updateLevel = useCallbackRef((key: string, criteria: Partial<SortLevel>) => {
    setLevels((prev: SortLevel[]) => prev.map((level) => level.key === key ? { ...level, ...criteria } : level));
  }, []);

  const moveLevel = useCallbackRef((indexFrom: number, indexTo: number, isDrag: boolean) => {
    // A drop is dnd-kit's own animation; only the buttons hand their layout change to the FLIP.
    if (isDrag) refSkipFlip.current = true;
    setLevels((prev: SortLevel[]) => {
      if (indexTo < 0 || indexTo >= prev.length) return prev;
      const next = [...prev];
      next.splice(indexTo, 0, ...next.splice(indexFrom, 1));
      return next;
    });
  }, []);

  const handleDone = useCallbackRef((option?: OptionInput) => {
    let updatedSortOptions: ISort.RangeOptions | undefined;
    if (option === 'Sort') {
      const sorts: ISort.Options[] = levels.map((level) => {
        const criteria: ISort.Criteria = { ...level.criteria };
        /* Case sensitivity is a property of the whole sort, not of a level — carried on
           `RangeOptions.collatorOptions` below. A level that kept its own (a table's stored
           criteria does) would silently outrank the checkbox the user just set. */
        delete criteria.collatorOptions;
        return { index: level.index, criteria };
      });
      updatedSortOptions = {
        ...sortOptions,
        ...options,
        // The primary level's direction, so the range-wide default agrees with what is shown.
        reverse: levels[0]?.criteria.reverse ?? options.reverse,
        sorts
      };
    }
    onInput?.(updatedSortOptions);
    propOnDone?.(updatedSortOptions);
  }, [levels, options, propOnDone, onInput, sortOptions]);

  const ids = useMemo(() => levels.map((level) => level.key), [levels]);

  return (
    <OptionsDialog
      title={t('sort.title')}
      options={[
        { id: 'Sort', label: () => t('sort.action'), disabled: () => refusal !== null },
        'Cancel'
      ]}
      onDone={handleDone}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: (theme: Theme) => theme.spacing(1.5),
          minWidth: '560px'
        }}
      >
        {/* The captions head the list, so they are grouped WITH it — the section gap above belongs
            between the list and the options below it, not between a header and the rows it names. */}
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ padding: (theme: Theme) => theme.spacing(0, 0.5) }}>
            <Box sx={{ ...CARD_BOX, borderColor: 'transparent', paddingTop: 0, paddingBottom: 0 }}>
              <Box sx={COLUMN_PRIORITY} />
              <Typography variant="body2" sx={{ ...COLUMN_FIELD, ...CAPTION_TEXT }}>
                {isRowSort ? t('sort.column') : t('sort.row')}
              </Typography>
              <Typography variant="body2" sx={{ ...COLUMN_SORT_ON, ...CAPTION_TEXT }}>
                {t('sort.sortOn')}
              </Typography>
              <Typography variant="body2" sx={{ ...COLUMN_ORDER, ...CAPTION_TEXT, paddingLeft: 0 }}>
                {t('sort.order')}
              </Typography>
              <Box sx={COLUMN_ACTIONS} />
            </Box>
          </Box>

          <Box
            ref={refList}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: (theme: Theme) => theme.spacing(0.75),
              padding: (theme: Theme) => theme.spacing(0.5),
              maxHeight: '320px',
              overflowY: 'auto'
            }}
          >
            <SortableCards
              ids={ids}
              scrollRef={refList}
              onMove={(indexFrom: number, indexTo: number) => moveLevel(indexFrom, indexTo, true)}
            >
              {levels.map((level: SortLevel, position: number) => (
                // A lone level has nowhere to go, so it is not a drag handle either.
                <SortableCard key={level.key} id={level.key} disabled={levels.length <= 1}>
                  <SortLevelCard
                    level={level}
                    position={position}
                    count={levels.length}
                    fields={fields}
                    labelForField={labelForField}
                    isRowSort={isRowSort}
                    onChange={updateLevel}
                    onMoveBy={(delta: number) => moveLevel(position, position + delta, false)}
                    onDuplicate={() => {
                      setLevels((prev: SortLevel[]) => {
                        const next = [...prev];
                        next.splice(position + 1, 0, { ...level, key: newLevelKey(), criteria: { ...level.criteria } });
                        return next;
                      });
                    }}
                    onDelete={() => setLevels((prev: SortLevel[]) => prev.filter((entry) => entry.key !== level.key))}
                  />
                </SortableCard>
              ))}
            </SortableCards>
            {/* Inside the scroller and after the last card, carrying the priority label the level it
                adds will have — the row reads as the next one, greyed until it exists. */}
            <Box sx={{ ...CARD_BOX, borderColor: 'transparent', flex: '0 0 auto', paddingTop: 0, paddingBottom: 0 }}>
              <Typography
                variant="body2"
                sx={{ ...COLUMN_PRIORITY, color: (theme: Theme) => theme.palette.text.secondary }}
              >
                {t('sort.thenBy')}
              </Typography>
              <SimpleTooltip disableInteractive title={t('sort.addLevel')}>
                <IconButton
                  size="small"
                  className="sxl-sort-addLevel"
                  aria-label={t('sort.addLevel')}
                  onClick={() => {
                    setLevels((prev: SortLevel[]) => {
                      // Seeded with the first field not already spoken for, so the common case adds
                      // a usable level rather than an immediate duplicate.
                      const used = new Set(prev.map((level) => level.index));
                      const free = fields.offsets.find((offset) => !used.has(offset));
                      return [...prev, { key: newLevelKey(), index: free ?? 0, criteria: {} }];
                    });
                  }}
                >
                  <DynamicIcon iconKey="Insert" />
                </IconButton>
              </SimpleTooltip>
            </Box>
          </Box>
        </Box>

        { refusal !== null ? (
          <Typography
            variant="body2"
            className="sxl-sort-refusal"
            sx={{ color: (theme: Theme) => theme.palette.error.main }}
          >
            {refusal}
          </Typography>
        ) : null }

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: (theme: Theme) => theme.spacing(2),
            // The row wraps, and the orientation control is taller than the checkboxes beside it.
            rowGap: (theme: Theme) => theme.spacing(1.5),
            borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`,
            paddingTop: (theme: Theme) => theme.spacing(1)
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!options.hasHeader}
                onChange={() => setOptions((prev: ISort.RangeOptions) => ({ ...prev, hasHeader: !prev.hasHeader }))}
              />
            }
            label={t('sort.hasHeader')}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={isCaseSensitive(options.collatorOptions)}
                onChange={() => setOptions((prev: ISort.RangeOptions) => ({
                  ...prev,
                  collatorOptions: isCaseSensitive(prev.collatorOptions)
                    ? Sort.CaseInsensitiveOptions
                    : Sort.CaseSensitiveOptions
                }))}
              />
            }
            label={t('sort.caseSensitive')}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={!!options.includeHidden}
                onChange={() => setOptions((prev: ISort.RangeOptions) => ({ ...prev, includeHidden: !prev.includeHidden }))}
              />
            }
            label={t('sort.includeHidden')}
          />
          {/* A float label rather than a `Typography` beside the control: the checkboxes it sits
              among carry their own labels, and a loose caption reads as a different kind of thing. */}
          <FormControl size="small" sx={{ minWidth: '180px' }}>
            <InputLabel id="sxl-sort-orientation-label">{t('sort.orientation')}</InputLabel>
            <Select
              size="small"
              className="sxl-sort-orientation"
              labelId="sxl-sort-orientation-label"
              label={t('sort.orientation')}
              value={axis}
              onChange={(event: SelectChangeEvent<IRange.Axis>) => {
                const newAxis = event.target.value as IRange.Axis;
                /* Only the axis changes. The old code re-seeded every option from the transposed
                   defaults, which silently reset the case-sensitivity choice; the field offsets are
                   clamped below instead, and everything the user set is kept. */
                setOptions((prev: ISort.RangeOptions) => ({ ...prev, axis: newAxis }));
              }}
            >
              <MenuItem value={IRange.Axis.Row}>{t('sort.orientationTopToBottom')}</MenuItem>
              <MenuItem value={IRange.Axis.Column}>{t('sort.orientationLeftToRight')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
    </OptionsDialog>
  );
});

interface SortLevelCardProps {
  level: SortLevel;
  position: number;
  count: number;
  fields: SortFields;
  labelForField: (index: number) => string;
  isRowSort: boolean;
  onChange: (key: string, criteria: Partial<SortLevel>) => void;
  onMoveBy: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * One sort level: its priority label, the field it names, what of that field to compare, and the
 * direction — plus the reorder/duplicate/delete affordances, revealed on hover or focus.
 */
const SortLevelCard = memo((props: SortLevelCardProps) => {
  const {
    level, position, count, fields, labelForField, isRowSort, onChange, onMoveBy, onDuplicate, onDelete
  } = props;

  const t = useTranslator();

  const sortOn = level.criteria.sortOn ?? ISort.SortOn.Value;
  const isDescending = !!level.criteria.reverse;

  /* A level can name a field the menu does not list — one past the render cap, or one left behind by
     an axis flip. Appending it keeps the Select showing a value instead of blanking. */
  const entries = useMemo(() => {
    const retValue = fields.offsets.map((offset: number, at: number) => ({ offset, label: fields.labels[at] }));
    if (!fields.offsets.includes(level.index)) {
      retValue.push({ offset: level.index, label: labelForField(level.index) });
    }
    return retValue;
  }, [fields, level.index, labelForField]);

  /* The label is resolved by the CALLER: `t` is extracted from literal call sites, and a key built
     here from `name` would be invisible to the catalog tooling (which then prunes it). */
  const action = (
    label: string, name: string, iconKey: string, disabled: boolean, onClick: () => void
  ): React.ReactNode => (
    <SimpleTooltip disableInteractive title={label}>
      <div>
        <IconButton
          size="small"
          className={`sxl-sort-${name}`}
          aria-label={label}
          disabled={disabled}
          sx={{ padding: '2px' }}
          onClick={onClick}
        >
          <DynamicIcon style={{ transform: 'scale(0.85)' }} iconKey={iconKey} />
        </IconButton>
      </div>
    </SimpleTooltip>
  );

  return (
    <Box
      sx={{
        ...CARD_BOX,
        '&:hover, &:focus-within': {
          boxShadow: 1,
          '& .sxl-sort-level-actions': { opacity: 1, pointerEvents: 'auto' }
        }
      }}
    >
      <Typography variant="body2" sx={COLUMN_PRIORITY}>
        {position === 0 ? t('sort.sortBy') : t('sort.thenBy')}
      </Typography>

      <Select
        size="small"
        className="sxl-sort-field"
        value={level.index}
        sx={COLUMN_FIELD}
        // The label column heads "Column" for a top-to-bottom sort and "Row" for left-to-right.
        aria-label={isRowSort ? t('sort.column') : t('sort.row')}
        onChange={(event: SelectChangeEvent<number>) => onChange(level.key, { index: Number(event.target.value) })}
      >
        {entries.map((entry) => (
          <MenuItem key={entry.offset} value={entry.offset}>{entry.label}</MenuItem>
        ))}
      </Select>

      <Select
        size="small"
        className="sxl-sort-on"
        value={sortOn}
        sx={COLUMN_SORT_ON}
        aria-label={t('sort.sortOn')}
        onChange={(event: SelectChangeEvent<ISort.SortOn>) => {
          onChange(level.key, { criteria: { ...level.criteria, sortOn: event.target.value as ISort.SortOn } });
        }}
      >
        <MenuItem value={ISort.SortOn.Value}>{t('sort.sortOnValue')}</MenuItem>
        {/* Listed for shape, disabled for truth: the engine compares values only — `sortOn` is
            carried through xlsx but nothing reads it when sorting. */}
        <MenuItem value={ISort.SortOn.FillColor} disabled>
          {t('sort.sortOnFillColor')}
          <Typography variant="caption" sx={{ marginLeft: 1, opacity: 0.7 }}>{t('sort.notSupported')}</Typography>
        </MenuItem>
        <MenuItem value={ISort.SortOn.FontColor} disabled>
          {t('sort.sortOnFontColor')}
          <Typography variant="caption" sx={{ marginLeft: 1, opacity: 0.7 }}>{t('sort.notSupported')}</Typography>
        </MenuItem>
        <MenuItem value={ISort.SortOn.Icon} disabled>
          {t('sort.sortOnIcon')}
          <Typography variant="caption" sx={{ marginLeft: 1, opacity: 0.7 }}>{t('sort.notSupported')}</Typography>
        </MenuItem>
      </Select>

      <Box sx={COLUMN_ORDER}>
        <SimpleTooltip disableInteractive title={isDescending ? t('sort.descending') : t('sort.ascending')}>
          <IconButton
            size="small"
            className="sxl-sort-order"
            aria-label={isDescending ? t('sort.descending') : t('sort.ascending')}
            onClick={() => onChange(level.key, { criteria: { ...level.criteria, reverse: !isDescending } })}
          >
            <DynamicIcon iconKey={isDescending ? 'SortDecrease' : 'SortIncrease'} />
          </IconButton>
        </SimpleTooltip>
      </Box>

      <Box
        className="sxl-sort-level-actions"
        sx={{
          ...COLUMN_ACTIONS,
          /* Faded, never COLLAPSED: taking the width out at rest resized every card under the
             pointer. `pointerEvents` is what keeps the invisible buttons unclickable — a keyboard
             tab into one still reveals the row through `:focus-within`. */
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease'
        }}
      >
        {/* Reordering only exists once there is something to reorder against; a lone level's
            move buttons would be two permanently dead controls. */}
        {count > 1 && action(t('sort.moveUp'), 'moveUp', 'CardMoveUp', position === 0, () => onMoveBy(-1))}
        {count > 1 && action(t('sort.moveDown'), 'moveDown', 'CardMoveDown', position === count - 1, () => onMoveBy(1))}
        {action(t('sort.copyLevel'), 'copyLevel', 'CardDuplicate', false, onDuplicate)}
        {action(t('sort.deleteLevel'), 'deleteLevel', 'Delete', count <= 1, onDelete)}
      </Box>
    </Box>
  );
});

SortLevelCard.displayName = 'SortLevelCard';

export default SortDialog;
