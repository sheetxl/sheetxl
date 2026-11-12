import type React from 'react';
import {
  memo, forwardRef, useState, useEffect, useCallback, useRef
} from 'react';

import { clsx } from 'clsx';
import { useMergeRefs } from 'react-merge-refs';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { IconButton } from '@mui/material'
import { Input } from '@mui/material';

import { TimerUtils } from '@sheetxl/utils';

import {
  IFont, type IRange, type ICellRanges, type INamedCollection, type INamed,
  type IWorkbook, type IRangeSelection
} from '@sheetxl/sdk';

import {
  useCallbackRef, useImperativeElement, KeyCodes, useFloatStack, useTextSelectionDrag,
  useNotifier, NotifierType, CommandButtonType, useTranslator, type IReactNotifier
} from '@sheetxl/utils-react';

import {
  CommandGroup, ExhibitMenuHeader, CommandButton, defaultRenderPopupPanel,
  ExhibitDivider, ExhibitTooltip, ExhibitPopupIconButton,
  type ExhibitQuickButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { useModelListener } from '@sheetxl/react';

/**
 * The field border — `--sxl-color-input-border`, the same token the formula bar reads, so the name box and the
 * formula field it sits beside stay the same control. Disabled falls back to MUI: no token names that.
 */
const FIELD_BORDER_COLOR = 'var(--sxl-color-input-border, light-dark(rgba(0, 0, 0, 0.2), rgba(255, 255, 255, 0.2)))';

import {
  type NamedCollectionEditorProps, type INamedCollectionEditorElement
} from './INamedCollectionEditor';

/**
 * Editor used for selecting, editing, or removing named ranges.
 */
export const NamedCollectionEditor = memo(forwardRef<INamedCollectionEditorElement, NamedCollectionEditorProps>(
  (props: NamedCollectionEditorProps, refForwarded) => {
  const {
    className: propClassName,
    style: propStyle,
    disabled,
    names,
    workbook,
    // sheet,
    restoreFocus,
    readonly = false,
    // icon,
    disabled: propDisabled,
    propsCommandPopupButton,
    ...rest
  } = props;

  const notifier: IReactNotifier = useNotifier();
  const t = useTranslator();

  const [displayRange, setDisplayRange] = useState<any>(null); // { text: string, fontStyle?: string}
  const [draggingSelection, setDraggingSelection] = useState<IRangeSelection | null>(null);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { reference: floatReference } = useFloatStack({
    parentFloat: propsCommandPopupButton?.parentFloat
  });

  const [isReadOnlyOrProtected, setIsReadOnlyOrProtected] = useState(() => {
    return readonly || !workbook.getProtection().isStructureAllowed();
  });

  const committedRangeText = () => {
    return displayRange?.text ?? '';
  }

  const [rangeText, setRangeText] = useState<string>(committedRangeText);

  /** returns a string that can be resolve to a range */
  const commitRangeText = useCallbackRef((): IRange.FixableCoords | string | null => {
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

    const asItem:INamed | null = names.getByName(rangeText);
    // TODO - if the wrong type error
    if (asItem && asItem.getRanges?.()) {
      return rangeText;
    }

    let asRanges:ICellRanges | null = null;
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
        // A range address is just a reference expression.
        item = names.addFormula(rangeText, asRanges.toString());
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

    /* A drag in flight reports the live dimensions rather than an address, and takes precedence over
       the name below: while the pointer is down, the size is what is being watched. */
    if (draggingSelection) {
      const dragging = workbook.getSelectedRange();
      const rowCount = dragging.getRowCount();
      const colCount = dragging.getColumnCount();
      if (rowCount > 1 || colCount > 1) {
        let text = `${rowCount}R x ${colCount}C`;
        // if a big number make the divider smaller.
        if (text.length > 17) { // 7 + 5 + 5
          text = `${rowCount}x${colCount}`;
        }
        setDisplayRange({
          text,
          fontStyle: 'italic',
          justifyContent: 'center'
        });
        return;
      }
    }

    /* Selecting the cells a name refers to shows the name in place of the address. Parts are not
       included: Excel's name box shows the address for a table column, not `Sales[Amount]`. */
    // A sheet of another kind has no cells to name.
    const selectedWorksheet = workbook.getSelectedWorksheet();
    if (!selectedWorksheet) {
      setDisplayRange({ text: '' });
      return;
    }
    let text = null;
    try {
      const selection = selectedWorksheet.getSelection();
      text = names.getByRanges(selection.getRanges())[0] ?? null;
    } catch (error: any) { }

    if (!text) {
      text = selectedWorksheet.getSelectedRange().toString();
    }
    setDisplayRange({ text });
  }, [workbook, draggingSelection]);

  const [all, setAll] = useState(() => names?.getItems() ?? null);

  useModelListener<INamedCollection, INamedCollection.IListeners>(names, {
    onCollectionChange(_source: INamedCollection): void {
      setAll(names.getItems());
      updateRangeDisplay(); // no debounce
    },
    /* A restore is announced on its own channel, and this list has to re-read on both: an undo of a
       table rename moves no state the collection holds — a table's name is read back off the table —
       so there is nothing for `onCollectionChange` to report. */
    onInvalidated(_source: INamedCollection): void {
      setAll(names.getItems());
      updateRangeDisplay();
    },
    onClose(_source: INamedCollection): void {
      setAll([]);
    }
  });

  useEffect(() => {
    setRangeText(committedRangeText());
  }, [displayRange]);

  useEffect(() => {
    updateRangeDisplayDebounced();
  }, [draggingSelection]);

  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onProtectionChange: (source: IWorkbook) => {
      setIsReadOnlyOrProtected(readonly || !source.getProtection().isStructureAllowed());
    },
    onSelectedSheetChange: (source: IWorkbook) => {
      setDraggingSelection(null);
      updateRangeDisplay();
    },
    onSheetsChange: (source: IWorkbook) => {
      setDraggingSelection(null);
      updateRangeDisplay();
    },
    onViewChange(source: IWorkbook): void {
      setDraggingSelection(null);
      updateRangeDisplay();
    }
  });

  const updateRangeDisplayDebounced = useCallbackRef(TimerUtils.debounce(updateRangeDisplay, draggingSelection ? 0 : 120), [draggingSelection]);

  useModelListener<IRangeSelection, IRangeSelection.IListeners>(workbook.getSelectedWorksheet()?.getSelection(), {
    onChange: (_source: IRangeSelection) => {
      updateRangeDisplayDebounced();
    },
    onAdjustingChange: (source: IRangeSelection) => {
      setDraggingSelection(source.getAdjusting());
    }
  });

  const refInput = useRef<HTMLInputElement>(null)

  const textDrag = useTextSelectionDrag();

  const renderInputQuickButton = useCallback((props: ExhibitQuickButtonProps) => {
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
          inputMode={'text'} // Keep virtual keyboard but request simple text mode
          // disabled={propDisabled ?? (!command || command.disabled())}
          inputProps={{
            tabIndex: 0,
            // The formula bar around the field is `user-select: none`, which a browser reads as a veto on
            // a drag-select the moment the pointer leaves the field. Suspended for the length of the press.
            onPointerDown: textDrag.onPointerDown,
            onDragStart: textDrag.onDragStart,
            name: 'input-named-range',
            maxLength: 255,
            className: 'input',
            autoFocus: false, // not 'sticking use autoFocusSel instead'
            spellCheck: false,
            // placeholder: 'Type to search key bindings',
            autoComplete: 'off',
            autoCorrect: 'off',
            autoCapitalize: 'off',
            // Tell mobile keyboards to send proper Enter events
            enterKeyHint: 'done',
            ref: refInput
          }}
          sx={{
            '&::before': { // default
              borderBottom: '1px solid transparent'
            },
            '&:hover:not(.Mui-disabled):not(.Mui-focused):not(.Mui-error):before': { // hover
              borderBottom: (theme: Theme) => `1px solid ${(theme.palette.text as any).icon ?? theme.palette.action.active}`
            },
            '&:hover:not(.Mui-disabled):not(.Mui-error):before': { // focus and hover
              borderBottom: (theme: Theme) => `1px solid ${theme.palette.primary.main}`
            },
            '::after': { // focus
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
            boxShadow: 'none',
            flex: '1',
            // width: defaultWidth,
            color: (theme: Theme) => theme.palette.text.secondary,
            'input': {
              padding: '0',
              height: '1rem',
              textAlign: 'left',
              '&:hover:not(.Mui-disabled):not(.Mui-error)': { // hover
                color: (theme: Theme) => theme.palette.text.primary,
              },
              '&:focus:not(.Mui-disabled):not(.Mui-error)': { // focused
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
            // Debug logging for mobile
            // console.log('🔴 NamedCollectionEditor KeyDown:', {
            //   key: e.key,
            //   keyCode: e.keyCode,
            //   which: e.which,
            //   code: e.code,
            //   timeStamp: e.timeStamp
            // });

            if ((e.which === KeyCodes.Enter || e.which === KeyCodes.Tab)) {
              let doGoto:IRange.FixableCoords | string | null = rangeText;
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
  }, [rangeText, displayRange, textDrag]);

  const onGoto = useCallbackRef(async (address: ICellRanges.Address) => {
    // TODO - when pressing enter from textfield we need to also close the popup
    try {
      floatReference?.closeAll();
      const found = names.getItems({
        address: address
      })?.[0];
      if (found) {
        await found?.select();
      }
      await workbook.getRanges(address)?.select({ autoFocus: true });
    } catch (error: any) {
      notifier.showMessage?.(error.message, { type: NotifierType.Error });
    }
  }, [names, notifier, workbook]);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    setTimeout(() => {
      setIsPopupOpen(true); // HACK - the onPopupOpen is not being called with a delay. We need an immediate
    }, 0);
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // Close-on-execute is automatic: members render inside this popup's float and `useCommands`
      // closes the enclosing float on execute (`useFloat`).
      groupKey: propsCommandPopupButton?.groupKey
      // disabled: propDisabled
    }

    // The SHEET's collection — everything reachable from the selected sheet, which is what the name
    // box may jump to. The workbook's would list other sheets' private names.
    let items:INamed[] = (workbook?.getSelectedWorksheet()?.getNames() ?? names).getItems();

    // we want ranges to sort first.
    items = items.sort((a: INamed, b: INamed) => {
      const aIsTable = a.getType() === 'table';
      const bIsTable = b.getType() === 'table';
      if (aIsTable === bIsTable) {
        return a.getName().localeCompare(b.getName());
      }
      return aIsTable ? 1 : -1;
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
    /* Tracked rather than compared against `items[i-1]` because hidden/range-less items are
       skipped below; the previous item may never have been rendered. */
    let lastIsTable:boolean | null = null;
    for (let i=0; i<itemsLength; i++) {
      const item:INamed = items[i];
      const ranges = item.getRanges?.();
      if (!ranges || item.isHidden()) continue; // we filter out hidden and missing ranges
      /* Everything calc owns is a 'formula' - a name that "is a range" is just one whose
         expression is a pure reference. Only tables are a distinct group. */
      const isTable = item.getType() === 'table';
      // TODO - The selection doesn't render.
      // const selected = item.name === displayRange?.text;
      if (isTable !== lastIsTable) { // Add a label. if (first rendered) || (group is different)
        if (lastIsTable !== null) {
          menus.push(
            <ExhibitDivider
              orientation='horizontal'
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
            {isTable ? t('named.groupTables') : t('named.groupRanges')}
          </ExhibitMenuHeader>
        );
        lastIsTable = isTable;
      }
      if (!isTable) {
        // No popup members (read-only / protected) → a plain quick button (just the `quickCommand`).
        menus.push(popupCommandKeysReference ? (
          <CommandGroup
            {...commandButtonProps}
            key={'named-' + menus.length}
            groupKey='namedItem'
            members={popupCommandKeysReference}
            commandState={item}
            label={item.getName()}
            quickCommand={'selectNamed'}
            disabled={propDisabled ?? !item.getRanges?.()}
            icon='NamedRange'
          />
        ) : (
          <CommandButton
            {...commandButtonProps}
            key={'named-' + menus.length}
            commandKey={'selectNamed'}
            groupKey='namedItem'
            commandState={item}
            label={item.getName()}
            disabled={propDisabled ?? !item.getRanges?.()}
            icon='NamedRange'
          />
        ));
      } else {
        menus.push(popupCommandKeysTable ? (
          <CommandGroup
            {...commandButtonProps}
            key={'namedItem-' + menus.length}
            groupKey='namedItem'
            members={popupCommandKeysTable}
            commandState={item}
            label={item.getName()}
            quickCommand={'selectNamed'}
            disabled={propDisabled ?? !ranges}
            icon={'TableInsert'}
          />
        ) : (
          <CommandButton
            {...commandButtonProps}
            key={'namedItem-' + menus.length}
            commandKey={'selectNamed'}
            groupKey='namedItem'
            commandState={item}
            label={item.getName()}
            disabled={propDisabled ?? !ranges}
            icon={'TableInsert'}
          />
        ));
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
            groupKey='namedItem'
            commandKey={'addNamedReference'}
          />
        ) : null}
        {(menus && menus.length > 0) ? (<>
        { !isReadOnlyOrProtected ? <ExhibitDivider orientation='horizontal'/> : null}
        <Box
          sx={{
            // The list is the ONE scroller, and vertical only: the float's paper clips
            // horizontally (menus ellipsize), and a horizontal bar here for a long name took
            // height the list did not have, which is what put a vertical bar on a list that fit.
            overflowX: 'hidden',
            overflowY: 'auto',
            minHeight: 0,
            flex: '1 1 auto'
          }}>
          {menus}
        </Box>
        </>) : null}
        {/* The name manager, like Define Name… above, stays put while the list scrolls. Not
            gated on protection: reading the names matters most on a protected workbook. */}
        <ExhibitDivider orientation='horizontal'/>
        <CommandButton
          {...commandButtonProps}
          groupKey='namedItem'
          commandKey={'activeNameManager'}
        />
      </Box>
    );
    return defaultRenderPopupPanel({...props, children});
  }, [workbook, all, names, displayRange, isReadOnlyOrProtected, t]);

  const refLocal = useImperativeElement<INamedCollectionEditorElement, unknown>(refForwarded, () => ({
    focus(options?: FocusOptions): void {
      refInput.current?.focus(options);
    }
  }), []);

  const refMerged = useMergeRefs([refLocal, refForwarded]);
  return (
    <Box
      {...rest}
      className={clsx('outer', propClassName)}
      style={{
        minWidth: 120,
        flex: '1 1 100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'start', // displayRange?.justifyContent ??
        ...propStyle
      }}
      ref={refMerged as React.RefObject<HTMLDivElement>}
    >
      <ExhibitPopupIconButton
        className='outer-button'
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
          // ...propStyle // this is incorrect
        }}
        propsButton={{
          sx: {
            // background: 'pink',
            backgroundColor: 'var(--sxl-color-input, var(--sxl-color-base-100))',
          }
        }}
        tabIndex={-1}
        outlined={{
          color: (theme: Theme) => {
            // match formula bar color
            return !disabled ? FIELD_BORDER_COLOR : theme.palette.action.disabled;
          }
        }}
        // disabled={propDisabled}
        renderPopupPanel={renderPopupPanel}
        onPopupOpen={() => setIsPopupOpen(true) }
        onPopupClose={() => setIsPopupOpen(false) }
        renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
          return (
            <ExhibitTooltip
              title={disabled || isPopupOpen ? '' : t('nameBox.title')}
              disabled={disabled}
              leaveDelay={0}//disabled ? 0 : undefined}
              sx={{opacity: disabled || isPopupOpen? 0 : 1}}
            >
              {children}
            </ExhibitTooltip>
          );
        }}
        renderQuickButton={renderInputQuickButton}
      />
    </Box>
  );
}));

NamedCollectionEditor.displayName = 'NamedCollectionEditor';