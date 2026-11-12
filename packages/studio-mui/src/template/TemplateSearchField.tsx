import React, { useMemo, useRef, useState } from 'react';

import {
  Box, ButtonBase, Chip, Divider, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, TextField
} from '@mui/material';
import { type SxProps, type Theme } from '@mui/system';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { ExhibitIconButton } from '@sheetxl/utils-mui';

import { resolveCategoryColor } from './categoryColor';
import { type TemplateCategory, type TemplateEntry } from './useTemplateCatalog';

/** Whether an entry matches a search: its title, description, tags or category title. */
export const matchesTemplateQuery = (
  entry: TemplateEntry,
  query: string,
  category?: TemplateCategory
): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [entry.title, entry.description, category?.title, ...(entry.tags ?? [])];
  return haystack.some((text) => text?.toLowerCase().includes(needle));
};

/**
 * The gallery filter for a search: entries in any of `categoryIds` (all categories when empty) that
 * match `query`. `undefined` when nothing is filtered.
 */
export const useTemplateFilter = (
  categories: readonly TemplateCategory[],
  query: string,
  categoryIds: readonly string[]
): ((entry: TemplateEntry) => boolean) | undefined => {
  return useMemo(() => {
    if (!query.trim() && categoryIds.length === 0) return undefined;
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const only = categoryIds.length > 0 ? new Set(categoryIds) : null;
    return (entry: TemplateEntry): boolean => {
      if (only && !only.has(entry.category)) return false;
      return matchesTemplateQuery(entry, query, categoriesById.get(entry.category));
    };
  }, [categories, query, categoryIds]);
};

export interface TemplateSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The categories offered as filters. With fewer than two, the field is a plain search. */
  categories?: readonly TemplateCategory[];
  /** The ids of the categories the search is limited to. Empty is every category. */
  categoryIds?: readonly string[];
  onCategoryIdsChange?: (categoryIds: string[]) => void;
  sx?: SxProps<Theme>;
}

const NO_IDS: readonly string[] = [];

/** The category's color as a dot. Without one, the grey of the chip it would add. */
const CategorySwatch = (props: { category: TemplateCategory }): React.ReactElement => {
  const { category } = props;
  return (
    <Box
      component="span"
      sx={(theme: Theme) => ({
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        flex: 'none',
        backgroundColor: resolveCategoryColor(category, theme)?.fill ?? theme.palette.action.selected
      })}
    />
  );
};

const CategoryChip = (props: { category: TemplateCategory; onDelete: () => void }): React.ReactElement => {
  const { category, onDelete } = props;
  return (
    <Chip
      size="small"
      label={category.title}
      title={category.description}
      onDelete={onDelete}
      sx={(theme: Theme) => {
        const color = resolveCategoryColor(category, theme);
        return {
          marginY: 0.25,
          marginRight: 0.5,
          maxWidth: '160px',
          ...(color ? {
            backgroundColor: color.fill,
            color: color.text,
            '& .MuiChip-deleteIcon': { color: color.text, opacity: 0.7 },
            '& .MuiChip-deleteIcon:hover': { color: color.text, opacity: 1 },
            '&.Mui-focusVisible': {
              backgroundColor: color.fill,
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: '1px'
            }
          } : undefined)
        };
      }}
    />
  );
};

/**
 * The template search box. Same shape as the task panes' search fields.
 *
 * @remarks
 * Given categories, the search icon opens a list of them. A chosen category shows as a chip in the
 * field and limits the search to it; with several chosen, an entry in any of them is shown.
 */
export const TemplateSearchField = (props: TemplateSearchFieldProps): React.ReactElement => {
  const { value, onChange, categories, categoryIds = NO_IDS, onCategoryIdsChange, sx } = props;
  const t = useTranslator();
  const refInput = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const filterable = !!onCategoryIdsChange && (categories?.length ?? 0) > 1;
  const chosen = useMemo(() => {
    if (!filterable || categoryIds.length === 0) return [];
    const categoriesById = new Map(categories!.map((c) => [c.id, c]));
    return categoryIds.map((id) => categoriesById.get(id)).filter((c): c is TemplateCategory => !!c);
  }, [filterable, categories, categoryIds]);

  const setCategoryIds = (ids: string[]): void => {
    onCategoryIdsChange?.(ids);
    refInput.current?.focus();
  };
  const closeMenu = (): void => {
    setMenuAnchor(null);
    refInput.current?.focus();
  };

  const searchIcon = <DynamicIcon iconKey="Find"/>;
  let startAdornment: React.ReactNode = <InputAdornment position="start">{searchIcon}</InputAdornment>;
  if (filterable) {
    const label = t('template.filterByCategory');
    startAdornment = (
      <>
        <InputAdornment position="start" sx={{ marginRight: 0.5 }}>
          <ButtonBase
            aria-label={label}
            title={label}
            aria-haspopup="menu"
            aria-expanded={!!menuAnchor}
            onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button === 0) e.preventDefault(); }}
            onClick={(e: React.MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: -0.75,
              paddingX: 0.25,
              paddingY: 0.25,
              borderRadius: 1,
              color: 'inherit',
              '&:hover, &.Mui-focusVisible': { backgroundColor: 'action.hover' }
            }}
          >
            {searchIcon}
            <DynamicIcon iconKey="ExpandMore" style={{ fontSize: '1rem', marginLeft: '-2px' }}/>
          </ButtonBase>
        </InputAdornment>
        {chosen.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            onDelete={() => setCategoryIds(categoryIds.filter((id) => id !== category.id))}
          />
        ))}
      </>
    );
  }

  const hasSearch = !!value || chosen.length > 0;
  return (
    <>
      <TextField
        size="small"
        value={value}
        placeholder={chosen.length > 0 ? undefined : t('template.search')}
        inputRef={refInput}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          // Escape clears first, the text and then the categories; the window's own Escape would
          // close it over an abandoned search.
          if (e.key === 'Escape' && hasSearch) {
            e.stopPropagation();
            if (value) onChange('');
            else setCategoryIds([]);
          } else if (e.key === 'Backspace' && chosen.length > 0) {
            // From the text only: a focused chip deletes itself.
            const input = refInput.current;
            if (e.target === input && input.selectionStart === 0 && input.selectionEnd === 0) {
              e.preventDefault();
              setCategoryIds(categoryIds.slice(0, -1));
            }
          }
        }}
        sx={sx}
        slotProps={{
          input: {
            // Chips wrap onto more lines rather than squeeze the text out of the field, so the vertical
            // padding is the field's, not the text's, and every line is a chip's height: 6 + 28 + 6
            // is the same 40px on one line. Clear is pinned to the first line, as the search icon is,
            // out of the flow so it does not wrap with the chips.
            sx: {
              backgroundColor: 'background.paper',
              flexWrap: 'wrap',
              paddingY: '6px',
              paddingRight: hasSearch ? '40px' : undefined,
              '& .MuiInputBase-input': { flex: '1 1 60px', minWidth: '60px', width: 0, height: '28px', paddingY: 0 },
              '& .MuiInputAdornment-positionStart': { height: '28px', maxHeight: 'none' },
              '& .MuiInputAdornment-positionEnd': {
                position: 'absolute',
                right: '8px',
                top: '6px',
                height: '28px',
                maxHeight: 'none',
                marginLeft: 0
              }
            },
            startAdornment,
            endAdornment: hasSearch ? (
              <InputAdornment position="end">
                <ExhibitIconButton
                  aria-label={t('template.clearSearch')}
                  propsTooltip={{ label: t('template.clearSearch') }}
                  onMouseDown={(e: React.MouseEvent<HTMLElement>) => { if (e.button === 0) e.preventDefault(); }}
                  onClick={() => {
                    onChange('');
                    setCategoryIds([]);
                  }}
                  icon={<DynamicIcon iconKey="Close"/>}
                  size="small"
                />
              </InputAdornment>
            ) : undefined
          },
          htmlInput: {
            spellCheck: false,
            autoComplete: 'off',
            'aria-label': t('template.search')
          }
        }}
      />
      {filterable ?
        <Menu
          anchorEl={menuAnchor}
          open={!!menuAnchor}
          onClose={closeMenu}
          disableRestoreFocus
          slotProps={{ list: { dense: true, 'aria-label': t('dialog.template.categories') } }}
        >
          {categories!.map((category) => {
            const isChosen = categoryIds.includes(category.id);
            return (
              <MenuItem
                key={category.id}
                selected={isChosen}
                title={category.description}
                onClick={() => {
                  onCategoryIdsChange!(isChosen ? categoryIds.filter((id) => id !== category.id) : [...categoryIds, category.id]);
                  closeMenu();
                }}
              >
                <ListItemIcon><CategorySwatch category={category}/></ListItemIcon>
                <ListItemText>{category.title}</ListItemText>
                {isChosen ? <DynamicIcon iconKey="Check" style={{ fontSize: '1rem', marginLeft: '16px' }}/> : null}
              </MenuItem>
            );
          })}
          {chosen.length > 0 ? [
            <Divider key="divider"/>,
            <MenuItem key="all" onClick={() => { onCategoryIdsChange!([]); closeMenu(); }}>
              <ListItemIcon/>
              <ListItemText>{t('template.allCategories')}</ListItemText>
            </MenuItem>
          ] : null}
        </Menu>
      : null}
    </>
  );
};
