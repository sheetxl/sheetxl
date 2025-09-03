import React, {
  useMemo, memo, forwardRef, useCallback, useEffect, useReducer
} from 'react';

import clsx from 'clsx';

import { Box, BoxProps } from '@mui/material';

import {
  ITable, Table, ITableStyle, IStyleCollection, IBorder, IStyle, IRange
} from '@sheetxl/sdk';

import { GridSurfaceStyle } from '@sheetxl/grid-react';

import {
  StaticBorderRenderer
} from '@sheetxl/react';

import resetsStyles from '../../theme/Resets.module.css';


export interface TableStylePreviewProps extends BoxProps {
  /** Required */
  styles: IStyleCollection;
  /**
   * The table to render. If not provided then then a default table will be used.
   */
  table?: ITable;
  /**
   * Allows for table Style to be overwritten.
   */
  tableStyle?: ITableStyle;

  bodyStyle: GridSurfaceStyle;

  // borderProps?: StaticBorderRendererProps
  disabled?: boolean;
  /**
   * If `true` then the border will be forced to be thin.
   *
   * @remarks
   * Useful for small thumbnails and mimics Excel.
   */
  forceThinBorder?: boolean;
  /**
   * if `true` then listers will be added to track table changes.
   */
  isLive?: boolean;

  /**
   * Change the default width of the rendered table.
   * @defaultValue `10`
   */
  cellHeight?: number;
}

const rowCount = 5;
const columnCount = 5;
const defaultCellHeight = 10;
const defaultCellScale = 1.3;

/**
 * Component for rendering tableStyle previews.
 * This uses an html table and the TableStyle renderer.
 *
 * It has the ability to render borders and fills
 * with the their styles.
 * @remarks
 * This is intended to be used for the table options pane but is currently not in use.
 */
export const TableStylePreview = memo(forwardRef((props: TableStylePreviewProps, forwardRef) => {
  const {
    styles,
    table: propTable,
    tableStyle = propTable?.getStyle() ?? styles.getDefaultTableStyle(),
    bodyStyle,
    sx: propSx,
    // borderProps,
    disabled: propDisabled,
    className: propClassName,
    forceThinBorder,
    cellHeight = defaultCellHeight,
    isLive = false,
    ...rest
  } = props;

  const cellWidth = Math.ceil(cellHeight * defaultCellScale);

  // const [refMeasure, { width: measureWidth=0, height: measureHeight=0 }] = useMeasure<HTMLDivElement>();
  const [_, forceRender] = useReducer((s: number) => s + 1, 0);

  useEffect(() => {
    if (!isLive || !propTable) return;

    return propTable.addListeners({
      // should we listen to only the style changes?
      onAnyChange: () => {
        forceRender();
      }
    });
  }, [propTable, isLive]);

  const previewTable = useMemo(() => {
    let json:ITable.JSON = propTable?.toJSON() ?? {} as ITable.JSON; // we will be added.
    const previewSize:IRange.Coords = {
      rowStart: 0,
      colStart: 0,
      rowEnd: rowCount - 1,
      colEnd: columnCount - 1
    };
    if (json) {
      json.styleOptions = {
        ...json.styleOptions,
        name: tableStyle.getName()
      }
    }
    json.ref = previewSize;
    return new Table({ initialAnchor: previewSize, json, styles });
  }, [_, propTable, tableStyle, styles]);

  const styleCells:IStyle[] = useMemo(() => {
    const retValue = [];
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:IStyle = previewTable.getStyleAt({ colIndex, rowIndex });
        retValue.push(style);
      }
    }
    return retValue;
  }, [previewTable]);

  const cellPreviews = useMemo(() => {
    const styledArea = (rowIndex: number, colIndex: number, cellStyle: IStyle) => {
      let style = cellStyle.getFill().toCSS(bodyStyle?.darkMode ?? false) as React.CSSProperties;
      const width = cellWidth - (colIndex < columnCount - 1 ? 1 : 0);
      const height = cellHeight - (rowIndex < rowCount - 1 ? 1 : 0);
      const textHeight = 1;//cellStyle.font.weight >= 700 ? 2 : 1;
      const textWidth = 6;
      const textColor = cellStyle.getFont().getFill().toCSS(bodyStyle?.darkMode ?? false);
      style = {
        ...style,
        position: 'absolute',
        boxSizing: 'border-box',
        // borderSpacing: '1px',
        left: (colIndex * (cellWidth - 1)),
        top: (rowIndex * (cellHeight - 1)),
        width,
        height
      }


      return (
        <td
          key={`${rowIndex}-${colIndex}`}
          className={`table-style-fill ${rowIndex}-${colIndex}`}
          style={style}
        >
          <div
            className={`table-style-text ${rowIndex}-${colIndex}`}
            style={{
              position: 'absolute',
              boxSizing: 'border-box',
              width: `${textWidth}px`,
              left: (width - textWidth) / 2,
              top: (height - textHeight) / 2,
              // boxShadow: cellStyle.font.weight >= 700 ? `0px 0px 0px 0.25px ${textColor}` : undefined,
              // outline: cellStyle.font.weight >= 700 ? `${textColor} solid 0px` : undefined,
              borderTop: `${textHeight}px solid ${textColor}`,
            }}
          />
        </td>
      )
    }

    // add to each element the classes
    const retValue = [];
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      const tds = [];
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:IStyle = styleCells[rowIndex * rowCount + colIndex];
        tds.push(styledArea(rowIndex, colIndex, style));
      }
      retValue.push(<tr key={rowIndex}>{tds}</tr>);
    }

    return retValue;
  }, [previewTable, tableStyle, bodyStyle]);

  const getBorderAt = useCallback((_value: any, index: number): IBorder => {
    return styleCells[index].getBorder() ?? null;
  }, [styleCells]);

  return (
    <Box
      ref={forwardRef}
      className="table-format-preview"
      // className={clsx({
      //     ['Mui-disabled']: propDisabled,
      //   }, "static-cell-renderer")
      // }
      sx={{
        background: bodyStyle?.fill,
        filter: propDisabled ? 'grayscale(0.4) opacity(0.8);' : 'none', // move this to TableStylePreview as a disabled prop
        '& .styled-element': {
          position: 'absolute',
        },
        ...propSx
      }}
      {...rest}
    >
      <StaticBorderRenderer
        // styles={styles}
        getBorderAt={getBorderAt}
        rowCount={rowCount}
        columnCount={columnCount}
        forceThinBorder={forceThinBorder}
        width={(cellWidth - 1) * columnCount + 1}
        height={(cellHeight - 1) * rowCount + 1}
        darkMode={bodyStyle?.darkMode ?? false}
        style={{
          pointerEvents: 'none'
          // ...borderProps?.style
        }}
        // {...borderProps}
      >
        <table
          className={clsx(propClassName, 'sheetxl-table-preview', resetsStyles['sheetxl-reset'])}
          style={{
            borderCollapse: 'collapse',
            width: (cellWidth - 1) * columnCount + 1,
            height: (cellHeight - 1) * rowCount + 1
          }}
        >
          <tbody>
            {cellPreviews}
          </tbody>
        </table>
      </StaticBorderRenderer>
    </Box>
  );
}));

export default TableStylePreview;