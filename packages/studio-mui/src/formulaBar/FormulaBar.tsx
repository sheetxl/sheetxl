import type React from 'react';
import {
  useRef, memo, forwardRef, useMemo, useState
} from 'react';

import { clsx } from 'clsx';
import { useTheme, type Theme } from '@mui/material';
import { Paper, Box } from '@mui/material';

import { IFont, ICalculation } from '@sheetxl/sdk';

import {
  useCommands, CommandScopeProvider, useCallbackRef, useImperativeElement,
  SplitPane, DynamicIcon, ResizableBox, RenderSlot, useTranslator
} from '@sheetxl/utils-react';

import { useModelListener } from '@sheetxl/react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import {
  NamedCollectionEditor, type NamedCollectionEditorProps, type INamedCollectionEditorElement
} from '../named';

import {
  type FormulaBarProps, type IFormulaBarElement, type FormulaBarAttributes
} from './IFormulaBar';
import { useFormulaBarSession } from './useFormulaBarSession';

import styles from './FormulaBar.module.css';

const defaultRenderNamedCollectionEditor = (props: NamedCollectionEditorProps): React.ReactElement => {
  return <NamedCollectionEditor {...props}/>
}

const MAX_LINES_EXPANDED = 15;

/**
 * The field border — `--sxl-color-input-border`, the token every field-shaped control reads so the formula
 * bar, the name box, and the field widgets stay the same control. Read at FULL strength: these sites used to
 * render `alpha(theme.palette.divider, 0.2)`, which only reads as a border because MUI's own divider is
 * already translucent (the multiply makes it *stronger*) — a host supplying an opaque one got a border 5x too
 * weak and it vanished. Disabled is the one case that still needs MUI, since no token names a disabled border.
 */
const FIELD_BORDER_COLOR = 'var(--sxl-color-input-border, light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2)))';

/**
 * This tracks the selection of the sheet and
 * updates the a named range editor and a sheet cell editor.
 */
export const FormulaBar = memo(
  forwardRef<IFormulaBarElement, FormulaBarProps>((props, refForwarded) => {
  const {
    className: propClassName,
    style: propStyle,
    workbook: propWorkbook,
    editable: propEditable,
    showNamedCollectionEditor: propShowItemsEditor=true,
    propsNamedCollectionEditor,
    renderNamedCollectionEditor: propRenderNamedCollectionEditor = defaultRenderNamedCollectionEditor,

    disabled: propDisabled,
    showCalculateNow: propShowCalculateNow = true,
    placement = 'top',
    // Only the phone bar (`MobileFormulaBar`) rides the keyboard.
    floatOnKeyboard: _floatOnKeyboard,
    ...rest
  } = props;

  // `workbook` is always injected by the studio renderer — the bar is non-functional without it — so
  // although the public prop is optional, treat it as required (runtime-guaranteed by the caller).
  const workbook = propWorkbook!;

  const editorLineHeight = 20;
  const {
    sheet, disabled, isEditing, cancel: onCancelEdit, commit: onCommitEdit, editorSpec, cellEditor
  } = useFormulaBarSession({ workbook, editable: propEditable, disabled: propDisabled, lineHeight: editorLineHeight });

  const resolvedCommands = useCommands(['insertFunctionDialog', 'calculateAll']);
  const insertFunctionCommand = resolvedCommands[0];
  const calculateCommand = resolvedCommands[1];

  // Calculate Now shows only in manual calculation mode; the mode is a calculation setting
  // (`onOptionsChange`), not a view or transaction event.
  const calculation = workbook.getCalculation();
  const [isManualCalc, setIsManualCalc] = useState<boolean>(() => calculation.getCalculationMode() === ICalculation.CalculationMode.Manual);
  useModelListener<ICalculation, ICalculation.IListeners>(calculation, {
    onOptionsChange: (source: ICalculation) => {
      setIsManualCalc(source.getCalculationMode() === ICalculation.CalculationMode.Manual);
    }
  });
  const showCalculateNow = propShowCalculateNow && isManualCalc;
  // Chrome tooltips resolve through t(); the hook subscribes, and `t`'s identity is the memo dep.
  const t = useTranslator();

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

  const refRangeEditor = useRef<INamedCollectionEditorElement>(null);

  const rangeEditor: React.ReactElement<any> | null = useMemo(() => {
    if (!propShowItemsEditor) return null;
    return <RenderSlot render={propRenderNamedCollectionEditor} props={{
      ref: refRangeEditor,
      names: workbook.getNames(),
      // TODO - weird that we have both the named and the workbook.
      // workbook is only used to get the 'selectedRange' for new items.
      workbook,
      // disabled,  // we don't disabled the range editor, instead we disabled various commands
      ...propsNamedCollectionEditor
    }} />;
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
          backgroundColor: 'var(--sxl-color-input, var(--sxl-color-base-100))',
          border: (theme: Theme) => {
            return `solid ${(!disabled ? FIELD_BORDER_COLOR : theme.palette.action.disabled)} 1px`
          }
        }}
      >
        {showCalculateNow ? (
          // Calculate Now (F9), only while the workbook is in MANUAL calculation mode — the one
          // state where a user has to ask for a recalculation. First, ahead of ✕ ✓ fx, which belong
          // to the formula text. Not gated on `disabled`: cell protection and a read-only workbook
          // do not stop a recalculation, as in Excel. (Michael, 2026-08-26.)
          <ExhibitIconButton
            sx={{
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
            disabled={!calculateCommand || calculateCommand.disabled()}
            aria-label="calculate-now"
            icon={<DynamicIcon iconKey="Calculate" />}
            propsTooltip={{
              label: calculateCommand?.getLabel() ?? t('statusBar.calculate'),
              simple: true
            }}
            onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
              if (e.button !== 0) return;
              calculateCommand?.execute();
              e.preventDefault();
            }}
          />
        ) : null}
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
            label: t('formulaBar.cancel'),
            simple: true
          }}
          disabled={disabled || !isEditing}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
          onClick={onCancelEdit}
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
            label: t('formulaBar.enter'),
            simple: true
          }}
          disabled={disabled || !isEditing}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
          onClick={onCommitEdit}
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
          disabled={!insertFunctionCommand || insertFunctionCommand.disabled()}
          aria-label="commit-formula-function"
          icon={<DynamicIcon iconKey="Function" style={{transform: 'scale(0.85)' }}/>}
          propsTooltip={{
            label: insertFunctionCommand?.getLabel() ?? t('formulaBar.insertFunction'),
            simple: true
          }}
          onMouseDown={(e: React.MouseEvent<HTMLElement>) => {
            if (e.button !== 0) return;
            insertFunctionCommand?.execute();
            e.preventDefault();
          }}
        />
      </Paper>
    )
  // `t` — tooltip labels above are baked via t(); its identity changes on a language switch.
  }, [disabled, isEditing, insertFunctionCommand, onCancelEdit, onCommitEdit, t, showCalculateNow, calculateCommand]);

  const appTheme = useTheme();

  const [isFormulaBarFocused, setIsFormulaBarFocused] = useState<boolean>(false);

  const formulaEditor = useMemo(() => {
    return (
      <Box
        className={"formula-bar " + styles['formula-bar']}
        sx={{
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
            paddingRight: '2px',
            // minHeight: "1.2em",
            boxShadow: "none",
            borderRadius : (theme: Theme) => {
              return `${theme.shape.borderRadius}px`
            },
            backgroundColor: 'var(--sxl-color-input, var(--sxl-color-base-100))',
            border: (theme: Theme) => {
              return `solid ${(!disabled ? FIELD_BORDER_COLOR : theme.palette.action.disabled)} 1px`
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
            },
            '& .react-resizable-handle-n': {
              position: 'absolute',
              top: '-10px',
              cursor: 'n-resize'
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
            // A bar below the grid grows upward, so its grip sits on its top edge.
            resizeHandles={[placement === 'bottom' ? 'n' : 's']}
            axis="y"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 100%',
              overflow: 'hidden'
            }}
          >
            {cellEditor ?? undefined}
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
              label: linesVisible > 1
              ? t('formulaBar.collapse')
              : t('formulaBar.expand'),
              simple: true
            }}
            // disabled={disabled || editState === null}
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
  }, [formulaButtonPanel, cellEditor, isFormulaBarFocused, linesVisible, editorLineHeight, t, placement]);

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
        elementBefore={rangeEditor ?? undefined}
        elementAfter={formulaEditor}
      />
      </>
    )
  }, [rangeEditor, formulaEditor]);

  const refEditable = useRef(propEditable);
  refEditable.current = propEditable;
  const refLocal = useImperativeElement<IFormulaBarElement, FormulaBarAttributes>(refForwarded, () => ({
    isFormulaBarElement: () => true,
    getNamedCollectionEditorElement: () => refRangeEditor.current,
    getEditable: () => refEditable.current ?? null,
    isFocusWithin: (): boolean => !!refLocal.current?.contains(document.activeElement)
  }), []);

  // why wrap in yet another div?
  return (
    // The `formula:editor` leaf, declaratively (same as the inline editor's `layer:editor`): create-child +
    // session-gated `contributeEditorCommands` + dispose, and `elementRef region` names the bar's element —
    // bounding this scope's commands to it AND recording it in the tree's region index, so the studio focus
    // tracker anchors here on focus (F4 / `toggleEditorFocus` resolve at this leaf). "The element only names
    // the leaf" — no `appTracker`, no per-region tracker. `null` spec (no editable) ⇒ pass-through.
    <CommandScopeProvider spec={editorSpec} elementRef={refLocal} region>
      <div
        {...rest}
        ref={refLocal}
        className={clsx(propClassName)}
        style={{
          display:"flex",
          flexDirection: "row",
          gap: '4px', //(theme: Theme) => { return theme.spacing(0.5) },
          ...propStyle
        }}
      >
        {mainPanel}
      </div>
    </CommandScopeProvider>
    );
  })
);

FormulaBar.displayName = "FormulaBar";