import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { NumberFormat, type ICell } from '@sheetxl/sdk';

import {
  useCommands, useTranslator, useLanguage, KeyCodes, DynamicIcon
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, defaultRenderPopupPanel, ExhibitDivider, ExhibitMenuItem,
  ExhibitTooltip, type ExhibitPopupIconButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

const { Builder } = NumberFormat;

export interface AccountingStyleCommandButtonProps
  extends Omit<ExhibitPopupIconButtonProps, 'icon' | 'label' | 'renderPopupPanel'> {
  /** The render surface, for scoped command chrome (label/description). */
  groupKey?: string;
}

/**
 * Common ISO 4217 currencies offered by default — a curated shortlist (like the locale picker's
 * `COMMON_LOCALES`), not a capability boundary: any symbol works, and the Number Format dialog's
 * Currency category can build any code. The symbol and display name come from `Intl`, so the list
 * stays a few dozen codes rather than a hand-maintained table.
 */
const COMMON_CURRENCIES: readonly string[] = [
  'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SGD',
  'SEK', 'NOK', 'DKK', 'NZD', 'KRW', 'INR', 'BRL', 'RUB', 'ZAR', 'MXN',
  'TRY', 'PLN', 'THB', 'IDR', 'ILS', 'AED', 'SAR', 'CZK', 'HUF', 'PHP',
  'MYR', 'TWD'
];

/**
 * The Accounting/Currency style button with a currency picker — the parity of Excel's `$` ribbon
 * dropdown. It drives the existing `formatNumberFormatAccountingStyle` command directly (the same
 * pattern {@link LocaleCommandButton} uses for `locale`): the command's callback already takes an
 * optional format code, so the default row applies the locale currency (no arg → the built-in
 * Currency style) and each currency row applies an Accounting code built with that symbol.
 *
 * The chosen currency is a literal SYMBOL baked into the number format — locale-agnostic, so the
 * cell renders that currency regardless of the workbook locale.
 */
export const AccountingStyleCommandButton = memo(forwardRef<HTMLElement, AccountingStyleCommandButtonProps>((props, refForwarded) => {
  const {
    sx: propSx,
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const t = useTranslator();
  // Currency display NAMES follow the UI language ("Euro" vs "Euro", "US Dollar" vs "US-Dollar").
  const language = useLanguage();
  const [command] = useCommands<string, ICell>(['formatNumberFormatAccountingStyle']);
  const isDisabled = propDisabled ?? (!command || command.disabled());

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    // Empty format → the built-in Currency named style (locale currency); a code → that exact
    // Accounting format. Mirrors the command callback's own `format ? … : named Currency`.
    // Only THIS picker closes (`closeFloat`, not `closeFloatAll`): it sits in the number format menu's
    // quick-button row, whose commands are `quickAction` and leave that menu open.
    const apply = (format?: string): void => {
      panelProps.closeFloat?.();
      void command?.execute(format ?? undefined);
    };

    const itemProps = (onChoose: () => void) => ({
      disabled: isDisabled,
      sx: { display: 'flex', paddingTop: '4px', paddingBottom: '4px', flex: 'none' },
      onMouseUp: (e: React.MouseEvent) => { if (e.button !== 0) return; onChoose(); },
      onMouseDown: (e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) onChoose();
      }
    });

    const itemLabel = (text: string) => (
      <Box sx={{ display: 'flex', flex: '1 1 100%', flexDirection: 'column', overflow: 'hidden' }}>
        <Typography
          component="div"
          sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {text}
        </Typography>
      </Box>
    );

    // Sort by display name — the user scans "Euro"/"US Dollar", not the ISO codes.
    const codes = [...COMMON_CURRENCIES].sort((a, b) =>
      currencyName(a, language).localeCompare(currencyName(b, language)));

    const items = codes.map((code) => {
      const symbol = currencySymbol(code);
      return (
        <ExhibitMenuItem key={code} {...itemProps(() => apply(accountingFormat(symbol)))}>
          {itemLabel(`${symbol}  ${currencyName(code, language)} (${code})`)}
        </ExhibitMenuItem>
      );
    });

    return defaultRenderPopupPanel({
      ...panelProps,
      children: (
        // `overflow: hidden` bounds this flex column to the Paper's height so the LIST box (not the
        // float's Paper) scrolls, keeping the default row a fixed header. Same pattern as the locale picker.
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 100%', overflow: 'hidden' }}>
          <Box sx={{ flex: 'none' }}>
            <ExhibitMenuItem key="default-currency" {...itemProps(() => apply())}>
              {itemLabel(t('numberFormat.accountingDefault'))}
            </ExhibitMenuItem>
            <ExhibitDivider orientation="horizontal"/>
          </Box>
          <Box sx={{ overflow: 'auto', flex: '1 1 100%' }}>{items}</Box>
        </Box>
      )
    });
  }, [command, isDisabled, t, language]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      sx={{ ...propSx }}
      disabled={isDisabled}
      quickCommand={'formatNumberFormatAccountingStyle'}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel?.(groupKey)}
          description={command?.getDescription?.(groupKey)}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      icon={<DynamicIcon iconKey="CurrencyDollar"/>}
      label={command?.getLabel?.(groupKey)}
      {...rest}
    />
  );
}));

/** An Accounting number-format code carrying the given currency symbol literal. */
function accountingFormat(symbol: string): string {
  const base = Builder.parse(Builder.defaultCodeForCategory('Accounting'));
  return Builder.build({ ...base, currencySymbol: symbol });
}

/** The narrow currency symbol for an ISO code (`EUR` → `€`), from `Intl`; the code itself on a miss. */
function currencySymbol(code: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/** The currency's display name in the UI language (`EUR` → "Euro"); the code itself on a miss. */
function currencyName(code: string, language: string | null): string {
  try {
    return new Intl.DisplayNames([language ?? 'en'], { type: 'currency' }).of(code) ?? code;
  } catch {
    return code;
  }
}
