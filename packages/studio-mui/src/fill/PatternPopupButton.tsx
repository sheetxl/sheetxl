import type React from 'react';
import { memo, useCallback } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { IFill, type ICell, type IColor } from '@sheetxl/sdk';

import { useCallbackRef, useTranslator, type TranslateFn } from '@sheetxl/utils-react';

import {
  ExhibitPopupIconButton, ExhibitTooltip,
  type ExhibitPopupButtonProps, type ExhibitPopupPanelProps
} from '@sheetxl/utils-mui';

import { PatternSwatch, PATTERN_GALLERY } from './PatternSwatch';

/**
 * Localized name for a built-in pattern. A literal `t()` pair per pattern keeps the extractor
 * seeing `key → english`; a computed key would be invisible to it.
 */
export function patternLabel(t: TranslateFn, pattern: IFill.BuiltInSheetPattern): string {
  switch (pattern) {
    case IFill.BuiltInSheetPattern.None: return t('fill.pattern.none');
    case IFill.BuiltInSheetPattern.Solid: return t('fill.pattern.solid');
    case IFill.BuiltInSheetPattern.Gray0625: return t('fill.pattern.gray0625');
    case IFill.BuiltInSheetPattern.Gray125: return t('fill.pattern.gray125');
    case IFill.BuiltInSheetPattern.LightGray: return t('fill.pattern.lightGray');
    case IFill.BuiltInSheetPattern.MediumGray: return t('fill.pattern.mediumGray');
    case IFill.BuiltInSheetPattern.DarkGray: return t('fill.pattern.darkGray');
    case IFill.BuiltInSheetPattern.LightHorizontal: return t('fill.pattern.lightHorizontal');
    case IFill.BuiltInSheetPattern.LightVertical: return t('fill.pattern.lightVertical');
    case IFill.BuiltInSheetPattern.LightDown: return t('fill.pattern.lightDown');
    case IFill.BuiltInSheetPattern.LightUp: return t('fill.pattern.lightUp');
    case IFill.BuiltInSheetPattern.LightGrid: return t('fill.pattern.lightGrid');
    case IFill.BuiltInSheetPattern.LightTrellis: return t('fill.pattern.lightTrellis');
    case IFill.BuiltInSheetPattern.DarkHorizontal: return t('fill.pattern.darkHorizontal');
    case IFill.BuiltInSheetPattern.DarkVertical: return t('fill.pattern.darkVertical');
    case IFill.BuiltInSheetPattern.DarkDown: return t('fill.pattern.darkDown');
    case IFill.BuiltInSheetPattern.DarkUp: return t('fill.pattern.darkUp');
    case IFill.BuiltInSheetPattern.DarkGrid: return t('fill.pattern.darkGrid');
    case IFill.BuiltInSheetPattern.DarkTrellis: return t('fill.pattern.darkTrellis');
    default: return pattern;
  }
}

export interface PatternPopupButtonProps
  extends Omit<ExhibitPopupButtonProps, 'icon' | 'renderPopupPanel'> {
  /** The currently applied tile. */
  selectedPattern: IFill.BuiltInSheetPattern;
  /** The tile's mark color, so the gallery previews the pattern the user will actually get. */
  foreground?: IColor.Serializable | null;
  /** The color behind the marks. */
  background?: IColor.Serializable | null;

  onSelectPattern?: (pattern: IFill.BuiltInSheetPattern) => void;

  createCell: (update: ICell.Update) => ICell | null;

  darkMode?: boolean;
}

const SWATCH_SIZE = 34;
const GALLERY_COLUMNS = 6;

/**
 * The pattern gallery — Excel's Format Cells → Fill → Pattern Style grid, drawn from the model's
 * own tiles and in the fill's own two colors.
 */
export const PatternPopupButton = memo((props: PatternPopupButtonProps) => {
  const {
    selectedPattern,
    foreground,
    background,
    onSelectPattern: propOnSelectPattern,
    createCell,
    darkMode = false,
    disabled: propDisabled,
    ...rest
  } = props;

  const t = useTranslator();
  const onSelectPattern = useCallbackRef(
    propOnSelectPattern ?? ((_pattern: IFill.BuiltInSheetPattern) => {}),
    [propOnSelectPattern]
  );

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { closeFloat } = panelProps;
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GALLERY_COLUMNS}, ${SWATCH_SIZE}px)`,
          gap: '4px',
          padding: '8px'
        }}
      >
        {PATTERN_GALLERY.map((pattern) => (
          <ExhibitTooltip key={pattern} label={patternLabel(t, pattern)}>
            <Box
              role="button"
              tabIndex={0}
              aria-label={patternLabel(t, pattern)}
              aria-pressed={pattern === selectedPattern}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
              onMouseUp={() => { closeFloat?.(); onSelectPattern(pattern); }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                closeFloat?.();
                onSelectPattern(pattern);
              }}
              sx={{
                width: `${SWATCH_SIZE}px`,
                height: `${SWATCH_SIZE}px`,
                cursor: 'pointer',
                borderRadius: '2px',
                outline: (theme: Theme) => (pattern === selectedPattern
                  ? `2px solid ${theme.palette.primary.main}`
                  : `1px solid ${theme.palette.divider}`),
                outlineOffset: '-1px',
                '&:hover': {
                  outline: (theme: Theme) => `2px solid ${theme.palette.primary.light}`
                }
              }}
            >
              <PatternSwatch
                patternType={pattern}
                foreground={foreground}
                background={background}
                createCell={createCell}
                darkMode={darkMode}
              />
            </Box>
          </ExhibitTooltip>
        ))}
      </Box>
    );
  }, [selectedPattern, foreground, background, createCell, darkMode, onSelectPattern, t]);

  return (
    <ExhibitPopupIconButton
      disabled={propDisabled}
      tooltip={t('fill.patternTooltip', { pattern: patternLabel(t, selectedPattern) })}
      renderPopupPanel={renderPopupPanel}
      icon={(
        <Box
          sx={{
            width: '48px',
            height: '20px',
            borderRadius: '2px',
            outline: (theme: Theme) => `1px solid ${theme.palette.divider}`,
            outlineOffset: '-1px',
            overflow: 'hidden'
          }}
        >
          <PatternSwatch
            patternType={selectedPattern}
            foreground={foreground}
            background={background}
            createCell={createCell}
            darkMode={darkMode}
          />
        </Box>
      )}
      {...rest}
    />
  );
});

PatternPopupButton.displayName = 'PatternPopupButton';
