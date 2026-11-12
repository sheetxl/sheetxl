import React, { useCallback, useState } from 'react';

import {
  Box, Checkbox, DialogActions, DialogContent, FormControlLabel, Typography
} from '@mui/material';

import { useTranslator } from '@sheetxl/utils-react';

import { InternalWindow, type InternalWindowProps } from '@sheetxl/utils-mui';

import { TemplatePanel } from './TemplatePanel';
import { TemplateSearchField, useTemplateFilter } from './TemplateSearchField';
import { useTemplateCatalog, type TemplateEntry } from './useTemplateCatalog';

export interface TemplateDialogProps extends InternalWindowProps {
  /** The catalog to show. Defaults to the published SheetXL templates. */
  templatePath?: string;
  /** Called when a template is chosen. */
  onSelectTemplate?: (entry: TemplateEntry) => void;
  /** Whether "Show at startup" is checked. Omit to hide the checkbox. */
  showAtStartup?: boolean;
  /** Called when "Show at startup" is toggled. */
  onShowAtStartupChange?: (show: boolean) => void;
}

/**
 * "Choose a template": the template gallery with a search that can be limited to categories.
 */
const TemplateDialog: React.FC<TemplateDialogProps> = (props: TemplateDialogProps) => {
  const {
    title: propTitle,
    templatePath,
    onSelectTemplate,
    showAtStartup: propShowAtStartup,
    onShowAtStartupChange,
    sx: propSx,
    ...rest
  } = props;

  const t = useTranslator();
  const catalog = useTemplateCatalog({ path: templatePath });
  const [query, setQuery] = useState<string>('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const filter = useTemplateFilter(catalog.categories, query, categoryIds);

  // The modal's props are fixed at show time, so the checkbox keeps its own copy.
  const [showAtStartup, setShowAtStartup] = useState<boolean | undefined>(propShowAtStartup);
  const handleShowAtStartup = useCallback((show: boolean): void => {
    setShowAtStartup(show);
    onShowAtStartupChange?.(show);
  }, [onShowAtStartupChange]);
  const handleSelect = useCallback((entry: TemplateEntry): void => {
    onSelectTemplate?.(entry);
  }, [onSelectTemplate]);

  return (
    <InternalWindow
      isModal={true}
      sx={{
        width: '860px',
        ...propSx
      }}
      title={propTitle ?? t('dialog.template.title')}
      autoFocusSel={'.template-tile'}
      {...rest}
    >
      {/* Capped only by the viewport, less the title bar, the footer and a margin. */}
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 'calc(100vh - 160px)' }}>
        <TemplateSearchField
          value={query}
          onChange={setQuery}
          categories={catalog.categories}
          categoryIds={categoryIds}
          onCategoryIdsChange={setCategoryIds}
          sx={{ width: '50%', minWidth: 'min(100%, 280px)' }}
        />
        <TemplatePanel
          catalog={catalog}
          filter={filter}
          emptyLabel={filter ? t('template.noMatches') : undefined}
          visibleRows={2}
          onSelect={handleSelect}
          sx={{ flex: '1 1 auto', overflow: 'auto' }}
        />
      </DialogContent>
      {showAtStartup !== undefined ?
        <DialogActions sx={{ justifyContent: 'flex-start', paddingX: 3, paddingY: 0.5 }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={showAtStartup} onChange={(e) => handleShowAtStartup(e.target.checked)}/>}
            label={<Typography variant="body2">{t('template.showAtStartup')}</Typography>}
          />
        </DialogActions>
      : null}
    </InternalWindow>
  );
}

export default TemplateDialog;
