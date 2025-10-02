import React, { useEffect, useState, useMemo } from 'react';
import clsx from 'clsx';

import { Theme, styled, alpha, getOverlayAlpha } from '@mui/material/styles';

import { TextField } from '@mui/material';
import { Box } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';
import { Typography } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { IconButton } from '@mui/material';
import { TableCell } from '@mui/material';

import {
  AutoSizer, Column, Table, TableCellProps, TableHeaderProps,
} from 'react-virtualized';

import { CommonUtils } from '@sheetxl/utils';
import { ICommand, ICommands, KeyCodes, DynamicIcon } from '@sheetxl/utils-react';

import { toShortcutElements } from '@sheetxl/utils-mui';

const classes = {
  flexContainer: 'ReactVirtualizedDemo-flexContainer',
  tableRow: 'ReactVirtualizedDemo-tableRow',
  tableRowHover: 'ReactVirtualizedDemo-tableRowHover',
  tableCell: 'ReactVirtualizedDemo-tableCell',
  noClick: 'ReactVirtualizedDemo-noClick',
};

const styles = ({ theme }: { theme: Theme }) =>
  ({
    // temporary right-to-left patch, waiting for
    // https://github.com/bvaughn/react-virtualized/issues/454
    '& .ReactVirtualized__Table__headerRow': {
      ...(theme.direction === 'rtl' && {
        paddingLeft: '0 !important',
      }),
      ...(theme.direction !== 'rtl' && {
        paddingRight: undefined,
      }),
    },
    '& .ReactVirtualized__Table__Grid': {
      outline: 'none'
    },
    [`& .${classes.flexContainer}`]: {
      display: 'flex',
      alignItems: 'center',
      boxSizing: 'border-box',
    },
    [`& .${classes.tableRow}`]: {
      cursor: 'pointer',
    },
    [`& .${classes.tableRowHover}`]: {
      '&:hover:not([disabled])': {
        backgroundColor: theme.palette.grey[200],
      },
    },
    [`& .${classes.tableCell}`]: {
      flex: 1,
    },
    [`& .${classes.noClick}`]: {
      cursor: 'initial',
    },
  } as const);

interface ColumnData {
  dataKey: string;
  label: string;
  numeric?: boolean;
  icon?: string;
  width?: number;
  widthLess?: number;
}

interface Row {
  index: number;
}

interface MuiVirtualizedTableProps {
  columns: readonly ColumnData[];
  headerHeight?: number;
  onRowClick?: () => void;
  rowCount: number;
  rowGetter: (row: Row) => any;
  rowHeight?: number;
}

class MuiVirtualizedTable extends React.PureComponent<MuiVirtualizedTableProps> {
  static defaultProps = {
    headerHeight: 40,
    rowHeight: 48,
  };

  getRowClassName = ({ index }: Row) => {
    const { onRowClick } = this.props;

    return clsx(classes.tableRow, classes.flexContainer, {
      [classes.tableRowHover]: index !== -1 && onRowClick != null,
    });
  };

  cellRenderer = ({
    cellData,
    rowData,
    dataKey,
    columnIndex,
    width
  }: TableCellProps & { width: number }) => {

    const { columns, rowHeight, onRowClick } = this.props;
    let dataRender = cellData;
    let styling:React.CSSProperties = {
      height: rowHeight,
      paddingRight: '2px',
      paddingTop: '0px',
      paddingBottom: '0px',
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
    }
    if (dataKey === 'shortcut') {
      dataRender = toShortcutElements(cellData);
    } else if (dataKey === 'description') {
      styling = {
        ...styling,
        fontSize: '.75rem',
        display: 'block',
        paddingTop: '4px',
        paddingRight: '8px',
        whiteSpace: 'pre-line'
      }
    }
    if (dataKey === 'label') {
      let icon = rowData.icon;
      if (!icon || typeof icon === 'string') {
        icon = <DynamicIcon iconKey={icon} />;
      }
      // else if (React.isValidElement(icon)) {
      //   icon
      // }
      dataRender = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          {cellData}
        </div>
      );
    }
    return (
      <TableCell
        component="div"
        className={clsx(classes.tableCell, classes.flexContainer, {
          [classes.noClick]: onRowClick == null,
        })}
        variant="body"
        style={styling}
        align={
          (columnIndex != null && columns[columnIndex].numeric) || false
            ? 'right'
            : 'left'
        }
      >
        {dataRender}
      </TableCell>
    );
  };

  headerRenderer = ({
    label,
    columnIndex,
    dataKey,
    width
  }: TableHeaderProps & { columnIndex: number, width: number }) => {
    const { headerHeight, columns } = this.props;

    const column = columns[columnIndex];
    return (
      <TableCell
        component="div"
        className={clsx(classes.tableCell, classes.flexContainer, classes.noClick)}
        variant="head"
        sx={{
          width,
          height: headerHeight,
          paddingLeft: dataKey === 'label' ? 'calc(16px + 8px + var(--icon-size, 1rem))' : undefined,
          backgroundColor: (theme: Theme) => theme.palette.grey[300],
        }}
        align={column.numeric || false ? 'right' : 'left'}
      >
        <div>{column.label}</div>
      </TableCell>
    );
  };

  render() {
    const { columns, rowHeight, headerHeight, ...tableProps } = this.props;
    return (
      <AutoSizer>
        {({ height, width: tableWidth }) => (
          <Table
            height={height}
            width={tableWidth}
            rowHeight={rowHeight!}
            gridStyle={{
              direction: 'inherit',
            }}
            headerHeight={headerHeight!}
            {...tableProps}
            rowClassName={this.getRowClassName}
          >
            {columns.map(({ dataKey, width: colWidth, widthLess, ...other }, index) => {
              const renderWidth = widthLess ? tableWidth - widthLess : colWidth;
              return (
                <Column
                  style={{
                    flex: `1 1 ${renderWidth}px`,
                  }}
                  key={dataKey}
                  headerRenderer={(headerProps) =>
                    this.headerRenderer({
                      ...headerProps,
                      width: renderWidth,
                      columnIndex: index,
                    })
                  }
                  className={classes.flexContainer}
                  cellDataGetter={({ rowData, columnData, dataKey }) => {
                    return rowData[dataKey];
                  }}
                  cellRenderer={(cellProps) =>
                    this.cellRenderer({
                      ...cellProps,
                      width: renderWidth,
                      columnIndex: index,
                    })
                  }
                  dataKey={dataKey}
                  width={renderWidth}
                  {...other}
                />
              );
            })}
          </Table>
        )}
      </AutoSizer>
    );
  }
}

const VirtualizedTable = styled(MuiVirtualizedTable)(styles);

export default function ShortcutKeysPanel(props) {
  const {
    commands,
    ...rest
  } = props;

  const [showAll, setShowAll] = useState<boolean>(false);
  const [searchInputText, setSearchInputText] = useState<string>('');

  const availableRows = useMemo(() => {
    const asCommands:ICommands.IGroup = commands;
    let commandArray:{ command: ICommand<any, any>, groupKey: string}[] = asCommands.getAllCommands();
    if (!showAll) {
      commandArray = commandArray.filter((record: { command: ICommand<any, any>, groupKey: string }) => {
        return record.command.shortcut();
      });
    }

    // sort by group (doesn't exist yet)
    commandArray.sort((a: { command: ICommand<any, any>, groupKey: string}, b: { command: ICommand<any, any>, groupKey: string}) => {
      return a.command.label().localeCompare(b.command.label());
    });
    // we want multiple shortcuts to be their own line.
    const retValue = [];

    const replaceDoubleNewLines = (str: string):string => {
      return str.replace(/\n\n/g, '\n');
    }

    const commandArrayLength = commandArray.length;
    for (let i=0;i<commandArrayLength; i++) {
      const record = commandArray[i];
      const command = record.command;
      const shortcut = command.shortcut();
      if (Array.isArray(shortcut)) {
        const shortcuts = shortcut as any[];
        const shortcutsLength = shortcuts.length;
        for (let j=0; j<shortcutsLength; j++) {
          retValue.push({
            label: command.label(),
            icon: command.icon(),
            description: replaceDoubleNewLines(command.description()),
            shortcut: shortcuts[j]
          });
        }
      } else {
        retValue.push({
          label: command.label(),
          icon: command.icon(),
          description: replaceDoubleNewLines(command.description()),
          shortcut: command.shortcut()
        });
      }
    }
    return retValue;
  }, [showAll, commands])

  const [indexedRows, setIndexedRows] = useState<any>(null);
  useEffect(() => {
    // TODO - we could do this on first too.
    import('fuse.js').then((Fuse) => {
      setIndexedRows(new Fuse.default(availableRows, {
        threshold: 0,
        ignoreLocation: true,
        keys: [
          "label",
          "description",
          // "shortcut.key"
        ]
      }));
    });
  }, [availableRows]);

  const [rows, setRows] = useState(availableRows);

  const isShowNoResults = searchInputText.length > 0 && rows.length === 0; // return based on search count

  useEffect(() => {
    if (!indexedRows) {
      return;
    }
    CommonUtils.debounce(() => {
      if (searchInputText.trim().length === 0) {
        setRows(availableRows);
        return
      };
      const searchResults = indexedRows.search(searchInputText.trim());
      const searchedRows = new Array(searchResults.length);
      for (let i=0; i<searchResults.length; i++) {
        searchedRows[i] = searchResults[i].item;
      }
      setRows(searchedRows);
    }, 90)();
  }, [indexedRows, searchInputText]);

  const rowGetter = (row: Row):any => {
    return rows[row.index];
  }

  return (
    <Box
      style={{
        height: 440, width: '100%',
        display: 'flex',
        flexDirection: 'column'
     }}
      {...rest}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'end',
          marginBottom: (theme: Theme) => theme.spacing(2),
          color: (theme: Theme) => {
            // if dark mode we use the secondary text color.
            return theme.palette.text.secondary; // default
          }
        }}
      >
        <TextField
          slotProps={{
            input: {
              sx: {
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
              },
              endAdornment: (
                <InputAdornment
                  sx={{
                    opacity: searchInputText.length > 0 ? 1 : 0,
                    display: searchInputText.length > 0 ? 'flex' : 'none',
                    // transform: 'scale(0.75) translateX(16px)'
                  }}
                  position="end"
                >
                   <IconButton
                    aria-label="clear search"
                    onClick={() =>  setSearchInputText('')}
                    edge="end"
                  >
                    <DynamicIcon iconKey='Close'/>
                  </IconButton>
                </InputAdornment>
              )
            },
            htmlInput: {
              className: 'input',
              autoFocus: true, // not 'sticking use autoFocusSel instead'
              spellCheck: false,
              placeholder: 'Type to search key bindings',
              autoComplete: "off",
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1),
                paddingBottom: (theme: Theme) => theme.spacing(1)
              },
            }
          }}
          sx={{
            flex: '1 1 40%',
            marginRight: (theme: Theme) => theme.spacing(1),
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme: Theme) => {
                return isShowNoResults ? `${theme.palette.error.main} !important` : undefined
              }
            },
            '& .MuiInputLabel-outlined': {
              color: (theme: Theme) => {
                return isShowNoResults ? `${theme.palette.error.main} !important` : undefined
              }
            }
          }}
          value={searchInputText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchInputText(e.target.value);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if ((e.which === KeyCodes.Escape)) {
              if (searchInputText.length > 0) {
                setSearchInputText('');
                e.stopPropagation();
                e.preventDefault();
              }
            }
          }}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        <FormControlLabel
          sx={{
            flex: '1 1 60%',
          }}
          control={
            <Checkbox
              checked={showAll}
              onChange={() => setShowAll(!showAll)}
            />
          }
          label="Show commands without key bindings"
          labelPlacement="start"
        />
      </Box>
      <Box
        sx={{
          flex: '1 1 100%',
          borderRadius: (theme: Theme) => {
            return `${theme.shape.borderRadius}px`;
          },
          border: (theme: Theme) => {
            return `solid ${(theme.palette.divider)} 1px`
          },
          paddingRight: '1px',
          overflow: 'hidden',
          '* .MuiTableCell-head': {
            background: (theme: Theme) => {
              return theme.palette.background.paper;
            },
            backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
          }
        }}
      >
        <VirtualizedTable
          rowCount={rows.length}
          rowGetter={rowGetter}
          columns={[
            {
              width: 214,
              label: 'Command',
              dataKey: 'label',
            },
            {
              width: 226,
              label: 'Key Binding',
              dataKey: 'shortcut',
            },
            {
              // width: 240,
              label: 'Description',
              dataKey: 'description',
              widthLess: 214 + 226 + 13 /* scrollbar width */
            },
          ]}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexShrink: '0',
          paddingLeft: theme => theme.spacing(1),
          paddingTop: theme => theme.spacing(1),
          paddingRight: theme => theme.spacing(1),
          // paddingTop: '0px',
          userSelect: 'none',
          justifyContent: 'flex-end',
        }}
      >
        <Typography
          noWrap={true}
          component="div"
          sx={{
            color: (theme: Theme) => {
              return isShowNoResults ? theme.palette.error.main : theme.palette.text.secondary;
            }
          }}
        >
          {`${rows.length === 0 ? 'No' : rows.length} shortcut key${rows.length === 1 ? '' : 's'}${searchInputText.length > 0 ? ` found` : ''}`}
        </Typography>
      </Box>
    </Box>
  );
}
