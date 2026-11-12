import type React from 'react';
import { memo } from 'react';

import {
  Box, MenuItem, Select, TextField, Typography
} from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IConditionalFormat, type IColor, type ICalculation } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { ColorPopupButton } from '../color';
import { FormulaField } from '../form';
import { useFormulaOption } from '../conditions/useFormulaOption';

import { usePreviewColors } from './previewColor';

const TYPE_MESSAGE_KEYS: Record<IConditionalFormat.ColorStopType, string> = {
  [IConditionalFormat.ColorStopType.AutoMin]: messageKey('conditionalFormat.stopType.autoMin'),
  [IConditionalFormat.ColorStopType.AutoMax]: messageKey('conditionalFormat.stopType.autoMax'),
  [IConditionalFormat.ColorStopType.Min]: messageKey('conditionalFormat.stopType.min'),
  [IConditionalFormat.ColorStopType.Max]: messageKey('conditionalFormat.stopType.max'),
  [IConditionalFormat.ColorStopType.Num]: messageKey('conditionalFormat.stopType.num'),
  [IConditionalFormat.ColorStopType.Percent]: messageKey('conditionalFormat.stopType.percent'),
  [IConditionalFormat.ColorStopType.Percentile]: messageKey('conditionalFormat.stopType.percentile'),
  [IConditionalFormat.ColorStopType.Formula]: messageKey('conditionalFormat.stopType.formula')
};

/** The stop types that carry no user value — the range's own extents. */
const VALUELESS = new Set<IConditionalFormat.ColorStopType>([
  IConditionalFormat.ColorStopType.AutoMin,
  IConditionalFormat.ColorStopType.AutoMax,
  IConditionalFormat.ColorStopType.Min,
  IConditionalFormat.ColorStopType.Max
]);

export interface ScaleStopRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A short leading label for the row — `Minimum`, `Midpoint`, … A row whose `leading` control
   * already says which band it is (an icon set's icon button) has none.
   */
  label?: string;
  stop: IConditionalFormat.Stop | IConditionalFormat.ColorScaleStop;
  onStopChange: (stop: IConditionalFormat.Stop | IConditionalFormat.ColorScaleStop) => void;
  /**
   * The stop types this row may switch between, in menu order.
   */
  allowedTypes: readonly IConditionalFormat.ColorStopType[];
  /**
   * Show the color well (color scales only).
   */
  showColor?: boolean;
  /**
   * A control drawn after the label, where the color well sits — an icon set puts the band's
   * icon button here.
   */
  leading?: React.ReactNode;
  /**
   * Show the `>` / `>=` bound picker (icon sets; maps to {@link IConditionalFormat.Stop.exclusive}).
   */
  showExclusive?: boolean;
  readOnly?: boolean;
}

/**
 * One threshold of a scale rule: `[label] [color?] [type] [value]`.
 *
 * @remarks
 * The color well sits next to the label rather than at the end of the row because it is the one
 * control here that is always live — the value field goes dead whenever the type is an extent the
 * range decides (`Min`, `Max`, `Automatic`), and a row should not lead with a control that may be
 * dead.
 */
export const ScaleStopRow = memo<ScaleStopRowProps>((props) => {
  const {
    label,
    stop,
    onStopChange,
    allowedTypes,
    showColor = false,
    leading,
    showExclusive = false,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();
  const { darkMode, toColor, propsColorPanel } = usePreviewColors();
  const formulas = useFormulaOption();

  const type = stop.type ?? IConditionalFormat.ColorStopType.Num;
  const hasValue = !VALUELESS.has(type);
  const valueDisabled = readOnly || !hasValue;
  const isFormula = type === IConditionalFormat.ColorStopType.Formula;
  const valueFormula = (stop.value as ICalculation.IFormula | undefined)?.isIFormula ? stop.value as ICalculation.IFormula : null;

  const color = (stop as IConditionalFormat.ColorScaleStop).color;
  const colorModel: IColor | null = showColor ? toColor(color) : null;

  const handleType = (newType: IConditionalFormat.ColorStopType): void => {
    const next = { ...stop, type: newType };
    if (VALUELESS.has(newType)) {
      delete next.value;
    } else if (next.value === undefined) {
      // A sensible seed per type, so the row is valid the moment it changes kind.
      next.value = newType === IConditionalFormat.ColorStopType.Formula ? '' : 0;
    } else if (newType !== IConditionalFormat.ColorStopType.Formula && typeof next.value !== 'number') {
      const parsed = typeof next.value === 'string' ? Number(next.value) : Number.NaN;
      next.value = Number.isFinite(parsed) ? parsed : 0;
    }
    onStopChange(next);
  };

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      {...rest}
    >
      {label !== undefined && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', flex: '0 0 62px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {label}
        </Typography>
      )}
      {leading}
      {showColor && (
        <ColorPopupButton
          tooltip={t('conditionalFormat.stopColor')}
          selectedColor={colorModel!}
          disabled={readOnly}
          onSelectColor={(picked) => {
            if (!picked) return;
            onStopChange({ ...stop, color: picked.toString() } as IConditionalFormat.ColorScaleStop);
          }}
          darkMode={darkMode}
          propsPanel={{ disableAlpha: true, ...propsColorPanel }}
        />
      )}
      {showExclusive && (
        <Select
          size="small"
          value={stop.exclusive ? 'gt' : 'gte'}
          disabled={readOnly}
          onChange={(e) => {
            const next = { ...stop };
            if (e.target.value === 'gt') next.exclusive = true;
            else delete next.exclusive;
            onStopChange(next);
          }}
          sx={{ flex: '0 0 auto', backgroundColor: 'background.paper' }}
        >
          <MenuItem value="gte">{'>='}</MenuItem>
          <MenuItem value="gt">{'>'}</MenuItem>
        </Select>
      )}
      <Select
        size="small"
        value={type}
        disabled={readOnly}
        onChange={(e) => handleType(e.target.value as IConditionalFormat.ColorStopType)}
        sx={{ flex: '1 1 40%', minWidth: 0, backgroundColor: 'background.paper' }}
      >
        {allowedTypes.map((allowed) => (
          <MenuItem key={allowed} value={allowed}>
            {t(TYPE_MESSAGE_KEYS[allowed])}
          </MenuItem>
        ))}
      </Select>
      {/* A `Formula` stop deserves the formula editor — reference picking, token coloring, an error
          outline — not a text box. The two swap on the TYPE, which is an explicit menu choice, so
          the field is never exchanged out from under someone mid-keystroke. */}
      {isFormula ? (
        <FormulaField
          size="small"
          home={formulas.home}
          // Typed in the editing locale and handed back compiled, so the stop stores it canonical; an
          // in-progress formula still carries the user's keystrokes.
          value={valueFormula ? formulas.display(valueFormula) : `${stop.value ?? ''}`}
          onChangeText={(text: string) => {
            onStopChange({ ...stop, value: text.trim().length > 0 ? formulas.compile(text) : text });
          }}
          placeholder={t('conditionalFormat.enterFormula')}
          disabled={valueDisabled}
          // The stored cfvo expression carries no `=` on the wire, and the field reads the same way.
          equals="bare"
          // A stop is resolved ONCE for the whole rule, so a relative reference does not mean what
          // pointing at a cell looks like it means.
          pickAs="absolute"
          // Fully compact: the row's own Select already says "Formula", and no reserved helper line
          // — so the field centers against its siblings. An invalid formula still outlines.
          label={null}
          showError={false}
          helperText={null}
          sx={{
            flex: '1 1 30%',
            minWidth: 0,
            // The same paper the row's Select and number box sit on. Reached by selector rather
            // than `slotProps`, which this field spreads onto its FormControl, not its input —
            // the inner slots are its own (the coloring overlay measures them).
            '& .MuiInputBase-root': {
              backgroundColor: valueDisabled ? 'action.disabledBackground' : 'background.paper'
            }
          }}
        />
      ) : (
        /* An extent the range decides carries no value to type. A paper-white empty box reads as an
           input waiting for a click, so a dead one is recessed and says why. */
        <TextField
          size="small"
          type="number"
          placeholder={!hasValue ? t('conditionalFormat.stopFromData') : undefined}
          value={hasValue ? `${stop.value ?? ''}` : ''}
          disabled={valueDisabled}
          onChange={(e) => {
            const raw = e.target.value;
            onStopChange({ ...stop, value: raw === '' ? 0 : Number(raw) });
          }}
          sx={{ flex: '1 1 30%', minWidth: 0, cursor: valueDisabled ? 'not-allowed' : undefined }}
          slotProps={{
            input: {
              sx: {
                backgroundColor: valueDisabled ? 'action.disabledBackground' : 'background.paper',
                cursor: valueDisabled ? 'not-allowed' : undefined
              }
            }
          }}
        />
      )}
    </Box>
  );
});

ScaleStopRow.displayName = 'ScaleStopRow';
