import type React from 'react';
import { memo, forwardRef } from 'react';

import { Box, Typography } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook, type IWorksheet, type IConditionalFormat } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import { useModelSync, type ItemsPaneArgs } from '@sheetxl/react';

import {
  AnchorItemsPanel, AnchoredRangeField, type AnchorItemsDescriptor, type AnchorItemBodyProps
} from '../anchorItems';

import { ConditionalFormatEditorPanel } from './ConditionalFormatEditorPanel';
import { conditionalFormatTitle } from './ConditionalFormatTitle';
import { RulePreview } from './RulePreview';

/**
 * The card's stop-if-true badge.
 *
 * @remarks
 * Shown only when the flag actually ENDS evaluation — a scale rule never does, whatever the file
 * it came from said. It is the one property of a rule that is invisible in what the rule paints —
 * a reader comparing two cards can see their formats and their ranges, but not that one of them
 * ends evaluation — so the card says it, and says nothing when there is nothing to say.
 */
const StopIfTrueBadge = memo<AnchorItemBodyProps<IConditionalFormat>>(({ item }) => {
  const t = useTranslator();
  useModelSync<IConditionalFormat.IListeners>(item, 'onAnyChange');

  // The flag only ENDS anything on a predicate rule — a scale always applies. A rule imported with
  // it set on a data bar keeps the flag (it round-trips) but has nothing to announce.
  if (!item.isStopIfTrue() || item.getScale()) return null;
  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'flex-start',
      px: 0.75,
      py: 0.25,
      border: 1,
      borderColor: 'divider',
      borderRadius: 1,
      color: 'text.secondary'
    }}>
      <Typography variant="caption">{t('conditionalFormat.stopIfTrue')}</Typography>
    </Box>
  );
});

StopIfTrueBadge.displayName = 'StopIfTrueBadge';

/**
 * The card's "Apply to" field.
 *
 * @remarks
 * The ranges line is a field, not a caption: re-pointing a rule is the edit users reach for most
 * and it needs none of the editor. The card keeps its title, which the editor drops — out here
 * there is no tab strip naming the rule's kind.
 */
const ConditionalFormatCardRanges = memo<AnchorItemBodyProps<IConditionalFormat>>(({ item }) => {
  const t = useTranslator();
  return <AnchoredRangeField item={item} label={t('conditionalFormat.applyTo')} helperText={null} />;
});

ConditionalFormatCardRanges.displayName = 'ConditionalFormatCardRanges';

/**
 * Binds conditional formats to the generic {@link AnchorItemsPanel}.
 */
export const ConditionalFormatItemsDescriptor: AnchorItemsDescriptor<IConditionalFormat> = {
  key: 'conditional-format',
  messageKeys: {
    none: messageKey('conditionalFormat.none'),
    addPrompt: messageKey('conditionalFormat.addPrompt'),
    heading: messageKey('conditionalFormat.heading'),
    insert: messageKey('conditionalFormat.insert'),
    new: messageKey('conditionalFormat.new'),
    moveUp: messageKey('conditionalFormat.moveUp'),
    moveDown: messageKey('conditionalFormat.moveDown'),
    edit: messageKey('conditionalFormat.edit'),
    duplicate: messageKey('conditionalFormat.duplicate'),
    delete: messageKey('conditionalFormat.delete'),
    cancel: messageKey('conditionalFormat.cancel'),
    save: messageKey('conditionalFormat.save')
  },
  getCollection: (sheet: IWorksheet) => sheet.getConditionalFormats(),
  changeEvents: ['onConditionalFormatsChange'],
  // Excel rules conditional formats under Format Cells, not Edit Objects.
  isReadOnly: (sheet: IWorksheet): boolean => !sheet.getProtection().isFormatCellsAllowed(),
  applyUpdate: (target: IConditionalFormat, edited: IConditionalFormat): void => {
    // Whole definition, shape included — the SDK's update(rule) clears what the draft lacks and
    // describes itself for undo history.
    target.update(edited);
  },
  // What Excel's dialog refuses on OK. A scale rule has no condition and nothing to refuse.
  validate: (edited: IConditionalFormat): string | null => edited.getCondition()?.validate() ?? null,
  /* A seeded rule is a NEW rule, so every mutually-exclusive key is named for the same reason
     `applyUpdate` names them: a `scale` seed has to clear the `between` condition a fresh temporary
     rule carries, or the draft would hold both and write a malformed rule. */
  applySeed: (draft: IConditionalFormat, seed: IConditionalFormat.Properties): void => {
    draft.update({
      condition: seed.condition ?? null,
      style: seed.style ?? null,
      scale: seed.scale ?? null,
      stopIfTrue: seed.stopIfTrue ?? false
    });
  },
  getCardTitle: conditionalFormatTitle,
  /* The rendering preview leads the card — it is how a user tells two rules apart at a glance.
     Taller than the title line on purpose: the swatch is the main event, and the card can afford
     the height. */
  CardMedia: ({ item }: AnchorItemBodyProps<IConditionalFormat>) => (
    <RulePreview conditionalFormat={item} size={32} />
  ),
  CardSubtitle: ConditionalFormatCardRanges,
  CardBody: StopIfTrueBadge,
  EditorBody: ({ item }: AnchorItemBodyProps<IConditionalFormat>) => (
    <ConditionalFormatEditorPanel conditionalFormat={item} />
  )
};

export interface ConditionalFormatDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  /**
   * The task pane's activation argument. A `draft` in it opens the pane editing a new rule seeded
   * from those properties — how the Home▸Conditional Formatting presets ("Greater Than…") hand
   * their rule over without committing it.
   */
  args?: ItemsPaneArgs<IConditionalFormat.Properties>;
}

/**
 * The conditional-formatting task pane: the generic anchored-items list driven by
 * {@link ConditionalFormatItemsDescriptor}.
 */
export const ConditionalFormatDetailsPanel =
  memo(forwardRef<HTMLDivElement, ConditionalFormatDetailsPanelProps>((props, refForwarded) => {
  const {
    workbook,
    args,
    ...rest
  } = props;
  return (
    <AnchorItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={ConditionalFormatItemsDescriptor}
      args={args}
      dragReorder
      {...rest}
    />
  );
}));

ConditionalFormatDetailsPanel.displayName = 'ConditionalFormatDetailsPanel';
