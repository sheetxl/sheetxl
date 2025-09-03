import React, {
  useRef, useLayoutEffect, useState, useMemo, useEffect, memo
} from 'react';

import { useMeasure } from 'react-use';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { DialogContent } from '@mui/material';

import { Box } from '@mui/material';
import { TextField } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { TouchRippleActions } from '@mui/material';
import { Collapse } from '@mui/material';
import { InputLabel } from '@mui/material';
import { MenuItem } from '@mui/material';
import { FormControl } from '@mui/material';
import { Select, SelectChangeEvent, type SelectProps } from '@mui/material';

// Note - we could do all of this with a single icon but I think it is more clear and flexible to have separate icons
import { ArrowUpward as ArrowUpwardIcon } from '@mui/icons-material';
import { ArrowDownward as ArrowDownwardIcon } from '@mui/icons-material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

import { IRange, ICell, ICellRange, IWorkbook } from '@sheetxl/sdk';

import {
  useCallbackRef, KeyCodes, KeyModifiers
} from '@sheetxl/utils-react';

import {
  ExhibitDivider, ExhibitOptionButton, themeIcon
} from '@sheetxl/utils-mui';

import {
  FindOptionsIcon, FindReplaceToggleIcon, FindCaseSensitiveIcon, FindWholeWordIcon,
  FindRegExIcon, FindReplaceIcon, FindReplaceAllIcon,
  InternalWindow, InternalWindowProps, IInternalWindowElement
} from '@sheetxl/utils-mui';

export interface FindReplaceWindowProps extends InternalWindowProps {
findText?: string;
  findOptions?: ICellRange.FindOptions;

  replace?: boolean;

  replaceText?: string;
  replaceOptions?: IWorkbook.ReplaceOptions;

  onFindOrReplace?: (options: FindReplaceWindowOptions) => Promise<number>;
}


type OptionSelectProps = Omit<SelectProps, 'variant' | 'onSelect'> & {
  label: string;
  value: any;
  options: Record<string, any>;
  onSelect: (value: any) => void;
}

const OptionSelect = memo((props: OptionSelectProps) => {
  const {
    label,
    value: propValue,
    options,
    onSelect,
    tabIndex=0,
    ...rest
  } = props;

  const [optionsKey, setOptionsKey] = useState<string>(() => keyForValue(propValue, options));
  useEffect(() => {
    setOptionsKey(keyForValue(propValue, options));
  }, [propValue, options]);

  const handleChange = useCallbackRef((event: SelectChangeEvent) => {
    setOptionsKey(event.target.value);
    onSelect?.(options[event.target.value]);
  }, [onSelect, options]);

  const menus = useMemo(() => {
    return Object.keys(options).map((key) => {
      return (
        <MenuItem
          key={key}
          value={key}
        >
          {key}
        </MenuItem>
      );
    });
  }, [options]);

  return (
    <FormControl
      sx={{
        minWidth: 135, // TODO - make this dynamic
        // maxWidth: '100%'
      }}
      size="small"
    >
      <InputLabel>
        {label}
      </InputLabel>
      <Select
        inputProps={{
          tabIndex
        }}
        value={optionsKey}
        label={label}
        onChange={handleChange}
        sx={{
          backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
        }}
        {...rest}
      >
        {menus}
      </Select>
    </FormControl>
  );
});

export const ScopeOptions = {
  /**
   * Search the entire workbook
   */
  Workbook: 'workbook',
  /**
   * Search the current sheet or range
   */
  Sheet: 'sheet'
} as const;
export type ScopeOptions = typeof ScopeOptions[keyof typeof ScopeOptions];

export interface FindReplaceWindowOptions {
  /**
   * The text to find.
   * @required
   */
  findText: string;
  findOptions: ICellRange.FindOptions;

  /* We have a flag to support null replaceText */
  replace?: boolean;

  replaceText?: string | null;

  replaceOptions?: IWorkbook.ReplaceOptions;

  /**
   * If true the operation will signal to the ui container to
   * autoFocus.
   */
  autoFocus?: boolean;

  /**
   * Default value 'Sheet'
   */
  scope?: ScopeOptions
}

const collapseTime = {
  enter: 140,
  exit: 140
};

const minContentWidth = 460; // 440 works

const fieldOptionsAll = {
  'Formulas': ICell.Content.Formulas,
  'Values': ICell.Content.Values,
  'Notes': ICell.Content.Notes,
  'Comments': ICell.Content.Comments
}

const fieldOptionsReplace = {...fieldOptionsAll};
delete fieldOptionsReplace['Values'];

const rowScanOptions = {
  'By Rows': true,
  'By Columns': false,
}

const keyForValue = (value: any, obj: Record<string, any>): string => {
  const keys = Object.keys(obj);
  for (let k=0; k<keys.length; k++) {
    const key = keys[k];
    if (obj[key] === value) {
      return key;
    }
  }
}

/**
 * TODO
 * - save last searches (up/down arrow to navigate) (in preferences/workbook?)
 * - later add indexing so we can do real-time search and count
 */
export const FindReplaceWindow: React.FC<FindReplaceWindowProps> = memo((props: FindReplaceWindowProps) => {
  const {
    replace: propReplace=false,
    findText: propFindText,
    replaceText: propReplaceText,
    findOptions: propFindOptions,
    replaceOptions: propReplaceOptions,
    title: propTitle,
    onHide: propOnHide,
    onFindOrReplace,
    ...rest
  } = props;

  const refFindText = useRef<HTMLInputElement>(null);
  const refReplaceText = useRef<HTMLInputElement>(null);

  const refRipplePrev = useRef<TouchRippleActions>(null);
  const refRippleNext = useRef<TouchRippleActions>(null);
  const refRippleReplace = useRef<TouchRippleActions>(null);
  const refRippleReplaceAll = useRef<TouchRippleActions>(null);

  const doRipple = (event: any, ripple: TouchRippleActions) => {
    if (!ripple) return;
    const rippleDuration = 180;
    ripple.start(event, {
      center: false
    })
    setTimeout(() => ripple.stop(event), rippleDuration);
  }

  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [isShowAdditionalOptions, setShowAdditionalOptions] = useState<boolean>(false);
  const [isShowReplace, setShowReplace] = useState<boolean>(propReplace);
  const [isShowNoResults, setShowNoResults] = useState<boolean>(false);
  const [hasFocus, setHasFocus] = useState<boolean>(false);

  const [options, setOptions] = useState<FindReplaceWindowOptions>({
    findText: null,
    replaceText: null,
    replace: propReplace,
    replaceOptions: {
    },
    findOptions: {
      matchCase: false,
      matchEntireCell: false,
      useRegex: false,

      // isReverse: false, // transit property
      // disableWrap: false,
      orientation: IRange.Orientation.Row,
      fields: [ICell.Content.Formulas]
    },
    scope: ScopeOptions.Sheet
  });

  const doFindReplace = useCallbackRef(async (forward?: boolean, replace?: boolean, replaceAll?: boolean, autoFocus?: boolean) => {
    if (!onFindOrReplace)
      return;

    const state:FindReplaceWindowOptions = {
      ...options
    }
    state.replaceOptions = {
      ...state.replaceOptions,
    }
    state.findOptions = {
      ...state.findOptions,
    }
    state.replaceOptions.maxCount = replaceAll ? undefined : 1;
    state.replace = replace;

    // We don't allow value for replace
    if (replace && options.findOptions.fields?.[0] === ICell.Content.Values)
      state.findOptions.fields = [ICell.Content.Formulas];
    state.findOptions.reverse = !forward;

    const count = await onFindOrReplace({
      autoFocus,
      ...state
    });
    setShowNoResults(count === 0);

  }, [options, onFindOrReplace]);

  useEffect(() => {
    // We do this on blur too
    setShowNoResults(false);
  }, [options, isShowAdditionalOptions, isShowReplace]);

  const handleKeyDown = useCallbackRef((e: React.KeyboardEvent, replace: boolean) => {
    if (e.keyCode === KeyCodes.Enter) {
      if (!options.findText)
        return;
      let forward = true;
      let replaceAll = false;
      if (e.shiftKey) {
        forward = false;
      }
      if (!replace) {
        doRipple(e, forward ? refRippleNext.current : refRipplePrev.current);
      } else {
        if (e.ctrlKey && e.altKey) {
          replaceAll = true;
        }
        doRipple(e, replaceAll ? refRippleReplaceAll.current : refRippleReplace.current);
      }

      doFindReplace(forward, replace, replaceAll, false);
    }
  }, [options]);

  const refWindow = useRef<IInternalWindowElement>(null);

  useLayoutEffect(() => {
    setOptions((prev: FindReplaceWindowOptions) => {
      const newValue = {
        ...prev
      };

      // If blank we don't clear the previous
      newValue.findText = (propFindText && propFindText.length > 0 ? propFindText : (prev.findText ?? ''));
      setSelectAll(true); // this ok?

      // if propReplaceText wasn't specified then we leave the replace option allow
      if (propReplaceText !== undefined) {
        newValue.replaceText = propReplaceText;
      }
      if (propFindOptions) {
        newValue.findOptions = {
          ...newValue.findOptions,
          ...propFindOptions
        }
      }

      if (!newValue.replaceText)
        newValue.replaceText = '';

      if (newValue.replaceOptions) {
        newValue.replaceOptions = {
          ...newValue.replaceOptions
        }
      }

      if (propReplaceOptions) {
        newValue.replaceOptions = {
          ...newValue.replaceOptions,
          ...propReplaceOptions
        }
      }
      if (!options.findOptions.fields?.[0])
        options.findOptions.fields = [ICell.Content.Formulas];

      const didSetReplace = (propReplaceOptions || propReplaceText !== undefined) ? true : false;
      // only if replace, don't set back to find only. Comment out if we want to revert to just find on Ctrl + F.
      if (didSetReplace)
        setShowReplace(didSetReplace);

      return newValue;
    });

    if (!hasFocus) {
      refWindow.current?.focus();
    }
    // if additional options are not default
  }, [propFindText, propReplaceText, propFindOptions, propReplaceOptions]);

  useEffect(() => {
    if (!isShowReplace) {
      setSelectAll(true);
    } else if (options.findOptions.fields[0] === ICell.Content.Values) {
      // console.log('setting to formula');
      // setOptions((prev: FindReplaceWindowOptions) => {
      //   const newValue = { ...prev };
      //   newValue.replaceOptions.findOptions.fields[0] = ICell.Content.Formulas;
      //   return newValue;
      // });
    }
  }, [isShowReplace]);

  useEffect(() => {
    if (!selectAll || !refFindText.current) return;
    if (options.findText !== refFindText.current.value) return; // still running effects

    if (refFindText.current === document.activeElement || refFindText.current.contains(document.activeElement)) {
      refFindText.current?.select();
      setSelectAll(false);
      return;
    }
    refFindText.current.addEventListener('focus', () => {
      refFindText.current?.select();
      setSelectAll(false);
    }, { once: true });
  }, [selectAll, options]);

  const [refContentMeasure, { width: contentWidth }] = useMeasure<HTMLElement>();

  return (
    <InternalWindow
      ref={refWindow}
      title={propTitle ?? (!isShowReplace ? 'Find' : 'Find & Replace')}
      initialPosition={{ y: '35' }}
      autoFocusSel={'.input'}
      onHide={propOnHide}
      onFocus={() => setHasFocus(true)}
      onBlur={() => {
        setHasFocus(false);
        setShowNoResults(false);
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
          paddingLeft: (theme: Theme) => theme.spacing(1.5),
          paddingRight: (theme: Theme) => theme.spacing(1.5)
        }}
        onKeyDown={(e) => {
          if (e.key === 'h' && e.ctrlKey) {
            setShowReplace(true);
            if (refFindText.current?.contains(document.activeElement)) {
              refReplaceText.current?.focus();
            }
          } else if (e.key === 'f' && e.ctrlKey) {
            // setShowReplace(false);
            // if (isShowReplace) {
              refFindText.current?.focus();
            // }
          } else if (e.key === 'c' && e.altKey) {
            setOptions((prev: FindReplaceWindowOptions) => {
              const newValue = {
                ...prev
              };
              newValue.findOptions.matchCase = !prev.findOptions.matchCase;
              return newValue;
            });
          } else if (e.key === 'e' && e.altKey) {
            setOptions((prev: FindReplaceWindowOptions) => {
              const newValue = {
                ...prev
              };
              newValue.findOptions.matchEntireCell = !prev.findOptions.matchEntireCell;
              return newValue;
            });
          } else if (e.key === 'r' && e.altKey) {
            setOptions((prev: FindReplaceWindowOptions) => {
              const newValue = {
                ...prev
              };
              newValue.findOptions.useRegex = !prev.findOptions.useRegex;
              return newValue;
            });
          // } else if (e.which === KeyCodes.Tab) {
          //   // hard code tabbing. Should use tabindex but FocusTrap is not behaving as expected
          //   if (isShowReplace && refFindText.current?.contains(document.activeElement)) {
          //     refReplaceText.current?.focus();
          //     e.preventDefault();
          //   }
          //   //  else if (isShowReplace && refReplaceText.current?.contains(document.activeElement)) {
          //   //   refMatchCase.current?.focus();
          //   //   e.preventDefault();
          //   // }
          //   return; // don't prevent default
          } else {
            // other shortcut keys
            return; // don't prevent default
          }
          e.preventDefault();
        }}
      >
      <Box // primary find/replace
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: (theme: Theme) => theme.spacing(1)
        }}
      >
      <Box // left options box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'start',
          gap: (theme: Theme) => theme.spacing(0.25),
          paddingTop: '3px'//(theme: Theme) => theme.spacing(0.5)
        }}
      >
        <ExhibitOptionButton
          // tabIndex={1} // FocusTrap is not behaving as expected
          selected={isShowAdditionalOptions}
          onSelectToggle={(value: boolean) => {
            setShowAdditionalOptions(value);
          }}
          preventFocus={true}
          label="Toggle Additional Options"
          icon={themeIcon(<FindOptionsIcon/>)}
        />
        <ExhibitOptionButton
          // tabIndex={2}  // FocusTrap is not behaving as expected
          selected={isShowReplace}
          onSelectToggle={(value: boolean) => {
            setShowReplace(value);
          }}
          preventFocus={true}
          label="Toggle Replace"
          icon={themeIcon(<FindReplaceToggleIcon/>)}
          shortcut={{ key: isShowReplace ? 'F' : 'H', modifiers: [KeyModifiers.Ctrl]}}
        />
      </Box>
      <Box // find/replace rows
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}
      >
        <Box // find row
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <TextField
            label="Find"
            InputLabelProps={{
              shrink: true
            }}
            InputProps={{
              sx:{
                paddingRight: (theme: Theme) => theme.spacing(1),
                minWidth: contentWidth > minContentWidth ? '20em' : undefined,
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
              },
              inputProps: {
                draggable: false,
                ref: refFindText,
                className: 'input',
                autoFocus: true, // not 'sticking use autoFocusSel instead'
                spellCheck: false,
                autoComplete: "off",
                // tabIndex: 3,  // FocusTrap is not behaving as expected
                sx: {
                  paddingTop: (theme: Theme) => theme.spacing(1.25),
                  paddingBottom: (theme: Theme) => theme.spacing(0.75)
                },
              },
              endAdornment: (
                <InputAdornment
                  sx={{
                    transform: 'scale(0.75) translateX(16px)'
                  }}
                  position="end"
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: '1px'
                    }}
                  >
                    <ExhibitOptionButton
                      // tabIndex={5}  // FocusTrap is not behaving as expected
                      selected={options.findOptions.matchCase}
                      onSelectToggle={(value: boolean) => {
                        setOptions((prev: FindReplaceWindowOptions) => {
                          const newValue = {
                            ...prev
                          };
                          newValue.findOptions.matchCase = value;
                          return newValue;
                        });
                      }}
                      label="Match Case"
                      shortcut={{ key: 'C', modifiers: [KeyModifiers.Alt] }}
                      icon={themeIcon(<FindCaseSensitiveIcon />)}// sx={{transform: 'scale(0.70)'}} />)}
                    />
                    <ExhibitOptionButton
                      // tabIndex={6}  // FocusTrap is not behaving as expected
                      selected={options.findOptions.matchEntireCell}
                      onSelectToggle={(value: boolean) => {
                        setOptions((prev: FindReplaceWindowOptions) => {
                          const newValue = {
                            ...prev
                          };
                          newValue.findOptions.matchEntireCell = value;
                          return newValue;
                        });
                      }}
                      label="Match Entire Cell"
                      shortcut={{ key: 'E', modifiers: [KeyModifiers.Alt] }}
                      icon={themeIcon(<FindWholeWordIcon />)}// sx={{transform: 'scale(0.70)'}} />)}
                    />
                    <ExhibitOptionButton
                      // tabIndex={6}  // FocusTrap is not behaving as expected
                      selected={options.findOptions.useRegex}
                      onSelectToggle={(value: boolean) => {
                        setOptions((prev: FindReplaceWindowOptions) => {
                          const newValue = {
                            ...prev
                          };
                          newValue.findOptions.useRegex = value;
                          return newValue;
                        });
                      }}
                      label="Use Regular Expression"
                      shortcut={{ key: 'R', modifiers: [KeyModifiers.Alt] }}
                      icon={themeIcon(<FindRegExIcon />)}// sx={{transform: 'scale(0.70)'}} />)}
                    />
                  </Box>
                </InputAdornment>
              )
            }}
            sx={{
              flex: '1 1 100%',
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
            value={options.findText ?? ''}
            onChange={(e) => {
              setOptions((prev: FindReplaceWindowOptions) => {
                const newValue = {
                  ...prev
                };
                newValue.findText = e.target.value;
                return newValue;
              });
            }}
            onKeyDown={(e) => handleKeyDown(e, false/*replace*/)}
            onContextMenu={(e) => { e.stopPropagation(); }}
          />
          <ExhibitOptionButton
            // tabIndex={8}  // FocusTrap is not behaving as expected
            selected={options.findOptions.reverse} // not a toggle
            // sx={{
            //   visibility: 'hidden !important' // TODO - implement reverse in scanCells. - This put this back BEFORE next button),
            // }}
            onSelectToggle={(_value: boolean) => {
              doFindReplace(false/*forward*/, false/*replace*/);
            }}
            touchRippleRef={refRipplePrev}
            label="" //label="Previous Match" - TODO - implement reverse in scanCells. - This put this back BEFORE next button)
            shortcut={{ key: 'Enter', modifiers: [KeyModifiers.Shift]}}
            icon={themeIcon(options.findOptions.orientation !== IRange.Orientation.Column ? <ArrowBackIcon/> : <ArrowUpwardIcon/>)}
            disabled={!options.findText}
          />
          <ExhibitOptionButton
            // tabIndex={9}  // FocusTrap is not behaving as expected
            selected={!options.findOptions.reverse} // not a toggle
            onSelectToggle={(_value: boolean) => {
              doFindReplace(true/*forward*/, false/*replace*/);
            }}
            touchRippleRef={refRippleNext}
            label="Next Match"
            shortcut={{ key: 'Enter'}}
            icon={themeIcon(options.findOptions.orientation !== IRange.Orientation.Column ? <ArrowForwardIcon/> : <ArrowDownwardIcon/>)}
            disabled={!options.findText}
          />
        </Box>
        <Collapse // replace row
          in={isShowReplace}
          timeout={collapseTime}
          onExit={() => {
            refFindText.current?.focus();
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: (theme: Theme) => theme.spacing(2)
            }}
          >
          <TextField
            label="Replace"
            InputLabelProps={{
              shrink: true,
            }}
            InputProps={{
              sx:{
                paddingRight: (theme: Theme) => theme.spacing(1),
                // minWidth: '20em',
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`,
              },
              inputProps: {
                ref: refReplaceText,
                className: 'input',
                spellCheck: false,
                autoComplete: "off",
                // tabIndex: 4,  // FocusTrap is not behaving as expected
                sx: {
                  paddingTop: (theme: Theme) => theme.spacing(1.25),
                  paddingBottom: (theme: Theme) => theme.spacing(0.75)
                },
              }
            }}
            sx={{
              flex: '1 1 100%',
              marginRight: (theme: Theme) => theme.spacing(1),
            }}
            value={options.replaceText ?? ''}
            onChange={(e) => {
              setOptions((prev: FindReplaceWindowOptions) => {
                const newValue = {
                  ...prev
                };
                newValue.replaceText = e.target.value;
                return newValue;
              });
            }}
            onKeyDown={(e) => handleKeyDown(e, true/*replace*/)}
            onContextMenu={(e) => { e.stopPropagation(); }}
          />
            <ExhibitOptionButton
              // tabIndex={10}  // FocusTrap is not behaving as expected
              // selected={options.isReplace} // not a toggle
              onSelectToggle={(_value: boolean) => {
                doFindReplace(true/*forward*/, true/*replace*/);
              }}
              touchRippleRef={refRippleReplace}
              label="Replace"
              shortcut={{ key: 'Enter'}}
              icon={themeIcon(<FindReplaceIcon/>)}
              disabled={!options.findText}
            />
            <ExhibitOptionButton
              // tabIndex={11}  // FocusTrap is not behaving as expected
              // selected={options.replaceOptions.replaceAll} // not a toggle
              onSelectToggle={(_value: boolean) => {
                doFindReplace(true/*forward*/, true/*replace*/, true/*replaceAll*/);
              }}
              touchRippleRef={refRippleReplaceAll}
              label="Replace All"
              shortcut={{ key: 'Enter', modifiers: [KeyModifiers.Ctrl, KeyModifiers.Alt]}}
              icon={themeIcon(<FindReplaceAllIcon/>)}
              disabled={!options.findText}
            />
            {/* <Box // spacing
              sx={{
                minWidth: '10px',
                background:'red'
              }}
            /> */}
          </Box>
        </Collapse>
      </Box>
      </Box>
      <Collapse // additional options row
        in={isShowAdditionalOptions}
        timeout={collapseTime}
        onExit={() => {
          refFindText.current?.focus();
        }}
      >
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
          <ExhibitDivider orientation='horizontal' sx={{ marginBottom: (theme: Theme) => theme.spacing(1.5) }} />
          <Box // options
            sx={{
              display: 'flex',
              flexDirection: contentWidth >= ((135 * 3) + (4*2) /* 3 hardcoded buttons with gaps */) ? 'row' : 'column',
              justifyContent: 'space-evenly',
              alignItems: 'center',
              rowGap: (theme: Theme) => theme.spacing(2),
            }}
            tabIndex={-1}
          >
            <OptionSelect
              // tabIndex={12}  // FocusTrap is not behaving as expected
              label="Within"
              value={options.scope}
              options={ScopeOptions}
              onSelect={(value: ScopeOptions) => {
                setOptions((prev: FindReplaceWindowOptions) => {
                  const newValue = {
                    ...prev
                  };
                  newValue.scope = value;
                  return newValue;
                });
              }}
            />
            <OptionSelect
              // tabIndex={13}  // FocusTrap is not behaving as expected
              label="Search" // "Orientation" terrible name but it's what Excel uses
              value={options.findOptions.orientation !== IRange.Orientation.Column}
              options={rowScanOptions}
              onSelect={(value: boolean) => {
                setOptions((prev: FindReplaceWindowOptions) => {
                  const newValue = {
                    ...prev
                  };
                  newValue.findOptions.orientation = value ? IRange.Orientation.Row : IRange.Orientation.Column;
                  return newValue;
                });
              }}
            />
            <OptionSelect
              // tabIndex={14}  // FocusTrap is not behaving as expected
              label="Look in"
              value={(isShowReplace && options.findOptions.fields?.[0] === ICell.Content.Values) ? ICell.Content.Formulas : options.findOptions.fields?.[0]}
              options={isShowReplace ? fieldOptionsReplace : fieldOptionsAll}
              onSelect={(value: ICell.Content) => {
                setOptions((prev: FindReplaceWindowOptions) => {
                  const newValue = {
                    ...prev
                  };
                  newValue.findOptions.fields = [value];
                  return newValue;
                });
              }}
            />
          </Box>
        </Box>
      </Collapse>
      </DialogContent>
    </InternalWindow>
  );
});

export default FindReplaceWindow;
