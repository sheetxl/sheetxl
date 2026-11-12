import type React from 'react';
import { memo, useRef } from 'react';

import { type Theme, type SxProps } from '@mui/material';
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { InputField } from '../form/InputField';

import { type FormatSelection } from './useFormatSelection';

/**
 * What every tab of the format pane takes: the live selection, and nothing else.
 *
 * @remarks
 * Each panel is a standalone component — drop it in a dialog or an inspector by handing it a
 * {@link FormatSelection} of your own. They apply live (no OK button), matching Excel Online.
 */
export interface FormatPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The live selection the panel reads and writes. */
  selection: FormatSelection;
  /** Force every control off, on top of the selection's own {@link FormatSelection.disabled}. */
  disabled?: boolean;
}

/**
 * An `onClick` for a `MenuItem` inside a MUI `Select`: what to do when the item picked is the one
 * the dropdown already shows.
 *
 * @remarks
 * `Select` fires `onChange` only for a DIFFERENT value. But the pane shows the ANCHOR cell's format,
 * and the rest of a multi-cell selection need not match it — so picking *Accounting* over an anchor
 * that is already Accounting is a request to make the whole selection so, not a no-op. `Select`
 * runs an item's own `onClick` before deciding whether anything changed, which makes it the hook
 * for that case.
 */
export const onReselect = <T,>(shown: T, item: T, apply: () => void) => (): void => {
  if (item === shown) apply();
};

export interface FormatNumberFieldProps {
  label: string;
  /** The committed value — the anchor cell's. */
  value: number;
  min: number;
  max: number;
  /** The spinner's increment. Default `1`. */
  step?: number;
  /** Accept fractions (a line width in points). Default: whole numbers only. */
  decimals?: boolean;
  /** Width in px. These sit in rows beside buttons, not in a form column. */
  width: number;
  disabled?: boolean;
  /** A value to apply — typed, stepped, or re-committed with Enter. Already clamped to `min…max`. */
  onChange: (value: number) => void;
}

/**
 * A number field for the format pane: an {@link InputField} with a numeric input, no helper
 * line, and a commit on Enter.
 *
 * @remarks
 * A plain controlled `TextField` applied on every keystroke but could not apply what it already
 * showed — typing the value on display fires no change event — and the pane shows the ANCHOR cell's
 * value while the rest of the selection may differ (the same problem {@link onReselect} solves for
 * the dropdowns). `InputField`'s commit channel fires on Enter whether or not the text changed, so
 * Enter here means "the whole selection, this value". The live channel keeps the keystroke-by-
 * keystroke apply, and the spinner arrows with it.
 *
 * The two channels overlap: every edit the live channel applied reaches the commit channel again
 * (Escape included — the cancel's revert runs through the live channel first). The field remembers
 * what it applied since the session began and skips an identical commit, so an edit never writes
 * twice, and Enter with nothing edited is the only time the commit channel writes.
 */
export const FormatNumberField = memo((props: FormatNumberFieldProps) => {
  const { label, value, min, max, step = 1, decimals = false, width, disabled, onChange } = props;

  // What the LIVE channel wrote during the open session; `null` once the session commits.
  const appliedRef = useRef<number | null>(null);

  const clamp = (n: number): number => Math.max(min, Math.min(max, n));
  // Empty text is not a number: mid-edit it means "not done" (nothing applied); at a commit, zero.
  const parse = (text: string): number | null => {
    const n = decimals ? parseFloat(text) : parseInt(text, 10);
    return Number.isNaN(n) ? null : clamp(n);
  };

  return (
    <InputField
      label={label}
      value={String(value)}
      disabled={disabled}
      hideAdornment
      helperText={null}
      propsInput={{ type: 'number', min, max, step }}
      // A number reads from the right, as it does in a cell.
      sx={{ width, minWidth: 0, '& input': { textAlign: 'right' } }}
      onChangeInput={(text: string) => {
        const next = parse(text);
        if (next === null) return;
        appliedRef.current = next;
        onChange(next);
      }}
      onDone={(text: string) => {
        const next = parse(text) ?? clamp(0);
        const applied = appliedRef.current;
        appliedRef.current = null;
        if (applied !== next) onChange(next);
      }}
    />
  );
});
FormatNumberField.displayName = 'FormatNumberField';

/** The vertical rhythm every format panel shares. */
export const panelSx: SxProps<Theme> = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
  minWidth: 0
};

export interface FormatSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The section heading. Omit for an unlabeled group. */
  label?: string;
  sx?: SxProps<Theme>;
}

/**
 * A labeled group of controls — the pane's answer to Excel's group boxes, without the box.
 */
export const FormatSection = memo((props: FormatSectionProps) => {
  const { label, children, sx: propSx, ...rest } = props;
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0, ...propSx }}
      {...rest}
    >
      {label ? (
        <Typography
          variant="caption"
          component="div"
          sx={{ color: 'text.secondary', lineHeight: 1.4 }}
        >
          {label}
        </Typography>
      ) : null}
      {children}
    </Box>
  );
});
FormatSection.displayName = 'FormatSection';

export interface FormatRowProps extends React.HTMLAttributes<HTMLDivElement> {
  sx?: SxProps<Theme>;
}

/**
 * A wrapping row of controls. The pane is narrow and resizable, so rows wrap rather than clip.
 */
export const FormatRow = memo((props: FormatRowProps) => {
  const { children, sx: propSx, ...rest } = props;
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0, ...propSx }}
      {...rest}
    >
      {children}
    </Box>
  );
});
FormatRow.displayName = 'FormatRow';

/**
 * A strip of icon buttons that reads as one control — the alignment toggles, the font effects.
 */
export const FormatButtonGroup = memo((props: FormatRowProps) => {
  const { children, sx: propSx, ...rest } = props;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        flexWrap: 'wrap',
        minWidth: 0,
        ...propSx
      }}
      {...rest}
    >
      {children}
    </Box>
  );
});
FormatButtonGroup.displayName = 'FormatButtonGroup';
