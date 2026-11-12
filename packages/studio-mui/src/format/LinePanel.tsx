import type React from 'react';
import { memo, useMemo } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IFill, IStroke, type IColor, type IStyleCollection } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator } from '@sheetxl/utils-react';

import { ColorPopupButton } from '../color';

import { FormatSection, FormatRow, FormatNumberField, panelSx } from './FormatPanelParts';
import { DashIcon, LineEndPopupButton, PreviewPopupButton, type PreviewOption } from './LinePreviews';

/**
 * What the Line panel needs: one line to show and one place to write a line.
 */
export interface LineSelection {
  /** The line the controls show, resolved: what the shape states over its theme style. */
  stroke: IStroke;
  /**
   * What the shape states of its line itself, or `null` for nothing. The color picker shows the
   * **Automatic** swatch when the color is the theme's rather than stated.
   */
  stated: IStroke.JSON | null;
  /** The color the line takes when none is stated — the picker's **Automatic** swatch. */
  autoColor: IColor;
  /** The workbook's style collection — theme swatches and recent colors for the picker. */
  styles: IStyleCollection;
  /** Theme color resolution for the color picker. */
  schemeLookup: IColor.SchemeLookup;
  /** Whether the GRID renders dark (not the app chrome) — swatches follow the grid. */
  darkMode: boolean;
  /** True when the line cannot be changed (a protected sheet). */
  disabled: boolean;
  /**
   * Writes a line as one undoable step.
   *
   * @param stroke Line properties that merge into what is stated, or `null` for the theme's line.
   * @param description A `messageKey('op.…')` naming the step in the undo history.
   */
  applyStroke: (stroke: IStroke.Modifiers | null, description?: string) => void;
}

export interface LinePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The line the panel reads and writes. */
  selection: LineSelection;
  /** Force every control off, on top of the selection's own {@link LineSelection.disabled}. */
  disabled?: boolean;
}

/** The line kinds the type dropdown offers: Excel's No line and Solid line. */
const LineType = { None: 'none', Solid: 'solid' } as const;
type LineType = typeof LineType[keyof typeof LineType];

/** The dashes Excel's Dash type list offers, in its order. Any other dash shows as custom. */
const DASHES: readonly IStroke.DashStyle[] = [
  IStroke.DashStyle.Solid,
  IStroke.DashStyle.SysDot,
  IStroke.DashStyle.SysDash,
  IStroke.DashStyle.Dash,
  IStroke.DashStyle.DashDot,
  IStroke.DashStyle.LongDash,
  IStroke.DashStyle.LongDashDot,
  IStroke.DashStyle.LongDashDotDot,
];
const CUSTOM_DASH = 'custom';

const CAPS: readonly IStroke.LineCap[] = [IStroke.LineCap.Square, IStroke.LineCap.Round, IStroke.LineCap.Butt];
const JOINS: readonly IStroke.LineJoin[] = [IStroke.LineJoin.Round, IStroke.LineJoin.Bevel, IStroke.LineJoin.Miter];
const ENDS: readonly IStroke.LineEndType[] = [
  IStroke.LineEndType.None,
  IStroke.LineEndType.Triangle,
  IStroke.LineEndType.Arrow,
  IStroke.LineEndType.Stealth,
  IStroke.LineEndType.Diamond,
  IStroke.LineEndType.Oval,
];
const SIZES: readonly IStroke.LineEndSize[] = [IStroke.LineEndSize.Small, IStroke.LineEndSize.Medium, IStroke.LineEndSize.Large];

/** Excel's widest line, in points. */
const MAX_WIDTH = 1584;

/**
 * The **Line** section of Format Shape: whether a line is drawn, and its color, width, dash,
 * arrowheads, caps and joins, applying live.
 *
 * @remarks
 * Excel shows the controls only while a line is drawn; so does this. The dash and the arrowheads
 * are picked from previews drawn in the line's color, the way the border style picker offers its
 * strokes, which is what lets the begin arrow, the dash and the end arrow sit on one row. An arrow
 * is one button, as a border is: the types in its list, each type's sizes in a submenu.
 *
 * The color picker's **Automatic** swatch is the theme style's color, which is what a line that
 * states a width alone draws with, so picking it hands the color back rather than writing the
 * theme's value down.
 */
export const LinePanel = memo((props: LinePanelProps) => {
  const {
    selection,
    disabled: propDisabled,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const { stroke, stated, autoColor, applyStroke, schemeLookup, styles, darkMode } = selection;
  const disabled = propDisabled || selection.disabled;

  const visible = stroke.isVisible();
  const lineType: LineType = visible ? LineType.Solid : LineType.None;

  // The picker reads `null` as the Automatic swatch: a line whose color is the theme's.
  const ownColor = stated?.fill && stated.fill.type !== IFill.Type.None;
  const color = ownColor ? stroke.getFill().getColor() : null;
  // What the previews draw in: the line's color, whichever of the two it is.
  const previewColor = color ?? autoColor;

  const dash = stroke.getDash();
  const dashValue = typeof dash === 'string' && (DASHES as readonly string[]).includes(dash) ? dash : CUSTOM_DASH;
  const head = stroke.getHead();
  const tail = stroke.getTail();

  const recentColors = useCallbackRef(() => styles.recentColors(), [styles]);

  const changeLineType = useCallbackRef((next: LineType) => {
    if (next === lineType) return;
    if (next === LineType.None) {
      applyStroke({ fill: { type: IFill.Type.None } }, messageKey('op.setShapeStroke'));
    } else {
      // A line again: the color the theme gives, unless the width was what hid it.
      applyStroke({ fill: null, width: stroke.getWidth() > 0 ? undefined : null }, messageKey('op.setShapeStroke'));
    }
  }, [lineType, stroke, applyStroke]);

  const applyColor = useCallbackRef((next: IColor | null, isCustom?: boolean) => {
    if (next && isCustom) styles.addRecentColor(next);
    applyStroke({ fill: next ? next.toString() : null }, messageKey('op.setStrokeColor'));
  }, [applyStroke, styles]);

  const applyWidth = useCallbackRef((width: number) => {
    applyStroke({ width }, messageKey('op.setStrokeWidth'));
  }, [applyStroke]);

  const applyDash = useCallbackRef((next: string) => {
    if (next === CUSTOM_DASH) return;
    applyStroke({ dash: next as IStroke.DashStyle }, messageKey('op.setStrokeDash'));
  }, [applyStroke]);

  const applyCap = useCallbackRef((lineCap: IStroke.LineCap) => {
    applyStroke({ lineCap }, messageKey('op.setStroke'));
  }, [applyStroke]);

  const applyJoin = useCallbackRef((lineJoin: IStroke.LineJoin) => {
    applyStroke({ lineJoin }, messageKey('op.setStroke'));
  }, [applyStroke]);

  /** An end as picked: a type at the current size, a type and size, or `null` for none. */
  const applyEnd = useCallbackRef((which: 'head' | 'tail', end: IStroke.LineEnd | null) => {
    applyStroke({ [which]: end }, messageKey('op.setLineEnds'));
  }, [applyStroke]);

  /** Literal `t()` pairs, so the extractor can see every key. */
  const labels = useMemo(() => ({
    dash: {
      [IStroke.DashStyle.Solid]: t('line.dash.solid'),
      [IStroke.DashStyle.SysDot]: t('line.dash.sysDot'),
      [IStroke.DashStyle.SysDash]: t('line.dash.sysDash'),
      [IStroke.DashStyle.Dash]: t('line.dash.dash'),
      [IStroke.DashStyle.DashDot]: t('line.dash.dashDot'),
      [IStroke.DashStyle.LongDash]: t('line.dash.lgDash'),
      [IStroke.DashStyle.LongDashDot]: t('line.dash.lgDashDot'),
      [IStroke.DashStyle.LongDashDotDot]: t('line.dash.lgDashDotDot'),
      [CUSTOM_DASH]: t('line.dashCustom'),
    } as Record<string, string>,
    cap: {
      [IStroke.LineCap.Square]: t('line.capSquare'),
      [IStroke.LineCap.Round]: t('line.capRound'),
      [IStroke.LineCap.Butt]: t('line.capFlat'),
    } as Record<string, string>,
    join: {
      [IStroke.LineJoin.Round]: t('line.joinRound'),
      [IStroke.LineJoin.Bevel]: t('line.joinBevel'),
      [IStroke.LineJoin.Miter]: t('line.joinMiter'),
    } as Record<string, string>,
    end: {
      [IStroke.LineEndType.None]: t('line.end.none'),
      [IStroke.LineEndType.Triangle]: t('line.end.triangle'),
      [IStroke.LineEndType.Arrow]: t('line.end.arrow'),
      [IStroke.LineEndType.Stealth]: t('line.end.stealth'),
      [IStroke.LineEndType.Diamond]: t('line.end.diamond'),
      [IStroke.LineEndType.Oval]: t('line.end.oval'),
    } as Record<string, string>,
    size: {
      [IStroke.LineEndSize.Small]: t('line.sizeSmall'),
      [IStroke.LineEndSize.Medium]: t('line.sizeMedium'),
      [IStroke.LineEndSize.Large]: t('line.sizeLarge'),
    } as Record<string, string>,
  }), [t]);

  // The previews follow the line's color, so they are built per render; they are cheap SVGs.
  const dashOptions: PreviewOption<string>[] = DASHES.map((one) => ({
    value: one, label: labels.dash[one], icon: <DashIcon dash={one} color={previewColor} darkMode={darkMode}/>
  }));
  if (dashValue === CUSTOM_DASH) {
    dashOptions.push({ value: CUSTOM_DASH, label: labels.dash[CUSTOM_DASH], icon: <DashIcon dash={dash} color={previewColor} darkMode={darkMode}/> });
  }
  // Full width for a choice that changes the controls below it (the line type), its own width
  // for one that does not (cap, join).
  const select = <V extends string>(label: string, value: V, values: readonly V[], names: Record<string, string>, onChange: (next: V) => void, width?: number): React.ReactElement => (
    <FormControl size="small" fullWidth={width === undefined} sx={width === undefined ? undefined : { width }}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        label={label}
        notched
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {values.map((one) => <MenuItem key={one} value={one}>{names[one]}</MenuItem>)}
      </Select>
    </FormControl>
  );

  return (
    <Box
      className={clsx('sxl-format-line-panel', propClassName)}
      sx={panelSx}
      {...rest}
    >
      <FormatSection>
        {select(t('line.type'), lineType, [LineType.None, LineType.Solid], {
          [LineType.None]: t('line.typeNone'),
          [LineType.Solid]: t('line.typeSolid'),
        }, changeLineType)}
      </FormatSection>

      {visible ? (
        <>
          <FormatSection label={t('line.color')}>
            <FormatRow>
              <ColorPopupButton
                icon="stroke.colored"
                disabled={disabled}
                darkMode={darkMode}
                compareRGB={true}
                selectedColor={color}
                onSelectColor={applyColor}
                propsPanel={{
                  disableAlpha: true,
                  autoColor,
                  schemeLookup,
                  recentColors
                }}
              />
              <FormatNumberField
                label={t('line.width')}
                value={stroke.getWidth()}
                min={0}
                max={MAX_WIDTH}
                step={0.25}
                decimals
                width={96}
                disabled={disabled}
                onChange={applyWidth}
              />
            </FormatRow>
          </FormatSection>

          {/* Begin arrow, dash, end arrow on one row under one label, as the color and width are; an
              arrow's button holds its type and size, and each button names itself in its tooltip. */}
          <FormatSection label={t('line.dashArrows')}>
            <FormatRow>
              <LineEndPopupButton
                end={head}
                atStart
                color={previewColor}
                darkMode={darkMode}
                types={ENDS}
                sizes={SIZES}
                typeLabels={labels.end}
                sizeLabels={labels.size}
                widthLabel={t('line.sizeWidth')}
                lengthLabel={t('line.sizeLength')}
                tooltip={t('line.head')}
                disabled={disabled}
                onSelect={(end) => applyEnd('head', end)}
              />
              <PreviewPopupButton
                value={dashValue}
                options={dashOptions}
                onSelect={applyDash}
                tooltip={t('line.dash')}
                disabled={disabled}
              />
              <LineEndPopupButton
                end={tail}
                color={previewColor}
                darkMode={darkMode}
                types={ENDS}
                sizes={SIZES}
                typeLabels={labels.end}
                sizeLabels={labels.size}
                widthLabel={t('line.sizeWidth')}
                lengthLabel={t('line.sizeLength')}
                tooltip={t('line.tail')}
                disabled={disabled}
                onSelect={(end) => applyEnd('tail', end)}
              />
            </FormatRow>
          </FormatSection>

          <FormatSection label={t('line.capJoin')}>
            <FormatRow>
              {select(t('line.cap'), stroke.getLineCap(), CAPS, labels.cap, applyCap, 128)}
              {select(t('line.join'), stroke.getLineJoin(), JOINS, labels.join, applyJoin, 128)}
            </FormatRow>
          </FormatSection>
        </>
      ) : null}
    </Box>
  );
});

LinePanel.displayName = 'LinePanel';
