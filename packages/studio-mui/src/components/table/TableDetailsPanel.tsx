import React, {
  useRef, useState, memo, forwardRef, useReducer, useMemo
} from 'react';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';

import { useMeasure } from 'react-use';

import { Theme } from '@mui/material/styles';

import { Paper, Box, Typography } from '@mui/material';

import { ITable, ITableStyle, ICellRanges } from '@sheetxl/sdk';

import {
  useNotifier, IReactNotifier, useCallbackRef, ICommand, useCommands, ICommands, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, ExhibitDivider
} from '@sheetxl/utils-mui';

import { useModelListener, CommandContext } from '@sheetxl/react';

import styles from './TableDetailsPanel.module.css';

import { NamedInput, RangeInput } from '..';
import { PresetTableStylesCommandButton } from '../../command';
import { TableStyleOptionsPanel } from './TableStyleOptionsPanel';
import { TableStylePreview } from './TableStylePreview';

export interface TableDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  command?: ICommand<ITable, CommandContext.Table>;

  commands: ICommands.IGroup;

  context?: CommandContext.Table;

  // Add back if we want to hardcode to TaskPanes vs dialogs (or we create an appropriate interface)
  // frame?: IFrame;
}

/**
 * TODO
 * - save last searches (up/down arrow to navigate) (in preferences/workbook?)
 * - later add indexing so we can do real-time search and count
 */
export const TableDetailsPanel =
  memo(forwardRef<HTMLDivElement, TableDetailsPanelProps>((props, refForwarded) => {

  const {
    title: propTitle,
    // onHide: propOnHide,
    // autoFocusSel = '.range-input input',
    // frame,
    commands,
    className: propClassName,
    ...rest
  } = props;

  const notifier: IReactNotifier = useNotifier();

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const refLocal = useRef<HTMLDivElement>(null);
  const [_, forceRender] = useReducer((s:number) => s + 1, 0);

  const [refContentMeasure, { width: _contentWidth }] = useMeasure<HTMLElement>();

  const commandsResolved = useCommands(commands, ['editTable']);

  const context: CommandContext.Table = commandsResolved[0].context() as unknown as CommandContext.Table;
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
    overlay = (
    <Typography
      component="div"
      style={{
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyItems: 'center',
        justifyContent: 'center'
      }}
    >
      No table selected
    </Typography>
    )
  }

  return (
    <Paper
      // autoFocusSel={autoFocusSel}
      // onHide={propOnHide}
      square={true}
      onFocus={() => setHasFocus(true)}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (!((refLocal?.current?.contains(e.relatedTarget)))) {
          setHasFocus(false);
        }
      }}
      ref={mergeRefs([refLocal, refContentMeasure, refForwarded]) as React.RefObject<HTMLDivElement>}

      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        paddingTop: (theme: Theme) => theme.spacing(1.5),
        paddingBottom: (theme: Theme) => theme.spacing(1.5),
        boxSizing: 'border-box',
      }}
      className={clsx('sxl-table-details-panel', propClassName, {
        ['sxl-has-focus']: hasFocus
      })}
      {...rest}
      // onKeyDown={(e) => {
      //   // needed because dialogs are not using command keys
      //   // e.stopPropagation();
      //   // e.preventDefault();
      // }}
    >
      {overlay ? overlay :
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 auto',
            flexDirection: 'column',
            transition: 'opacity 60ms',
            opacity: context.table() ? 1 : 0
          }}
        >
          <Box
            sx={{
              containerType: 'inline-size', // Enable container queries
              display: 'flex',
              flexDirection: 'column',
              maxWidth: '100%',
              boxSizing: 'border-box',
              paddingTop: (theme: Theme) => theme.spacing(2),
              paddingLeft: (theme: Theme) => theme.spacing(2),
              paddingRight: (theme: Theme) => theme.spacing(2)
            }}
          >
            <Box // range row
              className={styles['range-row']}
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
          <Box
            sx={{
              minHeight: '10px',
              flex: '1 1 100%',
              display: 'flex',
              flexDirection: 'column',
              containerType: 'inline-size', // Enable container queries
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
            <Box
              sx={{
                display: 'flex',
                flex: '1 1 100%',
                alignItems: 'center',
                justifyContent: 'start',
                flexDirection: 'column',
                marginTop: (theme: Theme) => theme.spacing(1),
                marginBottom: (theme: Theme) => theme.spacing(1)
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'start', gap: '2px' }}
              >
                <TableStylePreview
                  table={table}
                  styles={context.styles()}
                  bodyStyle={context.bodyStyle()}
                  cellHeight={30}
                  isLive={true}
                />
                {/*
                  TODO - we need the float parent to allow the menu to close
                */}
                <PresetTableStylesCommandButton
                  command={(commands.getCommand('formatTableStyle'))}
                  commands={commands}
                  disabledQuickKey={true}
                  // style={{
                  //   borderTopLeftRadius: '0px',
                  //   borderBottomLeftRadius: '0px',
                  // }}
                  // {...commandPopupProps}
                />
              </div>
            </Box>
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
            />
            <ExhibitDivider
              orientation='horizontal'
            />
            <Box // action-row
              className={styles['action-row']}
            >
              <CommandButton
                variant={CommandButtonType.Menuitem}
                command={commands.getCommand('convertTableToRange')}
                commandState={table}
              />
              <CommandButton
                variant={CommandButtonType.Menuitem}
                commandState={table}
                command={commands.getCommand('deleteTable')}
                // commandHook={commandHook}
              />
            </Box>
          </Box>
        </Box>
      }
    </Paper>
  );
}));