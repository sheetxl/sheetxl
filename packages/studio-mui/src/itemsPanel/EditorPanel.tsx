import type React from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';

import clsx from 'clsx';

import { Box, Button } from '@mui/material';
import { type Theme } from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

import { type ItemMessageKeys } from './ItemsDescriptor';
import { EditorCommitContext, type EditorCommit, type EditorCommits } from './EditorCommit';

import styles from './Items.module.css';

export interface EditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The feature's catalog keys for the cancel/save labels.
   *
   * `Required`, because these are the editor's own buttons: a list that reaches this panel at all
   * is an authorable one, and an authorable list supplies them (see `ItemsDescriptor.createDraft`).
   */
  messageKeys: Required<Pick<ItemMessageKeys, 'cancel' | 'save'>>;
  /**
   * Called when save is requested
   */
  onSave: () => void;

  /**
   * Called when cancel is requested
   */
  onCancel: () => void;
}

/**
 * Save/cancel shell wrapped around a feature editor.
 */
export const EditorPanel = memo<EditorProps>((props) => {
  const {
    children,
    messageKeys,
    onSave,
    onCancel,
    className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();

  const refCommits = useRef<Set<EditorCommit>>(new Set());
  const commits = useMemo((): EditorCommits => ({
    register: (commit: EditorCommit): (() => void) => {
      refCommits.current.add(commit);
      return () => { refCommits.current.delete(commit); };
    }
  }), []);

  /* Every field is asked, not just up to the first refusal: each one either lands its text on the
     draft or shows why it cannot. */
  const handleSave = useCallback(() => {
    let committed = true;
    for (const commit of Array.from(refCommits.current)) {
      if (!commit()) committed = false;
    }
    if (committed) onSave();
  }, [onSave]);

  const className = useMemo(() => {
    return clsx('sxl-items-editor', 'sxl-anchor-items-editor', propClassName, {
      // ['sxl-has-focus']: hasFocus
    }, styles['editor'])
  }, [propClassName]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        gap: (theme: Theme) => theme.spacing(2)
      }}
      {...rest}
      className={className}
    >
      <EditorCommitContext.Provider value={commits}>
        {children}
      </EditorCommitContext.Provider>
      {/* Action Buttons */}
      <Box
        className={styles['editor-buttons']}
        sx={{
          gap: (theme: Theme) => theme.spacing(1),
          paddingTop: (theme: Theme) => theme.spacing(2),
          borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: '1fr',
            gap: (theme: Theme) => theme.spacing(1),
          }}
        >
          <Button variant="outlined" onClick={onCancel}>
            {t(messageKeys.cancel)}
          </Button>
          <Button variant="contained" onClick={handleSave}>
            {t(messageKeys.save)}
          </Button>
        </Box>
      </Box>
    </Box>
  );
});

EditorPanel.displayName = 'EditorPanel';
