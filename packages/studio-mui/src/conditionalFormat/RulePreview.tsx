import type React from 'react';
import { memo, useMemo } from 'react';

import { Box } from '@mui/material';

import {
  IConditionalFormat, IFont, IFill, type ICellStyle, type IColor, type IWorkbook
} from '@sheetxl/sdk';

import { IconSetGlyphs, resolveIconSetIcons, useModelSync } from '@sheetxl/react';

import { PresetChip } from './PresetChip';
import {
  ScaleMiniGrid, colorScaleRows, dataBarRows,
  GRID_CELL_BACKGROUND, GRID_ACCENT_COLOR, GRID_TEXT_COLOR, GRID_ERROR_COLOR
} from './ScaleMiniGrid';
import { toPreviewColor, usePreviewColors } from './previewColor';

/**
 * The color a stop was authored with, resolved for on-screen preview.
 *
 * @remarks
 * `'adaptive'` rather than a baked light/dark value: a system color emits `light-dark()` and the
 * browser re-resolves it from the `color-scheme` of the grid surface this preview adopts.
 */
const cssOf = (
  color: IColor.Serializable | null | undefined,
  workbook: IWorkbook | null,
  fallback: string
): string => {
  return toPreviewColor(color, workbook)?.toCSS('adaptive') ?? fallback;
};

const previewFill = (fill: ICellStyle.Properties['fill'], workbook: IWorkbook | null, fallback: string): string => {
  if (!fill) return fallback;
  if (typeof fill === 'string') return cssOf(fill, workbook, fallback);
  const type = (fill as IFill.Properties).type;
  if (type === IFill.Type.None) return fallback;
  const solid = fill as IFill.SolidProperties;
  const pattern = fill as IFill.PatternProperties;
  return cssOf(pattern.foreground ?? solid.color ?? pattern.background, workbook, fallback);
};

export interface RulePreviewProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The rule to preview. Read, never mutated.
   */
  conditionalFormat: IConditionalFormat;
  /**
   * Swatch height in px.
   * @defaultValue 28
   */
  size?: number;
}

/**
 * The rendering preview of what a rule paints: an `Aa` chip for a dxf, a few cells of sheet for a
 * color scale or data bar, the icons of an icon set.
 *
 * @remarks
 * With the grid not yet painting every rule type, this swatch — in the rule card and at the top of
 * the editor — is the authoring feedback loop, not decoration.
 */
export const RulePreview = memo<RulePreviewProps>((props) => {
  const { conditionalFormat, size = 28, ...rest } = props;
  const { workbook, themeKey } = usePreviewColors();

  // The rule mutates in place while it is edited — the prop identity never changes, so this
  // subscription (not the memo'd props) is what keeps the preview live.
  useModelSync<IConditionalFormat.IListeners>(conditionalFormat, 'onAnyChange');

  const scale = conditionalFormat.getScale();
  const ruleStyle = conditionalFormat.getStyle();

  // A dxf is a DIFF against the cell's own style, so the preview's base is the workbook's Normal
  // style — the same font the untouched grid shows — with the rule's overrides on top.
  const normalFontCss = useMemo((): React.CSSProperties => {
    try {
      // `'adaptive'`, like every other color here — the chip's own grid surface carries the
      // `color-scheme` the browser resolves it against.
      return (workbook?.getStyles().getNormal().getFont().toCSS('adaptive') ?? {}) as React.CSSProperties;
    } catch {
      return {};
    }
  }, [workbook, themeKey]);

  const body = useMemo(() => {
    if (scale?.type === IConditionalFormat.ScaleType.ColorScale) {
      return (
        <ScaleMiniGrid rows={colorScaleRows(scale.stops ?? [], GRID_CELL_BACKGROUND, workbook)} />
      );
    }
    if (scale?.type === IConditionalFormat.ScaleType.DataBar) {
      return (
        <ScaleMiniGrid
          rows={dataBarRows(
            scale,
            cssOf(scale.color, workbook, GRID_ACCENT_COLOR),
            scale.borderColor ? cssOf(scale.borderColor, workbook, GRID_ACCENT_COLOR) : undefined
          )}
        />
      );
    }
    if (scale?.type === IConditionalFormat.ScaleType.IconSet) {
      // The icons the rule resolves to — set, per-band overrides and reverse applied — highest
      // first, the way a set is pictured; the sheet draws from the same lookup.
      return (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', px: 0.5
        }}>
          <IconSetGlyphs icons={resolveIconSetIcons(scale)} order="descending" size={14} gap={3} />
        </Box>
      );
    }
    // A predicate rule previews its dxf.
    const font = ruleStyle?.font;
    const underline = font?.underline && font.underline !== IFont.UnderlineStyle.None;
    return (
      <Box sx={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Normal first, the dxf's own facets over it — a facet the rule does not carry must show
        // Normal's value, not a hardcoded default.
        ...normalFontCss,
        backgroundColor: previewFill(ruleStyle?.fill, workbook, 'transparent'),
        ...(font?.color && font.color !== 'auto'
          ? { color: cssOf(font.color, workbook, GRID_TEXT_COLOR) }
          : null),
        ...(font?.weight ? { fontWeight: font.weight } : null),
        ...(font?.style ? { fontStyle: font.style } : null),
        textDecoration: [
          underline ? 'underline' : '',
          font?.strike ? 'line-through' : ''
        ].join(' ').trim() || 'none',
        // Normal's point size is a CELL size; the chip is a few dozen pixels, so the one facet
        // that cannot come from Normal is the size.
        fontSize: `${Math.round(size * 0.5)}px`,
        lineHeight: 1,
        // The red-border preset has no fill or font to show — outline the chip itself.
        outline: ruleStyle?.borders
          ? `1px solid ${cssOf((Object.values(ruleStyle.borders)[0] as any)?.color, workbook, GRID_ERROR_COLOR)}`
          : undefined,
        outlineOffset: '-3px'
      }}>
        Aa
      </Box>
    );
  }, [scale, ruleStyle, size, normalFontCss, workbook, themeKey]);

  return (
    // The same chip the preset strips are built from, so a rule and the preset it came from are
    // drawn by one control — `sheet` is what puts both on the grid's paper and light/dark rather
    // than the card's.
    <PresetChip
      sheet
      className="sxl-cf-rule-preview"
      sx={{
        // The gallery's fixed footprint does not fit here: the card and the editor header ask for
        // different heights, and a scale preview needs room to be more than one cell wide.
        width: 'auto',
        minWidth: `${size * 1.7}px`,
        height: `${size}px`
      }}
      {...rest}
    >
      {body}
    </PresetChip>
  );
});

RulePreview.displayName = 'RulePreview';
