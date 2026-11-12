import React from 'react';

import { IGeometry, type IShape } from '@sheetxl/sdk';

import { useShapeGeometry } from './useShapeGeometry';

const FILL = '#9dc3e6';
const STROKE = '#2f5597';

/** A hex color through a shading's transfer, per channel. */
const shade = (hex: string, fill: IGeometry.PathFill): string => {
  const [slope, intercept] = IGeometry.FillTransfer[fill];
  const channel = (i: number): string => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return Math.round(Math.max(0, Math.min(1, slope * c + intercept)) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

/**
 * A geometry's paths with plain paint: what any renderer does with `forEachPath`. Fills are
 * shaded by their transfer, strokes take the line, line ends are filled with the line's color.
 */
export const GeometryPaths: React.FC<{ geometry: IGeometry; strokeWidth?: number }> = ({ geometry, strokeWidth = 1 }) => {
  const drawn: React.ReactNode[] = [];
  geometry.forEachPath((p) => {
    switch (p.layer) {
      case IGeometry.PathLayer.Fill:
        drawn.push(<path key={p.index} d={p.d} fill={shade(FILL, p.fill)} stroke="none" />);
        break;
      case IGeometry.PathLayer.Stroke:
        drawn.push(<path key={p.index} d={p.d} fill="none" stroke={STROKE} strokeWidth={strokeWidth} strokeMiterlimit={18.5} />);
        break;
      case IGeometry.PathLayer.Marker:
        drawn.push(<path key={p.index} d={p.d} fill={STROKE} stroke="none" />);
        break;
    }
  });
  return <>{drawn}</>;
};

export interface ShapeBoxProps {
  name: string;
  width: number;
  height: number;
  adjustments?: Record<string, number>;
  /** The shape's line, for its width and ends. */
  stroke?: IShape.JSON['stroke'];
  /** The line width the paths are drawn with, in px. */
  strokeWidth?: number;
}

/** One preset at a size, asked of a shape and drawn from its geometry. */
export const ShapeBox: React.FC<ShapeBoxProps> = ({ name, width, height, adjustments, stroke, strokeWidth }) => {
  const geometry = useShapeGeometry({ geometry: name, adjustments, stroke }, width, height);
  return (
    <svg width={width} height={height} overflow="visible" style={{ display: 'block' }}>
      {geometry ? <GeometryPaths geometry={geometry} strokeWidth={strokeWidth} /> : null}
    </svg>
  );
};
