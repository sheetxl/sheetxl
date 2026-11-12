import { type Theme } from '@mui/system';

import { Color } from '@sheetxl/sdk';

import { type TemplateCategory } from './useTemplateCatalog';

/** The category's color and the black or white that reads on it, for the theme in use. */
export const resolveCategoryColor = (
  category: TemplateCategory | undefined,
  theme: Theme
): { fill: string; text: string } | null => {
  if (!category?.color) return null;
  try {
    const fill = new Color(category.color).toCSS(theme.palette.mode === 'dark');
    // By contrast ratio: a brightness cut-off puts white on the mid tones that dark mode inverts to.
    return { fill, text: theme.palette.getContrastText(fill) };
  } catch {
    // A self-hosted catalog may carry anything; a color that does not parse is no color.
    return null;
  }
};
