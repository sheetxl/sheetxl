import type React from 'react';
import { memo, forwardRef, useReducer } from 'react';

import {
  Box, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography, type Theme
} from '@mui/material';

import { type IWorkbook, type IExternalBookCollection } from '@sheetxl/sdk';

import { messageKey } from '@sheetxl/utils';
import { useTranslator } from '@sheetxl/utils-react';

/** Excel's three, in the order its own dialog offers them. */
const MODES: IExternalBookCollection.UpdateLinks[] = ['userSet', 'always', 'never'];

const MODE_MESSAGE_KEYS: Record<IExternalBookCollection.UpdateLinks, string> = {
  userSet: messageKey('externalLink.updateLinks.userSet'),
  always: messageKey('externalLink.updateLinks.always'),
  never: messageKey('externalLink.updateLinks.never')
};

export interface ExternalLinkSettingsTabProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
}

/**
 * The **Settings** tab: what should happen to the cached values when this workbook is opened.
 *
 * @remarks
 * Carried, not obeyed — SheetXL always reads the cache and never refreshes a link, so the setting
 * is for the applications that do. It is still worth writing: a
 * workbook that arrives with `never` must leave with it.
 *
 * A workbook whose source said nothing shows `userSet`, which is how Excel reads an absent
 * attribute. Opening the tab writes nothing; only a click does.
 */
export const ExternalLinkSettingsTab =
  memo(forwardRef<HTMLDivElement, ExternalLinkSettingsTabProps>((props, refForwarded) => {
  const {
    workbook,
    ...rest
  } = props;

  const t = useTranslator();
  /* The property has no change event — nothing else in the product writes it — so the radio is
     driven off the model and re-read after the write it made itself. */
  const [_renderNonce, forceRender] = useReducer((s: number) => s + 1, 0);

  const value: IExternalBookCollection.UpdateLinks = workbook.getUpdateLinks() ?? 'userSet';
  const isReadOnly = !workbook.getProtection().isStructureAllowed();

  return (
    <Box
      ref={refForwarded}
      {...rest}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // See `WorkbookProtectionTab` — with no global `border-box` reset, `width: 100%` plus
        // horizontal padding overflows, and the pane clips the right padding away.
        boxSizing: 'border-box',
        gap: (theme: Theme) => theme.spacing(1.5),
        padding: (theme: Theme) => theme.spacing(1.5),
        overflowX: 'hidden',
        overflowY: 'auto'
      }}
    >
      <FormControl disabled={isReadOnly}>
        <FormLabel sx={{ typography: 'body2' }}>
          {t('externalLink.updateLinks.label')}
        </FormLabel>
        <RadioGroup
          value={value}
          onChange={(_e: React.ChangeEvent<HTMLInputElement>, next: string) => {
            workbook.setUpdateLinks(next as IExternalBookCollection.UpdateLinks);
            forceRender();
          }}
        >
          {MODES.map((mode: IExternalBookCollection.UpdateLinks) => (
            <FormControlLabel
              key={mode}
              value={mode}
              control={<Radio size="small" />}
              label={<Typography variant="body2">{t(MODE_MESSAGE_KEYS[mode])}</Typography>}
            />
          ))}
        </RadioGroup>
      </FormControl>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('externalLink.updateLinks.note')}
      </Typography>
    </Box>
  );
}));

ExternalLinkSettingsTab.displayName = 'ExternalLinkSettingsTab';
