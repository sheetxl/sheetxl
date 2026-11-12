import { IFill, type ICellStyle } from '@sheetxl/sdk';

/** The grid of cells a style swatch draws, and the size of each. */
export interface StyleSwatchGrid {
  rows: number;
  columns: number;
  /** A cell's width in pixels, its right line included. */
  cellWidth: number;
  /** A cell's height in pixels, its bottom line included. */
  cellHeight: number;
}

/** A swatch's size in pixels: neighboring cells share a line. */
export const swatchSizeOf = (grid: StyleSwatchGrid): { width: number; height: number } => ({
  width: grid.columns * grid.cellWidth - (grid.columns - 1),
  height: grid.rows * grid.cellHeight - (grid.rows - 1)
});

const textHeight = 1;
const textWidth = 7;

const line = (ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number): void => {
  ctx.beginPath();
  ctx.moveTo(x+0.5, y+0.5);
  ctx.lineTo(x2+0.5, y2+0.5);
  ctx.stroke();
}

/**
 * Draws a table or pivot table style swatch, each cell's fill, outer lines and a stroke for its
 * text, and returns it as a CSS `url(...)` of a data URL; `null` when the canvas has no context.
 *
 * @param styleAt The style a cell shows, from the swatch's top-left.
 * @param gridFill An opaque color for cells with no fill (a canvas fill cannot take a `var()`).
 * @param hasText Whether a cell shows text; absent, every cell does.
 */
export const drawStyleSwatch = (
  canvas: HTMLCanvasElement,
  grid: StyleSwatchGrid,
  styleAt: (rowIndex: number, colIndex: number) => ICellStyle,
  darkMode: boolean,
  gridFill: string,
  hasText?: (rowIndex: number, colIndex: number) => boolean
): string | null => {
  const { rows, columns } = grid;
  const styleCells:ICellStyle[] = [];
  for (let rowIndex=0; rowIndex<rows; rowIndex++) {
    for (let colIndex=0; colIndex<columns; colIndex++) {
      styleCells.push(styleAt(rowIndex, colIndex));
    }
  }

  const { width: swatchWidth, height: swatchHeight } = swatchSizeOf(grid);
  if (canvas.width !== swatchWidth) {
    canvas.width = swatchWidth;
  }
  if (canvas.height !== swatchHeight) {
    canvas.height = swatchHeight;
  }
  /* `willReadFrequently`: this canvas is drawn and then READ (`toDataURL`) once per swatch, sixty
     times in a row. Without it the browser keeps the bitmap on the GPU and every read is a
     synchronous readback, which is where a 61x46 swatch spends ~15ms. */
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  const width = grid.cellWidth - 1;
  const height = grid.cellHeight - 1;
  // fills
  for (let rowIndex=0; rowIndex<rows; rowIndex++) {
    for (let colIndex=0; colIndex<columns; colIndex++) {
      const style:ICellStyle = styleCells[rowIndex * columns + colIndex];
      const fill = style.getFill();
      let color = gridFill; // default background (the grid/window color)
      if (fill.getType() === IFill.Type.Solid) {
        color = (fill as IFill.ISolid).getColor().toRGBA(darkMode).toString();
      } else if (fill.getType() === IFill.Type.Gradient) {
        color = (fill as IFill.IGradient).getStops()[0]?.getColor().toRGBA(darkMode).toString();
      } else if (fill.getType() === IFill.Type.Pattern) {
        color = (fill as IFill.IPattern).getForeground().toRGBA(darkMode).toString();
      }
      // `ctx.fillStyle = undefined` is a silent no-op (keeps the prior cell's color) → bleed. Guard it.
      ctx.fillStyle = color ?? gridFill;

      const x = colIndex * width;
      const y = rowIndex * height;
      ctx.fillRect(x, y, width + 1, height + 1);
    }
  }
  // borders and text
  ctx.lineWidth = 1;
  for (let rowIndex=0; rowIndex<rows; rowIndex++) {
    for (let colIndex=0; colIndex<columns; colIndex++) {
      const style:ICellStyle = styleCells[rowIndex * columns + colIndex];
      const x = colIndex * width;
      const y = rowIndex * height;
      // border
      const border = style.getBorders();
      if (!border.isEmpty()) {
        const left = border.getLeft();
        if (!left.isNone()) {
          ctx.strokeStyle = left.getColor().toRGBA(darkMode).toString();
          line(ctx, x, y, x, y + height);
        }
        const top = border.getTop();
        if (!top.isNone()) {
          ctx.strokeStyle = top.getColor().toRGBA(darkMode).toString();
          line(ctx, x, y, x + width, rowIndex * height);
        }
        const right = border.getRight();
        if (!right.isNone()) {
          ctx.strokeStyle = right.getColor().toRGBA(darkMode).toString();
          line(ctx, x + width, y, x + width, y + height);
        }
        const bottom = border.getBottom();
        if (!bottom.isNone()) {
          ctx.strokeStyle = bottom.getColor().toRGBA(darkMode).toString();
          line(ctx, x, y + height, x + width, y + height);
        }
      }

      // text
      if (hasText && !hasText(rowIndex, colIndex)) continue;
      ctx.strokeStyle = style.getFont().getColor().toRGBA(darkMode).toString();
      // The middle pixel row between the cell's lines, on a whole pixel so the stroke stays sharp.
      const textTop = Math.floor((height - textHeight + 1) / 2);
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
  return `url(${canvas.toDataURL()})`;
};
