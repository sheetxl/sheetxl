import type React from 'react';
import { memo, useMemo } from 'react';

import clsx from 'clsx';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Select } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IFill, IColor, Color, type ICell, type IStyleCollection } from '@sheetxl/sdk';

import { useCallbackRef, useCommands, useTranslator } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { ColorPopupButton, AutoColorPosition } from '../color';
import {
  PatternPopupButton, GradientEditor, toGradientValue, toPatternSlots, DEFAULT_GRADIENT,
  type GradientValue, type GradientStopValue
} from '../fill';

import { FormatSection, FormatRow, panelSx, onReselect } from './FormatPanelParts';
import { type FormatSelection } from './useFormatSelection';

/** The tile a cell gets when it is switched to a pattern fill and has no pattern of its own yet. */
const DEFAULT_PATTERN = IFill.BuiltInSheetPattern.Gray125;

/** The picker's *No Fill* swatch — the same transparent sentinel the ribbon's fill command offers. */
const NO_FILL = new Color(IColor.Named.Transparent);
/**
 * What the Fill panel needs: one fill to show and one place to write a fill. A cell selection and a
 * shape both answer it, which is how the same panel serves Format Cells and Format Shape.
 */
export interface FillSelection {
  /** The fill the controls show, resolved: the anchor cell's, or the shape's. */
  fill: IFill;
  /** The workbook's style collection — theme swatches and recent colors for the pickers. */
  styles: IStyleCollection;
  /** Theme color resolution for the color pickers. */
  schemeLookup: IColor.SchemeLookup;
  /** Whether the GRID renders dark (not the app chrome) — swatches follow the grid. */
  darkMode: boolean;
  /** True when the fill cannot be changed (a protected sheet). */
  disabled: boolean;
  /** Mints a detached cell for the pattern swatches (theme colors resolve against the workbook). */
  createCell: (update: ICell.Update) => ICell | null;
  /**
   * Writes a fill as one undoable step.
   *
   * @param fill The fill, or fill properties that merge into what is there.
   * @param description A `messageKey('op.…')` naming the step in the undo history.
   */
  applyFill: (fill: IFill.Update, description?: string) => void;
}

/** The cell selection's fill: the anchor cell's, written to every selected range. */
export const fillSelectionOf = (selection: FormatSelection): FillSelection => ({
  fill: selection.style.getFill(),
  styles: selection.styles,
  schemeLookup: selection.schemeLookup,
  darkMode: selection.darkMode,
  disabled: selection.disabled,
  createCell: selection.createCell,
  applyFill: (fill: IFill.Update, description?: string): void => selection.applyStyle({ fill }, description),
});

export interface FillPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The fill the panel reads and writes. */
  selection: FillSelection;
  /** Force every control off, on top of the selection's own {@link FillSelection.disabled}. */
  disabled?: boolean;
  /**
   * The most stops the gradient editor will author. The model and the xlsx file take any number
   * (Excel draws them all; only its own dialog stops at two colors), so none is imposed here.
   * @defaultValue the editor's own, see {@link GradientEditorProps.maxStops}
   */
  maxGradientStops?: number;
}

/**
 * The **Fill** tab of the format pane — the one tab Excel Online does not have.
 *
 * @remarks
 * Excel buries pattern and gradient fills in a desktop-only "Fill Effects" sub-dialog, and Excel
 * Online drops them entirely: on the web, a cell's fill is a single color. The model here has
 * always carried all three (`IFill.Type.Solid | Pattern | Gradient`), so this tab surfaces them as
 * one choice — pick the KIND of fill, then edit that kind — rather than hiding two of the three
 * behind a button.
 *
 * `IFill.Type.None` is a fourth model type but not a fourth choice: it reads as Solid with the
 * picker's *No Fill* swatch selected, the same swatch the ribbon offers. Setting a color was the
 * common case and a No Fill entry in the type dropdown cost it an extra trip through that dropdown.
 *
 * Every control here reads {@link FormatSelection.style} and writes through
 * {@link FormatSelection.applyStyle} — solid included. The solid swatch used to be the ribbon's
 * `formatFillColor` command button, which reads and writes the SHEET's selection directly: correct
 * in the task pane, wrong the moment a caller hands these panels a selection of their own. The
 * command is still consulted for the picker's cross-surface memory (last-used color, recent
 * colors), just not for the value.
 */
export const FillPanel = memo((props: FillPanelProps) => {
  const {
    selection,
    disabled: propDisabled,
    maxGradientStops,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const { fill, applyFill, createCell, schemeLookup, styles, darkMode } = selection;
  const disabled = propDisabled || selection.disabled;

  const applyStyle = useCallbackRef((update: { fill: IFill.Update }, description?: string): void => {
    applyFill(update.fill, description);
  }, [applyFill]);

  const fillType = fill.getType();
  // No Fill lives on the color picker, so an unfilled cell still sits on Solid in the dropdown.
  const selectedType = fillType === IFill.Type.None ? IFill.Type.Solid : fillType;

  // The pattern controls speak in the dialog's roles, not the stored slots — they differ for a
  // solid tile (see `toPatternSlots`).
  const pattern = fillType === IFill.Type.Pattern ? (fill as IFill.IPattern) : null;
  const patternType = pattern?.getPatternType() ?? DEFAULT_PATTERN;
  const patternRoles = pattern
    ? toPatternSlots(patternType, pattern.getForeground(), pattern.getBackground())
    : null;
  // The pattern color's *Automatic* swatch — the theme's text color, which is also what the model
  // paints for a pattern with no foreground of its own.
  const autoPatternColor = useMemo(() => new Color(IColor.Scheme.Tx1, schemeLookup), [schemeLookup]);
  const patternForeground = patternRoles?.foreground ?? autoPatternColor;
  const patternBackground = patternRoles?.background ?? new Color(IColor.Named.Transparent, schemeLookup);

  // `null` is what the picker's No Fill swatch reads as — an unfilled cell, and a pattern or
  // gradient the user is switching away from, both land there rather than on a stale color.
  const solidColor = fillType === IFill.Type.Solid ? (fill as IFill.ISolid).getColor() : null;

  const recentColors = useCallbackRef(() => styles.recentColors(), [styles]);

  // The fill-color command carries the picker's "last used" memory as `quickColor` — the same
  // swatch the ribbon's split button offers. Switching a cell TO solid should land on it rather
  // than on a white the user never picked. The command supplies MEMORY only; the value the picker
  // shows and writes is the selection's own.
  const [fillColorCommand] = useCommands<IColor, CommandContext.Color>(['formatFillColor']);
  const fillColorContext = fillColorCommand?.getContext();
  const lastFillColor = fillColorContext?.quickColor ?? null;

  const applySolid = useCallbackRef((color: IColor | null, isCustom?: boolean) => {
    // Keep the ribbon's quick swatch and the Recent row in step with what was picked here — the
    // memory is the user's, not the surface's.
    if (color && isCustom) styles.addRecentColor(color);
    fillColorContext?.onColorSelect?.(color as IColor);
    if (!color) {
      applyStyle({ fill: { type: IFill.Type.None } }, messageKey('op.setFillNone'));
      return;
    }
    applyStyle(
      { fill: { type: IFill.Type.Solid, color: color.toString() } },
      messageKey('op.setFillColor')
    );
  }, [applyStyle, styles, fillColorContext]);

  /** `delta` is in the dialog's roles; the swap to stored slots happens here, once. */
  const applyPattern = useCallbackRef((delta: Partial<IFill.PatternProperties>) => {
    const nextType = delta.patternType ?? patternType;
    const slots = toPatternSlots(
      nextType,
      delta.foreground ?? patternForeground.toString(),
      delta.background ?? patternBackground.toString()
    );
    applyStyle({
      fill: {
        type: IFill.Type.Pattern,
        patternType: nextType,
        foreground: slots.foreground,
        background: slots.background
      }
    }, messageKey('op.setFillPattern'));
  }, [applyStyle, patternType, patternForeground, patternBackground]);

  const applyGradient = useCallbackRef((value: GradientValue) => {
    applyStyle({
      fill: {
        type: IFill.Type.Gradient,
        gradientType: value.gradientType,
        angle: value.angle,
        stops: value.stops.map((stop: GradientStopValue) => ({ offset: stop.offset, color: stop.color }))
      }
    }, messageKey('op.setFillGradient'));
  }, [applyStyle]);

  const changeFillType = useCallbackRef((next: IFill.Type) => {
    if (next === selectedType) return;
    switch (next) {
      case IFill.Type.Solid:
        // The ribbon's quick swatch (last used, else Background 2), then whatever color the cell is
        // already showing, then white.
        applyStyle(
          {
            fill: {
              type: IFill.Type.Solid,
              color: (lastFillColor ?? fill.getColor())?.toString() ?? 'ffffff'
            }
          },
          messageKey('op.setFillSolid')
        );
        break;
      case IFill.Type.Pattern:
        applyPattern({});
        break;
      case IFill.Type.Gradient:
        applyGradient(DEFAULT_GRADIENT);
        break;
      default:
        break;
    }
  }, [selectedType, fill, lastFillColor, applyStyle, applyPattern, applyGradient]);

  // The anchor's fill, exactly as the controls below show it, for a dropdown pick that changes
  // nothing here (see `onReselect`).
  const reapplyFill = useCallbackRef(() => {
    switch (fillType) {
      case IFill.Type.Pattern:
        applyPattern({});
        break;
      case IFill.Type.Gradient:
        applyGradient(toGradientValue(fill as IFill.IGradient));
        break;
      case IFill.Type.Solid:
        applyStyle(
          { fill: { type: IFill.Type.Solid, color: (fill as IFill.ISolid).getColor().toString() } },
          messageKey('op.setFillColor')
        );
        break;
      default:
        applyStyle({ fill: { type: IFill.Type.None } }, messageKey('op.setFillNone'));
        break;
    }
  }, [fillType, fill, applyStyle, applyPattern, applyGradient]);

  return (
    <Box
      className={clsx('sxl-format-fill-panel', propClassName)}
      sx={panelSx}
      {...rest}
    >
      <FormatSection>
        <FormControl size="small" fullWidth>
          <InputLabel shrink>{t('fill.type')}</InputLabel>
          <Select
            label={t('fill.type')}
            notched
            disabled={disabled}
            value={selectedType}
            onChange={(e) => changeFillType(e.target.value as IFill.Type)}
          >
            <MenuItem value={IFill.Type.Solid} onClick={onReselect(selectedType, IFill.Type.Solid, reapplyFill)}>
              {t('fill.typeSolid')}
            </MenuItem>
            <MenuItem value={IFill.Type.Pattern} onClick={onReselect(selectedType, IFill.Type.Pattern, reapplyFill)}>
              {t('fill.typePattern')}
            </MenuItem>
            <MenuItem value={IFill.Type.Gradient} onClick={onReselect(selectedType, IFill.Type.Gradient, reapplyFill)}>
              {t('fill.typeGradient')}
            </MenuItem>
            {/* A picture fill comes from a file; the panel shows it and offers the other kinds. */}
            {fillType === IFill.Type.Image ? (
              <MenuItem value={IFill.Type.Image} disabled>
                {t('fill.typeImage')}
              </MenuItem>
            ) : null}
          </Select>
        </FormControl>
      </FormatSection>

      {selectedType === IFill.Type.Solid ? (
        <FormatSection label={t('fill.backgroundColor')}>
          <FormatRow>
            {/* The automatic swatch IS No Fill — relabeled and moved to the foot of the panel,
                exactly as the ribbon's fill split button presents it. */}
            <ColorPopupButton
              icon="fill.colored"
              disabled={disabled}
              darkMode={darkMode}
              compareRGB={true}
              selectedColor={solidColor}
              onSelectColor={applySolid}
              propsPanel={{
                disableAlpha: true,
                autoColor: NO_FILL,
                autoColorLabelKey: messageKey('color.noFill'),
                autoColorPosition: AutoColorPosition.End,
                schemeLookup,
                recentColors
              }}
            />
          </FormatRow>
        </FormatSection>
      ) : null}

      {fillType === IFill.Type.Pattern ? (
        <>
          <FormatSection label={t('fill.patternStyle')}>
            <FormatRow>
              <PatternPopupButton
                disabled={disabled}
                darkMode={darkMode}
                selectedPattern={patternType}
                foreground={patternForeground.toString()}
                background={patternBackground.toString()}
                createCell={createCell}
                onSelectPattern={(next: IFill.BuiltInSheetPattern) => applyPattern({ patternType: next })}
              />
            </FormatRow>
          </FormatSection>
          <FormatSection label={t('fill.patternForeground')}>
            <FormatRow>
              <ColorPopupButton
                disabled={disabled}
                darkMode={darkMode}
                selectedColor={patternForeground}
                onSelectColor={(color: IColor | null) => {
                  applyPattern({ foreground: (color ?? autoPatternColor).toString() });
                }}
                propsPanel={{ disableAlpha: true, autoColor: autoPatternColor, schemeLookup, recentColors }}
              />
            </FormatRow>
          </FormatSection>
          <FormatSection label={t('fill.patternBackground')}>
            <FormatRow>
              <ColorPopupButton
                disabled={disabled}
                darkMode={darkMode}
                selectedColor={patternBackground}
                onSelectColor={(color: IColor | null) => {
                  applyPattern({ background: (color ?? NO_FILL).toString() });
                }}
                propsPanel={{
                  disableAlpha: true,
                  autoColor: NO_FILL,
                  autoColorLabelKey: messageKey('color.noFill'),
                  schemeLookup,
                  recentColors
                }}
              />
            </FormatRow>
          </FormatSection>
        </>
      ) : null}

      {fillType === IFill.Type.Gradient ? (
        <FormatSection>
          <GradientEditor
            disabled={disabled}
            maxStops={maxGradientStops}
            darkMode={darkMode}
            schemeLookup={schemeLookup}
            recentColors={recentColors}
            value={toGradientValue(fill as IFill.IGradient)}
            onChange={applyGradient}
          />
        </FormatSection>
      ) : null}
    </Box>
  );
});

FillPanel.displayName = 'FillPanel';
