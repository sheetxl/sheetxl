import React, {
  memo, forwardRef, useState, useRef, useLayoutEffect, useEffect
} from 'react';

import clsx from 'clsx';
import { mergeRefs } from 'react-merge-refs';

import type { SxProps } from '@mui/system';
import { alpha, Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Input } from '@mui/material';
import { Typography } from '@mui/material';

import { useMeasure } from 'react-use';

import { CommonUtils } from '@sheetxl/utils';

import { IOUtils } from '@sheetxl/io';

import { useImperativeElement, KeyCodes } from '@sheetxl/utils-react';

import { ExhibitTooltip } from '@sheetxl/utils-mui';

import type { IWorkbookElement } from './IWorkbookElement';

export interface RequestTitleOptions extends FocusOptions {
  selectAll?: boolean;

  requestReason?: string;
}
export interface WorkbookTitleAttributes {
  /**
   * Request focus with a callback that will be called on blur.
   *
   * @param onAccept - Callback when the user's focus leaves the title element after a request focus for a title.
   */
  requestWorkbookTitle: (onAccept?: (title: string, commitReason: string) => void, options?: RequestTitleOptions) => void;
  /**
   * Called when application wants to focus the workbook title.
   * @param options - `FocusOptions`
   */
  focus: (options?: FocusOptions) => void;
}
/**
 * Type returned via ref property
 */
export interface IWorkbookTitleElement extends HTMLDivElement, WorkbookTitleAttributes {};
export interface WorkbookTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  workbook?: IWorkbookElement;

  title?: string;

  onTitleChange?: (newTitle: string | null) => void;
  /**
   * Text to show if no values
   * @defaultValue 'Untitled'
   */
  placeHolder?: string;
  /**
   * If true the title will not be editable
   * @defaultValue false
   */
  readOnly?: boolean;
  /**
   * @defaultValue false
   */
  hidden?: boolean;

  /**
   * Ref for the IWorkbookTitleElement
   */
  ref?: React.Ref<IWorkbookTitleElement>;
}

const createTitleStyle = (outlined: boolean = false, readOnly: boolean = false) => {
  if (readOnly)
    return null;
  return {
    '& input:not(:focus):not(:hover)': {
      color: (theme: Theme) => {
        return theme.palette.text.secondary;
      },
    },
    backgroundColor: (theme: Theme) => {
      return alpha(theme.palette.background.paper, 0.6); // theme.palette.action.selectedOpacity * 4
    },
    borderRadius: (theme: Theme) => {
      return `${theme.shape.borderRadius}px`
    },
    border: (theme: Theme) => {
      return `solid ${(outlined ? theme.palette.divider : "transparent")} 1px`
    },
    '&.Mui-disabled': {
      border: (theme: Theme) => {
        return `solid ${(outlined ? theme.palette.divider : 'transparent')} 1px`
      },
    },
    "&:focus-within:not([disabled])": {
      backgroundColor: (theme: Theme) => {
        return theme.palette.background.paper;
      }
    },
    "&:hover:not([disabled])": {
      border: (theme: Theme) => {
        return `solid ${(outlined ? theme.palette.text?.primary : theme.palette.divider)} 1px`
      },
      backgroundColor: null
    },
    '&.Mui-focusVisible': {
      outline: (theme: Theme) => `solid ${theme.palette.primary.main} 1px !important`,
      border: (theme: Theme) => `1px solid ${theme.palette?.primary?.main} !important`,
    }
  };
}

export const WorkbookTitle = memo(forwardRef<IWorkbookTitleElement, WorkbookTitleProps>(
  (props: WorkbookTitleProps, refForwarded) => {
  const {
    sx: propSx,
    workbook,
    title: propTitle = '',
    placeHolder = 'Untitled',
    onTitleChange,
    readOnly = false,
    hidden,
    ...rest
  } = props;

  const outlined = true;
  const underlined = !outlined;

  const [isFocused, setFocused] = useState<boolean>(false);
  const [isInvalid, setInvalid] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(propTitle ?? "");
  const [initialInputValue, setInitialInputValue] = useState<string>("");
  const [refInputMeasure, { width: inputWidth }] = useMeasure<HTMLDivElement>();
  const [refMeasure, { width: inputContainerWidth }] = useMeasure<HTMLDivElement>();
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const refInput = useRef<HTMLInputElement>(null);
  // We use a ref instead of state because the native blur and enter both occur in same render and we don't want duplicates
  const refAcceptCallback = useRef<{ onAccept: (title: string, reason: string) => void, requestReason: string }>(null);

  const refLocal = useImperativeElement<IWorkbookTitleElement, WorkbookTitleAttributes>(refForwarded, () => ({
    requestWorkbookTitle: (onAccept: (title: string, reason: string) => void = null, options?: RequestTitleOptions) => {
      refAcceptCallback.current = { onAccept, requestReason: options?.requestReason };
      if (options?.selectAll)
        refInput.current?.select();
      refInput.current?.focus(options);
    },
    focus: (options?: FocusOptions) => {
      refInput.current?.focus(options);
    }
  }), []);

  useLayoutEffect(() => {
    setIsResizing(propTitle !== inputValue);
    setInitialInputValue(propTitle);
    setInputValue(propTitle);
  }, [propTitle]);

  useEffect(() => {
    if (!isResizing || inputWidth === 0) return;
    // HACK: This is a hack to prevent the input from showing while resizing as it flickers
    CommonUtils.debounce(() => {
      setIsResizing(false);
    }, 300)();
  }, [isResizing, inputWidth]);

  useEffect(() => {
    setInvalid(inputValue && !IOUtils.isValidWindowsFilename(inputValue));
  }, [inputValue]);

  if (hidden) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: (isResizing) ? '0' : '1', // reduce resizing flicker
        transition: !isResizing ? 'opacity .25s ease-in' : undefined,
        '& .tooltip-wrapper': {
          maxWidth: '100%'
        },
        // border: 'red 1px solid',
      }}
      ref={mergeRefs([refLocal, refMeasure, refForwarded]) as any}
      {...rest}
    >
      <ExhibitTooltip
        label={refAcceptCallback.current?.requestReason ?? `Workbook Name`}
        // description={"Enter a name that is unique and meaningful for this workbook"}
        // disabled={disabled}
      >
      <Box
        className={clsx({
          ['Mui-focusVisible']: (isFocused),
          // ['Mui-hovered']: (isHovered),
        })}
        sx={{
          visibility: inputWidth === 0 ? 'hidden' : 'visible', // because we have to render to measure
          display: 'block',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingLeft: '12px',
          paddingRight: '12px',
          marginLeft: '2px',
          marginRight: '2px',
          paddingTop: underlined? '2px' : '2px',
          paddingBottom: underlined ? '2px' : '1px',
          ...createTitleStyle(outlined, readOnly),
          ...propSx
        }}
      >
        { readOnly ? (
          <Typography
            variant="subtitle1"
            component="div"
            sx={{
              // fontWeight: '600',
              whiteSpace: 'nowrap',
              fontStyle: (inputValue !== initialInputValue) ? 'italic' : undefined,
              userSelect: 'none',
              textOverflow: 'ellipsis',
              lineHeight: '1.4375em', // to match input height
              border: 'transparent 1px solid', // to match input border
              color: (theme: Theme) => {
                return (isInvalid ? theme.palette.error.dark : undefined);
              }
            }}
          >
            {propTitle ?? placeHolder}
          </Typography>
        ) : (
          <Input
            sx={{
              // We are using the getBoundingClientRect because the input width is not accurate
              width: `${Math.min(inputWidth + 3, Math.max(inputContainerWidth, refLocal.current?.getBoundingClientRect()?.width))}px`, // +3  fudge due to letter spacing being off.
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              fontWeight: '600',
              maxWidth: '100%',
              border:'none',
              padding: '0px',
              margin: '0px',
              color: (theme: Theme) => {
                return (isInvalid ? theme.palette.error.dark : undefined);
              },
              fontStyle: (inputValue !== initialInputValue) ? 'italic' : undefined,
              '& input': {
                paddingTop: '0px',
                paddingBottom: underlined ? '1px' : '0px',
                textOverflow: 'ellipsis'
              }
            }}
            disableUnderline={!underlined}
            fullWidth={false}
            multiline={false}
            readOnly={readOnly}
            spellCheck={false}
            placeholder={placeHolder}
            onFocus={(e:React.FocusEvent<HTMLInputElement>) => {
              setFocused(true);
              e.target?.select();
            }}
            inputProps={{
              name: `input-workbook-title`,
              autoComplete: "off",
              ref: refInput
            }}
            onBlur={() => {
              setFocused(false);
              if (isInvalid) {
                setInputValue(initialInputValue);
                return;
              }
              if (inputValue !== initialInputValue) { // commit value
                onTitleChange?.(inputValue);
                if (inputValue) {
                  refAcceptCallback.current?.onAccept?.(inputValue, 'blur');
                }
              }
              refAcceptCallback.current = null;
            }}
            onChange={(e) => {
              if (e.target.value.length > IOUtils.MAX_WORKBOOK_NAME_SIZE) {
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              setInputValue(e.target.value);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (IOUtils.WINDOW_FILENAME_CHAR_RESERVED_REGEX.test(e.key) || (e.target as any)?.value.length > IOUtils.MAX_WORKBOOK_NAME_SIZE)
                  e.preventDefault();
              if ((e.which === KeyCodes.Enter || e.which === KeyCodes.Tab)) {
                if (isInvalid) {
                  setInputValue(initialInputValue);
                } else {
                  onTitleChange?.(inputValue);
                  if (inputValue) {
                    refAcceptCallback.current?.onAccept?.(inputValue, 'keydown');
                    refAcceptCallback.current = null;
                  }
                }
                e.stopPropagation();
                e.preventDefault();
                workbook?.focus();
              } else if ((e.which === KeyCodes.Escape)) {
                if (inputValue === initialInputValue) { // restore focus
                  workbook?.focus();
                } else { // revert value
                  setInputValue(initialInputValue);
                  setTimeout(() => {
                    (e.target as any)?.select();
                  }, 0);
                }
                refAcceptCallback.current = null;
                e.stopPropagation();
                e.preventDefault();
              }
            }}

            value={inputValue}
          />
        ) }
        <Box
          ref={refInputMeasure}
          sx={{
            position: 'absolute',
            visibility: 'hidden',
            top: '-9999px',  //hack
            fontWeight: '600 !important',
            whiteSpace: 'pre',
            fontStyle: (inputValue !== initialInputValue) ? 'italic' : undefined,
            fontFamily: (theme: Theme) => theme.typography.fontFamily,
            letterSpacing: '0.00938em' // note sure how to get this from mui
          }}
        >
          {inputValue || placeHolder}
        </Box>
      </Box>
      </ExhibitTooltip>
    </Box>
  );
}));

WorkbookTitle.displayName = 'WorkbookTitle';