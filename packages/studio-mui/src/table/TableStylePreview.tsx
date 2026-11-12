import type React from 'react';
import {
  useMemo, memo, forwardRef, useCallback, useEffect, useReducer
} from 'react';

import clsx from 'clsx';

import { Box, type BoxProps } from '@mui/material';

import {
  Table, type ITable, type ITableStyle, type IStyleCollection, type IBorders, type ICellStyle
} from '@sheetxl/sdk';

import { StaticBorderRenderer, useGridColorScheme } from '@sheetxl/react';

import resetsStyles from '../theme/Resets.module.css';


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

  // propsBorder?: StaticBorderRendererProps
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

// 15x15 viewport
// TODO - move to icon pack
const PATH_CLEAR = `M 7.4530672,10.134098 2.6725085,5.2978998 3.370275,4.5911648 7.4530672,8.7264777 11.530095,4.5911648 l 0.697764,0.706735M 7.4529247,10.134098 2.9086709,5.2978998 3.5719465,4.5911648 7.4529247,8.7264777 11.328423,4.5911648 l 0.663274,0.70673`;

/**
 * Component for rendering tableStyle previews.
 * This uses an html table and the TableStyle renderer.
 *
 * It has the ability to render borders and fills
 * with the their styles.
 * @remarks
 * This is intended to be used for the table options pane but is currently not in use.
 */
export const TableStylePreview = memo(forwardRef(
  (props: TableStylePreviewProps, refForwarded) => {
  const {
    styles,
    table: propTable,
    tableStyle = propTable?.getStyle() ?? styles.getTableStyles().getDefault(),
    sx: propSx,
    // borderProps,
    disabled: propDisabled,
    className: propClassName,
    forceThinBorder,
    cellHeight = defaultCellHeight,
    isLive = false,
    ...rest
  } = props;

  // The grid body's scheme (shared source; this renders in the table details panel, outside the grid).
  // Drives `toCSS(darkMode)` inversion; the window bg + cell tokens resolve from the grid surface the
  // root Box declares below.
  const gridColorScheme = useGridColorScheme();
  const darkMode = gridColorScheme === 'dark';

  const cellWidth = Math.ceil(cellHeight * defaultCellScale);
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
    const size = {
      width: columnCount,
      height: rowCount
    };
    if (json) {
      json.style = {
        ...json.style,
        name: tableStyle.getName()
      }
    }
    return new Table({ size, json, styles });
  }, [_, propTable, tableStyle, styles]);

  const styleCells:ICellStyle[] = useMemo(() => {
    const retValue = [];
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:ICellStyle = previewTable.getStyleAt(rowIndex, colIndex);
        retValue.push(style);
      }
    }
    return retValue;
  }, [previewTable]);

  const cellPreviews = useMemo(() => {
    const isHiddenButtons = previewTable.isHiddenButtons() || !previewTable.isShowHeaders();
    const styledArea = (rowIndex: number, colIndex: number, cellStyle: ICellStyle) => {
      const showButtons = !isHiddenButtons && rowIndex === 0;
      let style = cellStyle.getFill().toCSS(darkMode) as React.CSSProperties;
      const width = cellWidth - (colIndex < columnCount - 1 ? 1 : 0);
      const height = cellHeight - (rowIndex < rowCount - 1 ? 1 : 0);
      const textHeight = 1;//cellStyle.font.weight >= 700 ? 2 : 1;
      const textWidth = 6;
      const textColor = cellStyle.getFont().getColor().toCSS(darkMode);
      style = {
        ...style,
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        justifyContent: showButtons ? 'space-evenly' : 'center',
        boxSizing: 'border-box',
        // borderSpacing: '1px',
        left: (colIndex * (cellWidth - 1)),
        top: (rowIndex * (cellHeight - 1)),
        width,
        height
      }

      let button = null;
      if (showButtons) {
        button = (
        <svg
          width={`${15}`}
          height={`${15}`}
          viewBox={`0 0 15 15`}
          style={{
            fill: textColor,
            // opacity: disabled ? 0.6 : 1,
            // transform: `scale(${zoom})`
          }}
        >
          <path d={PATH_CLEAR}/>
        </svg>
        )
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
              boxSizing: 'border-box',
              width: `${textWidth}px`,
              // boxShadow: cellStyle.font.weight >= 700 ? `0px 0px 0px 0.25px ${textColor}` : undefined,
              // outline: cellStyle.font.weight >= 700 ? `${textColor} solid 0px` : undefined,
              borderTop: `${textHeight}px solid ${textColor}`,
            }}
          />
          {button}
        </td>
      )
    }

    // add to each element the classes
    const retValue = [];
    for (let rowIndex=0; rowIndex<rowCount; rowIndex++) {
      const tds = [];
      for (let colIndex=0; colIndex<columnCount; colIndex++) {
        const style:ICellStyle = styleCells[rowIndex * rowCount + colIndex];
        tds.push(styledArea(rowIndex, colIndex, style));
      }
      retValue.push(<tr key={rowIndex}>{tds}</tr>);
    }

    return retValue;
  }, [previewTable, tableStyle, darkMode, previewTable.isHiddenButtons()]);

  const getBorderAt = useCallback((_value: any, index: number): IBorders => {
    return styleCells[index].getBorders() ?? null;
  }, [styleCells]);

  return (
    <Box
      ref={refForwarded}
      className="table-format-preview"
      // Adopt the grid surface + its mode so the window bg + any cell tokens resolve to grid values.
      data-sxl-theme-surface="grid"
      data-sxl-theme-mode={gridColorScheme}
      sx={{
        background: 'var(--sxl-color-base-100)',
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