import React, {
  useRef, memo, forwardRef, useMemo, useState
} from 'react';

import { ResizableBox } from 'react-resizable';

import { useTheme, Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Paper } from '@mui/material';

import { IWorkbook, IFont, ISheet, ICell, IRangeSelection, EditMode } from '@sheetxl/sdk';

import {
  useEditMode, useCallbackRef, useImperativeElement, SplitPane, DynamicIcon
} from '@sheetxl/utils-react';

import { TextStyle, ICellEditorElement } from '@sheetxl/grid-react';

import {
  SheetCellEditor, useModelListener,
  createCellEditStateFromCell as defaultCreateCellEditStateFromCell
} from '@sheetxl/react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import {
  NamedCollectionEditor, NamedCollectionEditorProps, INamedCollectionEditorElement
} from '../named';

import {
  FormulaBarProps, IFormulaBarElement, FormulaBarAttributes
} from './IFormulaBar';

const defaultRenderNamedCollectionEditor = (props: NamedCollectionEditorProps, ref: React.Ref<INamedCollectionEditorElement>): React.ReactElement<any> => {
  return <NamedCollectionEditor ref={ref} {...props}/>
}

const MAX_LINES_EXPANDED = 15;

/**
 * This tracks the selection of the sheet and
 * updates the a named range editor and a sheet cell editor.
 */
export const FormulaBar = memo(
  forwardRef<IFormulaBarElement, FormulaBarProps>((props, refForwarded) => {
  const {
    sx: propSx,
    workbook,
    sheetElement,
    gridStyle,
    showNamedCollectionEditor: propShowItemsEditor=true,
    propsNamedCollectionEditor,
    renderNamedCollectionEditor: propRenderNamedCollectionEditor = defaultRenderNamedCollectionEditor,

    disabled: propDisabled,
    commands: commandsParent,
    ...rest
  } = props;

  const [sheet, setSelectedSheet] = useState<ISheet>(workbook?.getSelectedSheet());
  const [activeCoords, setActiveCoords] = useState<ICell.Coords>(sheet.getSelectedCell().getCoords());
  const [cellDisabled, setCellDisabled] = useState<boolean>(false);

  const disabled = propDisabled || cellDisabled;

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange: (source: IWorkbook) => {
      const sheet = source?.getSelectedSheet();
      setActiveCoords(sheet.getSelectedCell().getCoords());
      setSelectedSheet(sheet);
    },
    onViewChange(source: IWorkbook): void {
      const sheet = source?.getSelectedSheet();
      setActiveCoords(sheet.getSelectedCell().getCoords());
      setSelectedSheet(sheet);
    }
  });

  const editorRef = useRef<ICellEditorElement>(null);

  const defaultTextStyle:TextStyle = useMemo(() => {
    return {
      fontSize: 11
    }
  }, []);

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(sheet.getSelection(), {
    onChange: () => {
      const selectedCell = sheet.getSelectedCell();
      setCellDisabled(!selectedCell.isEditAllowed());
      setActiveCoords(selectedCell.getCoords());
    },
  });

  useModelListener<ISheet, ISheet.IListeners>(sheet, {
    onProtectionChange(): void {
      // A bit of a hack to trigger a re-render
      setCellDisabled(!sheet.getSelectedCell().isEditAllowed());
    }
  });

  const editorLineHeight = editorRef.current?.getLineHeight() ?? 20;
  const [editorHeight, setEditorHeight] = useState<number>(editorLineHeight);

  const [stashedExpandedLines, setStashedExpandedLines] = useState<number>(5);
  const [linesVisible, setLinesVisible] = useState<number>(1);

  const onResizeStop = useCallbackRef((event, {size}) => {
    event.preventDefault();
    event.stopPropagation();
    const snappedLines = Math.floor(size.height / editorLineHeight);
    setEditorHeight(snappedLines * editorLineHeight + 1);
    if (snappedLines > 1) {
      setStashedExpandedLines(snappedLines);
    }
  }, [editorLineHeight]);

  const onResize = useCallbackRef((event, {size}) => {
    const snappedLines = Math.floor(size.height / editorLineHeight);
    setLinesVisible(snappedLines);
  }, [editorLineHeight]);

  const editModeHandler = useEditMode();

  const editMode = editModeHandler.getMode();
  let stateAndCoords = null;
  if (editMode?.key === 'edit') {
    stateAndCoords = editMode.args?.stateAndCoords;
  }

  const cellEditor = useMemo(() => {
    let editState = stateAndCoords?.editState;
    if (!editState) {
      editState = defaultCreateCellEditStateFromCell(() => {
        return sheet.getRange(activeCoords).getCell();
      });
    }

    return (
      <Box
        sx={{
          display: "flex",
          flex: '1 1 100%',
          flexDirection: "row",
          gap: 4
        }}
      >
        <SheetCellEditor
          ref={editorRef}
          activeCoords={activeCoords}
          sheet={sheet}
          onFocus={() => {
            sheetElement?.startEdit({
              autoFocus: false,
              editMode: true,
              cell: activeCoords,
            });
          }}
          defaultTextStyle={defaultTextStyle}
          useRichStyling={false}
          disabled={disabled}
          onChangeEdit={(editState) => {
            if (editState.dirty !== undefined) {
              const newStateAndCoords = {
                sheet,
                coords: activeCoords,
                editState
              };
              editModeHandler.setMode((prev: EditMode) => {
                // key:'edit'
                return {
                  ...prev,
                  args: {
                    ...prev?.args,
                    stateAndCoords: newStateAndCoords
                  }
                }
              });
            }
          }}
          editState={editState}
          commands={commandsParent}
          onCancelEdit={() => { sheetElement?.cancelEdit(); sheetElement?.focus(); }}
          onSubmitEdit={() => {
            sheetElement?.submitEdit();
            sheetElement?.focus();
          }}
          linesVisible={linesVisible}
        />
      </Box>
    );
  }, [sheet, stateAndCoords, activeCoords, linesVisible, sheetElement]);

  const refRangeEditor = useRef<INamedCollectionEditorElement>(null);
  const rangeEditor: React.ReactElement<any> = useMemo(() => {
    if (!propShowItemsEditor) return null;
    return propRenderNamedCollectionEditor({
      names: workbook.getNames(),
      // TODO - weird that we have both the named and the workbook.
      // workbook is only used to get the 'selectedRange' for new items.
      workbook,
      // disabled,  // we don't disabled the range editor, instead we disabled various commands
      ...propsNamedCollectionEditor
    }, refRangeEditor);
  }, [propRenderNamedCollectionEditor, propsNamedCollectionEditor, propShowItemsEditor, sheet, workbook, disabled]);

  const formulaButtonPanel = useMemo(() => {
    return (
      <Paper
        elevation={0}
        // tabIndex={0}
        sx={{
          display:'flex',
          alignItems: 'center',
          userSelect: 'none',
          flexGrow: 0,
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          border: (theme: Theme) => {
            return `solid ${(!disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled)} 1px`
          }
        }}
      >
        <ExhibitIconButton
          sx={{
            // padding: '0px',
            // margin: '0px 0px',
            border: 'none !important',
            '&.Mui-focusVisible': { // we still want the focus outline
              border: 'none',
            },
            "&:hover:not([disabled])": {
              border: `none`
            }
          }}
          dense={true}
          outlined={false}
          color="warning"
          aria-label="cancel-formula-edit"
          icon={<DynamicIcon iconKey="CloseError" />}
          propsTooltip={{
            label: 'Cancel',
            simple: true
          }}
          disabled={disabled || stateAndCoords === null}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
          onClick={() => { sheetElement.cancelEdit(); }}
        />
        <ExhibitIconButton
          sx={{
            // padding: '0px',
            // margin: '0px 0px',
            border: 'none !important',
            '&.Mui-focusVisible': { // we still want the focus outline
              border: 'none',
            },
            "&:hover:not([disabled])": {
              border: `none`
            }
          }}
          dense={true}
          outlined={false}
          color="primary"
          aria-label="commit-formula-edit"
          icon={<DynamicIcon iconKey="CheckSuccess" />}
          propsTooltip={{
            label: 'Enter',
            simple: true
          }}
          disabled={disabled || stateAndCoords === null}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
          onClick={() => { sheetElement.submitEdit(); }}
        />
        <ExhibitIconButton
          sx={{
            // padding: '0px',
            // margin: '0px 0px',
            border: 'none !important',
            '&.Mui-focusVisible': { // we still want the focus outline
              border: 'none',
            },
            "&:hover:not([disabled])": {
              border: `none`
            }
          }}
          dense={true}
          outlined={false}
          disabled={true} // TODO - implement
          aria-label="commit-formula-function"
          icon={<DynamicIcon iconKey="Function" style={{transform: 'scale(0.85)' }}/>}
          propsTooltip={{
            label: 'Insert Function',
            simple: true
          }}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
        />
      </Paper>
    )
  }, [disabled, stateAndCoords]);

  const appTheme = useTheme();

  const [isFormulaBarFocused, setIsFormulaBarFocused] = useState<boolean>(false);

  const formulaEditor = useMemo(() => {
    return (
      <Box
        className={"formula-bar"}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flex: '1 1 100%',
          gap: (theme: Theme) => { return theme.spacing(0.5) },
          alignItems: 'start'
        }}
      >
        {formulaButtonPanel}
        <Paper
          elevation={0} // formula bar
          sx={{
            display: "flex",
            flexDirection: "row",
            flex: "1 1 100%",
            position: 'relative',
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            fontSize: 11 * IFont.getDeviceScale(),
            // '& .editor-placement': {
            //   // top: '2px !important',
            // },
            //minHeight: "calc(100% - 2px)", // breaks height nesting directive
            alignItems: 'stretch',
            paddingTop: '2px',
            paddingBottom: '2px',
            // minHeight: "1.2em",
            boxShadow: "none",
            borderRadius : (theme: Theme) => {
              return `${theme.shape.borderRadius}px`
            },
            backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
            border: (theme: Theme) => {
              return `solid ${(!disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled)} 1px`
            },
            '& textarea': {
              color: (theme: Theme) => {
                if (disabled)
                  return `${theme.palette.text.disabled} !important`
                return theme.palette.text.primary;
              },
            },
            '& .react-resizable-handle': {
              width: '100%',
              height: '8px',
              backgroundColor: 'transparent', // red
              boxSizing: 'content-box',
              zIndex: 1000,
            },
            '& .react-resizable-handle-s': {
              position: 'absolute',
              bottom: '-10px',
              cursor: 's-resize'
            }
          }}
          onFocus={() => setIsFormulaBarFocused(true)}
          onBlur={() => setIsFormulaBarFocused(false)}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
            // We are starting to drag then stop editing
            if ((e.target as Element)?.classList.contains('react-resizable-handle'))
            e.preventDefault();
          }}
        >
          <Box
            className="formula-editor"
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flex: '1 1 100%',
              position: 'relative',
              alignItems: 'center',
              marginTop: '0px', // to offset bottom border
              paddingLeft: (theme: Theme) => { return theme.spacing(1) },
              paddingRight: (theme: Theme) => { return theme.spacing(1) },
            }}
          >
          {/* @ts-ignore */}
          <ResizableBox
            height={editorHeight}
            draggableOpts={{grid: [editorLineHeight, editorLineHeight]}}
            minConstraints={[editorLineHeight, editorLineHeight]}
            maxConstraints={[editorLineHeight * MAX_LINES_EXPANDED, editorLineHeight * MAX_LINES_EXPANDED]}
            onResize={onResize}
            onResizeStop={onResizeStop}
            resizeHandles={['s']}
            axis="y"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 100%',
              overflow: 'hidden'
            }}
          >
            {cellEditor}
          </ResizableBox>
          </Box>
          <ExhibitIconButton
            sx={{
              padding: '0px',
              margin: '0px 0px',
              border: 'none !important',
              '&.Mui-focusVisible': { // we still want the focus outline
                border: 'none',
              },
              "&:hover:not([disabled])": {
                border: `none`
              }
            }}
            dense={true}
            outlined={false}
            aria-label="toggle-expand-formula-edit"
            icon={<DynamicIcon iconKey={linesVisible > 1 ? "ExpandLess" : "ExpandMore"} />}
            propsTooltip={{
              label: `${linesVisible > 1 ? 'Collapse' : 'Expand'} Formula Bar`,
              simple: true
            }}
            // disabled={disabled || editStateAndCoords === null}
            onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
            onClick={() => {
              const newLinesVisible = (linesVisible > 1 ? 1 : stashedExpandedLines);
              setEditorHeight(newLinesVisible * editorLineHeight + 1);
              setLinesVisible(newLinesVisible);
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: '100%',
              height: '2px',
              bottom: '0',
              willChange: 'opacity',
              transition: 'opacity 60ms ease-in',
              opacity: isFormulaBarFocused ? 1 : 0,
              borderBottomWidth: '2px',
              borderBottomStyle: 'solid',
              borderBottomColor: (theme: Theme) => {
                return theme.palette.primary.main;
              },
              borderRadius : (theme: Theme) => {
                return `${theme.shape.borderRadius}px`
              },
            }}
          />
        </Paper>
      </Box>
    );
  }, [formulaButtonPanel, cellEditor, isFormulaBarFocused, linesVisible, editorLineHeight]);

  const mainPanel = useMemo(() => {
    if (!rangeEditor && !formulaEditor) return null;
    if (!rangeEditor && formulaEditor) return formulaEditor;
    if (rangeEditor && !formulaEditor) return rangeEditor;
    return (
      <>
      <SplitPane
        fixedPane="before"
        minBefore="165px" // fit the default size
        minAfter="200px"
        propsPaneBefore={{
          style: {
            alignItems: 'flex-start'
          }
        }}
        propsPaneAfter={{
          style: {
            overflow: 'visible', // to allow the resizer under the formula editor to overflow
          }
        }}
        propsResizer={{
          style: {
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='13' viewBox='0 0 6 13' version='1.1' fill='${(appTheme.palette.text as any).icon ?? appTheme.palette.action.active}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='m 4.5961932,11.36243 c 0,0.88365 -0.71627,1.59991 -1.59991,1.59991 -0.88365,0 -1.60005,-0.71626 -1.60005,-1.59991 0,-0.88365 0.7164,-1.6000508 1.60005,-1.6000508 0.88364,0 1.59991,0.7164008 1.59991,1.6000508 m 0,-4.881294 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 -0.88365,0 -1.60005,-0.7164 -1.60005,-1.60004 0,-0.88365 0.7164,-1.60005 1.60005,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-4.881226 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 -0.88365,0 -1.60005,-0.7164 -1.60005,-1.60005 0,-0.88365 0.7164,-1.59991 1.60005,-1.59991 0.88364,0 1.59991,0.71626 1.59991,1.59991' /%3E%3C/svg%3E%0A")`,
            backgroundRepeat: 'no-repeat',
            // A bit convoluted. This is the height of the icon - the viewBox height + padding
            backgroundPosition: `center calc(((var(--icon-size, 24) - 13px + 5px) / 2))`,
            minWidth: '18px',//var(--icon-size, 20px)'
            marginRight: '1px'
          }
        }}
        elementBefore={rangeEditor}
        elementAfter={formulaEditor}
      />
      </>
    )
  }, [rangeEditor, formulaEditor]);

  const refLocal = useImperativeElement<IFormulaBarElement, FormulaBarAttributes>(refForwarded, () => ({
    isFormulaBarElement: () => true,
    getNamedCollectionEditorElement: () => refRangeEditor.current
  }), []);

  return (
    <Box
      sx={{
        display:"flex",
        flexDirection: "row",
        gap: (theme: Theme) => { return theme.spacing(0.5) },
        ...propSx
      }}
      ref={refLocal}
      {...rest}
    >
      {mainPanel}
    </Box>
    );
  })
);

FormulaBar.displayName = "FormulaBar";