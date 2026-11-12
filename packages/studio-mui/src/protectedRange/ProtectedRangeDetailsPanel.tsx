import type React from 'react';
import { memo, forwardRef } from 'react';

import { Box, Button, Typography, type Theme } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type IWorkbook, type IWorksheet, type IProtectedRange } from '@sheetxl/sdk';

import { DynamicIcon, useNotifier, useTranslator } from '@sheetxl/utils-react';

import { type ItemsPaneArgs, useModelSync, promptUnlockProtectedRanges } from '@sheetxl/react';

import {
  AnchorItemsPanel, type AnchorItemsDescriptor, type AnchorItemBodyProps
} from '../anchorItems';

import { ProtectedRangeEditorPanel } from './ProtectedRangeEditorPanel';
import { flushStagedPassword } from './ProtectedRangeDraft';

const captionSx = {
  color: (theme: Theme) => theme.palette.text.secondary,
  fontStyle: 'italic',
  minWidth: 0
};

/**
 * The password line of a card, and — while the sheet is enforcing — the way through it.
 *
 * @remarks
 * A card is read-only while the sheet is protected (the list is what protection enforces), but
 * that is exactly when a password-gated range has something to DO: grant session access. So the
 * body carries its own Unlock, the one act the card offers under protection, and a Lock to take it
 * back. Both are session state (`IProtectedRange.isUnlocked`), so the card subscribes to that
 * itself — the list's own subscription only follows document changes.
 *
 * On an unprotected or paused sheet nothing is enforced and there is nothing to unlock; the line
 * then only states the configuration.
 */
const ProtectedRangeCardBody: React.FC<AnchorItemBodyProps<IProtectedRange>> = ({ item }) => {
  const t = useTranslator();
  const notifier = useNotifier();
  const ranges = item.getRanges();
  const sheet: IWorksheet | null = ranges.isInvalid() ? null : ranges.getWorksheet();
  useModelSync<IProtectedRange.IListeners>(item, ['onUnlockChange']);
  // The hook tolerates a null source at runtime (an invalidated item has no sheet); only the
  // signature insists.
  useModelSync<IWorksheet.IListeners>(sheet as IWorksheet, ['onProtectionChange']);

  if (!item.hasPassword()) return null;
  if (!sheet?.getProtection().isLocked()) {
    return (
      <Typography variant="caption" sx={captionSx}>
        {t('protectedRange.passwordRequired')}
      </Typography>
    );
  }
  const unlocked = item.isUnlocked();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        columnGap: (theme: Theme) => theme.spacing(1)
      }}
    >
      <Typography variant="caption" sx={captionSx}>
        {unlocked ? t('protectedRange.unlocked') : t('protectedRange.passwordRequired')}
      </Typography>
      <Button
        size="small"
        color={unlocked ? 'inherit' : 'primary'}
        sx={{ textTransform: 'none' }}
        onClick={() => {
          if (unlocked) {
            item.relock();
          } else {
            void promptUnlockProtectedRanges(notifier, [item]);
          }
        }}
      >
        {unlocked ? t('protectedRange.lock') : t('protectedRange.unlock')}
      </Button>
    </Box>
  );
};

/**
 * Binds protected ranges to the generic {@link AnchorItemsPanel}.
 *
 * @remarks
 * `reorderable` is off: OOXML models `protectedRanges` as an unordered set, so the move up/down
 * affordances would present an ordering that carries no meaning.
 */
export const ProtectedRangeItemsDescriptor: AnchorItemsDescriptor<IProtectedRange> = {
  key: 'protected-range',
  // `moveUp`/`moveDown` are absent — see `reorderable` below.
  // No `heading`: this list only ever renders under the pane's own "Ranges" tab, which
  // already names it — a second title directly below read as chrome repeating itself.
  messageKeys: {
    none: messageKey('protectedRange.none'),
    addPrompt: messageKey('protectedRange.addPrompt'),
    insert: messageKey('protectedRange.insert'),
    new: messageKey('protectedRange.new'),
    edit: messageKey('protectedRange.edit'),
    duplicate: messageKey('protectedRange.duplicate'),
    delete: messageKey('protectedRange.delete'),
    cancel: messageKey('protectedRange.cancel'),
    save: messageKey('protectedRange.save')
  },
  getCollection: (sheet: IWorksheet) => sheet.getProtectedRanges(),
  changeEvents: ['onProtectedRangesChange'],
  /* Stated rather than inherited: the generic default reads `objects`, the DRAWING flag, which is
     only accidentally the right answer here. Excel greys out Allow Edit Ranges on a protected sheet
     for the same reason — the list is what protection is enforcing, so it cannot be edited from
     under it. Paused does NOT count: enforcement is down, the model takes the edits (`isLocked()`
     reads false, and that is what every SDK guard consults), and re-authoring these ranges is much
     of what a pause is FOR. */
  isReadOnly: (sheet: IWorksheet): boolean => sheet.getProtection().isLocked(),
  reorderable: false,
  // Hashing is async, so the editor stages the plain text and it lands here — before either save
  // path serializes the temporary item.
  beforeSave: (edited: IProtectedRange): Promise<void> => flushStagedPassword(edited),
  applyUpdate: (target: IProtectedRange, edited: IProtectedRange): void => {
    target.update(edited); // the SDK's update() already describes itself for undo history
  },
  getCardTitle: (item: IProtectedRange, t): string => {
    return item.getName() || t('protectedRange.unnamed');
  },
  /* A leading glyph, as the conditional-format cards have — without one a list of unlocked ranges
     is an undifferentiated wall of titles. `LockRange` is `Lock` until a dedicated glyph exists;
     the cards already point at the key they will keep. */
  CardMedia: () => (
    <DynamicIcon iconKey="LockRange" size={24} ariaHidden />
  ),
  CardBody: ProtectedRangeCardBody,
  EditorBody: ({ item }: AnchorItemBodyProps<IProtectedRange>) => (
    <ProtectedRangeEditorPanel protectedRange={item} />
  )
};

export interface ProtectedRangeDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  workbook: IWorkbook;
  /**
   * The task pane's activation argument. `insert: true` opens the pane on a new range anchored to
   * the selection, rather than on the list — what "Unlock Range…" asks for.
   */
  args?: ItemsPaneArgs;
}

/**
 * The protected-ranges task pane: the generic anchored-items list driven by
 * {@link ProtectedRangeItemsDescriptor}.
 */
export const ProtectedRangeDetailsPanel =
  memo(forwardRef<HTMLDivElement, ProtectedRangeDetailsPanelProps>((props, refForwarded) => {
  const {
    workbook,
    args,
    ...rest
  } = props;
  return (
    <AnchorItemsPanel
      ref={refForwarded}
      workbook={workbook}
      descriptor={ProtectedRangeItemsDescriptor}
      args={args}
      {...rest}
    />
  );
}));

ProtectedRangeDetailsPanel.displayName = 'ProtectedRangeDetailsPanel';
