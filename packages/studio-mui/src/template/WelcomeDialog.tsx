import React, { useCallback, useState } from 'react';

import {
  Box, Button, Checkbox, DialogContent, Divider, FormControlLabel, Link, Typography
} from '@mui/material';
import { type Theme } from '@mui/system';

import { VERSION } from '@sheetxl/sdk';

import { DynamicIcon, useTranslator } from '@sheetxl/utils-react';

import { InternalWindow, type InternalWindowProps } from '@sheetxl/utils-mui';

import { LogoTextNoPaddingIcon } from '@sheetxl/react';

import { TemplatePanel } from './TemplatePanel';
import { TemplateSearchField, useTemplateFilter } from './TemplateSearchField';
import { loadCatalog, useTemplateCatalog, type TemplateEntry } from './useTemplateCatalog';

/** Where "add yours" points. */
const TEMPLATES_REPO_URL = 'https://github.com/sheetxl/templates-workbook';
const DOCS_URL = 'https://www.sheetxl.com/docs';
const HOME_URL = 'https://www.sheetxl.com';

/** Too narrow for the rail beside a card: the dialog stacks into one column. */
const NARROW = '@container welcome (max-width: 500px)';

export interface WelcomeDialogProps extends InternalWindowProps {
  /** The catalog to show. Defaults to the published SheetXL templates. */
  templatePath?: string;
  /** Shown at the top of the rail. Defaults to the SheetXL logo. */
  logo?: React.ReactNode;
  /** Keep the blank workbook. */
  onBlank?: () => void;
  /** Open a workbook from the device. */
  onOpenFromDevice?: () => void;
  /** Open a workbook from a web address. Omit to hide the entry. */
  onOpenFromWeb?: () => void;
  /** Called when a template is chosen. */
  onSelectTemplate?: (entry: TemplateEntry) => void;
  /** Whether "Show at startup" is checked. Omit to hide the checkbox. */
  showAtStartup?: boolean;
  /** Called when "Show at startup" is toggled. */
  onShowAtStartupChange?: (show: boolean) => void;
}

const RailButton = (props: { icon: string; label: string; onClick?: () => void }): React.ReactElement => {
  const { icon, label, onClick } = props;
  return (
    <Button
      variant="text"
      color="inherit"
      onClick={onClick}
      startIcon={<DynamicIcon iconKey={icon}/>}
      sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 'normal', paddingX: 1.5 }}
    >
      {label}
    </Button>
  );
};

/**
 * The startup surface: a rail of ways to begin (blank, open) beside the template gallery.
 */
const WelcomeDialog: React.FC<WelcomeDialogProps> = (props: WelcomeDialogProps) => {
  const {
    title: propTitle,
    templatePath,
    logo,
    onBlank,
    onOpenFromDevice,
    onOpenFromWeb,
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

  return (
    <InternalWindow
      isModal={true}
      sx={{
        width: '960px',
        ...propSx
      }}
      title={propTitle ?? t('dialog.welcome.title')}
      {...rest}
    >
      {/* Capped only by the viewport (less the title bar and a margin): a fraction of it cut the
          two rows short on a laptop screen. The dialog's own width, not the viewport's, decides the
          layout: a studio may be embedded smaller than the window. */}
      <DialogContent
        dividers
        sx={{ display: 'flex', padding: 0, maxHeight: 'calc(100vh - 96px)', containerType: 'inline-size', containerName: 'welcome' }}
      >
        <Box
          sx={{
            display: 'flex',
            flex: '1 1 auto',
            minHeight: 0,
            minWidth: 0,
            // Too narrow for the rail beside a card: one column in reading order, where only the
            // gallery scrolls. The rail and the gallery step aside (`contents`) so their parts can be
            // ordered.
            [NARROW]: { flexDirection: 'column', flex: '0 0 100%' }
          }}
        >
          <Box
            component="nav"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              width: '220px',
              flex: 'none',
              padding: 2,
              // The studio's desktop surface, as the task panes sit on: the rail is chrome, the gallery is content.
              backgroundColor: 'var(--sxl-color-base-200)',
              borderRight: (theme: Theme) => `1px solid ${theme.palette.divider}`,
              [NARROW]: { display: 'contents' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, paddingX: 1.5, paddingBottom: 2, [NARROW]: { order: 1, padding: 2, paddingBottom: 1 } }}>
              {logo ??
                <Link href={HOME_URL} target="_blank" rel="noopener noreferrer" sx={{ display: 'flex' }}>
                  <LogoTextNoPaddingIcon role="img" aria-label="SheetXL" style={{ width: '120px', height: '33px' }}/>
                </Link>
              }
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, [NARROW]: { order: 2, paddingX: 1 } }}>
              <RailButton icon="FileNew" label={t('dialog.welcome.blank')} onClick={onBlank}/>
              {onOpenFromDevice ? <RailButton icon="FileOpen" label={t('dialog.welcome.openFromDevice')} onClick={onOpenFromDevice}/> : null}
              {onOpenFromWeb ? <RailButton icon="FileOpen" label={t('dialog.welcome.openFromWeb')} onClick={onOpenFromWeb}/> : null}
            </Box>
            <Box sx={{ flex: '1 1 auto', [NARROW]: { display: 'none' } }}/>
            <Divider sx={{ marginBottom: 1, [NARROW]: { display: 'none' } }}/>
            <Box
              sx={{
                display: 'flex', flexDirection: 'column', gap: 0.5, paddingX: 1.5,
                [NARROW]: {
                  order: 6, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, paddingX: 3, paddingY: 1.5,
                  borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`
                }
              }}
            >
              <Link variant="caption" href={DOCS_URL} target="_blank" rel="noopener noreferrer">{t('dialog.welcome.docs')}</Link>
              <Link variant="caption" href={TEMPLATES_REPO_URL} target="_blank" rel="noopener noreferrer">{t('dialog.welcome.addTemplate')}</Link>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('dialog.welcome.version', { version: VERSION })}</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', [NARROW]: { display: 'contents' } }}>
            <Box sx={{ display: 'flex', paddingX: 3, paddingTop: 2, paddingBottom: 2, [NARROW]: { order: 3 } }}>
              {/* Half the gallery, so chips have room; the whole of it once that is too narrow to type in. */}
              <TemplateSearchField
                value={query}
                onChange={setQuery}
                categories={catalog.categories}
                categoryIds={categoryIds}
                onCategoryIdsChange={setCategoryIds}
                sx={{ flex: '0 1 50%', minWidth: 'min(100%, 280px)', [NARROW]: { flex: '1 1 100%' } }}
              />
            </Box>
            <TemplatePanel
              role="region"
              aria-label={t('dialog.welcome.templates')}
              catalog={catalog}
              onSelect={onSelectTemplate}
              filter={filter}
              emptyLabel={filter ? t('template.noMatches') : undefined}
              visibleRows={2}
              sx={{
                flex: '1 1 auto', overflow: 'auto', paddingX: 2, paddingBottom: 2,
                // Gives up height before anything around it does, down to its one-row minimum.
                [NARROW]: { order: 4, flex: '0 1 auto' }
              }}
            />
            {showAtStartup !== undefined ?
              <Box sx={{ flex: 'none', paddingX: 3, paddingY: 0.5, borderTop: (theme: Theme) => `1px solid ${theme.palette.divider}`, [NARROW]: { order: 5 } }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={showAtStartup} onChange={(e) => handleShowAtStartup(e.target.checked)}/>}
                  label={<Typography variant="body2">{t('template.showAtStartup')}</Typography>}
                />
              </Box>
            : null}
          </Box>
        </Box>
      </DialogContent>
    </InternalWindow>
  );
}

/** @internal Fetch the catalog the dialog will show, ahead of showing it. */
export const prefetchCatalog = (templatePath?: string): void => {
  loadCatalog(templatePath).catch(() => { /* the dialog reports it, and retries */ });
};

export default WelcomeDialog;
