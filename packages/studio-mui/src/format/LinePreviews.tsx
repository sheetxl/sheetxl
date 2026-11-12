import type React from 'react';
import { memo, useCallback } from 'react';

import { Box } from '@mui/material';

import { IStroke, type IColor } from '@sheetxl/sdk';

import { KeyCodes } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitPopupMenuItem, ExhibitMenuItem, ExhibitIconButton, createStrokeShadowFilter,
  type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { StyledStrokeIcon } from '../border';

/** The previews' line width, in px: wide enough to read a dash, narrow enough to keep a dot a dot. */
const PREVIEW_WIDTH = 2;
/** The previews' length, in px. */
export const PREVIEW_LENGTH = 60;

/**
 * The preset dashes as dash and space lengths in line widths (DrawingML's own definitions).
 */
const DASH_PATTERNS: Readonly<Record<IStroke.DashStyle, readonly number[] | null>> = {
  [IStroke.DashStyle.Solid]: null,
  [IStroke.DashStyle.Dot]: [1, 3],
  [IStroke.DashStyle.Dash]: [4, 3],
  [IStroke.DashStyle.LongDash]: [8, 3],
  [IStroke.DashStyle.DashDot]: [4, 3, 1, 3],
  [IStroke.DashStyle.LongDashDot]: [8, 3, 1, 3],
  [IStroke.DashStyle.LongDashDotDot]: [8, 3, 1, 3, 1, 3],
  [IStroke.DashStyle.SysDash]: [3, 1],
  [IStroke.DashStyle.SysDot]: [1, 1],
  [IStroke.DashStyle.SysDashDot]: [3, 1, 1, 1],
  [IStroke.DashStyle.SysDashDotDot]: [3, 1, 1, 1, 1, 1],
};

export interface DashIconProps {
  dash: IStroke.DashStyle | number[];
  color: IColor | null;
  darkMode?: boolean;
}

/** A line drawn with a dash, in the line's color: what a dash looks like. */
export const DashIcon = memo((props: DashIconProps): React.ReactElement => {
  const { dash, color, darkMode } = props;
  const pattern = Array.isArray(dash) ? dash : DASH_PATTERNS[dash] ?? null;
  return (
    <StyledStrokeIcon
      styleColor={color}
      length={PREVIEW_LENGTH}
      width={PREVIEW_WIDTH}
      darkMode={darkMode}
      dashArray={pattern ? pattern.map((n) => n * PREVIEW_WIDTH) : undefined}
    />
  );
});
DashIcon.displayName = 'DashIcon';

/** A line end's half-height and length in px at the preview width, by its relative size. */
const END_WIDTHS: Readonly<Record<IStroke.LineEndSize, number>> = { sm: 2.5, med: 4, lg: 6 };
const END_LENGTHS: Readonly<Record<IStroke.LineEndSize, number>> = { sm: 5, med: 8, lg: 12 };

/** An arrowhead preview's length: the largest head plus a stub of line, about a square. */
export const END_PREVIEW_LENGTH = 20;

export interface LineEndIconProps {
  end: IStroke.LineEnd;
  /** Drawn at the start of the line (pointing left) rather than its end. */
  atStart?: boolean;
  color: IColor | null;
  darkMode?: boolean;
}

/** A stub of line with one end drawn: what an arrowhead of a type and size looks like. */
export const LineEndIcon = memo((props: LineEndIconProps): React.ReactElement => {
  const { end, atStart = false, color, darkMode = false } = props;
  const height = 16;
  const y = height / 2;
  const tip = END_PREVIEW_LENGTH - 1;
  const w = END_WIDTHS[end.width ?? IStroke.LineEndSize.Medium];
  const l = END_LENGTHS[end.length ?? IStroke.LineEndSize.Medium];
  const type = end.type;

  let marker: React.ReactNode = null;
  let lineEnd = tip;
  switch (type) {
    case IStroke.LineEndType.Triangle:
      marker = <polygon points={`${tip},${y} ${tip - l},${y - w} ${tip - l},${y + w}`}/>;
      lineEnd = tip - l;
      break;
    case IStroke.LineEndType.Stealth:
      marker = <polygon points={`${tip},${y} ${tip - l},${y - w} ${tip - l * 0.6},${y} ${tip - l},${y + w}`}/>;
      lineEnd = tip - l * 0.6;
      break;
    case IStroke.LineEndType.Diamond:
      marker = <polygon points={`${tip},${y} ${tip - l / 2},${y - w} ${tip - l},${y} ${tip - l / 2},${y + w}`}/>;
      lineEnd = tip - l;
      break;
    case IStroke.LineEndType.Oval:
      marker = <ellipse cx={tip - l / 2} cy={y} rx={l / 2} ry={w}/>;
      lineEnd = tip - l;
      break;
    case IStroke.LineEndType.Arrow:
      marker = (
        <polyline
          points={`${tip - l},${y - w} ${tip},${y} ${tip - l},${y + w}`}
          fill="none"
          strokeWidth={PREVIEW_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
      break;
    default:
      break;
  }

  const css = color ? color.toRGBA(darkMode).toString() : 'currentColor';
  return (
    <Box
      component="svg"
      width={END_PREVIEW_LENGTH}
      height={height}
      viewBox={`0 0 ${END_PREVIEW_LENGTH} ${height}`}
      sx={{
        display: 'block',
        overflow: 'visible',
        fill: css,
        stroke: css,
        filter: createStrokeShadowFilter(),
        transform: atStart ? 'scaleX(-1)' : undefined,
      }}
    >
      <line x1={1} y1={y} x2={lineEnd} y2={y} strokeWidth={PREVIEW_WIDTH}/>
      {marker}
    </Box>
  );
});
LineEndIcon.displayName = 'LineEndIcon';

export interface LineEndPopupButtonProps {
  end: IStroke.LineEnd;
  /** The start of the line (pointing left) rather than its end. */
  atStart?: boolean;
  color: IColor | null;
  darkMode?: boolean;
  /** The types offered, in order; the first is none. */
  types: readonly IStroke.LineEndType[];
  /** The sizes offered, in order. */
  sizes: readonly IStroke.LineEndSize[];
  /** Localized names by type, and by size. */
  typeLabels: Record<string, string>;
  sizeLabels: Record<string, string>;
  /** The size submenu's tooltip: `${width}: Small · ${length}: Large`. */
  widthLabel: string;
  lengthLabel: string;
  tooltip?: string;
  disabled?: boolean;
  onSelect: (end: IStroke.LineEnd | null) => void;
}

/**
 * One button for a line end, the way the border button is one button for a border: a preview of
 * the end as it is, opening the list of arrowhead types, each of which opens its sizes. Clicking a
 * type takes it at the current size; a size takes both.
 */
export const LineEndPopupButton = (props: LineEndPopupButtonProps): React.ReactElement => {
  const {
    end, atStart = false, color, darkMode, types, sizes, typeLabels, sizeLabels, widthLabel, lengthLabel,
    tooltip, disabled, onSelect
  } = props;

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps): React.ReactElement => {
    const { closeFloatAll, floatReference } = panelProps;
    const items = types.map((type) => {
      const icon = <LineEndIcon end={{ ...end, type }} atStart={atStart} color={color} darkMode={darkMode}/>;
      const selected = type === end.type;
      if (type === IStroke.LineEndType.None) {
        return (
          <ExhibitMenuItem
            key={type}
            icon={icon}
            selected={selected}
            disabled={disabled}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onMouseUp={() => { closeFloatAll?.(); onSelect(null); }}
          >
            {typeLabels[type]}
          </ExhibitMenuItem>
        );
      }
      // The sizes, on this type: Excel's 3×3, width across and length down.
      const createSizePanel = (sizeProps: ExhibitPopupPanelProps): React.ReactElement => (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${sizes.length}, auto)`, gap: '2px', padding: '6px 8px' }}>
          {sizes.map((length) => sizes.map((width) => (
            <ExhibitIconButton
              key={`${width}-${length}`}
              icon={<LineEndIcon end={{ type, width, length }} atStart={atStart} color={color} darkMode={darkMode}/>}
              selected={selected && (end.width ?? IStroke.LineEndSize.Medium) === width && (end.length ?? IStroke.LineEndSize.Medium) === length}
              disabled={disabled}
              propsTooltip={{ label: `${widthLabel}: ${sizeLabels[width]} · ${lengthLabel}: ${sizeLabels[length]}`, simple: true }}
              onClick={() => { sizeProps.closeFloatAll?.(); onSelect({ type, width, length }); }}
            />
          )))}
        </Box>
      );
      return (
        <ExhibitPopupMenuItem
          key={type}
          icon={icon}
          label={typeLabels[type]}
          selected={selected}
          disabled={disabled}
          parentFloat={floatReference}
          renderPopupPanel={createSizePanel}
          onQuickClick={() => { closeFloatAll?.(); onSelect({ ...end, type }); }}
        />
      );
    });
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', paddingTop: '4px', paddingBottom: '4px' }}>
        {items}
      </Box>
    );
  }, [end, atStart, color, darkMode, types, sizes, typeLabels, sizeLabels, widthLabel, lengthLabel, disabled, onSelect]);

  return (
    <ExhibitPopupIconButton
      disabled={disabled}
      icon={
        <Box sx={{ paddingLeft: '4px', marginRight: '4px', height: '24px', display: 'flex', alignItems: 'center' }}>
          <LineEndIcon end={end} atStart={atStart} color={color} darkMode={darkMode}/>
        </Box>
      }
      tooltip={tooltip ? `${tooltip}: ${typeLabels[end.type]}` : typeLabels[end.type]}
      renderPopupPanel={renderPopupPanel}
    />
  );
};

export interface PreviewOption<V extends string> {
  value: V;
  /** Named in the tooltip; the icon is what shows. */
  label: string;
  icon: React.ReactNode;
}

export interface PreviewPopupButtonProps<V extends string> {
  value: V;
  options: readonly PreviewOption<V>[];
  onSelect: (value: V) => void;
  /** Lay the options out in a grid of this many columns; a list otherwise. */
  columns?: number;
  tooltip?: string;
  disabled?: boolean;
  /** What the button shows in place of the chosen option's icon. */
  icon?: React.ReactNode;
}

/**
 * A button showing a preview of what is chosen, opening a list (or grid) of previews to choose
 * from: the way the border style picker offers its strokes.
 */
export const PreviewPopupButton = <V extends string>(props: PreviewPopupButtonProps<V>): React.ReactElement => {
  const { value, options, onSelect, columns, tooltip, disabled, icon } = props;
  const selected = options.find((option) => option.value === value) ?? options[0];

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps): React.ReactElement => {
    const { closeFloat } = panelProps;
    if (columns) {
      return (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, auto)`, gap: '2px', padding: '6px 8px' }}>
          {options.map((option) => (
            <ExhibitIconButton
              key={option.value}
              icon={option.icon}
              selected={option.value === value}
              disabled={disabled}
              propsTooltip={{ label: option.label, simple: true }}
              onClick={() => { closeFloat?.(); onSelect(option.value); }}
            />
          ))}
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', paddingTop: '4px', paddingBottom: '4px' }}>
        {options.map((option) => (
          <ExhibitMenuItem
            key={option.value}
            tabIndex={0}
            sx={{ height: '28px', paddingLeft: '16px' }}
            propsTooltip={{ description: option.label }}
            icon={null}
            disabled={disabled}
            selected={option.value === value}
            onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
            onMouseUp={() => { closeFloat?.(); onSelect(option.value); }}
            onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
              if (e.which === KeyCodes.Enter) closeFloat?.();
            }}
          >
            {option.icon}
          </ExhibitMenuItem>
        ))}
      </Box>
    );
  }, [options, value, onSelect, columns, disabled]);

  return (
    <ExhibitPopupIconButton
      disabled={disabled}
      icon={
        <Box sx={{ paddingLeft: '4px', marginRight: '4px', height: '24px', display: 'flex', alignItems: 'center' }}>
          {icon ?? selected?.icon}
        </Box>
      }
      tooltip={tooltip ? `${tooltip}: ${selected?.label ?? ''}` : selected?.label}
      renderPopupPanel={renderPopupPanel}
    />
  );
};
