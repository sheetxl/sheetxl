import type React from 'react';
import { memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IConditionalFormat, type IWorkbook } from '@sheetxl/sdk';

import { useCommands, useTranslator } from '@sheetxl/utils-react';

import {
  COLOR_SCALE_PRESETS, DATA_BAR_PRESETS, ICON_SET_GALLERY_BLOCKS, IconSetGlyphs, getConditionalIconSet,
  iconSetPreset, useWorkbook
} from '@sheetxl/react';

import {
  CommandPopupButton, ExhibitMenuHeader, defaultRenderPopupPanel,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { PresetChip } from './PresetChip';
import { toPreviewColor } from './previewColor';
import {
  ScaleMiniGrid, colorScaleRows, dataBarRows, GRID_ACCENT_COLOR, GRID_CELL_BACKGROUND
} from './ScaleMiniGrid';
import { ICON_GROUP_MESSAGE_KEYS } from './iconSetMessages';

/** The galleries this button offers, keyed by the kind of scale its command writes. */
export type PresetScaleType = 'dataBar' | 'colorScale' | 'iconSet';

/** One captioned block of swatches. */
export interface PresetGroup {
  /** Message key of the block's heading. */
  labelKey: string;
  /** Row-major; a `null` is an empty seat, so a block can end a row early. */
  presets: readonly (IConditionalFormat.Scale | null)[];
  /**
   * Swatches per row.
   * @defaultValue 3
   */
  columns?: number;
}

/**
 * Excel's two data-bar blocks — the same six colors, gradient then solid.
 */
const DATA_BAR_GROUPS: readonly PresetGroup[] = Object.freeze([
  {
    labelKey: messageKey('conditionalFormat.gradientFill'),
    presets: DATA_BAR_PRESETS.filter((preset) => !preset.solidFill)
  },
  {
    labelKey: messageKey('conditionalFormat.solidFill'),
    presets: DATA_BAR_PRESETS.filter((preset) => preset.solidFill)
  }
]);

/**
 * The color scales, split by stop count.
 *
 * @remarks
 * Excel shows all twelve as one unlabeled 4×3 block. Split, they read the way the data bars do —
 * two captioned blocks — and the caption is the one thing a swatch cannot say: whether the rule has
 * a midpoint. It is also the tab's own vocabulary (the editor's 2-Color / 3-Color switch).
 */
const COLOR_SCALE_GROUPS: readonly PresetGroup[] = Object.freeze([
  {
    labelKey: messageKey('conditionalFormat.threeColor'),
    presets: COLOR_SCALE_PRESETS.filter((preset) => preset.stops.length === 3)
  },
  {
    labelKey: messageKey('conditionalFormat.twoColor'),
    presets: COLOR_SCALE_PRESETS.filter((preset) => preset.stops.length === 2)
  }
]);

/**
 * The twenty icon sets, two abreast under Excel's four gallery headings — Excel Online's layout,
 * a colored family beside its gray twin.
 */
export const ICON_SET_PRESET_GROUPS: readonly PresetGroup[] = Object.freeze(
  ICON_SET_GALLERY_BLOCKS.map((block) => ({
    labelKey: ICON_GROUP_MESSAGE_KEYS[block.key],
    columns: 2,
    presets: block.rows.flatMap(([left, right]) => [iconSetPreset(left), right ? iconSetPreset(right) : null])
  }))
);

const GROUPS_BY_TYPE: Record<PresetScaleType, readonly PresetGroup[]> = {
  dataBar: DATA_BAR_GROUPS,
  colorScale: COLOR_SCALE_GROUPS,
  iconSet: ICON_SET_PRESET_GROUPS
};

/** Six per block, three across — Excel's own shape for the data-bar and color-scale galleries. */
const GALLERY_COLUMNS = 3;

/** Glyph size in an icon-set swatch, in px. */
const ICON_GLYPH_SIZE = 14;
const ICON_GLYPH_GAP = 3;
/**
 * Every icon-set swatch is the width of a FIVE-icon set, so a three-icon set does not shrink its
 * chip: the gallery stays a grid, and the eye compares sets rather than chip widths.
 */
const ICON_CHIP_WIDTH = 5 * ICON_GLYPH_SIZE + 4 * ICON_GLYPH_GAP + 12;

/** What one swatch paints, top row first. */
const previewRows = (
  scale: IConditionalFormat.Scale,
  workbook: IWorkbook | null
): React.ReactNode[] => {
  if (scale.type === IConditionalFormat.ScaleType.DataBar) {
    // `'adaptive'` (not the raw hex) so the bar previews through the same dark transform the sheet
    // paints it with — the mini grid adopts the GRID's light/dark, which is not the menu's.
    return dataBarRows(scale, toPreviewColor(scale.color, workbook)?.toCSS('adaptive') ?? GRID_ACCENT_COLOR);
  }
  if (scale.type === IConditionalFormat.ScaleType.ColorScale) {
    return colorScaleRows(scale.stops ?? [], GRID_CELL_BACKGROUND, workbook);
  }
  return [];
};

/**
 * What one swatch shows.
 *
 * @remarks
 * The two color scales are a few cells of sheet; an icon set is not grid-shaped — it is its
 * icons in a row, highest first, the way Excel pictures a set.
 */
const previewOf = (
  scale: IConditionalFormat.Scale,
  workbook: IWorkbook | null
): React.ReactNode => {
  if (scale.type === IConditionalFormat.ScaleType.IconSet) {
    return (
      <IconSetGlyphs
        icons={getConditionalIconSet(scale.iconSet!)}
        order="descending"
        size={ICON_GLYPH_SIZE}
        gap={ICON_GLYPH_GAP}
      />
    );
  }
  return <ScaleMiniGrid rows={previewRows(scale, workbook)} />;
};

export interface ScalePresetGalleryProps {
  groups: readonly PresetGroup[];
  /** Called with the picked preset. */
  onPick: (preset: IConditionalFormat.Scale) => void;
  disabled?: boolean;
}

/**
 * The swatch grid a preset gallery shows — the menu flyouts, and the icon-set tab's picker.
 */
export const ScalePresetGallery = memo<ScalePresetGalleryProps>((props) => {
  const { groups, onPick, disabled } = props;

  const t = useTranslator();
  const workbook = useWorkbook();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        padding: '2px 8px 4px'
      }}
    >
      {groups.map((group: PresetGroup) => (
        <Box key={group.labelKey}>
          <ExhibitMenuHeader>
            {t(group.labelKey)}
          </ExhibitMenuHeader>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${group.columns ?? GALLERY_COLUMNS}, auto)`,
              gap: '3px',
              marginBottom: '4px'
            }}
          >
            {group.presets.map((preset: IConditionalFormat.Scale | null, i: number) => preset === null ? (
              <Box key={i} />
            ) : (
              <PresetChip
                key={i}
                sheet
                disabled={disabled}
                // Roomier than the editor's strip: a menu has the width, and these swatches are the
                // only description a preset gets.
                sx={preset.type === IConditionalFormat.ScaleType.IconSet
                  ? { width: `${ICON_CHIP_WIDTH}px`, height: '32px' }
                  : { width: '44px', height: '32px' }}
                onClick={() => { onPick(preset); }}
              >
                {previewOf(preset, workbook)}
              </PresetChip>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
});

ScalePresetGallery.displayName = 'ScalePresetGallery';

interface CommandPresetGalleryProps {
  commandKey: string;
  groups: readonly PresetGroup[];
  disabled?: boolean;
}

/**
 * A gallery whose pick executes a command.
 *
 * @remarks
 * The command is resolved *here*, inside the popup, not by the button that opened it: `useCommands`
 * dismisses its enclosing float on execute, so picking a preset closes the menu it was picked from.
 */
const CommandPresetGallery = memo<CommandPresetGalleryProps>((props) => {
  const { commandKey, groups, disabled } = props;
  const command = useCommands([commandKey])[0];
  return (
    <ScalePresetGallery
      groups={groups}
      disabled={disabled}
      onPick={(preset) => { command?.execute(preset); }}
    />
  );
});

CommandPresetGallery.displayName = 'CommandPresetGallery';

export interface PresetScalesCommandButtonProps extends CommandPopupButtonProps {
  /** The command the gallery executes, with the picked preset as its payload. */
  commandKey: string;

  /** Which gallery to offer. */
  scaleType: PresetScaleType;
}

/**
 * A preset scale command as a **gallery flyout** — Excel's Home ▸ Conditional Formatting ▸ Data Bars
 * / Color Scales / Icon Sets.
 *
 * @remarks
 * The command still writes its default when executed bare (a keystroke, the command palette), so
 * this only adds a way to pick; it replaces no behavior.
 */
export const PresetScalesCommandButton = memo(
  forwardRef<HTMLElement, PresetScalesCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    scaleType,
    groupKey,
    disabled: propDisabled,
    ...rest
  } = props;

  const command = useCommands([commandKey])[0];
  const groups = GROUPS_BY_TYPE[scaleType];
  const isDisabled = propDisabled ?? (!command || command.disabled());

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const children = (
      <CommandPresetGallery
        commandKey={commandKey}
        groups={groups}
        disabled={isDisabled}
      />
    );
    return defaultRenderPopupPanel({ ...props, children });
  }, [commandKey, groups, isDisabled]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      // No quick command: the head opens the gallery (on hover, like every other submenu). Picking
      // is the action.
      label={command?.getLabel(groupKey)}
      icon={command?.getIcon(groupKey)}
      tooltip={command?.getDescription(groupKey)}
      groupKey={groupKey}
      disabled={isDisabled}
      {...rest}
    />
  );
}));

PresetScalesCommandButton.displayName = 'PresetScalesCommandButton';
