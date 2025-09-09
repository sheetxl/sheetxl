import React, {
  useRef, useState, memo, useReducer, useMemo
} from 'react';

import { useMeasure } from 'react-use';

import { Theme } from '@mui/material/styles';

import { DialogContent } from '@mui/material';
import { Box } from '@mui/material';

import { ITable, ITableStyle, ICellRanges } from '@sheetxl/sdk';

import {
  useNotifier, IReactNotifier, useCallbackRef, ICommand, useCommand, CommandGroup, CommandButtonType,
} from '@sheetxl/utils-react';

import {
  CommandButton, ExhibitDivider, InternalWindow, InternalWindowProps, IInternalWindowElement,
  themeIcon, InsertTableIcon, // ClearFormatsIcon,
} from '@sheetxl/utils-mui';

import { useModelListener, CommandContext } from '@sheetxl/react';

import { TableStyleOptionsPanel, NamedInput, RangeInput, TableStylePreview } from '../components';

export interface TableDetailsWindowProps extends InternalWindowProps {
  command?: ICommand<ITable, CommandContext.Table>;

  commands: CommandGroup,

  context?: CommandContext.Table;
}

/**
 * TODO
 * - save last searches (up/down arrow to navigate) (in preferences/workbook?)
 * - later add indexing so we can do real-time search and count
 */
export const TableDetailsWindow: React.FC<TableDetailsWindowProps> = memo((props: TableDetailsWindowProps) => {
  const {
    title: propTitle,
    onHide: propOnHide,
    autoFocusSel = '.range-input input',
    context: propContext,
    command,
    commands,
    ...rest
  } = props;

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const refWindow = useRef<IInternalWindowElement>(null);
  const [_, forceRender] = useReducer((s:number) => s + 1, 0);

  const [refContentMeasure, { width: _contentWidth }] = useMeasure<HTMLElement>();

  const _command = useCommand(command);

  const context = propContext ?? command.context();
  const table = context.table();
  const [ranges, setRanges] = useState<ICellRanges>(() => {
    return table ? context.getNames().getRanges(table.getRange()) : null;
  });

  const defaultName = useMemo(() => {
    return table?.getName() ?? '';
  }, [table]);

  useModelListener<ITable, ITable.IListeners>(context.table(), {
    onAnchorCoordsChange(source: ITable): void {
      setRanges(context.getNames().getRanges(source.getRange()));
    },
    onProtectedChange(_source: ITable): void {
      forceRender();
    }
  });

  const handleOnNameChange = useCallbackRef((name: string) => {
    context?.table().setName(name);
  }, [context]);

  const handleOnRangeChange = useCallbackRef((ranges: ICellRanges) => {
    context?.table().resize(ranges.at(0));
  }, [context]);

  let overlay = null;
  if (!context.table()) {
    overlay = (<div
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        opacity: 1,
        display: 'flex',
        alignItems: 'center',
        justifyItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
    >
      <div>
        No table selected
      </div>
    </div>
    )
  }

  const notifier: IReactNotifier = useNotifier();

  return (
    <InternalWindow
      ref={refWindow}
      title={propTitle ?? 'Table Details'}
      initialPosition={{ y: '35' }}
      autoFocusSel={autoFocusSel}
      onHide={propOnHide}
      onFocus={() => setHasFocus(true)}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (!((refWindow?.current?.contains(e.relatedTarget)))) {
          setHasFocus(false);
        }
      }}
      PaperProps={{
        elevation: hasFocus ? 3 : 1 // TODO - make this change based on hover
      }}
      {...rest}
    >
      <DialogContent dividers
        ref={refContentMeasure}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          paddingLeft: (theme: Theme) => theme.spacing(1.5),
          paddingRight: (theme: Theme) => theme.spacing(1.5)
        }}
        // onKeyDown={(e) => {
        //   // needed because dialogs are not using command keys
        //   // e.stopPropagation();
        //   // e.preventDefault();
        // }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            transition: 'opacity 60ms',
            opacity: context.table() ? 1 : 0
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              gap: (theme: Theme) => theme.spacing(1)
            }}
          >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: '100%',
              boxSizing: 'border-box',
              paddingLeft: (theme: Theme) => theme.spacing(2),
              paddingRight: (theme: Theme) => theme.spacing(2)
            }}
          >
            <Box // range row
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <NamedInput
                formName={'name'}
                defaultInput={defaultName}
                value={table?.getName() ?? 'No table'}
                onChangeInput={handleOnNameChange}
                onValidate={(name: string) => {
                  if (table && table.getName().toLowerCase() === name.toLowerCase()) return;
                  context?.getNames().validateName(name);
                }}
                disabled={table?.isProtected() ?? true}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                  if (!firstFocus) {
                    e.target?.select();
                  }
                  setFirstFocus(true);
                }}
              />
              <RangeInput
                formName={'range'}
                value={ranges}
                onChangeInput={handleOnRangeChange}
                // TODO - valid resize
                resolvedAddress={context.getNames().getRanges.bind(context.getNames())}
                disabled={table?.isProtected() ?? true}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                  if (!firstFocus) {
                    e.target?.select();
                  }
                  setFirstFocus(true);
                }}
              />
            </Box>
          </Box>
          </Box>
          <Box
            sx={{
              minHeight: '10px',
              flex: '1 1 100%',
              display: 'flex',
              flexDirection: 'column',
              gap: (theme: Theme) => theme.spacing(0.5),
              marginTop: (theme: Theme) => theme.spacing(1)
            }}
          >
            <ExhibitDivider
              orientation='horizontal'
              sx={{
                marginTop: (theme: Theme) => theme.spacing(1.5),
                marginBottom: (theme: Theme) => theme.spacing(0.75)
              }}
            />
            <TableStyleOptionsPanel
              disabled={table?.isProtected()}
              styleOptions={table?.getStyleOptions() ?? null}
              onStyleOptionsChange={(options: ITableStyle.StyleOptions) => {
                table.updateStyleOptions(options);
              }}
              showHeaderRow={table?.getShowHeaders()}
              onShowHeaderRowChange={(show: boolean) => {
                try {
                  table.setShowHeaders(show);
                } catch (error: any) {
                  notifier.showError(error);
                }
              }}
              showTotalRow={table?.getShowTotals()}
              onShowTotalRowChange={(show: boolean) => {
                try {
                  table.setShowTotals(show);
                } catch (error: any) {
                  notifier.showError(error);
                }
              }}
              showFilterButton={table?.getFilter() ? table.getShowFilterButton() : null}
              onShowFilterButtonChange={(show: boolean) => {
                try {
                  table.setShowFilterButton(show);
                } catch (error: any) {
                  notifier.showError(error);
                }
              }}

              // sx={{
              // I wanted it to layout 3x2 like excel but it was not responsive and I didn't like the way it looked.
              //   maxHeight: contentWidth > minContentWidth ? undefined : '90px'
              // }}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                marginTop: (theme: Theme) => theme.spacing(2),
                marginBottom: (theme: Theme) => theme.spacing(1)
              }}
            >
              {/*
                TODO - make this a drop down button (use preset table styles with custom, large button)
              */}
              <TableStylePreview
                table={table}
                styles={context.styles()}
                bodyStyle={context.bodyStyle()}
                cellHeight={30}
                isLive={true}
              />
            </Box>
            <ExhibitDivider
                orientation='horizontal'
              />
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                // gap: (theme: Theme) => theme.spacing(1),
                justifyContent: 'center'
              }}
            >
              <CommandButton
                variant={CommandButtonType.Menuitem}
                command={commands.getCommand('convertTableToRange')}
                commandState={table}
                icon={themeIcon(<InsertTableIcon/>)}
              />
              <CommandButton
                variant={CommandButtonType.Menuitem}
                commandState={table}
                command={commands.getCommand('deleteTable')}
                // commandHook={commandHook}

                icon={themeIcon(<InsertTableIcon/>)}
              />
            </Box>
          </Box>
        </Box>
        {overlay}
      </DialogContent>
    </InternalWindow>
  );
});

export default TableDetailsWindow;
