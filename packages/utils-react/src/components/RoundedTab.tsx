import type React from 'react';
import { useRef, useMemo, memo, forwardRef, isValidElement, cloneElement } from 'react';

import { type Point } from '@sheetxl/utils';

import { useMergeRefs } from 'react-merge-refs';

import { useMeasure } from '../hooks';


/*****************************************************************************
*                                                                            *
*  SVG Path Rounding Function                                                *
*  Copyright (C) 2014 Yona Appletree                                         *
*                                                                            *
*  Licensed under the Apache License, Version 2.0 (the "License");           *
*  you may not use this file except in compliance with the License.          *
*  You may obtain a copy of the License at                                   *
*                                                                            *
*      http://www.apache.org/licenses/LICENSE-2.0                            *
*                                                                            *
*  Unless required by applicable law or agreed to in writing, software       *
*  distributed under the License is distributed on an "AS IS" BASIS,         *
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  *
*  See the License for the specific language governing permissions and       *
*  limitations under the License.                                            *
*                                                                            *
*****************************************************************************/

/**
 * SVG Path rounding function. Takes an input path string and outputs a path
 * string where all line-line corners have been rounded. Only supports absolute
 * commands at the moment.
 *
 * @param pathString The SVG input path
 * @param radius The amount to round the corners, either a value in the SVG
 *               coordinate space, or, if useFractionalRadius is true, a value
 *               from 0 to 1.
 * @param useFractionalRadius If true, the curve radius is expressed as a
 *               fraction of the distance between the point being curved and
 *               the previous and next points.
 * @returns A new SVG path string with the rounding
 */
type PathCommand = (string | number)[] & { origPoint?: Point };

function roundPathCorners(pathString: string, radius: number, useFractionalRadius: boolean=false) {
  if (radius === 0) return pathString;
  function moveTowardsLength(movingPoint:Point, targetPoint:Point, amount: number): Point {
    let width = (targetPoint.x - movingPoint.x);
    let height = (targetPoint.y - movingPoint.y);
    let distance = Math.sqrt(width*width + height*height);

    return moveTowardsFractional(movingPoint, targetPoint, Math.min(1, amount / distance));
  }
  function moveTowardsFractional(movingPoint: Point, targetPoint: Point, fraction: number): Point {
    return {
      x: movingPoint.x + (targetPoint.x - movingPoint.x) * fraction,
      y: movingPoint.y + (targetPoint.y - movingPoint.y) * fraction
    };
  }

  // Adjusts the ending position of a command
  function adjustCommand(cmd: PathCommand, newPoint: Point) {
    if (cmd.length > 2) {
      cmd[cmd.length - 2] = newPoint.x;
      cmd[cmd.length - 1] = newPoint.y;
    }
  }

  // Gives an {x, y} object for a command's ending position
  function pointForCommand(cmd: PathCommand): Point {
    return {
      x: parseFloat(String(cmd[cmd.length - 2])),
      y: parseFloat(String(cmd[cmd.length - 1])),
    };
  }

  // Split apart the path, handing concatenated letters and numbers
  let pathParts = pathString
    .split(/[,\s]/)
    .reduce(function(parts: string[], part) {
      let match = part.match("([a-zA-Z])(.+)");
      if (match) {
        parts.push(match[1]);
        parts.push(match[2]);
      } else {
        parts.push(part);
      }

      return parts;
    }, [] as string[]);

  // Group the commands with their arguments for easier handling
  let commands = pathParts.reduce(function(commands: PathCommand[], part) {
    // The part is a parsed number
    if (parseFloat(part) == (part as any) && commands.length) {
      commands[commands.length - 1].push(part);
    } else {
      commands.push([part] as PathCommand);
    }

    return commands;
  }, [] as PathCommand[]);

  // The resulting commands, also grouped
  let resultCommands: PathCommand[] = [];

  if (commands.length > 1) {
    let startPoint = pointForCommand(commands[0]);

    // Handle the close path case with a "virtual" closing line
    let virtualCloseLine: PathCommand | null = null;
    if (commands[commands.length - 1][0] === "Z" && commands[0].length > 2) {
      virtualCloseLine = ["L", startPoint.x, startPoint.y];
      commands[commands.length - 1] = virtualCloseLine;
    }

    // We always use the first command (but it may be mutated)
    resultCommands.push(commands[0]);

    for (let cmdIndex=1; cmdIndex < commands.length; cmdIndex++) {
      let prevCmd = resultCommands[resultCommands.length - 1];
      let curCmd = commands[cmdIndex];

      // Handle closing case
      let nextCmd = (curCmd === virtualCloseLine) ? commands[1] : commands[cmdIndex + 1];

      // Nasty logic to decide if this path is a candidate.
      if (nextCmd && prevCmd && (prevCmd.length > 2) && curCmd[0] === "L" && nextCmd.length > 2 && nextCmd[0] === "L") {
        // Calc the points we're dealing with
        let prevPoint = pointForCommand(prevCmd);
        let curPoint = pointForCommand(curCmd);
        let nextPoint = pointForCommand(nextCmd);

        // The start and end of the curve are just our point moved towards the previous and next points, respectively
        let curveStart;
        let curveEnd;

        if (useFractionalRadius) {
          curveStart = moveTowardsFractional(curPoint, prevCmd.origPoint || prevPoint, radius);
          curveEnd = moveTowardsFractional(curPoint, nextCmd.origPoint || nextPoint, radius);
        } else {
          curveStart = moveTowardsLength(curPoint, prevPoint, radius);
          curveEnd = moveTowardsLength(curPoint, nextPoint, radius);
        }

        // Adjust the current command and add it
        adjustCommand(curCmd, curveStart);
        curCmd.origPoint = curPoint;
        resultCommands.push(curCmd);

        // The curve control points are halfway between the start/end of the curve and
        // the original point
        let startControl = moveTowardsFractional(curveStart, curPoint, .5);
        let endControl = moveTowardsFractional(curPoint, curveEnd, .5);

        // Create the curve
        let curveCmd = ["C", startControl.x, startControl.y, endControl.x, endControl.y, curveEnd.x, curveEnd.y];
        // Save the original point for fractional calculations
        //@ts-ignore
        curveCmd.origPoint = curPoint;
        resultCommands.push(curveCmd);
      } else {
        // Pass through commands that don't qualify
        resultCommands.push(curCmd);
      }
    }

    // Fix up the starting point and restore the close path if the path was originally closed
    if (virtualCloseLine) {
      let newStartPoint = pointForCommand(resultCommands[resultCommands.length-1]);
      resultCommands.push(["Z"]);
      adjustCommand(resultCommands[0], newStartPoint);
    }
  } else {
    resultCommands = commands;
  }

  return resultCommands.reduce(function(str, c){ return str + c.join(" ") + " "; }, "");
}


export interface RoundedTabProps extends React.HTMLAttributes<HTMLElement> {
  radius?: number;
  strokeWidth?: number;
  strokeColor?: string;
  /**
   * The clip applied to the child (which also shapes any ripple drawn inside it).
   * - `'tab'` — the inverted, open-top tab outline (Excel/Chrome style).
   * - `'rounded'` — a plain rounded rectangle, optionally inset via {@link clipInset}
   *   so it can match an inset "pill" background.
   * @defaultValue 'tab'
   */
  variant?: 'tab' | 'rounded';
  /**
   * Inset (px) of the `'rounded'` clip from each edge of the container. Lets the clip
   * line up with an inset pill so a ripple stays within the pill.
   */
  clipInset?: { top?: number; right?: number; bottom?: number; left?: number };
  // TODO - orientation. bottom, top, left, right
}

export const RoundedTab: React.FC<RoundedTabProps> = memo(
  forwardRef<any, RoundedTabProps>((props, refForwarded) => {
  const {
    className: propClassName,
    style: propStyle,
    children,
    radius = 4, // zero doesn't quite render correctly
    strokeWidth: propStrokeWidth = 1,
    strokeColor = 'grey',
    variant = 'tab',
    clipInset,
    ...rest
  } = props;

  const [refMeasureContainer, { width:widthContainer, height:heightContainer }] = useMeasure<HTMLDivElement>();
  const refLocal = useRef<HTMLDivElement>(null);

  const calcBorder = (strokeWidth: number, padding: number=0) => {
    const strokeOffset = strokeWidth / 2;
    const topOffset = strokeOffset;
    const bottomOffset = heightContainer - strokeOffset + padding;

    // draw left with notch out, bottom, right with notch out
    // (left inner edge at `radius` mirrors the right inner edge at `width - radius`)
    const left = `M 0 ${topOffset} L ${radius} ${topOffset} L ${radius} ${bottomOffset} L ${radius*2} ${bottomOffset}`;
    const bottom = `L ${widthContainer - (radius*2)} ${bottomOffset}`;
    const right = `M ${widthContainer - radius*2} ${bottomOffset} L ${widthContainer - (radius)} ${bottomOffset} L ${widthContainer - (radius)} ${topOffset} L ${widthContainer} ${topOffset}`;

    return roundPathCorners(`${left} ${bottom} ${right}`, radius);
  }

  const insetTop = clipInset?.top ?? 0;
  const insetRight = clipInset?.right ?? 0;
  const insetBottom = clipInset?.bottom ?? 0;
  const insetLeft = clipInset?.left ?? 0;

  // A plain rounded rectangle, inset per `clipInset`. Shared by both the visible outline
  // (edgePath) and the clip (clipPath) when `variant === 'rounded'`, so the stroke and the
  // fill use the same shape — needed once a rounded tab can have a *visible* border.
  const roundedRectPath = useMemo(() => {
    const x0 = insetLeft;
    const y0 = insetTop;
    const x1 = widthContainer - insetRight;
    const y1 = heightContainer - insetBottom;
    const rect = `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
    return roundPathCorners(rect, radius);
  }, [widthContainer, heightContainer, radius, insetTop, insetRight, insetBottom, insetLeft]);

  const edgePath = useMemo(() => {
    if (variant === 'rounded') return roundedRectPath;
    return calcBorder(propStrokeWidth);
  }, [variant, roundedRectPath, widthContainer, heightContainer, radius, propStrokeWidth]);

  const clipPath = useMemo(() => {
    if (radius === 0) return undefined;
    if (variant === 'rounded') return roundedRectPath;
    const strokeOffset = propStrokeWidth / 2;
    const w = widthContainer;
    // Align the fill's sides/bottom to the stroke centerline so the foreground
    // tucks under the border (no background seam). The top stays flush at y=0 so
    // the tab reads "open" at the top.
    const b = heightContainer - strokeOffset;
    // A single continuous, closed tab outline rounded in one pass, so every
    // corner — including the two top corners the stroke leaves open — gets a
    // clean curve instead of the square-cap-over-inset-curve mismatch that let
    // the background bleed through. Left open at the top edge; the fill closes it.
    const path = `M 0 0 L ${radius} 0 L ${radius} ${b} L ${w - radius} ${b} L ${w - radius} 0 L ${w} 0`;
    return roundPathCorners(path, radius);
  }, [widthContainer, heightContainer, radius, propStrokeWidth, variant, roundedRectPath]);

  const childProps = useMemo(() => {
    // Merge (don't replace) the child's own style so inline-styled children keep
    // their styles; we only add the clip path.
    const childStyle = isValidElement(children) ? (children.props as any)?.style : undefined;
    return {
      style: {
        ...childStyle,
        clipPath: `path('${clipPath}')`
      }
    }
  }, [clipPath, children]);

  const refMerged = useMergeRefs([refLocal, refMeasureContainer, refForwarded]);
  return (
    <div
      className={propClassName}
      style={{
        display: 'flex',
        flexDirection: 'row',
        ...propStyle
      }}
      {...rest}
      ref={refMerged as React.Ref<HTMLDivElement>}
    >
      {isValidElement(children) ? cloneElement(children, childProps) : <></>}
      <svg
        style={{
          position:"absolute",
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
        width={widthContainer}
        height={heightContainer}
        viewBox={`0 0 ${widthContainer} ${heightContainer}`}
      >
      <path
        d={edgePath}
        stroke={strokeColor}
        // d={clipPath}
        // stroke="red"
        fill="none"
        // strokeDasharray={strokeDasharray}
        // strokeDashoffset={strokeDashoffset}
        vectorEffect="non-scaling-stroke"
        strokeWidth={propStrokeWidth}
      />
    </svg>
  </div>)
}));