import type React from 'react';
import { memo, forwardRef } from 'react';

import { Box, Typography } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IDataValidation, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { useModelSync, type ItemsPaneArgs } from '@sheetxl/react';

import {
  AnchorItemsPanel, AnchoredRangeField, type AnchorItemsDescriptor, type AnchorItemBodyProps
} from '../anchorItems';

import { DataValidationEditorPanel, ALERT_STYLE_ICONS } from './DataValidationEditorPanel';
import { DataValidationIcon } from './DataValidationIcon';
import { dataValidationTitle } from './DataValidationTitle';

/** A badge: an icon saying what the rule does, with a tooltip, and text only where there is some (a prompt's title). */
const Badge: React.FC<{ icon: string; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <Box
    className="validation-badge"
    title={title}
    aria-label={title}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      px: 0.75,
      py: 0.25,
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      color: 'text.secondary'
    }}
  >
    <DynamicIcon iconKey={icon} size={14} ariaHidden />
    {children ? <Typography variant="caption">{children}</Typography> : null}
  </Box>
);

/** The name of each alert style, the badge's tooltip. */
const ALERT_STYLE_NAME_KEYS: Record<IDataValidation.AlertStyle, string> = {
  [IDataValidation.AlertStyle.Stop]: 'dataValidation.alertStop',
  [IDataValidation.AlertStyle.Warning]: 'dataValidation.alertWarning',
  [IDataValidation.AlertStyle.Information]: 'dataValidation.alertInformation'
};

/**
 * The card's badges: what a rule does, each as an icon (Michael, 2026-10-14: say what is on,
 * never what is off). A prompt, with its title; an alert, by its style; a list's in-cell
 * dropdown. A rule that does none of these has no badges.
 */
const DataValidationCardBody = memo<AnchorItemBodyProps<IDataValidation>>(({ item }) => {
  const t = useTranslator();
  useModelSync<IDataValidation.IListeners>(item, 'onAnyChange');

  const badges: React.ReactNode[] = [];
  if (item.isShowPromptMessage()) {
    badges.push(
      <Badge key="prompt" icon="NoteInsert" title={t('dataValidation.prompt')}>
        {item.getPromptTitle() || null}
      </Badge>
    );
  }
  if (item.getCondition() && item.isShowAlertMessage()) {
    const style = item.getAlertStyle();
    badges.push(
      <Badge key="alert" icon={ALERT_STYLE_ICONS[style]} title={`${t('dataValidation.alert')}: ${t(ALERT_STYLE_NAME_KEYS[style])}`} />
    );
  }
  if (!item.isHideDropdown() && item.getRenderHints().includes('list')) {
    badges.push(<Badge key="dropdown" icon="ArrowDownOutline" title={t('dataValidation.inCellDropdown')} />);
  }
  if (badges.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {badges}
    </Box>
  );
});

DataValidationCardBody.displayName = 'DataValidationCardBody';

/**
 * The card's "Apply to" field: re-pointing a validation needs none of the editor.
 */
const DataValidationCardRanges = memo<AnchorItemBodyProps<IDataValidation>>(({ item }) => {
  const t = useTranslator();
  return <AnchoredRangeField item={item} label={t('dataValidation.applyTo')} helperText={null} />;
});

DataValidationCardRanges.displayName = 'DataValidationCardRanges';

/**
 * Binds data validations to the generic {@link AnchorItemsPanel}.
 */
export const DataValidationItemsDescriptor: AnchorItemsDescriptor<IDataValidation> = {
  key: 'data-validation',
  messageKeys: {
    none: messageKey('dataValidation.none'),
    addPrompt: messageKey('dataValidation.addPrompt'),
    heading: messageKey('dataValidation.heading'),
    insert: messageKey('dataValidation.insert'),
    new: messageKey('dataValidation.new'),
    moveUp: messageKey('dataValidation.moveUp'),
    moveDown: messageKey('dataValidation.moveDown'),
    edit: messageKey('dataValidation.edit'),
    duplicate: messageKey('dataValidation.duplicate'),
    delete: messageKey('dataValidation.delete'),
    cancel: messageKey('dataValidation.cancel'),
    save: messageKey('dataValidation.save')
  },
  getCollection: (sheet: IWorksheet) => sheet.getDataValidations(),
  changeEvents: ['onDataValidationsChange'],
  // No protection option allows editing validations, as in Excel.
  isReadOnly: (sheet: IWorksheet): boolean => sheet.getProtection().isLocked() || sheet.getProtection().isReadOnly(),
  applyUpdate: (target: IDataValidation, edited: IDataValidation): void => {
    target.update(edited); // the SDK's update() already describes itself for undo history
  },
  // What Excel's dialog refuses on OK: a bound not given, bounds reversed, a fraction for a whole
  // number. A prompt-only validation has no condition and nothing to refuse.
  validate: (edited: IDataValidation): string | null => edited.getCondition()?.validate() ?? null,
  /* Excel's dialog, not the model's defaults: a rule made here refuses bad entry with Stop. The
     model's booleans default false, so a rule made through the API alerts on nothing until asked. */
  applyNewDefaults: (draft: IDataValidation): void => {
    draft.update({ alertStyle: IDataValidation.AlertStyle.Stop, showAlertMessage: true });
  },
  applySeed: (draft: IDataValidation, seed: IDataValidation.Properties): void => {
    draft.update(seed);
  },
  getCardTitle: dataValidationTitle,
  CardMedia: ({ item }: AnchorItemBodyProps<IDataValidation>) => (
    <DataValidationIcon dataValidation={item} size={32} />
  ),
  CardSubtitle: DataValidationCardRanges,
  CardBody: DataValidationCardBody,
  EditorBody: ({ item }: AnchorItemBodyProps<IDataValidation>) => (
    <DataValidationEditorPanel dataValidation={item} />
  )
};

export interface DataValidationDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  /**
   * The task pane's activation argument. A `draft` in it opens the pane editing a new validation
   * seeded from those properties, as the Data ▸ Data Validation presets do.
   */
  args?: ItemsPaneArgs<IDataValidation.Properties>;
}

/**
 * The data-validation task pane: the generic anchored-items list driven by
 * {@link DataValidationItemsDescriptor}.
 */
export const DataValidationDetailsPanel =
  memo(forwardRef<HTMLDivElement, DataValidationDetailsPanelProps>((props, refForwarded) => {
  const {
    workbook,
    args,
    ...rest
  } = props;
  return (
    <AnchorItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={DataValidationItemsDescriptor}
      args={args}
      dragReorder
      {...rest}
    />
  );
}));

DataValidationDetailsPanel.displayName = 'DataValidationDetailsPanel';
