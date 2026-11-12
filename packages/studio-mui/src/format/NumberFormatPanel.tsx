import React, {
  memo, forwardRef, useEffect, useState
} from 'react';

import clsx from 'clsx';

import { type Theme, type SxProps } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControl } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { InputLabel } from '@mui/material';
import { List } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemText } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';
import { TextField } from '@mui/material';
import { Typography } from '@mui/material';

import { type ICell, NumberFormat } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type TranslateFn } from '@sheetxl/utils-react';

import {
  SelectedIcon, ExhibitMenuItem, ExhibitPopupIconButton, defaultRenderPopupPanel,
  type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { NumberFormatQuickButtons } from '../command/NumberFormatQuickButtons';

import { onReselect, FormatNumberField, FormatSection } from './FormatPanelParts';
import { NumberFormatOption, numberFormatCategoryLabel } from './NumberFormatOption';

const { Builder } = NumberFormat;
type Category = NumberFormat.Category;
type Params = NumberFormat.BuilderParams;

export interface NumberFormatPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** The current format code (controlled). */
  value: string;
  /** Called with the new format code whenever the user changes a control. */
  onChange: (code: string) => void;
  /**
   * Optional accessor for the cell whose value drives the live preview
   * (and the workbook date-system/locale). Falls back to a category sample.
   */
  context?: () => ICell | null;
  /**
   * Called when the user presses Enter (so a hosting dialog can commit/close).
   * Not used in a task pane, where the panel applies live.
   */
  onCommit?: () => void;
  /**
   * Drop the panel's own sample line.
   *
   * @remarks
   * For a host that already shows the formatted cell — the format task pane's shared preview —
   * where a second sample of the same value is noise.
   */
  hideSample?: boolean;
  /**
   * Show the one-click formats — accounting, percent, comma, and the decimal nudges — above the
   * category.
   *
   * @remarks
   * Off by default because they are commands: they format the SELECTION rather than routing
   * through `onChange`, so a host whose target is something else (a dialog editing a style, a
   * preview) must leave them out.
   *
   * @defaultValue false
   */
  showQuickFormats?: boolean;
  /** Disable all controls. */
  disabled?: boolean;
}

/** Compact list-item styling (denser than MUI's default menu heights). */
const denseItemSx: SxProps<Theme> = {
  py: '2px',
  px: 1,
  minHeight: 0,
  '& .MuiListItemText-root': { my: 0 },
  '& .MuiListItemText-primary': { fontSize: '0.8125rem', lineHeight: 1.5 },
  '& .MuiListItemText-secondary': { fontSize: '0.7rem', lineHeight: 1.3 }
};

const boxedListSx: SxProps<Theme> = {
  border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
  borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
  overflow: 'auto',
  // The panel no longer sits in a fixed-height frame (the category list that set that height is a
  // dropdown now), so the preset lists cap themselves rather than growing to their content.
  maxHeight: 260
};

/** Labels for list-category preset codes that read poorly as raw codes (keyed by format code). */
const fractionLabels = (t: TranslateFn): Record<string, string> => ({
  '# ?/?': t('numberFormat.fractionOneDigit'),
  '# ??/??': t('numberFormat.fractionTwoDigits'),
  '# ???/???': t('numberFormat.fractionThreeDigits'),
  '# ?/2': t('numberFormat.fractionHalves'),
  '# ?/4': t('numberFormat.fractionQuarters'),
  '# ?/8': t('numberFormat.fractionEighths'),
  '# ??/16': t('numberFormat.fractionSixteenths'),
  '# ?/10': t('numberFormat.fractionTenths'),
  '# ??/100': t('numberFormat.fractionHundredths')
});
const specialLabels = (t: TranslateFn): Record<string, string> => ({
  '00000': t('numberFormat.specialZip'),
  '00000-0000': t('numberFormat.specialZip4'),
  '[<=9999999]###-####;(###) ###-####': t('numberFormat.specialPhone'),
  '000-00-0000': t('numberFormat.specialSsn')
});

/** Localized fallback label for a negative-number style (shown only when the sample fails to format). */
function negativeStyleLabel(t: TranslateFn, key: string, canonical: string): string {
  switch (key) {
    case 'minus': return t('numberFormat.negMinus');
    case 'red': return t('numberFormat.negRed');
    case 'parens': return t('numberFormat.negParens');
    case 'redParens': return t('numberFormat.negRedParens');
    default: return canonical;
  }
}

/** A sample value appropriate for previewing a category. `textSample` is the localized placeholder. */
function sampleFor(category: Category, cell: ICell | null, textSample: string): number | string {
  const cellVal = cell?.getValue();
  if (category === 'Text') return typeof cellVal === 'string' ? cellVal : textSample;
  if (category === 'Date' || category === 'Time') {
    return typeof cellVal === 'number' ? cellVal : 45658.625; // 2025-01-01 15:00
  }
  return typeof cellVal === 'number' ? cellVal : 1234.56;
}

/** Render a value with a format code, using the cell context when available. */
function formatSample(code: string, value: number | string, cell: ICell | null): string {
  try {
    if (cell) {
      return cell.createCell({ value, style: { numberFormat: code } })
        .getNumberFormat().displayText || '';
    }
    return NumberFormat.getEngine().format(code, value as any, {}).text ?? '';
  } catch {
    return '';
  }
}

function sampleAbsNumber(sample: number | string): number {
  return typeof sample === 'number' ? Math.abs(sample) : 1234.56;
}

/**
 * Standalone Excel-like "Format Cells → Number" panel: a category list plus
 * per-category controls that synthesize an Excel format code (via
 * {@link NumberFormat.Builder}). Controlled by `value`/`onChange` so it can be
 * dropped into a dialog, a task pane, or a larger format dialog unchanged.
 */
export const NumberFormatPanel = memo(forwardRef<HTMLDivElement, NumberFormatPanelProps>((
  props: NumberFormatPanelProps,
  refForwarded
) => {
  const {
    value,
    onChange,
    context,
    onCommit,
    hideSample = false,
    showQuickFormats = false,
    disabled = false,
    className: propClassName,
    onKeyDown: propOnKeyDown,
    ...rest
  } = props;

  const t = useTranslator();
  const [params, setParams] = useState<Params>(() => Builder.parse(value));

  // Re-sync when the code changes from outside (not from our own build()).
  useEffect(() => {
    if (Builder.build(params) !== value) {
      setParams(Builder.parse(value));
    }
  }, [value]);

  const cell = context?.() ?? null;

  const commit = useCallbackRef((next: Params) => {
    setParams(next);
    onChange(Builder.build(next));
  }, [onChange]);

  const patch = useCallbackRef((delta: Partial<Params>) => {
    commit({ ...params, ...delta });
  }, [params, commit]);

  // The code exactly as shown, for a dropdown pick that changes nothing here (see `onReselect`).
  const reapply = useCallbackRef(() => {
    onChange(value);
  }, [onChange, value]);

  const changeCategory = useCallbackRef((category: Category) => {
    if (category === params.category) return;
    const defaultCode = Builder.defaultCodeForCategory(category);
    const next: Params = Builder.isParametricCategory(category)
      ? Builder.parse(defaultCode)
      : { category, code: defaultCode };
    commit(next);
  }, [params.category, commit]);

  // Enter commits the hosting dialog. We do NOT gate on isDefaultPrevented:
  // MUI's ButtonBase (the list items) calls preventDefault() on Enter to fire
  // its own click, so gating there would swallow the commit.
  const handleKeyDown = useCallbackRef((e: React.KeyboardEvent<HTMLDivElement>) => {
    propOnKeyDown?.(e);
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Let the symbol Select and the category popup (portaled, but still in this React tree) handle Enter.
      if (target.closest('[role="combobox"], [role="menuitem"]')) return;
      e.preventDefault();
      e.stopPropagation();
      onCommit?.();
    }
  }, [propOnKeyDown, onCommit]);

  // Up/Down/Home/End roving nav for the (plain MUI) List widgets, which have no
  // built-in keyboard navigation. Moves selection live and follows with focus.
  const listArrowHandler = (
    count: number,
    currentIndex: number,
    onIndex: (index: number) => void
  ) => (e: React.KeyboardEvent<HTMLElement>) => {
    let next = currentIndex;
    switch (e.key) {
      case 'ArrowDown': next = Math.min(count - 1, currentIndex + 1); break;
      case 'ArrowUp': next = Math.max(0, currentIndex - 1); break;
      case 'Home': next = 0; break;
      case 'End': next = count - 1; break;
      default: return;
    }
    e.preventDefault();
    if (next !== currentIndex && next >= 0) onIndex(next);
    const buttons = e.currentTarget.querySelectorAll<HTMLElement>('.MuiListItemButton-root');
    buttons[next]?.focus();
  };

  const category = params.category;
  const previewValue = sampleFor(category, cell, t('numberFormat.sampleText'));
  const preview = formatSample(value, previewValue, cell);

  // What a category's row shows under its name: the code in effect for the category the panel is
  // on, and the code a pick would seed for the rest. Custom seeds `General`, which under the name
  // "Custom" would read as a lie, so it samples only while it IS the category.
  const optionSample = (option: Category): string => {
    if (option === 'Custom' && option !== category) return '';
    const code = option === category ? value : Builder.defaultCodeForCategory(option);
    return formatSample(code, sampleFor(option, cell, t('numberFormat.sampleText')), cell);
  };

  // A pick of the category already shown still reapplies (see `onReselect`).
  const pickCategory = (cat: Category) => {
    if (cat === category) reapply();
    else changeCategory(cat);
  };

  const createCategoryPanel = (props: ExhibitPopupPanelProps) => {
    const { closeFloatAll } = props;
    const items = Builder.CATEGORIES.map((cat) => {
      const selected = cat === category;
      const pick = () => {
        pickCategory(cat);
        closeFloatAll?.();
      };
      return (
        <ExhibitMenuItem
          key={cat}
          selected={selected}
          // Unselected rows keep SelectedIcon's (transparent) border so every label starts in one column.
          icon={<SelectedIcon selected={selected}>{selected ? undefined : null}</SelectedIcon>}
          sx={{ display: 'flex' }}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); }}
          onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0) return; pick(); }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') pick();
          }}
        >
          <NumberFormatOption
            label={numberFormatCategoryLabel(t, cat)}
            sample={optionSample(cat)}
          />
        </ExhibitMenuItem>
      );
    });
    return defaultRenderPopupPanel({
      ...props,
      children: <Box sx={{ overflow: 'auto', flex: '1 1 100%' }}>{items}</Box>
    });
  };

  // ---- shared control fragments ---------------------------------------------

  const decimalsControl = (
    <FormatNumberField
      label={t('numberFormat.decimalPlaces')}
      disabled={disabled}
      value={params.decimalPlaces ?? 0}
      min={0}
      max={30}
      width={140}
      onChange={(decimalPlaces: number) => patch({ decimalPlaces })}
    />
  );

  const currencySymbol = params.currencySymbol ?? '$';
  const symbolControl = (
    <FormControl size="small" sx={{ width: 140 }}>
      <InputLabel shrink>{t('numberFormat.symbol')}</InputLabel>
      <Select
        label={t('numberFormat.symbol')}
        notched
        disabled={disabled}
        value={currencySymbol}
        onChange={(e) => patch({ currencySymbol: e.target.value })}
      >
        {Builder.CURRENCY_SYMBOLS.map((s) => (
          <MenuItem key={s} value={s} onClick={onReselect(currencySymbol, s, reapply)}>{s}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  const separatorControl = (
    <FormControlLabel
      sx={{ alignSelf: 'center' }}
      control={
        <Checkbox
          size="small"
          disabled={disabled}
          checked={!!params.useSeparator}
          onChange={(e) => patch({ useSeparator: e.target.checked })}
        />
      }
      label={t('numberFormat.useSeparator')}
    />
  );

  const negativeStylesControl = (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
      <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>{t('numberFormat.negativeNumbers')}</Typography>
      <List
        dense
        disablePadding
        sx={{ ...boxedListSx, flex: '1 1 auto' }}
        onKeyDown={listArrowHandler(
          Builder.NEGATIVE_STYLES.length,
          params.negativeStyle ?? 0,
          (i) => patch({ negativeStyle: i })
        )}
      >
        {Builder.NEGATIVE_STYLES.map((style, i) => {
          const sampleCode = Builder.build({ ...params, negativeStyle: i });
          const sample = formatSample(sampleCode, -sampleAbsNumber(previewValue), cell);
          return (
            <ListItemButton
              key={style.key}
              disabled={disabled}
              selected={(params.negativeStyle ?? 0) === i}
              onClick={() => patch({ negativeStyle: i })}
              sx={denseItemSx}
            >
              <ListItemText
                primary={sample || negativeStyleLabel(t, style.key, style.label)}
                slotProps={{ primary: { noWrap: true, sx: { color: style.red ? 'error.main' : undefined, fontVariantNumeric: 'tabular-nums' } } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  const presetListControl = (presets: readonly string[], labels?: Record<string, string>) => (
    <List
      dense
      disablePadding
      sx={{ ...boxedListSx, flex: '1 1 auto' }}
      onKeyDown={listArrowHandler(
        presets.length,
        presets.indexOf(value),
        (i) => commit({ category, code: presets[i] })
      )}
    >
      {presets.map((code) => (
        <ListItemButton
          key={code}
          disabled={disabled}
          selected={value === code}
          onClick={() => commit({ category, code })}
          sx={denseItemSx}
        >
          <ListItemText
            primary={labels?.[code] ?? formatSample(code, previewValue, cell) ?? code}
            secondary={labels ? code : undefined}
            slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
          />
        </ListItemButton>
      ))}
    </List>
  );

  const customControl = (
    <TextField
      label={t('numberFormat.typeCode')}
      size="small"
      fullWidth
      disabled={disabled}
      value={value}
      error={!!value && !NumberFormat.Parser.isValidFormat(value)}
      helperText={!!value && !NumberFormat.Parser.isValidFormat(value) ? t('numberFormat.invalidCode') : ' '}
      onChange={(e) => commit({ category: 'Custom', code: e.target.value })}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { spellCheck: false, autoComplete: 'off' } }}
    />
  );

  const wrapRow = (children: React.ReactNode) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>{children}</Box>
  );

  // ---- per-category right pane ----------------------------------------------

  let rightPane: React.ReactNode;
  switch (category) {
    case 'General':
      rightPane = <Typography variant="body2">{t('numberFormat.generalInfo')}</Typography>;
      break;
    case 'Number':
      rightPane = <>{wrapRow(<>{decimalsControl}{separatorControl}</>)}{negativeStylesControl}</>;
      break;
    case 'Currency':
      rightPane = <>{wrapRow(<>{decimalsControl}{symbolControl}</>)}{negativeStylesControl}</>;
      break;
    case 'Accounting':
      rightPane = <>{wrapRow(<>{decimalsControl}{symbolControl}</>)}
        <Typography variant="caption" color="text.secondary">{t('numberFormat.accountingInfo')}</Typography>
      </>;
      break;
    case 'Percentage':
    case 'Scientific':
      rightPane = decimalsControl;
      break;
    case 'Date':
      rightPane = presetListControl(Builder.DATE_PRESETS);
      break;
    case 'Time':
      rightPane = presetListControl(Builder.TIME_PRESETS);
      break;
    case 'Fraction':
      rightPane = presetListControl(Builder.FRACTION_PRESETS, fractionLabels(t));
      break;
    case 'Special':
      rightPane = presetListControl(Builder.SPECIAL_PRESETS, specialLabels(t));
      break;
    case 'Text':
      rightPane = <Typography variant="body2">{t('numberFormat.textInfo')}</Typography>;
      break;
    case 'Custom':
      rightPane = <>{customControl}{presetListControl(Builder.DATE_PRESETS.concat(Builder.TIME_PRESETS as string[]))}</>;
      break;
    default:
      rightPane = null;
  }

  return (
    <Box
      ref={refForwarded}
      className={clsx('sxl-number-format-panel', propClassName)}
      onKeyDown={handleKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}
      {...rest}
    >
      {hideSample ? null : (
        <Box>
          <Typography variant="caption" component="div" sx={{ pl: 0.5 }}>{t('numberFormat.sample')}</Typography>
          <Typography
            variant="body1"
            component="div"
            sx={{
              borderRadius: (theme: Theme) => `${theme.shape.borderRadius}px`,
              padding: (theme: Theme) => theme.spacing(1),
              border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
              minHeight: '1.6em',
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {preview || ' '}
          </Typography>
        </Box>
      )}

      {showQuickFormats ? (
        <NumberFormatQuickButtons
          disabled={disabled}
          // Left, and given room below: pressed against the Category field they read as a caption
          // for it rather than as a strip of buttons.
          sx={{ justifyContent: 'flex-start', paddingBottom: 1 }}
        />
      ) : null}

      {/* Category, then the controls that category needs.

          A dropdown rather than Excel's tall side list: the panel has to fit a task pane a few
          hundred pixels wide, and a twelve-item list spent that width on names the user reads once.
          Stacking category over options also lets the per-category controls (and the preset lists,
          which are the tall ones) use the full width.

          The ribbon's popup rather than a MUI `Select`, like the Font tab's family picker: a
          `Select` menu takes MUI's surface and icon colors, not the toolbar's, so the same rows
          would look different here than in the ribbon's number-format popup. */}
      <FormatSection
        label={t('numberFormat.category')}
        // Clear of the category's controls below, whose outlined fields float their labels upward.
        sx={{ marginBottom: 0.5 }}
      >
        <ExhibitPopupIconButton
          outlined
          disabled={disabled}
          sx={{ width: '100%' }}
          renderPopupPanel={createCategoryPanel}
          icon={
            <Box
              sx={{
                display: 'flex',
                flex: '1 1 100%',
                minWidth: 0,
                paddingLeft: '4px',
                paddingRight: '4px',
                fontSize: (theme: Theme) => `${Math.round(theme.typography.fontSize)}px`,
                lineHeight: 1.2,
                fontFamily: (theme: Theme) => theme.typography.fontFamily,
                color: (theme: Theme) => theme.palette.text.secondary
              }}
            >
              <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre' }}>
                {numberFormatCategoryLabel(t, category)}
              </Box>
            </Box>
          }
        />
      </FormatSection>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0
        }}
      >
        {rightPane}
      </Box>
    </Box>
  );
}));

NumberFormatPanel.displayName = 'NumberFormatPanel';

export default NumberFormatPanel;
