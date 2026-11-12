import type React from 'react';
import { memo } from 'react';

import { Box, type SxProps, type Theme } from '@mui/material';

export interface RuleSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `'config'` for the half that decides *which cells* — tinted, the way the classic rule editor
   * is. `'format'`, the default, is the half that decides *what they look like*.
   */
  variant?: 'format' | 'config';
  sx?: SxProps<Theme>;
}

/**
 * One half of a rule tab.
 *
 * @remarks
 * Every tab is the same two boxes in the same order: what the rule paints, then what it matches.
 * The format box opens with a heading and whatever switch narrows its gallery; the config box
 * carries no heading at all, because its rows already name themselves.
 */
export const RuleSection = memo<RuleSectionProps>((props) => {
  const { variant = 'format', children, sx, ...rest } = props;
  return (
    <Box
      className={`sxl-cf-rule-section sxl-cf-rule-section-${variant}`}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        ...(variant === 'config' ? { backgroundColor: 'action.hover' } : null),
        ...sx
      }}
      {...rest}
    >
      {children}
    </Box>
  );
});

RuleSection.displayName = 'RuleSection';
