import React, {
  useMemo, memo, forwardRef
} from 'react';

import clsx from 'clsx';

import {
  ITable, Table, IStyleCollection, ITableStyle, IStyle, IFill, IRange
} from '@sheetxl/sdk';

import { GridSurfaceStyle } from '@sheetxl/grid-react';

export interface TableStyleCanvasPreviewProps extends React.HTMLAttributes<HTMLDivElement>  {
  table: ITable;

  tableStyle: ITableStyle;
  styles: IStyleCollection;
  bodyStyle: GridSurfaceStyle;

  disabled?: boolean;

  /**
   * If provided then this context will be used.
   */
  canvas?: HTMLCanvasElement;
}

const line = (ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number): void => {
  ctx.beginPath();
  ctx.moveTo(x+0.5, y+0.5);
  ctx.lineTo(x2+0.5, y2+0.5);
  ctx.stroke();
}

const rowCount = 5;
const columnCount = 5;
const defaultWidth = 13;
const defaultHeight = 10;
const tableWidth = (columnCount * defaultWidth - (columnCount - 1));
const tableHeight = (rowCount * defaultHeight - (rowCount - 1));
const textHeight = 1;//cellStyle.getFont().getWeight() >= 700 ? 2 : 1;
const textWidth = 7;

/**
 * This is a way to canvas based TableStylePreview. It has a simple rendering but is lightweight.
 */
export const TableStyleCanvasPreview: React.FC<TableStyleCanvasPreviewProps & { ref?: React.Ref<HTMLDivElement> }> =
   memo(forwardRef<HTMLDivElement, TableStyleCanvasPreviewProps>((props, refForward) => {

  const {
    table: propTable,
    tableStyle,
    styles,
    bodyStyle,
    disabled: propDisabled,
    style: propStyle,
    className: propClassName,
    canvas: propCanvas,
    ...rest
  } = props;

  const previewTable = useMemo(() => {
    const json = propTable.toJSON();
    const previewSize: IRange.Coords = {
      rowStart: 0,
      colStart: 0,
      rowEnd: rowCount - 1,
      colEnd: columnCount - 1
    };
    json.styleOptions = {
      ...json.styleOptions,
      name: tableStyle.getName()
    }
    json.ref = previewSize;
    return new Table({ initialAnchor: previewSize, json, styles });
  }, [propTable, tableStyle, styles]);

  const styleCells = useMemo(() => {
    const retValue = [];
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:IStyle = previewTable.getStyleAt({ colIndex, rowIndex });
        retValue.push(style);
      }
    }
    return retValue;
  }, [previewTable]);

  const backgroundImage = useMemo(() => {
    // console.profile("_GenerateBackgroundImage");
    // console.time("_GenerateBackgroundImage");
    let canvas = propCanvas;
    if (!propCanvas) {
      canvas =  document.createElement('canvas');
    }
    if (!canvas) return null;

    if (canvas.width !== tableWidth) {
      canvas.width = tableWidth;
    }
    if (canvas.height !== tableHeight) {
      canvas.height = tableHeight;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      return null;
    }
    // If no context can be found, return early.
    const width = defaultWidth - 1;
    const height = defaultHeight - 1;
    const darkMode = bodyStyle?.darkMode ?? false;
    // fills
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:IStyle = styleCells[rowIndex * rowCount + colIndex];
        const fill = style.getFill();
        let color = bodyStyle?.fill; // default background
        if (fill.getType() === IFill.Type.Solid) {
          color = (fill as IFill.ISolid).getColor().toCSS(darkMode, false);
        } else if (fill.getType() === IFill.Type.Gradient) {
          color = (fill as IFill.IGradient).getStops[0]?.color.toCSS(darkMode, false);
        } else if (fill.getType() === IFill.Type.Pattern) {
          color = (fill as IFill.IPattern).getForeground().toCSS(darkMode, false);
        }
        ctx.fillStyle = color;

        const x = colIndex * width;
        const y = rowIndex * height;
        ctx.fillRect(x, y, width + 1, height + 1);
      }
    }
    // borders and text
    ctx.lineWidth = 1;
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:IStyle = styleCells[rowIndex * rowCount + colIndex];
        const x = colIndex * width;
        const y = rowIndex * height;
        // border
        const border = style.getBorder();
        if (!border.isEmpty()) {
          const left = border.getLeft();
          if (!left.isNone()) {
            ctx.strokeStyle = left.getColor().toCSS(darkMode, false);
            line(ctx, x, y, x, y + height);
          }
          const top = border.getTop();
          if (!top.isNone()) {
            ctx.strokeStyle = top.getColor().toCSS(darkMode, false);
            line(ctx, x, y, x + width, rowIndex * height);
          }
          const right = border.getRight();
          if (!right.isNone()) {
            ctx.strokeStyle = right.getColor().toCSS(darkMode, false);
            line(ctx, x + width, y, x + width, y + height);
          }
          const bottom = border.getBottom();
          if (!bottom.isNone()) {
            ctx.strokeStyle = bottom.getColor().toCSS(darkMode, false);
            line(ctx, x, y + height, x + width, y + height);
          }
        }

        // text
        ctx.strokeStyle = style.getFont().getFill().toCSS(darkMode, false);
        const textTop = (height - textHeight) / 2;
        const textLeft = (width - textWidth) / 2;
        line(
          ctx,
          colIndex * width + textLeft,
          rowIndex * height + textTop,
          colIndex * width + textLeft + textWidth,
          rowIndex * height + textTop
        );
      }
    }
    // console.profileEnd("_GenerateBackgroundImage");
    // console.timeEnd("_GenerateBackgroundImage");

    return `url(${canvas.toDataURL()})`;
  }, [propCanvas, previewTable, tableStyle, bodyStyle]);

  return (
    <div
      ref={refForward}
      className={clsx('table-style-preview', propClassName)}
      style={{
        backgroundImage,
        width: tableWidth,
        height: tableHeight,
        ...propStyle
      }}
      {...rest}
    />
  );
}));