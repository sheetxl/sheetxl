import type React from 'react';
import { memo, useMemo, useState } from 'react';

import {
  Box, List, ListItemButton, ListItemText, MenuItem, Tab, Tabs, TextField, Typography, type Theme
} from '@mui/material';

import { type IPivotTable } from '@sheetxl/sdk';
import { messageKey } from '@sheetxl/utils';
import { useCallbackRef, useTranslator, type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext, type PivotFieldsModel } from '@sheetxl/react';

import { OptionsDialog, type InputDialogProps } from '@sheetxl/utils-mui';

import { NumberFormatPanel } from '../format/NumberFormatPanel';

export interface PivotValueSettingsDialogProps extends InputDialogProps<CommandContext.PivotValueSettings> {}

type Fn = IPivotTable.IDataField.Function;
type Kind = IPivotTable.IDataField.ShowAsKind | 'normal';

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/** Excel's order. */
const FUNCTIONS: readonly Fn[] = [
  'sum', 'count', 'average', 'max', 'min', 'product', 'countNums', 'stdDev', 'stdDevp', 'var', 'varp'
];

/** Literal keys: the extractor cannot see a computed one, and re-extraction would drop it. */
const FUNCTION_KEYS: Record<Fn, string> = {
  sum: messageKey('pivot.function.sum'),
  count: messageKey('pivot.function.count'),
  average: messageKey('pivot.function.average'),
  max: messageKey('pivot.function.max'),
  min: messageKey('pivot.function.min'),
  product: messageKey('pivot.function.product'),
  countNums: messageKey('pivot.function.countNums'),
  stdDev: messageKey('pivot.function.stdDev'),
  stdDevp: messageKey('pivot.function.stdDevp'),
  var: messageKey('pivot.function.var'),
  varp: messageKey('pivot.function.varp')
};

/** Excel's order. */
const KINDS: readonly Kind[] = [
  'normal', 'percentOfTotal', 'percentOfCol', 'percentOfRow', 'percent', 'percentOfParentRow', 'percentOfParentCol',
  'percentOfParent', 'difference', 'percentDiff', 'runTotal', 'percentOfRunningTotal', 'rankAscending',
  'rankDescending', 'index'
];

const KIND_KEYS: Record<Kind, string> = {
  normal: messageKey('pivotValueSettings.kind.normal'),
  percentOfTotal: messageKey('pivotValueSettings.kind.percentOfTotal'),
  percentOfCol: messageKey('pivotValueSettings.kind.percentOfCol'),
  percentOfRow: messageKey('pivotValueSettings.kind.percentOfRow'),
  percent: messageKey('pivotValueSettings.kind.percent'),
  percentOfParentRow: messageKey('pivotValueSettings.kind.percentOfParentRow'),
  percentOfParentCol: messageKey('pivotValueSettings.kind.percentOfParentCol'),
  percentOfParent: messageKey('pivotValueSettings.kind.percentOfParent'),
  difference: messageKey('pivotValueSettings.kind.difference'),
  percentDiff: messageKey('pivotValueSettings.kind.percentDiff'),
  runTotal: messageKey('pivotValueSettings.kind.runTotal'),
  percentOfRunningTotal: messageKey('pivotValueSettings.kind.percentOfRunningTotal'),
  rankAscending: messageKey('pivotValueSettings.kind.rankAscending'),
  rankDescending: messageKey('pivotValueSettings.kind.rankDescending'),
  index: messageKey('pivotValueSettings.kind.index')
};

/** The kinds that read across a base field. */
const WITH_FIELD: ReadonlySet<Kind> = new Set<Kind>([
  'percent', 'percentOfParent', 'difference', 'percentDiff', 'runTotal', 'percentOfRunningTotal', 'rankAscending',
  'rankDescending'
]);
/** The kinds that also compare with an item of it. */
const WITH_ITEM: ReadonlySet<Kind> = new Set<Kind>(['percent', 'difference', 'percentDiff']);

/** As the SDK spells them: a value's neighbor rather than a fixed item. */
const PREVIOUS = '(previous)';
const NEXT = '(next)';

type SettingsTab = 'function' | 'showAs' | 'numberFormat';

const sameShowAs = (a: IPivotTable.IDataField.ShowAs | null, b: IPivotTable.IDataField.ShowAs | null): boolean =>
  (a?.kind ?? null) === (b?.kind ?? null) && a?.baseField === b?.baseField && a?.baseItem === b?.baseItem;

/**
 * Excel's Value Field Settings: a value's caption, its function, how it is shown and its number
 * format. A chip's *Value settings…* opens it, and its `onInput` hands back what changed.
 *
 * @remarks
 * The caption follows the function picked, as Excel's does, until it is typed over.
 */
export const PivotValueSettingsDialog = memo<PivotValueSettingsDialogProps>((props: PivotValueSettingsDialogProps) => {
  const {
    initialValue,
    onOption,
    onValidateOption,
    onInput,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();
  const value = initialValue!.value;

  const initial = useMemo(() => ({
    name: value.getName(),
    fn: value.getFunction(),
    showAs: value.getShowAs(),
    numberFormat: value.getNumberFormat()
  }), [value]);
  const fields = useMemo(
    (): readonly IPivotTable.IField[] => value.getPivotTable().getFields(),
    [value]
  );

  const [tab, setTab] = useState<SettingsTab>('function');
  const [name, setName] = useState<string>(initial.name);
  const [nameTyped, setNameTyped] = useState(false);
  const [fn, setFn] = useState<Fn>(initial.fn);
  const [kind, setKind] = useState<Kind>(initial.showAs?.kind ?? 'normal');
  const [baseField, setBaseField] = useState<string>(initial.showAs?.baseField ?? fields[0]?.getName() ?? '');
  const [baseItem, setBaseItem] = useState<string>(initial.showAs?.baseItem ?? PREVIOUS);
  const [numberFormat, setNumberFormat] = useState<string>(initial.numberFormat);
  const [formatTyped, setFormatTyped] = useState(false);

  const items = useMemo((): string[] => {
    const field = fields.find((each) => each.getName() === baseField);
    return field ? field.getItems().map((item) => item.getName()) : [];
  }, [fields, baseField]);

  const pickFunction = (next: Fn): void => {
    setFn(next);
    if (!nameTyped) setName(value.getCaptionFor(next));
  };

  const changes = (): PivotFieldsModel.ValueSettings => {
    const showAs: IPivotTable.IDataField.ShowAs | null = kind === 'normal' ? null : {
      kind,
      ...(WITH_FIELD.has(kind) ? { baseField } : {}),
      ...(WITH_ITEM.has(kind) ? { baseItem } : {})
    };
    const trimmed = name.trim();
    return {
      ...(fn !== initial.fn ? { function: fn } : {}),
      ...(!sameShowAs(showAs, initial.showAs) ? { showAs } : {}),
      ...(formatTyped && numberFormat !== initial.numberFormat ? { numberFormat } : {}),
      ...(nameTyped && trimmed && trimmed !== value.getCaptionFor(fn) ? { name: trimmed } : {})
    };
  };

  const handleInput = useCallbackRef(async (option: OptionInput) => {
    const isCancel = option === cancelOption;
    if (!isCancel) onInput?.({ value, changes: changes() }, option);
    onOption?.(option, isCancel, option === defaultOption);
    onDone?.();
  }, [onInput, onDone, onOption, cancelOption, defaultOption, value, fn, kind, baseField, baseItem, numberFormat, formatTyped, name, nameTyped]);

  return (
    <OptionsDialog
      title={t('pivotValueSettings.title')}
      options={options}
      onDone={onDone}
      onOption={(option: OptionInput) => handleInput(option)}
      onValidateOption={onValidateOption}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus input'}
      sx={{
        width: '440px',
        ...propSx
      }}
      {...rest}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: (theme: Theme) => theme.spacing(1.5) }}>
        <Typography variant="body2" className="pivot-source-name">
          {t('pivotValueSettings.sourceName', { name: value.getField().getName() })}
        </Typography>
        <TextField
          className="autoFocus"
          size="small"
          label={t('pivotValueSettings.customName')}
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setName(e.target.value); setNameTyped(true); }}
        />
        <Tabs
          value={tab}
          onChange={(_, next: SettingsTab) => setTab(next)}
          // As the conditional-format pane's tabs: the words as written, not shouted.
          sx={{
            minHeight: '36px',
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: '36px', textTransform: 'none', pt: 0.5, pb: 0.5, px: 1.5, minWidth: 0 }
          }}
        >
          <Tab value="function" label={t('pivotValueSettings.tabFunction')} />
          <Tab value="showAs" label={t('pivotValueSettings.tabShowAs')} />
          <Tab value="numberFormat" label={t('pivotValueSettings.tabNumberFormat')} />
        </Tabs>
        {/* One height for every tab, so the dialog doesn't jump. */}
        <Box sx={{ height: '300px', overflow: 'auto' }}>
          {tab === 'function' ? (
            <List dense disablePadding role="listbox" aria-label={t('pivotValueSettings.tabFunction')} className="pivot-functions">
              {FUNCTIONS.map((each) => (
                <ListItemButton
                  key={each}
                  role="option"
                  aria-selected={each === fn}
                  selected={each === fn}
                  onClick={() => pickFunction(each)}
                  onDoubleClick={() => { pickFunction(each); void handleInput(defaultOption); }}
                >
                  <ListItemText primary={t(FUNCTION_KEYS[each])} />
                </ListItemButton>
              ))}
            </List>
          ) : null}
          {tab === 'showAs' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: (theme: Theme) => theme.spacing(2), pt: 1 }}>
              <TextField
                select
                size="small"
                className="pivot-show-as"
                label={t('pivotValueSettings.showAs')}
                value={kind}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKind(e.target.value as Kind)}
              >
                {KINDS.map((each) => <MenuItem key={each} value={each}>{t(KIND_KEYS[each])}</MenuItem>)}
              </TextField>
              <TextField
                select
                size="small"
                className="pivot-base-field"
                label={t('pivotValueSettings.baseField')}
                value={baseField}
                disabled={!WITH_FIELD.has(kind)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setBaseField(e.target.value); setBaseItem(PREVIOUS); }}
              >
                {fields.map((each) => <MenuItem key={each.getName()} value={each.getName()}>{each.getName()}</MenuItem>)}
              </TextField>
              <TextField
                select
                size="small"
                className="pivot-base-item"
                label={t('pivotValueSettings.baseItem')}
                value={baseItem}
                disabled={!WITH_ITEM.has(kind)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseItem(e.target.value)}
              >
                <MenuItem value={PREVIOUS}>{t('pivotValueSettings.previous')}</MenuItem>
                <MenuItem value={NEXT}>{t('pivotValueSettings.next')}</MenuItem>
                {items.map((each) => <MenuItem key={each} value={each}>{each}</MenuItem>)}
              </TextField>
            </Box>
          ) : null}
          {tab === 'numberFormat' ? (
            <NumberFormatPanel
              value={numberFormat}
              onChange={(code: string) => { setNumberFormat(code); setFormatTyped(true); }}
              onCommit={() => { void handleInput(defaultOption); }}
            />
          ) : null}
        </Box>
      </Box>
    </OptionsDialog>
  );
});

PivotValueSettingsDialog.displayName = 'PivotValueSettingsDialog';

export default PivotValueSettingsDialog;
