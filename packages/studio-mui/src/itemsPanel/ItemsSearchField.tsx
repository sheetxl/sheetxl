import type React from 'react';
import { memo } from 'react';

import { TextField, InputAdornment, type SxProps, type Theme } from '@mui/material';

import { DynamicIcon } from '@sheetxl/utils-react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

export interface ItemsSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder, already translated. Also the field's accessible name. */
  placeholder?: string;
  /** The clear button's tooltip, already translated. */
  clearLabel?: string;
  sx?: SxProps<Theme>;
}

/**
 * The search field above a card list: a find glyph, a clear button while there is a query, and
 * Escape clearing the query before it does anything else.
 */
export const ItemsSearchField = memo<ItemsSearchFieldProps>((props) => {
  const { value, onChange, placeholder, clearLabel, sx } = props;
  return (
    <TextField
      className="sxl-items-search"
      size="small"
      value={value}
      placeholder={placeholder}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        // Escape clears before it does anything else — the pane's own Escape would close it
        // over a query the user only meant to abandon.
        if (e.key === 'Escape' && value) {
          e.stopPropagation();
          onChange('');
        }
      }}
      sx={sx}
      slotProps={{
        input: {
          // The cards' surface, not the pane's: the field belongs with what it filters.
          sx: { backgroundColor: 'background.paper' },
          startAdornment: (
            <InputAdornment position="start">
              <DynamicIcon iconKey="Find" />
            </InputAdornment>
          ),
          // Only while there is something to clear — a permanent ✗ over an empty field reads
          // as a control that does nothing.
          endAdornment: value ? (
            <InputAdornment position="end">
              <ExhibitIconButton
                aria-label={clearLabel}
                propsTooltip={clearLabel ? { label: clearLabel } : undefined}
                // Clearing must not cost the field its focus — the next thing typed is usually
                // another query.
                onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button === 0) e.preventDefault(); }}
                onClick={() => onChange('')}
                icon={<DynamicIcon iconKey="Close" />}
                size="small"
              />
            </InputAdornment>
          ) : undefined
        },
        htmlInput: {
          spellCheck: false,
          autoComplete: 'off',
          'aria-label': placeholder
        }
      }}
    />
  );
});

ItemsSearchField.displayName = 'ItemsSearchField';
