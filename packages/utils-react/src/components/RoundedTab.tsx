import React, { useRef, useMemo, memo, forwardRef } from 'react';

import { Point } from '@sheetxl/utils';

import { mergeRefs } from 'react-merge-refs';

import { useMeasure } from 'react-use';


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
  function adjustCommand(cmd, newPoint: Point) {
    if (cmd.length > 2) {
      cmd[cmd.length - 2] = newPoint.x;
      cmd[cmd.length - 1] = newPoint.y;
    }
  }

  // Gives an {x, y} object for a command's ending position
  function pointForCommand(cmd) {
    return {
      x: parseFloat(cmd[cmd.length - 2]),
      y: parseFloat(cmd[cmd.length - 1]),
    };
  }

  // Split apart the path, handing concatenated letters and numbers
  let pathParts = pathString
    .split(/[,\s]/)
    .reduce(function(parts, part) {
      let match = part.match("([a-zA-Z])(.+)");
      if (match) {
        parts.push(match[1]);
        parts.push(match[2]);
      } else {
        parts.push(part);
      }

      return parts;
    }, []);

  // Group the commands with their arguments for easier handling
  let commands = pathParts.reduce(function(commands, part) {
    // The part is a parsed number
    if (parseFloat(part) == part && commands.length) {
      commands[commands.length - 1].push(part);
    } else {
      commands.push([part]);
    }

    return commands;
  }, []);

  // The resulting commands, also grouped
  let resultCommands = [];

  if (commands.length > 1) {
    let startPoint = pointForCommand(commands[0]);

    // Handle the close path case with a "virtual" closing line
    let virtualCloseLine = null;
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
    ...rest
  } = props;

  const [refMeasureContainer, { width:widthContainer, height:heightContainer }] = useMeasure<HTMLDivElement>();
  const refLocal = useRef<HTMLDivElement>(null);

  const calcBorder = (strokeWidth: number, padding: number=0) => {
    const strokeOffset = strokeWidth / 2;
    const topOffset = strokeOffset;
    const bottomOffset = heightContainer - strokeOffset + padding;

    // draw left with notch out, bottom, right with notch out
    const left = `M 0 ${topOffset} L ${radius - 0.5} ${topOffset} L ${radius - 0.5} ${bottomOffset} L ${radius*2} ${bottomOffset}`;
    const bottom = `L ${widthContainer - (radius*2)} ${bottomOffset}`;
    const right = `M ${widthContainer - radius*2} ${bottomOffset} L ${widthContainer - (radius)} ${bottomOffset} L ${widthContainer - (radius)} ${topOffset} L ${widthContainer} ${topOffset}`;

    return roundPathCorners(`${left} ${bottom} ${right}`, radius);
  }

  const edgePath = useMemo(() => {
    return calcBorder(propStrokeWidth);
  }, [widthContainer, heightContainer, radius, propStrokeWidth]);

  const clipPath = useMemo(() => {
     if (radius === 0) return undefined;
     const strokeOffset = radius / 2;
    const edgeBorder = calcBorder(radius);
    // add a top edge; this move up right, down.
    const path = edgeBorder + `L ${widthContainer} 0 L 0 0 L 0 ${strokeOffset}`;
    return path
  }, [edgePath, radius, propStrokeWidth]);

  const childProps = useMemo(() => {
    return {
      style: {
        clipPath: `path('${clipPath}')`
      }
    }
  }, [clipPath]);

  return (
    <div
      className={propClassName}
      style={{
        display: 'flex',
        flexDirection: 'row',
        ...propStyle
      }}
      {...rest}
      ref={mergeRefs([refLocal, refMeasureContainer, refForwarded])}
    >
      {React.isValidElement(children) ? React.cloneElement(children, childProps) : <></>}
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