import type React from 'react';
import { memo, useState } from 'react';

import clsx from 'clsx';

import { Box, Typography } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import { IBorders, type IColor } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, DynamicIcon } from '@sheetxl/utils-react';

import { ExhibitIconButton, PopupButtonType } from '@sheetxl/utils-mui';

import { ColorPopupButton } from '../color';
import { BorderStylePopupButton, BorderTemplateIcon } from '../border';

import { BorderPreview, edgeLabel, type BorderEdges } from './BorderPreview';
import {
  type FormatPanelProps, FormatSection, FormatRow, FormatButtonGroup, panelSx
} from './FormatPanelParts';

/** How tall the diagram is, and therefore how far apart the three buttons beside it sit. */
const DIAGRAM_HEIGHT = 104;

/**
 * The widest the diagram grows, however wide the pane is. Excel's proportion, about 3:2 — stretched
 * across a wide pane the cells stop reading as cells and the edges drift away from their buttons.
 */
const DIAGRAM_MAX_WIDTH = 156;

/** The pen a freshly opened panel draws with. Excel opens on a thin solid line too. */
const DEFAULT_PEN_STYLE = IBorders.StrokeStyle.Thin;

/** The 'Outline' preset, and the four buttons along the outside of the diagram. */
const OUTSIDE_EDGES: readonly IBorders.Edge[] = Object.freeze([
  IBorders.Edge.Left, IBorders.Edge.Top, IBorders.Edge.Right, IBorders.Edge.Bottom
]);

/** The 'Inside' pair — the rules that run BETWEEN the cells of a range. */
const INSIDE_EDGES: readonly IBorders.Edge[] = Object.freeze([
  IBorders.Edge.Horizontal, IBorders.Edge.Vertical
]);

/**
 * The 'All' preset: every boundary of the block. No diagonals — Excel's 'All Borders' leaves them
 * alone too.
 */
const ALL_EDGES: readonly IBorders.Edge[] = Object.freeze([
  ...OUTSIDE_EDGES, ...INSIDE_EDGES
]);

/** The two diagonals, set from the buttons in the bottom corners or the diagram's corners. */
const DIAGONAL_EDGES: readonly IBorders.Edge[] = Object.freeze([
  IBorders.Edge.DiagonalUp, IBorders.Edge.DiagonalDown
]);

/** What the diagram shows and reports. */
const DIAGRAM_EDGES: readonly IBorders.Edge[] = Object.freeze([
  ...ALL_EDGES, ...DIAGONAL_EDGES
]);

/** Build a border delta that sets `edges` to one stroke and leaves everything else alone. */
const strokeOn = (
  edges: readonly IBorders.Edge[],
  style: IBorders.StrokeStyle,
  color: IColor | null
): IBorders.Properties => {
  const stroke: IBorders.StrokeProperties = { style, color: color?.toString() };
  const properties: IBorders.Properties = {};
  for (const edge of edges) properties[edge] = stroke;
  return properties;
};

/**
 * Build a border delta that ERASES `edges` — the first half of drawing one.
 *
 * @remarks
 * A stroke delta merges, so a pen with no color cannot take the color off an edge that has one:
 * there is no value that means "back to the default". Erasing first makes the stroke that follows
 * the whole truth about that edge, which is what "set it to the pen" has to mean if clicking again
 * is going to recognize its own work and clear it.
 */
const eraseOn = (edges: readonly IBorders.Edge[]): IBorders.Properties => {
  const properties: Record<string, null> = {};
  for (const edge of edges) properties[edge] = null;
  return properties as unknown as IBorders.Properties;
};

/** A stroke's color as written, or `null` for none — the pen's color compares the same way. */
const colorKey = (color: IColor | string | null | undefined): string | null => {
  return color ? color.toString() : null;
};

/**
 * The **Border** tab of the format pane.
 *
 * @remarks
 * Excel's model — and this one — treats a border as a PEN plus a set of edges, and the panel is laid
 * out in that order: the pen first (color, then line style, since our line styles are drawn IN the
 * color), then the presets, then the diagram with a button per edge around it, the way the Format
 * Cells dialog arranges them.
 *
 * Every one of those buttons draws its own icon with the pen (see `BorderTemplateIcon`), so the
 * whole panel restyles as the color or the line changes and each button previews its own edit.
 *
 * The pen is panel state, not cell state: it is what the next click will draw, so it survives
 * moving the selection, exactly as the Format Cells dialog's does.
 *
 * Everything reads the SELECTION's border rather than the anchor cell's — inner rules only exist
 * at range scope.
 */
export const BorderPanel = memo((props: FormatPanelProps) => {
  const {
    selection,
    disabled: propDisabled,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const {
    getEdgeStroke, createBorder, applyStyle, styles, schemeLookup, autoColor, darkMode,
    hasInnerHorizontal, hasInnerVertical
  } = selection;
  const disabled = propDisabled || selection.disabled;

  // An inner rule needs two cells to run between. On a selection with no inside those targets are
  // inert, so say so rather than accepting a click that writes nothing.
  const isEdgeDisabled = useCallbackRef((edge: IBorders.Edge): boolean => {
    if (edge === IBorders.Edge.Horizontal) return !hasInnerHorizontal;
    if (edge === IBorders.Edge.Vertical) return !hasInnerVertical;
    return false;
  }, [hasInnerHorizontal, hasInnerVertical]);

  // The pen. Seeded from whatever the selection's bottom edge already uses, so opening the panel on
  // a bordered range offers to keep drawing the same line.
  const [penStyle, setPenStyle] = useState<IBorders.StrokeStyle>(() => {
    const existing = getEdgeStroke(IBorders.Edge.Bottom)?.getStyle();
    return existing && existing !== IBorders.StrokeStyle.None ? existing : DEFAULT_PEN_STYLE;
  });
  const [penColor, setPenColor] = useState<IColor | null>(() => {
    const stroke = getEdgeStroke(IBorders.Edge.Bottom);
    if (!stroke || stroke.isNone()) return null;
    // Only a color that was actually WRITTEN. `getColor()` answers for every stroke, resolving an
    // uncolored one to the theme's text color, so seeding from it would hand back a pen that draws
    // an explicit color where the border it copied had none.
    return stroke.getProperties().color ? stroke.getColor() : null;
  });

  const recentColors = useCallbackRef(() => styles.recentColors(), [styles]);

  const applyBorder = useCallbackRef((properties: IBorders.Properties | null) => {
    applyStyle({ borders: properties as IBorders.Properties }, messageKey('op.setBorders'));
  }, [applyStyle]);

  /** Draw the pen on `targets`, replacing whatever they carried (see {@link eraseOn}). */
  const drawEdges = useCallbackRef((targets: readonly IBorders.Edge[]) => {
    if (targets.length === 0) return;
    applyStyle([
      { borders: eraseOn(targets) },
      { borders: strokeOn(targets, penStyle, penColor) }
    ], messageKey('op.setBorders'));
  }, [applyStyle, penStyle, penColor]);

  /** Take the line off `targets`. */
  const clearEdges = useCallbackRef((targets: readonly IBorders.Edge[]) => {
    if (targets.length === 0) return;
    applyBorder(strokeOn(targets, IBorders.StrokeStyle.None, null));
  }, [applyBorder]);

  const setEdges = useCallbackRef((edges: readonly IBorders.Edge[]) => {
    // 'Inside' on a single row is still the one rule it has — draw the edges this selection HAS
    // rather than writing inner rules that land nowhere.
    drawEdges(edges.filter((edge) => !isEdgeDisabled(edge)));
  }, [drawEdges, isEdgeDisabled]);

  // Resolve every edge ONCE per render, as data — what is drawn, and what it is drawn WITH, since
  // the toggle compares both against the pen.
  const edges: BorderEdges = {};
  for (const edge of DIAGRAM_EDGES) {
    const stroke = getEdgeStroke(edge);
    if (stroke && !stroke.isNone()) edges[edge] = stroke.getProperties();
  }

  /** Whether `edge` already carries exactly what the pen would draw — style AND color. */
  const isPenStroke = useCallbackRef((edge: IBorders.Edge): boolean => {
    const current = edges[edge]; // absent means nothing is drawn there
    if ((current?.style ?? IBorders.StrokeStyle.None) !== penStyle) return false;
    // The AUTHORED color, not the resolved one: a stroke with no color of its own still reports
    // the theme's text color, so a resolved comparison would never match a pen that has none.
    return colorKey(current?.color) === colorKey(penColor);
  }, [edges, penStyle, penColor]);

  /** Whether every edge of `targets` this selection has already carries the pen. */
  const isPenStrokeOn = (targets: readonly IBorders.Edge[]): boolean => {
    const available = targets.filter((edge) => !isEdgeDisabled(edge));
    return available.length > 0 && available.every(isPenStroke);
  };

  const toggleEdges = useCallbackRef((targets: readonly IBorders.Edge[]) => {
    // 'Inside' on a single row is still the one rule it has — toggle the edges this selection HAS
    // rather than writing inner rules that land nowhere.
    const available = targets.filter((edge) => !isEdgeDisabled(edge));
    // Excel's rule, and not a plain on/off: a click makes the edges match the PEN, unless they
    // already do — then they come off. So changing the pen and clicking a drawn edge restyles it
    // rather than erasing it, which is the only way to recolor an edge in one gesture. Several
    // edges toggle as ONE: a pair that only half matches is drawn, not half cleared.
    //
    // A `None` pen therefore always clears, whichever branch it takes: drawing nothing and
    // clearing are the same edit.
    if (penStyle === IBorders.StrokeStyle.None || available.every(isPenStroke)) {
      clearEdges(available);
      return;
    }
    drawEdges(available);
  }, [clearEdges, drawEdges, isPenStroke, isEdgeDisabled, penStyle]);

  /** The pen, as a border on `targets` — what a button would draw, and what its icon shows. */
  const penOn = (targets: readonly IBorders.Edge[]): IBorders.Properties => {
    return strokeOn(targets, penStyle, penColor);
  };

  /**
   * A preset: one click, one shape.
   *
   * @remarks
   * The shapes worth a button are the ones that are tedious to click edge by edge. Everything else
   * is the diagram and the buttons around it.
   */
  const presetButton = (
    targets: readonly IBorders.Edge[],
    label: string,
    onClick: () => void
  ): React.ReactElement => (
    <ExhibitIconButton
      disabled={disabled}
      icon={
        <BorderTemplateIcon
          border={targets.length > 0 ? penOn(targets) : null}
          createBorder={createBorder}
        />
      }
      propsTooltip={{ label, simple: true }}
      onClick={onClick}
    />
  );

  /**
   * A toggle beside the diagram — the same click as the line itself, or as the crossing of the
   * inner rules for the 'Inside' pair.
   *
   * @remarks
   * Pressed means the edges already carry exactly what the pen would draw, which is also when a
   * click takes them off (see {@link toggleEdges}). An edge drawn in some other style reads as
   * unpressed and a click restyles it, because that is the question these buttons answer: is this
   * edge already what I am about to draw?
   *
   * Off only when NOTHING it would draw is available, and never hidden: the layout keeps its shape
   * as the selection changes, so a button never moves out from under the pointer.
   */
  const edgeButton = (targets: readonly IBorders.Edge[], label: string): React.ReactElement => {
    const isOff = disabled || targets.every(isEdgeDisabled);
    return (
      <ExhibitIconButton
        disabled={isOff}
        selected={!isOff && penStyle !== IBorders.StrokeStyle.None && isPenStrokeOn(targets)}
        icon={<BorderTemplateIcon border={penOn(targets)} createBorder={createBorder}/>}
        propsTooltip={{ label, simple: true }}
        onClick={() => toggleEdges(targets)}
      />
    );
  };

  const singleEdgeButton = (edge: IBorders.Edge): React.ReactElement => {
    return edgeButton([edge], edgeLabel(t, edge));
  };

  return (
    <Box
      className={clsx('sxl-format-border-panel', propClassName)}
      sx={panelSx}
      {...rest}
    >
      {/* The pen leads, and color leads the pen: a line style is a swatch of the line, so it can
          only show what it is offering once the color is settled. Excel puts the color last
          because its swatches are monochrome. */}
      <FormatRow>
        <ColorPopupButton
          disabled={disabled || penStyle === IBorders.StrokeStyle.None}
          darkMode={darkMode}
          icon={<DynamicIcon iconKey="stroke.colored"/>}
          tooltip={t('border.colorTooltip')}
          // `null` IS the pen's no-color-of-its-own state, and the panel reads it as "Automatic
          // is the selected swatch". Substituting a literal color here — as this did with Gray —
          // makes every picker open on a custom swatch the user never chose.
          selectedColor={penColor}
          onSelectColor={(color: IColor | null) => setPenColor(color)}
          propsPanel={{ disableAlpha: true, schemeLookup, recentColors, autoColor }}
        />
        <BorderStylePopupButton
          disabled={disabled}
          darkMode={darkMode}
          selectedStyle={penStyle}
          styleColor={penColor}
          variant={PopupButtonType.Toolbar}
          onSelectStyle={(next) => setPenStyle(next ?? IBorders.StrokeStyle.None)}
        />
      </FormatRow>

      {/* The whole-block shapes: 'All', which Excel's dialog leaves out and its ribbon does not —
          it is the most-clicked border there is — then 'Outside' and 'None'. 'Inside' is not here;
          it sits beside the diagram, level with the crossing it draws.
          Centered over the diagram they belong to, rather than ranged against the pane's edge. */}
      <FormatButtonGroup sx={{ justifyContent: 'center' }}>
        {presetButton(ALL_EDGES, t('border.all'), () => setEdges(ALL_EDGES))}
        {presetButton(OUTSIDE_EDGES, t('border.outside'), () => setEdges(OUTSIDE_EDGES))}
        {presetButton([], t('border.none'), () => applyBorder(null))}
      </FormatButtonGroup>

      {/* The diagram with its edges around it, each button beside the line it draws: the three
          horizontal rules down the left, the three vertical ones along the bottom. Excel's
          arrangement, and the one that needs no reading — position says which edge. 'Inside' takes
          the right, level with the middle: it is both inner rules, and its column balances the
          left one so the diagram sits centered in the pane. The diagonals take the bottom corners,
          as in Excel's dialog: up on the left, down on the right.

          Inset from the pane's edges, because unlike the rows above it this is a picture of the
          cells rather than a strip of controls, and a picture flush against a panel edge reads as
          a mistake. */}
      <FormatSection sx={{ px: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `auto minmax(0, ${DIAGRAM_MAX_WIDTH}px) auto`,
            justifyContent: 'center',
            columnGap: 0.5,
            rowGap: 0.25,
            minWidth: 0
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: `${DIAGRAM_HEIGHT}px`
            }}
          >
            {singleEdgeButton(IBorders.Edge.Top)}
            {singleEdgeButton(IBorders.Edge.Horizontal)}
            {singleEdgeButton(IBorders.Edge.Bottom)}
          </Box>
          <BorderPreview
            edges={edges}
            createBorder={createBorder}
            disabled={disabled}
            height={DIAGRAM_HEIGHT}
            omittedEdges={ALL_EDGES.filter(isEdgeDisabled)}
            onToggleEdges={toggleEdges}
          />
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {edgeButton(INSIDE_EDGES, t('border.inner'))}
          </Box>
          {singleEdgeButton(IBorders.Edge.DiagonalUp)}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', minWidth: 0 }}>
            {singleEdgeButton(IBorders.Edge.Left)}
            {singleEdgeButton(IBorders.Edge.Vertical)}
            {singleEdgeButton(IBorders.Edge.Right)}
          </Box>
          {singleEdgeButton(IBorders.Edge.DiagonalDown)}
        </Box>
        {/* Under the diagram, not over it: it explains the thing above it, and as a heading it
            read as a caption on the presets instead. The diagram itself stays a plain widget —
            a component that came with its own instructions could not be dropped anywhere else. */}
        <Typography
          variant="caption"
          component="div"
          sx={{ color: 'text.secondary', lineHeight: 1.4, textAlign: 'center' }}
        >
          {t('format.borderDiagram')}
        </Typography>
      </FormatSection>
    </Box>
  );
});

BorderPanel.displayName = 'BorderPanel';
