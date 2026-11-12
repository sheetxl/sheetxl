import type React from 'react';
import { memo } from 'react';

import { alpha } from '@mui/system';
import { type Theme, type SxProps } from '@mui/material';
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { NumberFormat } from '@sheetxl/sdk';

import { type TranslateFn } from '@sheetxl/utils-react';

type Category = NumberFormat.Category;

export interface NumberFormatOptionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The format's name — a {@link NumberFormat.Type} in the toolbar, a category in the pane. */
  label: string;
  /**
   * A live sample of the selection formatted this way. Blank keeps the row's height, so a list
   * where only some rows can show a sample stays evenly spaced.
   */
  sample?: string;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;
}

/**
 * The body of a number-format row: the format's name over what the current cell looks like in it.
 *
 * @remarks
 * Deliberately item-chrome free. The toolbar popup and the format pane's category dropdown each
 * wrap it in their own `ExhibitMenuItem`, since the two rows select differently (a command versus
 * the pane's `onChange`).
 */
export const NumberFormatOption = memo((props: NumberFormatOptionProps) => {
  const {
    label,
    sample,
    sx: propSx,
    ...rest
  } = props;

  const hasSample = !!sample && sample.length > 0;
  return (
    <Box
      sx={{
        // bold and larger
        display: 'flex',
        flex: '1 1 100%',
        flexDirection: 'column',
        overflow: 'hidden',
        '*': {
          lineHeight: '1.4'
        },
        ...propSx
      }}
      {...rest}
    >
      <Typography
        component="div"
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        component="div"
        sx={{
          // whiteSpace: 'pre-wrap', {/* uncomment if we want to preserve height */}
          color: (theme: Theme) => {
            return alpha(theme.palette.text.primary, .6)
          },
          paddingTop: hasSample ? '1px' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {hasSample ? sample : ' '}
      </Typography>
    </Box>
  );
});
NumberFormatOption.displayName = 'NumberFormatOption';

/**
 * Localized display name for a {@link NumberFormat.Type}. The canonical Type
 * string stays the identity (state/lookup); this is display-only. Reuses the
 * dialog's `numberFormat.cat*` keys where a type maps 1:1 to a category, plus
 * `numberFormat.type*` for the granular date/time + comma variants the toolbar
 * exposes. Unknown types fall back to the canonical name.
 */
export const numberFormatTypeLabel = (t: TranslateFn, type: string): string => {
  switch (type) {
    case NumberFormat.Type.General: return t('numberFormat.catGeneral');
    case NumberFormat.Type.Number: return t('numberFormat.catNumber');
    case NumberFormat.Type.Currency: return t('numberFormat.catCurrency');
    case NumberFormat.Type.Accounting: return t('numberFormat.catAccounting');
    case NumberFormat.Type.ShortDate: return t('numberFormat.typeShortDate');
    case NumberFormat.Type.MediumDate: return t('numberFormat.typeMediumDate');
    case NumberFormat.Type.LongDate: return t('numberFormat.typeLongDate');
    case NumberFormat.Type.ShortTime: return t('numberFormat.typeShortTime');
    case NumberFormat.Type.MediumTime: return t('numberFormat.typeMediumTime');
    case NumberFormat.Type.LongTime: return t('numberFormat.typeLongTime');
    case NumberFormat.Type.Comma: return t('numberFormat.typeComma');
    case NumberFormat.Type.Percentage: return t('numberFormat.catPercentage');
    case NumberFormat.Type.Fraction: return t('numberFormat.catFraction');
    case NumberFormat.Type.Scientific: return t('numberFormat.catScientific');
    case NumberFormat.Type.Text: return t('numberFormat.catText');
    case NumberFormat.Type.Special: return t('numberFormat.catSpecial');
    case NumberFormat.Type.Custom: return t('numberFormat.catCustom');
    default: return type;
  }
}

/**
 * Localized display name for a category. The SDK's `Builder.CATEGORIES` strings are canonical
 * (they are the `Category` identity values) — a literal `t()` pair per category keeps the
 * extractor seeing `key → english`; unknown categories fall back to the canonical name.
 */
export const numberFormatCategoryLabel = (t: TranslateFn, category: Category): string => {
  switch (category) {
    case 'General': return t('numberFormat.catGeneral');
    case 'Number': return t('numberFormat.catNumber');
    case 'Currency': return t('numberFormat.catCurrency');
    case 'Accounting': return t('numberFormat.catAccounting');
    case 'Date': return t('numberFormat.catDate');
    case 'Time': return t('numberFormat.catTime');
    case 'Percentage': return t('numberFormat.catPercentage');
    case 'Fraction': return t('numberFormat.catFraction');
    case 'Scientific': return t('numberFormat.catScientific');
    case 'Text': return t('numberFormat.catText');
    case 'Special': return t('numberFormat.catSpecial');
    case 'Custom': return t('numberFormat.catCustom');
    default: return category;
  }
}
