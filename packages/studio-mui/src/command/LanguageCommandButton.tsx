import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box, Typography } from '@mui/material';

import { DefaultLanguagePackService, type LanguageTag } from '@sheetxl/utils';

import {
  useCommands, useFloatStack, KeyCodes, DynamicIcon
} from '@sheetxl/utils-react';

import {
  CommandPopupButton, SelectedIcon, defaultRenderPopupPanel, ExhibitMenuItem, ExhibitTooltip, ExhibitPopupIconButton,
  type ExhibitPopupIconButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

export interface LanguageCommandButtonProps extends Omit<ExhibitPopupIconButtonProps, 'icon' | 'label' | 'renderPopupPanel'> {}

/**
 * The UI-language picker, backed by the studio `language` command (state = the active tag,
 * `execute(tag)` switches). The command exists so surfaces that resolve commands — including the
 * enclosing `languageOptions` panel's all-disabled reduction — see a real, enabled member; the
 * *list* is still this component's own concern.
 *
 * The list is whatever is REGISTERED, not a hardcoded set — `getAvailable()` grows when a user drops
 * a pack into `~/.sheetxl/resources/locales/…`, which is the point of the resource system. It follows
 * that a language can appear here that we never shipped, and that nothing needs a rebuild for it to.
 *
 * Contrast with locale (number/date formatting): that is a DOCUMENT property (`IWorkbook.setLocale`),
 * so its picker (`LocaleCommandButton`) sits behind a workbook command.
 */
export const LanguageCommandButton = memo(forwardRef<HTMLElement, LanguageCommandButtonProps>((props, refForwarded) => {
  const {
    sx: propSx,
    disabled: propDisabled,
    ...rest
  } = props;

  const [command] = useCommands(['language']);
  const active = (command?.getState() as LanguageTag) ?? DefaultLanguagePackService.getActive();
  const isDisabled = propDisabled ?? (!command || command.disabled());

  // Close the enclosing menu after a choice, as the other panel members do.
  const { reference } = useFloatStack();

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const choose = (tag: LanguageTag): void => {
      reference?.closeAll();
      void command?.execute(tag);
    };

    const items = DefaultLanguagePackService.getAvailable().sort().map((tag) => {
      const selected = tag === active;
      return (
        <ExhibitMenuItem
          key={tag}
          selected={selected}
          disabled={isDisabled}
          icon={selected ? <SelectedIcon/> : undefined}
          sx={{ display: 'flex', paddingTop: '4px', paddingBottom: '4px' }}
          onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0) return; choose(tag); }}
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) choose(tag);
          }}
        >
          <Box sx={{ display: 'flex', flex: '1 1 100%', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography
              component="div"
              sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {displayName(tag)}
            </Typography>
          </Box>
        </ExhibitMenuItem>
      );
    });

    return defaultRenderPopupPanel({
      ...panelProps,
      children: (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 100%' }}>
          <Box sx={{ overflow: 'auto', flex: '1 1 100%' }}>{items}</Box>
        </Box>
      )
    });
  }, [command, active, isDisabled, reference]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      sx={{ ...propSx }}
      disabled={isDisabled}
      // variant={CommandButtonType.Menuitem}
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
      icon={<DynamicIcon iconKey="Language"/>}
      // The command's label ("Language") — what the button DOES; the active language shows as
      // the selected row.
      label={command?.getLabel?.()}
      {...rest}
    />
  );
}));

/**
 * A language's name IN THAT LANGUAGE (`de` → "Deutsch").
 *
 * `Intl.DisplayNames` with the tag as its own locale is what every OS language picker does: someone
 * looking for their language recognizes it written the way they write it, not translated into the one
 * they are trying to leave. Falls back to the raw tag where `Intl` has no name for it.
 */
function displayName(tag: LanguageTag): string {
  try {
    return new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
