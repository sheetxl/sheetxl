import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import {
  useCommands, useTranslator, useLanguage, useFloatStack, KeyCodes, DynamicIcon
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, SelectedIcon, defaultRenderPopupPanel, ExhibitDivider, ExhibitMenuItem,
  ExhibitTooltip, type ExhibitPopupIconButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

export interface LocaleCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, 'icon' | 'label' | 'renderPopupPanel'> {}

/**
 * Locales offered by default. Unlike the language picker (whose list is the registered packs), a
 * locale needs no pack — any BCP 47 tag works (`Intl` probing) — so the list is a courtesy, not a
 * capability boundary: the workbook's current tag always joins it, so a locale set programmatically
 * (or by the file) is never invisible here.
 */
const COMMON_LOCALES: readonly string[] = [
  'ar-SA', 'cs-CZ', 'da-DK', 'de-AT', 'de-CH', 'de-DE', 'el-GR', 'en-AU', 'en-CA', 'en-GB',
  'en-IN', 'en-US', 'es-AR', 'es-ES', 'es-MX', 'fi-FI', 'fr-CA', 'fr-CH', 'fr-FR', 'he-IL',
  'hi-IN', 'hu-HU', 'id-ID', 'it-IT', 'ja-JP', 'ko-KR', 'nb-NO', 'nl-BE', 'nl-NL', 'pl-PL',
  'pt-BR', 'pt-PT', 'ru-RU', 'sv-SE', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN', 'zh-CN', 'zh-TW'
];

/**
 * The workbook regional-format (locale) picker, backed by the workbook `locale` command.
 *
 * A locale is a DOCUMENT property (`IWorkbook.setLocale` — number/date formatting travels with the
 * file, as in Excel), which is why this sits behind a workbook command while the language picker
 * (`LanguageCommandButton`) drives an application singleton behind a studio command.
 *
 * The command state is the PINNED tag or `null` (= follow the environment) — the same domain
 * `setLocale` takes — so the "System default" row can be told apart from a locale pinned to the
 * very tag the environment happens to resolve to.
 */
export const LocaleCommandButton = memo(forwardRef<HTMLElement, LocaleCommandButtonProps>((props, refForwarded) => {
  const {
    sx: propSx,
    disabled: propDisabled,
    ...rest
  } = props;

  const t = useTranslator();
  // Subscribing keeps the "System default" row live: its resolved tag follows the UI language.
  const language = useLanguage();
  const [command] = useCommands(['locale']);
  const pinned = (command?.getState() as string | null | undefined) ?? null;
  const isDisabled = propDisabled ?? (!command || command.disabled());

  // Close the enclosing menu after a choice, as the other panel members do.
  const { reference } = useFloatStack();

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const choose = (tag: string | null): void => {
      reference?.closeAll();
      void command?.execute(tag);
    };

    const itemProps = (tag: string | null, selected: boolean) => ({
      selected,
      disabled: isDisabled,
      icon: selected ? <SelectedIcon/> : undefined,
      sx: { display: 'flex', paddingTop: '4px', paddingBottom: '4px', flex: 'none' },
      onMouseUp: (e: React.MouseEvent) => { if (e.button !== 0) return; choose(tag); },
      onMouseDown: (e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) choose(tag);
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

    const tags = [...COMMON_LOCALES];
    if (pinned && !tags.includes(pinned)) tags.push(pinned);
    // Sort by display name, not tag — the user scans names ("Deutsch…"), not codes.
    tags.sort((a, b) => displayName(a).localeCompare(displayName(b)));

    const items = tags.map((tag) => (
      <ExhibitMenuItem key={tag} {...itemProps(tag, tag === pinned)}>
        {itemLabel(displayName(tag))}
      </ExhibitMenuItem>
    ));

    return defaultRenderPopupPanel({
      ...panelProps,
      children: (
        // `overflow: hidden` bounds this flex column to the Paper's height so the LIST box
        // below (not the float's Paper) becomes the scroll container. That keeps the
        // "System default" header a fixed flex sibling — no sticky, and no opaque-background
        // hack fighting MUI's elevation backgroundImage. Same pattern as InsertFunctionPopupPanel.
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 100%', overflow: 'hidden' }}>
          <Box sx={{ flex: 'none' }}>
            <ExhibitMenuItem key="system-default" {...itemProps(null, pinned === null)}>
              {itemLabel(t('locale.systemDefault', { locale: displayName(resolvedDefaultLocale(language)) }))}
            </ExhibitMenuItem>
            <ExhibitDivider orientation="horizontal"/>
          </Box>
          <Box sx={{ overflow: 'auto', flex: '1 1 100%' }}>{items}</Box>
        </Box>
      )
    });
  }, [command, pinned, isDisabled, reference, t, language]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      sx={{ ...propSx }}
      disabled={isDisabled}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel?.()}
          description={command?.getDescription?.()}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      icon={<DynamicIcon iconKey="Locale"/>}
      // The command's label ("Regional Format") — what the button DOES; the current value shows
      // as the selected row (and the system row names the tag the unpinned default resolves to).
      label={command?.getLabel?.()}
      {...rest}
    />
  );
}));


/**
 * The environment's own locale — the tag the SDK's `defaultLocale()` probes `Intl` for. Only the
 * FALLBACK now (the unpinned default follows the UI language first — see {@link resolvedDefaultLocale});
 * still used when no language is active. Memoized: the `resolvedOptions()` probe is surprisingly
 * expensive and the value cannot change within a page lifetime.
 */
let _environmentLocale: string | null = null;
function environmentLocale(): string {
  if (!_environmentLocale) {
    _environmentLocale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
  }
  return _environmentLocale;
}

/**
 * The tag an unpinned workbook actually resolves to — what the "System default" row names. Mirrors
 * the SDK's `Runtime.languageLocale`: the active UI language maximized to a region (`de` → `de-DE`,
 * `en` → `en-US`), falling back to the environment locale when no language is active. Named by the
 * shared {@link displayName}, this is why the row reads "System Default (American English)" under an
 * English UI and "System Default (Deutsch (Deutschland))" under German.
 */
function resolvedDefaultLocale(language: string | null): string {
  if (language) {
    try {
      const maximized = new Intl.Locale(language).maximize();
      return maximized.region ? `${maximized.language}-${maximized.region}` : maximized.baseName;
    } catch {
      // malformed tag — fall through to the environment
    }
  }
  return environmentLocale();
}

/**
 * A locale's name in ITS OWN language (`de-DE` → "Deutsch (Deutschland)") — same convention as the
 * language picker (self-named entries stay recognizable regardless of the UI language). Falls back
 * to the raw tag where `Intl` has no name for it.
 */
function displayName(tag: string): string {
  try {
    return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
