import React, { useState, useMemo, memo, useCallback } from 'react';

import { Theme, alpha, getOverlayAlpha } from '@mui/material/styles';

import { Box } from '@mui/material';
import { FormControl } from '@mui/material';
import { TextField } from '@mui/material';

import { IComment, ICell } from '@sheetxl/sdk';

import { useCallbackRef } from '@sheetxl/utils-react';

import { OptionsDialog, OptionsDialogProps } from '@sheetxl/utils-mui';

export interface CommentsDialogProps extends OptionsDialogProps {
  initialComments?: IComment.Properties;

  onUpdateComments?: (comment: IComment.Properties) => void;

  // TODO - replace this with an IComments object
  context: () => ICell;
};

const DEFAULT_INPUT_OPTIONS = ['Ok', 'Cancel'];

/**
 * PLACEHOLDER for comments editor
 */
// TODO - this doesn't update if comments are changed via the api
// TODO - comments should be in a panel an dialog should just wrap.
export const CommentsDialog: React.FC<CommentsDialogProps> = memo((props) => {
  const {
    initialComments: propsInitialComments = null,
    onUpdateComments,
    context,
    onOption,
    onValidateOption,
    onDone,
    options = DEFAULT_INPUT_OPTIONS,
    defaultOption = options?.[0],
    cancelOption = 'Cancel',
    sx: propSx,
    ...rest
  } = props;

  const initialComment:string = useMemo(() => {
    const comments:IComment.Properties = propsInitialComments ?? context?.()?.getComments();
    let asString = '';
    if (comments && comments.content && comments.content.runs) {
      const runs = comments.content.runs;
      for (let i=0; i<runs.length; i++) {
        const run = runs[i];
        asString += run?.text;
      }
    }
    return asString;
  }, []);

  const [comment, setComment] = useState<string>(initialComment);

  const [firstFocus, setFirstFocus] = useState<boolean>(false);

  const handleValidation = useCallback(async (_input?: string, _option?: string): Promise<boolean> => {
    // TODO - Border Color (and perhaps tooltip on invalid)
    // return TextUtils.isValidHttpUrl(input);
    return null;
  }, []);

  const handleComments = useCallbackRef(async (option: string) => {
    const asArray = comment === '' ? [] : comment.split('\n');

    if (option !== cancelOption) {
      const runs = [];
      for (let i = 0; i < asArray.length; i++) {
        runs.push({ text: asArray[i] });
      }
      const comments = { content: { runs } };
      onUpdateComments?.(comments);
    }
    onOption?.(option, option === cancelOption, option === defaultOption);
    onDone?.();
  }, [comment, onUpdateComments, onDone, onOption, defaultOption, cancelOption]);

  const handleOnCommentChange = useCallbackRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setComment(e.target.value);
    handleValidation(e.target.value, null);
  }, [onValidateOption]);

  const handleValidateComment = useCallbackRef(async (option: string): Promise<boolean> => {
    let result = await Promise.resolve(onValidateOption?.(option));
    try {
      if (result !== false)
        result = await handleValidation(comment, option);
    } catch (e) {}
    return result ?? true;
  }, [onValidateOption, comment]);

  return (
    <OptionsDialog
      title={`${initialComment ? 'Edit' : 'Insert'} Comments`}
      options={options}
      onDone={onDone}
      onOption={(option: string) => handleComments(option) }
      onValidateOption={handleValidateComment}
      defaultOption={defaultOption}
      cancelOption={cancelOption}
      autoFocusSel={'.autoFocus'}
      sx={{
        width: '480px',
        ...propSx
      }}
      {...rest}
    >
      <Box
        sx={{
          paddingTop: (theme: Theme) => theme.spacing(1),
          paddingBottom: (theme: Theme) => theme.spacing(0), // helper text spacing is already applied
          rowGap: (theme: Theme) => theme.spacing(1),
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <FormControl
          sx={{
            paddingTop: (theme: Theme) => theme.spacing(1.5),
            minWidth: 135, // TODO - make this dynamic
            width: '100%'
          }}
          size="small"
        >
        <TextField
          label="Comments"
          placeholder={'Enter a comment.'}
          onFocus={(e) => {
            if (!firstFocus) {
              e.target?.select();
            }
            setFirstFocus(true);
          }}
          sx={{
            '& .MuiFormHelperText-root': {
              marginTop: (theme: Theme) => theme.spacing(0.5)
            }
          }}
          InputLabelProps={{
            shrink: true
          }}
          InputProps={{
            inputProps: {
              className: 'autoFocus',
              spellCheck: false,
              autoComplete: "off",
              sx: {
                paddingTop: (theme: Theme) => theme.spacing(1.25),
                paddingBottom: (theme: Theme) => theme.spacing(0.75),
                backgroundImage: `linear-gradient(${alpha('#fff', getOverlayAlpha(5))}, ${alpha('#fff', getOverlayAlpha(5))})`
              }
            }
          }}

          value={comment}
          onChange={handleOnCommentChange}
          // onKeyDown={handleKeyDown}
          onContextMenu={(e) => { e.stopPropagation(); }}
        />
        </FormControl>
      </Box>
    </OptionsDialog>
  );
});

export default CommentsDialog;
