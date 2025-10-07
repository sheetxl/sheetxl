import React, {
  memo, forwardRef, useState, useEffect, useCallback, useRef
} from 'react';

import { mergeRefs } from 'react-merge-refs';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { TooltipProps } from '@mui/material';
import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import {
  IRange, ICellRanges, INamedCollection, INamed, ISheet,
  IWorkbook, IRangeSelection, IFont, CommonUtils, CoordUtils
} from '@sheetxl/sdk';

import {
  useCallbackRef, useImperativeElement, KeyCodes,
  useNotifier, IReactNotifier, NotifierType, CommandButtonType
} from '@sheetxl/utils-react';

import {
  CommandButton, useFloatStack, defaultCreatePopupPanel, ExhibitDivider, ExhibitTooltip,
  ExhibitPopupIconButton, ExhibitQuickButtonProps, ExhibitPopupPanelProps,
  SimpleCommandPopupButton, ExhibitMenuHeader
} from '@sheetxl/utils-mui';

import { useModelListener } from '@sheetxl/react';

import {
  NamedCollectionEditorProps, INamedCollectionEditorElement
} from './INamedCollectionEditor';

/**
 * Editor used for selecting, editing, or removing named ranges.
 */
const NamedCollectionEditor =
   memo(forwardRef<INamedCollectionEditorElement, NamedCollectionEditorProps>((props, refForwarded) => {
  const {
    disabled,
    names,
    workbook,
    // sheet,
    restoreFocus,
    readonly = false,
    // icon,
    disabled: propDisabled = false,
    commandPopupButtonProps,
    sx: propSx,
    ...rest
  } = props;

  const notifier: IReactNotifier = useNotifier();
  const [displayRange, setDisplayRange] = useState<any>(null); // { text: string, fontStyle?: string}
  const [activeRanges, setActiveRanges] = useState<readonly IRange.Coords[]>(() => workbook.getSelectedRanges().getCoords());
  // const [activeAnchor, setActiveAnchor] = useState<WorkbookCellCoords>({
  //   sheetName: sheet.getName(),
  //   ...sheet.getView().selection.cell
  // });

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { reference: floatReference } = useFloatStack({
    parentFloat: commandPopupButtonProps?.parentFloat
  });

  const [isReadOnlyOrProtected, setIsReadOnlyOrProtected] = useState(() => {
    return readonly || !workbook.getProtection().isStructureAllowed();
  });

  const committedRangeText = () => {
    return displayRange?.text ?? '';
  }

  const [rangeText, setRangeText] = useState<string>(committedRangeText);

  /** returns a string that can be resolve to a range */
  const commitRangeText = useCallbackRef((): IRange.FixableCoords | string => {
    floatReference?.closeAll();
    if (!rangeText) { // revert back to original value (blank is an example)
      const asText = committedRangeText();
      setRangeText(committedRangeText());
      return asText;
    }
    // If the same don't commit
    if (committedRangeText() === rangeText)
      return rangeText;

    const asLowerCase = rangeText.trim().toLowerCase();
    if (asLowerCase === 'r' || asLowerCase === 'c') {
      return rangeText;
    }

    // If valid address the just select.
    try {
      const asRanges:ICellRanges = workbook.getRanges(rangeText);
      if (asRanges) {
        return asRanges.toString();
      }
    } catch (error: any) {}

    const asItem:INamed = names.getByName(rangeText);
    // TODO - if the wrong type error
    if (asItem && asItem.getRanges()) {
      return rangeText;
    }

    let asRanges:ICellRanges = null;
    try {
      const ranges:ICellRanges = workbook.getRanges(rangeText);
      const coords:readonly IRange.FixableCoords[] = ranges.getCoords();
      const fixedCoords = coords.map((range) => {
        return {
          $colEnd: true,
          $rowEnd: true,
          $colStart: true,
          $rowStart: true,
          ...range
        };
      });
      asRanges = workbook.getRanges(fixedCoords);
    } catch (error: any) {

    }
    if (!asRanges) {
      const ranges = workbook.getSelectedRanges();
      const coords:readonly IRange.FixableCoords[] = ranges.getCoords();
      const fixedCoords = coords.map((range) => {
        return {
          $colEnd: true,
          $rowEnd: true,
          $colStart: true,
          $rowStart: true,
          ...range
        };
      });
      asRanges = workbook.getRanges(fixedCoords);
    }

    try {
      /* We do this because the rangeName may have changed. */
      let item = names.getByName(rangeText);
      if (!isReadOnlyOrProtected && !item) {
        item = names.addReference(rangeText, asRanges);
      }
      if (item) {
        setDisplayRange({
          text: item.getName()
        });
      }
    } catch (error: any) {
      // revert
      setRangeText(committedRangeText());
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
    return null;
  }, [rangeText, names, floatReference, isReadOnlyOrProtected, notifier]);

  const updateRangeDisplay = useCallbackRef(() => {
    if (workbook.isClosed()) return;
    const rangeCoords:IRange.FixableCoords[] = [];
    for (let i=0;i<activeRanges.length;i++) {
      const range = activeRanges[i];
      rangeCoords.push({
        $colEnd: true,
        $rowEnd: true,
        $colStart: true,
        $rowStart: true,
        ...range
      });
    }

    /* We use entire range to find match but excel only uses the first range */
    let found = null;
    try {
      // found = names.getItems({
      //   address: rangeCoords
      // });
      found = names.lookupByRanges(rangeCoords);
    } catch (error: any) { }
    let text = null;
    if (found?.length > 0) {
      text = found[0].getName()
    } else {
      text = workbook.getSelectedSheet().getSelectedRange().toString();
    }
    setDisplayRange({ text });
  }, [workbook, activeRanges]);


  const [all, setAll] = useState(() => names?.getItems() ?? null);

  useModelListener<INamedCollection, INamedCollection.IListeners>(names, {
    onCollectionChange(_source: INamedCollection): void {
      setAll(names.getItems());
      updateRangeDisplay(); // no debounce
    },
    onClose(_source: INamedCollection): void {
      setAll([]);
    }
  });

  useEffect(() => {
    setRangeText(committedRangeText());
  }, [displayRange, activeRanges]);

  const [sheet, setSelectedSheet] = useState<ISheet>(workbook?.getSelectedSheet());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onProtectionChange: (source: IWorkbook) => {
      setIsReadOnlyOrProtected(readonly || !source.getProtection().isStructureAllowed());
    },
    onSheetsChange: (source: IWorkbook) => {
      setSelectedSheet(source?.getSelectedSheet());
    },
    onViewChange(source: IWorkbook): void {
      setSelectedSheet(source?.getSelectedSheet());
    }
  });

  const [draggingSelection, setDraggingSelection] = useState<IRangeSelection.Coords | null>(null);

  const updateRangeDisplayDebounced = useCallbackRef(CommonUtils.debounce(updateRangeDisplay, draggingSelection ? 320 : 0), []);

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(sheet.getSelection(), {
    onChange: () => {
      setActiveRanges((prev) => {
        const activeRanges = workbook.getSelectedRanges();
        const asRanges = activeRanges.getCoords();
        if (CoordUtils.isEqualRangesArrays(asRanges, prev)) {
          return prev;
        }
        return asRanges;
      });
    },
    onAdjustingChange: (source: IRangeSelection) => {
      setDraggingSelection(source.getAdjusting());
    }
  });

  useEffect(() => {
    if (draggingSelection) {
      const dragging = workbook.getSelectedRange();
      const rowCount = dragging.getRowCount();
      const colCount = dragging.getColumnCount();
      let text = `${rowCount}R x ${colCount}C`;
      // if a big number make the divider smaller.
      if (text.length > 17) { // 7 + 5 + 5
        text = `${rowCount}x${colCount}`;
      }
      if (rowCount > 1 || colCount > 1) {
        setDisplayRange({
          text,
          fontStyle: "italic",
          justifyContent: "center"
        });
        return;
      }
    }

    setDisplayRange({
      // We want to display the ranges scoped to the current sheet.
      text: workbook.getSelectedSheet().getSelectedRange().toString()
    });
    updateRangeDisplayDebounced();
  }, [activeRanges, workbook, draggingSelection]);

  const refInput = useRef(null)

  const createInputQuickButton = useCallback((props: ExhibitQuickButtonProps) => {
    const {
      onMouseDown,
      onMouseUp,
      ...rest
    } = props;
    // TODO - allow for this to not have to be wrapped in an icon button. (we look borders at the moment)
    return (
      <IconButton
        {...rest}
        sx={{
          ...rest?.sx,
          display: 'flex',
          flex: '1 1 100%'
        }}
        disableRipple={true}
      >
        <Input
          inputMode={'text'}
          // disabled={propDisabled || !command || command.disabled()}
          inputProps={{
            tabIndex: 0,
            name: "input-named-range",
            maxLength: 255,
            className: 'input',
            autoFocus: false, // not 'sticking use autoFocusSel instead'
            spellCheck: false,
            // placeholder: 'Type to search key bindings',
            autoComplete: "off",
            ref: refInput
          }}
          sx={{
            "&::before": { // default
              borderBottom: "1px solid transparent"
            },
            "&:hover:not(.Mui-disabled):not(.Mui-focused):not(.Mui-error):before": { // hover
              borderBottom: (theme: Theme) => `1px solid ${(theme.palette.text as any).icon ?? theme.palette.action.active}`
            },
            "&:hover:not(.Mui-disabled):not(.Mui-error):before": { // focus and hover
              borderBottom: (theme: Theme) => `1px solid ${theme.palette.primary.main}`
            },
            "::after": { // focus
              borderBottom: (theme: Theme) => `1px solid ${theme.palette.primary.main}`
            },
            paddingTop: '0px',
            paddingBottom: '0px',
            height: '1rem',
            // fontSize: (theme: Theme) => {
            //   return `${Math.round(theme.typography.fontSize)}px`;
            // },
            fontSize: 11 * IFont.getDeviceScale(),
            fontStyle: displayRange?.fontStyle,
            paddingLeft: (theme: Theme) => { return theme.spacing(0.75) },
            paddingRight: (theme: Theme) => { return theme.spacing(0.75) },
            boxShadow: "none",
            flex: '1',
            // width: defaultWidth,
            color: (theme: Theme) => theme.palette.text.secondary,
            'input': {
              padding: '0',
              height: '1rem',
              textAlign: 'left',
              "&:hover:not(.Mui-disabled):not(.Mui-error)": { // hover
                color: (theme: Theme) => theme.palette.text.primary,
              },
              "&:focus:not(.Mui-disabled):not(.Mui-error)": { // focused
                color: (theme: Theme) => theme.palette.text.primary,
              }
            },
            // 'input::-webkit-inner-spin-button': {
            //   'WebkitAppearance': 'none',
            //   margin: '0'
            // }
          }}
          value={rangeText}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
            // setTimeout(() => {
            e.target?.select();
            // }, 0);
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if ((e.which === KeyCodes.Enter || e.which === KeyCodes.Tab)) {
              let doGoto:IRange.FixableCoords | string = rangeText;
              if (committedRangeText() !== rangeText) {
                e.stopPropagation();
                e.preventDefault();
                doGoto = commitRangeText();
              }
              if (doGoto) {
                onGoto(doGoto);
              } else {
                restoreFocus?.();
              }
            } else if ((e.which === KeyCodes.Escape)) {
              if (committedRangeText() !== rangeText) {
                setRangeText(committedRangeText());
                setTimeout(() => {
                  (e.target as any)?.select();
                }, 0);
                e.stopPropagation();
                e.preventDefault();
              } else {
                // hardcode return since we don't have a floatParent to rely on at the moment.
                restoreFocus?.();
              }
            // } else if (e.key.match('[-]')) { // disallow whitespace and other special characters
            //   e.stopPropagation();
            //   e.preventDefault();
            //   return;
            // }
            } else if ((e.which === KeyCodes.Space)) {
              e.stopPropagation();
              // e.preventDefault();
              return;
            }
          }}
          onBlur={() => {
            // revert on blur
            setRangeText(committedRangeText());
          }}
          onChange={(e) => {
            // if (e.target.value.length > 255) {
            //   e.stopPropagation();
            //   e.preventDefault();
            //   return;
            // }
            setRangeText(e.target.value);
          }}
        />
      </IconButton>
      );
  }, [rangeText, displayRange]);

  const onGoto = useCallbackRef(async (address: ICellRanges.Address) => {
    // TODO - when pressing enter from textfield we need to also close the popup
    try {
      floatReference?.closeAll();
      // await names.getItems({ address })?.[0]?.select();
      const found = names.lookupByRanges(address)?.[0];
      if (found) {
        await found?.select();
      }
      await workbook.getRanges(address)?.select();

    } catch (error: any) {
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [names, notifier, workbook]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    setTimeout(() => {
      setIsPopupOpen(true); // HACK - the onPopupOpen is not being called with a delay. We need an immediate
    }, 0);
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      parentFloat: props.floatReference,
      commandHook: {
        ...commandPopupButtonProps?.commandHook,
        beforeExecute(command: any, args: any): Promise<boolean | void> | boolean | void {
          floatReference?.closeAll();
          return commandPopupButtonProps?.commandHook?.beforeExecute?.(command, args);
        }
      },
      scope: commandPopupButtonProps?.scope,
      commands: commandPopupButtonProps?.commands,
      // disabled: propDisabled
    }

    let items:INamed[] = names.getItems({
      scope: workbook?.getSelectedSheet().getName()
    });

    // we want ranges to sort first.
    items = items.sort((a: INamed, b: INamed) => {
      if (a.getType() === b.getType()) {
        return a.getName().localeCompare(b.getName());
      }
      if (a.getType()  === 'range')
        return -1;
      return 1;
      // if (retValue !== 0) return retValue;
    });

    const popupCommandKeysReference = isReadOnlyOrProtected ? null : [
      'editNamedReference',
      'deleteNamedReference',
    ];
    const popupCommandKeysTable = isReadOnlyOrProtected ? null : [
      'editTable',
      null,
      'convertTableToRange',
      'deleteTable',
    ]
    const menus = [];
    const itemsLength = items.length;
    for (let i=0; i<itemsLength; i++) {
      const item:INamed = items[i];
      const ranges = item.getRanges();
      if (!ranges || item.isHidden()) continue; // we filter out hidden and missing ranges
      const type = item.getType();
      // TODO - The selection doesn't render.
      // const selected = item.name === displayRange?.text;
      if (type !== items[i-1]?.getType()) { // Add a label. if (i === 0) || (type is different)
        if (i > 0) {
          menus.push(
            <ExhibitDivider
              orientation="horizontal"
              key={`type-divider-${menus.length}`}
            />
          );
        }
        menus.push(
          <ExhibitMenuHeader
            key={`type-header-${menus.length}`}
            variant='subtitle2'
            sx={{
              paddingLeft: '16px'
            }}
          >
            {item.getType() === 'reference' ? 'Ranges' : 'Tables'}
          </ExhibitMenuHeader>
        );
      }
      if (type === 'reference') {
        menus.push(
          <SimpleCommandPopupButton
            {...commandButtonProps}
            key={'named-' + menus.length}
            popupCommandKeys={popupCommandKeysReference}
            popupScope="namedItem"
            scope="namedItem"
            commandState={item}
            commands={commandPopupButtonProps?.commands}
            label={item.getName()}
            quickCommand={'selectNamed'}
            disabled={!item.getRanges() || propDisabled}
            icon="NamedRange"
          />
        );
      } else if (type === 'table') {
        menus.push(
          <SimpleCommandPopupButton
            {...commandButtonProps}
            key={'namedItem-' + menus.length}
            popupCommandKeys={popupCommandKeysTable}
            popupScope="namedItem"
            scope="namedItem"
            commands={commandPopupButtonProps?.commands}
            commandState={item}
            label={item.getName()}
            quickCommand={'selectNamed'}
            disabled={!ranges || propDisabled}
            icon={"InsertTable"}
          />
        );
      }
    }

    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
        {...rest}
      >
        { !isReadOnlyOrProtected ? (
          <CommandButton
            {...commandButtonProps}
            scope='namedItem'
            command={commandPopupButtonProps?.commands.getCommand('addNamedReference')}
          />
        ) : null}
        {(menus && menus.length > 0) ? (<>
        { !isReadOnlyOrProtected ? <ExhibitDivider orientation="horizontal"/> : null}
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {menus}
        </Box>
        </>) : null}
      </Box>
    );
    return defaultCreatePopupPanel({...props, children});
  }, [workbook, all, names, displayRange, isReadOnlyOrProtected]);

  const refLocal = useImperativeElement<INamedCollectionEditorElement, unknown>(refForwarded, () => ({
    focus(options?: FocusOptions): void {
      refInput.current?.focus(options);
    }
  }), []);

  return (
    <Box
      className="outer"
      sx={{
        minWidth: 120,
        flex: '1 1 100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'start', // displayRange?.justifyContent ??
        ...propSx
      }}
      ref={mergeRefs([refLocal, refForwarded]) as any}
      {...rest}
    >
      <ExhibitPopupIconButton
        className="outer-button"
        sx={{
          display : 'flex',
          flex: '1 1 100%',
          '& .tooltip-wrapper': {
            display: 'flex',
            flex: '1 1 100%',
            width: '100%',
            // height: '100%',
            // height: '27px', // TODO - make this a function of the font similar to formulaEditor
          },
          ...propSx
        }}
        buttonProps={{
          sx: {
            // background: 'pink',
            backgroundColor: (theme: Theme) => theme.palette.background.paper,
            backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
          }
        }}
        tabIndex={-1}
        outlined={{
          color: (theme: Theme) => {
            // match formula bar color
            return !disabled ? alpha(theme.palette.divider, 0.2) : theme.palette.action.disabled;
          }
        }}
        // disabled={propDisabled}
        parentFloat={floatReference}
        createPopupPanel={createPopupPanel}
        onPopupOpen={() => setIsPopupOpen(true) }
        onPopupClose={() => setIsPopupOpen(false) }
        createTooltip={({children}: TooltipProps, disabled: boolean) => {
          return (
            <ExhibitTooltip
              title={disabled || isPopupOpen ? '' : 'Name Box'}
              disabled={disabled}
              leaveDelay={0}//disabled ? 0 : undefined}
              sx={{opacity: disabled || isPopupOpen? 0 : 1}}
            >
              {children}
            </ExhibitTooltip>
          );
        }}
        createQuickButton={createInputQuickButton}
      />
    </Box>
  );
}));

NamedCollectionEditor.displayName = "NamedCollectionEditor";
export { NamedCollectionEditor };