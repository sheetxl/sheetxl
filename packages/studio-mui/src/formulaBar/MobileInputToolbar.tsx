import type React from 'react';
import { memo } from 'react';

import { Box, Paper, type Theme } from '@mui/material';

import { DynamicIcon, useTranslator, type VirtualKeyboardInputMode } from '@sheetxl/utils-react';

import { ExhibitIconButton, type ExhibitIconButtonProps } from '@sheetxl/utils-mui';

/** The native keyboard the input asks for: letters, or the number pad. */
export type MobileInputMode = 'text' | 'decimal';

export interface MobileInputToolbarProps {
  /** Whether an edit session is live; cancel and commit are disabled otherwise. */
  isEditing: boolean;
  /** The bar cannot edit (protected cell, read-only workbook). */
  disabled: boolean;
  /** Whether the input's virtual keyboard is up. */
  keyboardShown: boolean;
  /** The keyboard the input currently asks for. */
  inputMode: VirtualKeyboardInputMode;
  /** Open the letters or the number keyboard on the field. */
  onInputMode: (mode: MobileInputMode) => void;
  /** Open the date picker; the picked date goes into the field. */
  onDate: () => void;
  /** Commit and move the active cell right, then keep typing. */
  onTab: () => void;
  /** Commit and move the active cell down, then keep typing. */
  onEnter: () => void;
  /**
   * Whether cancel and commit are on the toolbar. The studio's status bar carries both for any
   * edit, so they are off unless a host without one asks.
   */
  showCancelCommit?: boolean;
  /** Discard the edit. */
  onCancel: () => void;
  /** Keep the edit and stop. */
  onCommit: () => void;
}

/**
 * A toolbar button whose press does not move focus, so the keyboard stays where it is and the
 * studio's focus-restore listener still sees the session end inside the bar.
 */
const ToolbarButton: React.FC<ExhibitIconButtonProps> = (props) => (
  <ExhibitIconButton
    onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button !== 0) return; e.preventDefault(); }}
    {...props}
  />
);

/**
 * The row of entry buttons under the phone's formula bar, on the same surface as the studio
 * toolbar: the three inputs (letters, numbers, date) at the left, then Tab and Enter, and cancel /
 * commit at the right when {@link MobileInputToolbarProps.showCancelCommit} asks for them.
 *
 * @remarks
 * Presentation only. The host owns the textarea and the session, so every action is a callback it
 * runs inside the gesture, which is what lets the browser raise or switch the keyboard. Each input
 * button opens its input: tapping one is never a no-op, whether or not a keyboard is already up.
 */
export const MobileInputToolbar = memo((props: MobileInputToolbarProps): React.ReactElement => {
  const {
    isEditing, disabled, keyboardShown, inputMode, showCancelCommit,
    onInputMode, onDate, onTab, onEnter, onCancel, onCommit
  } = props;
  const t = useTranslator();

  return (
    <Paper
      elevation={2}
      className="formula-bar-input-toolbar"
      role="toolbar"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: (theme: Theme) => theme.spacing(0.25),
        paddingLeft: (theme: Theme) => theme.spacing(1),
        paddingRight: (theme: Theme) => theme.spacing(1),
        paddingTop: '2px',
        paddingBottom: '2px',
        userSelect: 'none',
        // The same surface as the studio toolbar (WorkbookToolbars): the float fill, its edge, and its corners.
        borderRadius: '8px',
        backgroundColor: 'var(--sxl-color-elevated, var(--sxl-color-base-100))',
        border: '1px solid var(--sxl-color-elevated-border, transparent)'
      }}
    >
      <ToolbarButton
        aria-label="input-mode-text"
        selected={keyboardShown && inputMode === 'text'}
        icon={<DynamicIcon iconKey="KeyboardLetters" />}
        propsTooltip={{ label: t('formulaBar.lettersKeyboard'), simple: true }}
        disabled={disabled}
        onClick={() => onInputMode('text')}
      />
      <ToolbarButton
        aria-label="input-mode-decimal"
        selected={keyboardShown && inputMode === 'decimal'}
        icon={<DynamicIcon iconKey="KeyboardNumbers" />}
        propsTooltip={{ label: t('formulaBar.numbersKeyboard'), simple: true }}
        disabled={disabled}
        onClick={() => onInputMode('decimal')}
      />
      <ToolbarButton
        aria-label="insert-date"
        icon={<DynamicIcon iconKey="KeyboardDate" />}
        propsTooltip={{ label: t('formulaBar.dateInput'), simple: true }}
        disabled={disabled}
        onClick={onDate}
      />
      <Box sx={{ flex: '1 1 auto' }} />
      <ToolbarButton
        aria-label="tab-formula-edit"
        icon={<DynamicIcon iconKey="KeyboardTab" />}
        propsTooltip={{ label: t('formulaBar.tab'), simple: true }}
        disabled={disabled}
        onClick={onTab}
      />
      <ToolbarButton
        aria-label="enter-formula-edit"
        icon={<DynamicIcon iconKey="KeyboardEnter" />}
        propsTooltip={{ label: t('formulaBar.enterKey'), simple: true }}
        disabled={disabled}
        onClick={onEnter}
      />
      {showCancelCommit ? (<>
        <Box sx={{ flex: '1 1 auto' }} />
        <ToolbarButton
          aria-label="cancel-formula-edit"
          color="warning"
          icon={<DynamicIcon iconKey="CloseError" />}
          propsTooltip={{ label: t('formulaBar.cancel'), simple: true }}
          disabled={disabled || !isEditing}
          onClick={onCancel}
        />
        <ToolbarButton
          aria-label="commit-formula-edit"
          color="primary"
          icon={<DynamicIcon iconKey="CheckSuccess" />}
          propsTooltip={{ label: t('formulaBar.enter'), simple: true }}
          disabled={disabled || !isEditing}
          onClick={onCommit}
        />
      </>) : null}
    </Paper>
  );
});

MobileInputToolbar.displayName = 'MobileInputToolbar';
