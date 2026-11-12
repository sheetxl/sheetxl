import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box, type Theme } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { type ICellStyle } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import {
  ICON_CATALOG, IconSetGlyphs, NO_CELL_ICON,
  type ConditionalIconCatalogEntry, type ConditionalIconSpec
} from '@sheetxl/react';

import {
  ExhibitPopupIconButton, defaultRenderPopupPanel,
  type ExhibitPopupIconButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { PresetChip } from './PresetChip';
import { iconDisplayName } from './iconSetMessages';

const NO_CELL_ICON_KEY = messageKey('conditionalFormat.noCellIcon');
const CELL_ICON_KEY = messageKey('conditionalFormat.cellIcon');

/** Where a band's icon comes from: a set and an index into it. */
export type IconAddress = { set: ICellStyle.IconSet, id: number };

/** Excel's list: the fifty-two icons, eight to a row, no headings. */
const PICKER_COLUMNS = 8;

/** The outline a chip draws when it is the icon the band already has. */
const selectedSx = {
  borderColor: 'primary.main',
  boxShadow: (theme: Theme) => `inset 0 0 0 1px ${theme.palette.primary.main}`
};

const CHIP_SX = { width: '28px', height: '26px' };

const sameIcon = (a: ConditionalIconSpec | null, b: ConditionalIconSpec): boolean =>
  !!a && a.iconKey === b.iconKey && a.color === b.color;

interface IconCatalogPanelProps {
  icon: ConditionalIconSpec | null;
  onPick: (icon: IconAddress) => void;
}

/**
 * Excel's custom-icon list: "No Cell Icon", then the fifty-two icons in one flat grid.
 *
 * @remarks
 * The band's current icon is marked by what it DRAWS, not by the address the rule stores — a
 * green up arrow borrowed from `5Arrows` is the same chip as the one `3Arrows` draws.
 */
const IconCatalogPanel = memo<IconCatalogPanelProps>((props) => {
  const { icon, onPick } = props;
  const t = useTranslator();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 8px' }}>
      <PresetChip
        sheet
        title={t(NO_CELL_ICON_KEY)}
        aria-pressed={icon === null}
        sx={{ ...CHIP_SX, ...(icon === null ? selectedSx : null) }}
        onClick={() => { onPick({ ...NO_CELL_ICON }); }}
      >
        {/* Nothing drawn is the point; the slot keeps the chip's footprint. */}
        <IconSetGlyphs icons={[null]} size={16} />
      </PresetChip>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PICKER_COLUMNS}, auto)`,
          justifyContent: 'start',
          gap: '3px'
        }}
      >
        {ICON_CATALOG.map((entry: ConditionalIconCatalogEntry) => {
          const selected = sameIcon(icon, entry.spec);
          return (
            <PresetChip
              key={`${entry.set}:${entry.id}`}
              sheet
              title={iconDisplayName(t, entry.spec)}
              aria-pressed={selected}
              sx={{ ...CHIP_SX, ...(selected ? selectedSx : null) }}
              onClick={() => { onPick({ set: entry.set, id: entry.id }); }}
            >
              <IconSetGlyphs icons={[entry.spec]} size={16} />
            </PresetChip>
          );
        })}
      </Box>
    </Box>
  );
});

IconCatalogPanel.displayName = 'IconCatalogPanel';

export interface IconPickerPopupButtonProps extends Omit<ExhibitPopupIconButtonProps, 'icon' | 'renderPopupPanel'> {
  /** What the band draws now, or `null` for nothing. */
  icon: ConditionalIconSpec | null;
  /**
   * Called with the address of the picked icon — a set and an index into it, or
   * {@link NO_CELL_ICON} for none.
   */
  onPick: (icon: IconAddress) => void;
}

/**
 * One band's icon as a button that opens Excel's custom-icon list.
 *
 * @remarks
 * The button shows what the band draws, so a column of them reads the same as the rule preview.
 * Picking closes the list: the choice is the whole interaction, there is nothing to confirm.
 */
export const IconPickerPopupButton = memo(
  forwardRef<HTMLElement, IconPickerPopupButtonProps>((props, refForwarded) => {
  const {
    icon,
    onPick,
    tooltip,
    ...rest
  } = props;

  const t = useTranslator();

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { closeFloat } = panelProps;
    const children = (
      <IconCatalogPanel
        icon={icon}
        onPick={(picked) => {
          // Close first: the pick re-renders the rule, and this panel with it.
          closeFloat?.();
          onPick(picked);
        }}
      />
    );
    return defaultRenderPopupPanel({ ...panelProps, children });
  }, [icon, onPick]);

  return (
    <ExhibitPopupIconButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      tooltip={tooltip ?? t(CELL_ICON_KEY)}
      icon={<IconSetGlyphs icons={[icon]} size={16} />}
      outlined
      {...rest}
    />
  );
}));

IconPickerPopupButton.displayName = 'IconPickerPopupButton';
