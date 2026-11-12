import type React from 'react';
import {
  useRef, useState, memo, forwardRef, useReducer, useMemo
} from 'react';

import clsx from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { type Theme } from '@mui/material';
import { Paper, Box, Typography } from '@mui/material';

import {
  type ITable, type ITableStyle, type ICalculation, type IStyleCollection, type INamedCollection
} from '@sheetxl/sdk';

import {
  useMeasure, useNotifier, useTranslator, useCallbackRef, CommandButtonType,
  type IReactNotifier
} from '@sheetxl/utils-react';

import { CommandButton, ExhibitDivider } from '@sheetxl/utils-mui';

import { useModelListener, type ReferenceDoneArgs, type EditDoneArgs } from '@sheetxl/react';

import { FormulaField, InputField } from '../form';
import { PresetTableStylesCommandButton } from '../command';
import { TableStyleOptionsPanel } from './TableStyleOptionsPanel';
import { TableStylePreview } from './TableStylePreview';

import styles from './TableDetailsPanel.module.css';

export interface TableDetailsPanelProps extends React.HTMLAttributes<HTMLDivElement> {

  table: ITable;
  getStyles: () => IStyleCollection;
  /**
   * Need so that we can add the table to the names.
   */
  getNames: () => INamedCollection;
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
    table,
    getStyles,
    getNames,
    // onHide: propOnHide,
    // autoFocusSel = '.range-input input',
    // frame,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();

  const notifier: IReactNotifier = useNotifier();

  const [hasFocus, setHasFocus] = useState<boolean>(false);
  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const refLocal = useRef<HTMLDivElement>(null);
  const [_, forceRender] = useReducer((s:number) => s + 1, 0);

  const [refContentMeasure, { width: _contentWidth }] = useMeasure<HTMLElement>();

  // The field's value is the table's own address text, absolute (`$A$3:$D$9` — Excel's resize-dialog
  // shape). Bare (unqualified) on purpose: the panel shows the DISPLAYED sheet's selected table, so
  // the field resolves it against that same sheet. The model listener below re-derives it whenever
  // the table moves.
  const [ranges, setRanges] = useState<string | null>(() => {
    return table ? table.getRange().getFixed(true).toString() : null;
  });

  const defaultName = useMemo(() => {
    return table?.getName() ?? '';
  }, [table]);

  // The field's anchor: the table's own sheet (its top-left cell). Bare text resolves HERE, not
  // against the selected tab — the panel's value has always been bare, and this is what makes that
  // reading stable.
  const tableHome = useMemo(() => {
    const range = table?.getRange();
    if (!range) return undefined;
    const coords = range.getCoords();
    return { rowIndex: coords.rowStart, colIndex: coords.colStart, scope: range.getWorksheet().getName() };
  }, [table, ranges]);

  useModelListener<ITable, ITable.IListeners>(table, {
    onAnchorCoordsChange(source: ITable): void {
      setRanges(source.getRange().getFixed(true).toString());
    },
    onProtectedChange(_source: ITable): void {
      forceRender();
    },
    onAnyChange(_source: ITable): void {
      forceRender();
    }
  });

  // Rename on the COMMIT channel only (Enter/blur/✓ — Escape reverts without touching the model), for
  // the same reason the range resizes there: a live rename wrote the model (and an undo entry) on
  // every keystroke, and every intermediate name had to be a legal one.
  const handleOnNameDone = useCallbackRef((name: string, args: EditDoneArgs) => {
    if (args.reason !== 'accept') return;
    if (!table || table.getName() === name) return;
    table.setName(name);
  }, [table]);

  // Resize on the COMMIT channel only (Enter/blur/✓ — drags just update the text). Resizing live on
  // every keystroke and picker move thrashed the model — and the resize listener re-derives `ranges`
  // from the table, stomping the in-progress text.
  const handleOnRangeDone = useCallbackRef((value: ICalculation.IFormula | null, args: ReferenceDoneArgs) => {
    if (args.reason !== 'accept') return;
    const resized = value?.getReferences();
    if (!resized) return;
    table.resize(resized.at(0));
  }, [table]);

  let overlay = null;
  if (!table) {
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
      {t('table.noneSelected')}
    </Typography>
    )
  }

  const refMerged = useMergeRefs([refLocal, refContentMeasure, refForwarded]);
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
      ref={refMerged as React.RefObject<HTMLDivElement>}

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
            opacity: table ? 1 : 0
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
              <InputField
                formName={'name'}
                defaultInput={defaultName}
                value={table?.getName() ?? 'No table'}
                // Commit-on-done (the range field's model): the ✓/✗ pair appears while editing and
                // Escape reverts to the name the edit started from.
                changeOn="done"
                onDone={handleOnNameDone}
                onValidate={(name: string) => {
                  if (table && table.getName().toLowerCase() === name.toLowerCase()) return;
                  getNames?.().validateName(name);
                }}
                disabled={table?.isProtected() ?? true}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                  if (!firstFocus) {
                    e.target?.select();
                  }
                  setFirstFocus(true);
                }}
              />
              <FormulaField
                grammar="reference"
                formName={'range'}
                value={ranges}
                // A table is ONE block on ONE sheet: no multi-range, no cross-sheet. `home` anchors
                // the bare text to the table's own sheet rather than whichever tab is selected.
                allowMulti={false}
                allowCrossSheet={false}
                home={tableHome}
                // The value is already absolute (`getFixed(true)` — Excel's resize shape), so a pick
                // must land absolute too; otherwise picking silently changed the form of the text.
                pickAs="absolute"
                // The panel acts only on the commit channel, so say so: `'done'` makes Enter the
                // field's own commit point (nothing here submits a form on it) and drops the picker
                // to caret-edit while the user TYPES an address.
                changeOn="done"
                onDone={handleOnRangeDone}
                // TODO - valid resize
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
                  styles={getStyles?.()}
                  cellHeight={30}
                  isLive={true}
                />
                {/*
                  TODO - we need the float parent to allow the menu to close
                */}
                <PresetTableStylesCommandButton
                  commandKey={'formatTableStyle'}
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
              showHeaderRow={table?.isShowHeaders()}
              onShowHeaderRowChange={(show: boolean) => {
                try {
                  table.setShowHeaders(show);
                } catch (error: any) {
                  notifier.showError(error);
                }
              }}
              showTotalRow={table?.isShowTotals()}
              onShowTotalRowChange={(show: boolean) => {
                try {
                  table.setShowTotals(show);
                } catch (error: any) {
                  notifier.showError(error);
                }
              }}
              showButton={!table?.isHiddenButtons()}
              onShowButtonChange={(show: boolean) => {
                try {
                  table.setHiddenButtons(!show);
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
                commandKey={'convertTableToRange'}
                commandState={table}
              />
              <CommandButton
                variant={CommandButtonType.Menuitem}
                commandState={table}
                commandKey={'deleteTable'}
              />
            </Box>
          </Box>
        </Box>
      }
    </Paper>
  );
}));