import type React from 'react';
import { memo, useCallback } from 'react';

import {
  Box, Checkbox, FormControlLabel, Typography
} from '@mui/material';

import { CommonUtils, IConditionalFormat, ICellStyle } from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';

import {
  IconSetGlyphs, defaultIconStops, getConditionalIconSet, iconSetSize, resolveIconSetIcons,
  withIconOverride
} from '@sheetxl/react';

import {
  ExhibitPopupIconButton, defaultRenderPopupPanel, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { ScaleStopRow } from './ScaleStopRow';
import { RuleSection } from './RuleSection';
import { IconPickerPopupButton } from './IconPickerPopupButton';
import { ICON_SET_PRESET_GROUPS, ScalePresetGallery } from './PresetScalesCommandButton';

// const ICON_SET_KEY = messageKey('conditionalFormat.iconSet');

const THRESHOLD_TYPES: readonly IConditionalFormat.ColorStopType[] = [
  IConditionalFormat.ColorStopType.Percent,
  IConditionalFormat.ColorStopType.Num,
  IConditionalFormat.ColorStopType.Percentile,
  IConditionalFormat.ColorStopType.Formula
];

/** Glyph size on the set picker's face, in px. */
const GLYPH_SIZE = 14;
const GLYPH_GAP = 3;
/** The face is always a five-icon set wide, the icons centered in it — the rule preview's shape. */
const FACE_WIDTH = 5 * GLYPH_SIZE + 4 * GLYPH_GAP;

export interface IconSetRulePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  scale: IConditionalFormat.IconSet;
  onScaleChange: (scale: IConditionalFormat.IconSet) => void;
  readOnly?: boolean;
}

/**
 * The Icon Sets tab: the set as a dropdown opening the menu's own gallery, show-icons-only and
 * reverse, then one row per band — the band's icon (which may be borrowed from any set, or be
 * none) and its threshold.
 *
 * @remarks
 * The gallery offers exactly the sets `ICellStyle.IconSet` names, so a rule authored here always
 * round-trips — including the three Excel 2010 sets that can only be written into the x14
 * extension. A set name adopted from a file that is none of them is shown by name and left as it
 * is; picking any preset replaces it.
 *
 * The dropdown's face is the set's own icons, so it repeats the rule preview above it — the
 * price of a picker that fits the pane; a strip of all twenty did not. Picking a set
 * clears per-band icons (they were chosen against the old set) and re-bands only when the size
 * changes, so authored thresholds survive a same-size switch.
 */
export const IconSetRulePanel = memo<IconSetRulePanelProps>((props) => {
  const {
    scale,
    onScaleChange,
    readOnly,
    ...rest
  } = props;

  const t = useTranslator();

  const iconSet = scale.iconSet ?? ICellStyle.IconSet.TrafficLights3;
  const isAdopted = getConditionalIconSet(iconSet).length === 0;
  const stops = scale.stops ?? [];
  const count = stops.length;
  // What each row draws, in row order — the sheet's own lookup, so the rows and the preview agree.
  const rowIcons = resolveIconSetIcons(scale);

  const update = (updates: Partial<IConditionalFormat.IconSet>): void => {
    const next: any = { ...scale };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    onScaleChange(next);
  };

  const handleSetChange = (name: ICellStyle.IconSet): void => {
    if (name === iconSet) return;
    const size = iconSetSize(name);
    let nextStops = stops;
    if (size !== stops.length) {
      // Re-band evenly; per-stop authored thresholds only survive a same-size switch.
      nextStops = defaultIconStops(size);
    }
    update({ iconSet: name, stops: nextStops, icon: undefined });
  };

  const createSetPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { closeFloat } = panelProps;
    const children = (
      <ScalePresetGallery
        groups={ICON_SET_PRESET_GROUPS}
        disabled={readOnly}
        onPick={(preset) => {
          // Close first: the pick re-renders the rule, and this panel with it.
          closeFloat?.();
          if (preset.type === IConditionalFormat.ScaleType.IconSet && preset.iconSet) {
            handleSetChange(preset.iconSet);
          }
        }}
      />
    );
    return defaultRenderPopupPanel({ ...panelProps, children });
  // The pick reads the rule through `handleSetChange`, which closes over the current scale.
  }, [readOnly, scale]);

  const setName = CommonUtils.camelToPrettyCase(iconSet);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      {...rest}
    >
      <RuleSection>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExhibitPopupIconButton
            outlined
            disabled={readOnly}
            label={setName}
            tooltip={setName}
            icon={
              <Box sx={{ width: `${FACE_WIDTH}px`, display: 'flex', justifyContent: 'center' }}>
                {isAdopted
                  // An adopted set has no glyphs; its name is the whole face.
                  ? <Typography variant="caption" noWrap>{setName}</Typography>
                  : <IconSetGlyphs icons={getConditionalIconSet(iconSet)} order="descending" size={GLYPH_SIZE} gap={GLYPH_GAP} />}
              </Box>
            }
            renderPopupPanel={createSetPopupPanel}
          />
        </Box>
        {isAdopted && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('conditionalFormat.adoptedIconSet')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Excel's spelling — the checkbox is the INVERSE of the wire's `showValue`. */}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={scale.showValue === false}
                disabled={readOnly}
                onChange={(e) => update({ showValue: e.target.checked ? false : undefined })}
              />
            }
            label={<Typography variant="body2">{t('conditionalFormat.showIconsOnly')}</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={scale.reverse ?? false}
                disabled={readOnly}
                onChange={(e) => update({ reverse: e.target.checked ? true : undefined })}
              />
            }
            label={<Typography variant="body2">{t('conditionalFormat.reverseIcons')}</Typography>}
          />
        </Box>
      </RuleSection>

      <RuleSection variant="config">
        {stops.map((stop, i) => {
          // The row shows band `i` AFTER reverse has turned it; the override is stored by the
          // turned band, so what the user sees change is what changes.
          const band = scale.reverse ? count - 1 - i : i;
          return (
            // The first band is "everything below the next threshold" — it has no threshold of its
            // own, so its threshold controls are dead. They still DRAW the `>=` the others have:
            // hiding them shortens the row and the column of thresholds stops lining up. The icon
            // stays live, and is what names the row — no "Icon 1" label.
            <ScaleStopRow
              key={i}
              stop={stop}
              allowedTypes={THRESHOLD_TYPES}
              showExclusive
              readOnly={readOnly || i === 0}
              leading={
                <IconPickerPopupButton
                  icon={rowIcons[i] ?? null}
                  disabled={readOnly || isAdopted}
                  onPick={(picked) => onScaleChange(withIconOverride(scale, band, picked))}
                />
              }
              onStopChange={(next) => {
                const nextStops = stops.slice();
                nextStops[i] = next;
                update({ stops: nextStops });
              }}
            />
          );
        })}
      </RuleSection>
    </Box>
  );
});

IconSetRulePanel.displayName = 'IconSetRulePanel';
