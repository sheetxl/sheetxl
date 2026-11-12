import type React from 'react';
import { memo, forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { type SxProps, type Theme } from '@mui/system';
import { Box, Button, ButtonBase, Skeleton, Typography } from '@mui/material';

import { ReactUtils, DynamicIcon, RenderSlot, useTranslator } from '@sheetxl/utils-react';

import { useGridColorScheme } from '@sheetxl/react';

import { resolveCategoryColor } from './categoryColor';
import { type TemplateCatalog, type TemplateCategory, type TemplateEntry } from './useTemplateCatalog';

export interface TemplatePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** The catalog to show, from {@link useTemplateCatalog}. */
  catalog: TemplateCatalog;
  /** Called when a template is chosen. */
  onSelect?: (entry: TemplateEntry) => void;
  /** Show only the entries that pass. */
  filter?: (entry: TemplateEntry) => boolean;
  /**
   * Group the tiles under headings. Returns the group key for an entry; groups are shown in the
   * order of `categories` when the keys are category ids, else in first-seen order.
   */
  groupBy?: (entry: TemplateEntry) => string;
  /** Render a tile in place of the default one. */
  renderTile?: (props: TemplateTileRenderProps) => React.ReactNode;
  /**
   * The smallest tile width, in pixels.
   * @defaultValue 180
   */
  tileMinWidth?: number;
  /**
   * Shown when no entry passes the filter.
   * @defaultValue "No templates here yet."
   */
  emptyLabel?: string;
  /**
   * Hold the panel at this many rows of tiles however many pass the filter; the rest scroll. A host
   * short of room may shrink it, but not below one row.
   * Unset, the panel is as tall as its content.
   */
  visibleRows?: number;
  /** MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/} */
  sx?: SxProps<Theme>;
}

/** What the panel hands a tile. */
/** What {@link TemplatePanelProps.renderTile} is handed. */
export interface TemplateTileRenderProps extends TemplateTileProps {
  entry: TemplateEntry;
}

export interface TemplateTileProps {
  category?: TemplateCategory;
  onSelect: () => void;
}

/** The width:height of a thumbnail. */
const THUMBNAIL_RATIO = '8 / 5';
/** The space between tiles, in pixels. */
const TILE_GAP = 8;

/** The entry's thumbnail for the grid the template will open in: dark only when the dark grid is on. */
const Thumbnail = (props: { entry: TemplateEntry; category?: TemplateCategory }): React.ReactElement => {
  const { entry, category } = props;
  const gridScheme = useGridColorScheme();
  const src = (gridScheme === 'dark' ? entry.thumbnailDarkUrl : undefined) ?? entry.thumbnailUrl;
  return <ThumbnailImage key={src} src={src} category={category}/>;
};

const ThumbnailImage = (props: { src?: string; category?: TemplateCategory }): React.ReactElement => {
  const { src, category } = props;
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(src ? 'loading' : 'failed');
  return (
    <Box
      className="template-thumbnail"
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: THUMBNAIL_RATIO,
        overflow: 'hidden',
        borderRadius: 1,
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        background: (theme: Theme) => theme.palette.background.paper,
        transition: 'border-color 150ms, box-shadow 150ms',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* While loading, the empty frame: a pulse over an area this size reads as broken. */}
      {state === 'failed' ?
        <DynamicIcon iconKey="FileNew" style={{ fontSize: '2.5rem', opacity: 0.4 }}/>
      :
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top left',
            opacity: state === 'loaded' ? 1 : 0,
            transition: 'opacity 150ms ease-out'
          }}
        />
      }
      {/* The category's color along the top edge; the frame's own corners round it. */}
      {category?.color ?
        <Box
          sx={(theme: Theme) => ({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: resolveCategoryColor(category, theme)?.fill
          })}
        />
      : null}
    </Box>
  );
};

const DefaultTile = (props: TemplateTileRenderProps): React.ReactElement => {
  const { entry, category, onSelect } = props;
  return (
    <ButtonBase
      className="template-tile"
      disableRipple
      onClick={onSelect}
      aria-label={category ? `${entry.title}, ${category.title}` : entry.title}
      title={entry.description}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        gap: 0.75,
        padding: 1,
        borderRadius: 1,
        // The thumbnail answers the pointer, not the tile: a wash over a picture only greys it.
        '&:hover .template-thumbnail, &.Mui-focusVisible .template-thumbnail': {
          borderColor: (theme: Theme) => theme.palette.primary.main,
          boxShadow: 3
        },
        '&.Mui-focusVisible': {
          outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '-2px'
        }
      }}
    >
      <Thumbnail entry={entry} category={category}/>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" component="div" noWrap>{entry.title}</Typography>
        {category ?
          <Typography variant="caption" component="div" noWrap sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {category.color ?
              <Box
                component="span"
                sx={(theme: Theme) => ({
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  flex: 'none',
                  backgroundColor: resolveCategoryColor(category, theme)?.fill
                })}
              />
            : null}
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{category.title}</Box>
          </Typography>
        : null}
      </Box>
    </ButtonBase>
  );
};

const SkeletonTile = (): React.ReactElement => (
  <Box sx={{ padding: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
    <Skeleton variant="rectangular" sx={{ width: '100%', height: 'auto', aspectRatio: THUMBNAIL_RATIO, borderRadius: 1 }}/>
    <Skeleton variant="text" width="60%"/>
    <Skeleton variant="text" width="35%"/>
  </Box>
);

/**
 * A gallery of workbook templates.
 *
 * @remarks
 * Knows nothing about dialogs; a host decides what choosing a template does. Arrow keys move
 * between tiles and Enter opens one.
 */
export const TemplatePanel = memo(forwardRef<HTMLDivElement, TemplatePanelProps>(
  (props: TemplatePanelProps, refForwarded) => {
  const {
    catalog,
    onSelect,
    filter,
    groupBy,
    renderTile,
    tileMinWidth = 180,
    emptyLabel,
    visibleRows,
    sx: propSx = ReactUtils.EmptyCssProperties,
    style: propStyle,
    className: propClassName,
    onKeyDown: propOnKeyDown,
    ...rest
  } = props;

  const t = useTranslator();
  const refGrid = useRef<HTMLDivElement>(null);

  /* A tile's height follows its width (the thumbnail keeps its ratio), so it is measured, not
     computed. With nothing to measure — no matches, an error — the last height is kept, which is
     what holds the panel still while filtering. */
  const [tileHeight, setTileHeight] = useState<number>(0);
  const refMeasureTile = useRef<() => void>(null);
  refMeasureTile.current = (): void => {
    const first = refGrid.current?.querySelector('.template-grid')?.firstElementChild as HTMLElement | null;
    // A custom tile sits in a `display: contents` wrapper, which has no box of its own.
    const tile = first?.offsetHeight ? first : first?.firstElementChild as HTMLElement | null;
    // Fractional: a rounded-down height leaves the rows a hair taller than the panel, and it scrolls.
    const height = tile?.getBoundingClientRect().height;
    if (height) setTileHeight(height);
  };
  useLayoutEffect(() => {
    if (visibleRows) refMeasureTile.current?.();
  });
  useEffect(() => {
    const grid = refGrid.current;
    if (!visibleRows || !grid) return;
    const observer = new ResizeObserver(() => refMeasureTile.current?.());
    observer.observe(grid);
    return () => observer.disconnect();
  }, [visibleRows]);

  const categoriesById = useMemo(() => {
    return new Map(catalog.categories.map((category) => [category.id, category]));
  }, [catalog.categories]);

  const groups = useMemo<{ key: string | null; title?: string; entries: TemplateEntry[] }[]>(() => {
    const entries = filter ? catalog.entries.filter(filter) : catalog.entries;
    if (!groupBy) return [{ key: null, entries }];
    const byKey = new Map<string, TemplateEntry[]>();
    for (const category of catalog.categories) byKey.set(category.id, []);
    for (const entry of entries) {
      const key = groupBy(entry);
      let group = byKey.get(key);
      if (!group) byKey.set(key, group = []);
      group.push(entry);
    }
    return [...byKey].filter(([, list]) => list.length > 0).map(([key, list]) => ({
      key, title: categoriesById.get(key)?.title ?? key, entries: list
    }));
  }, [catalog.entries, catalog.categories, categoriesById, filter, groupBy]);

  /** Arrow-key movement across the tile grid, in reading order. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    propOnKeyDown?.(e);
    if (e.defaultPrevented) return;
    const container = refGrid.current;
    if (!container) return;
    const tiles = Array.from(container.querySelectorAll<HTMLElement>('.template-tile'));
    const index = tiles.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    // Columns: the tiles that share the first tile's row in the same group.
    const top = tiles[index].offsetTop;
    const rowStart = tiles.findIndex((tile) => tile.offsetTop === top && tile.parentElement === tiles[index].parentElement);
    let columns = 0;
    while (tiles[rowStart + columns]?.offsetTop === top) columns++;
    let next = index;
    switch (e.key) {
      case 'ArrowRight': next = index + 1; break;
      case 'ArrowLeft': next = index - 1; break;
      case 'ArrowDown': next = index + Math.max(1, columns); break;
      case 'ArrowUp': next = index - Math.max(1, columns); break;
      case 'Home': next = 0; break;
      case 'End': next = tiles.length - 1; break;
      default: return;
    }
    next = Math.max(0, Math.min(tiles.length - 1, next));
    e.preventDefault();
    tiles[next].focus();
  };

  const gridSx = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${tileMinWidth}px, 1fr))`,
    gap: `${TILE_GAP}px`
  };

  let content: React.ReactNode;
  if (catalog.status === 'loading') {
    content = (
      <Box className="template-grid" sx={gridSx} aria-busy="true" aria-label={t('template.loading')}>
        {Array.from({ length: 6 }, (_, i) => <SkeletonTile key={i}/>)}
      </Box>
    );
  } else if (catalog.status === 'error') {
    content = (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('template.loadFailed')}</Typography>
        <Button variant="outlined" size="small" onClick={catalog.retry}>{t('template.retry')}</Button>
      </Box>
    );
  } else if (groups.every((group) => group.entries.length === 0)) {
    content = (
      <Typography variant="body2" sx={{ color: 'text.secondary', padding: 4, textAlign: 'center' }}>
        {emptyLabel ?? t('template.empty')}
      </Typography>
    );
  } else {
    content = groups.map((group) => (
      <Box key={group.key ?? ''} role="group" aria-label={group.title}>
        {group.title ?
          <Typography variant="overline" component="div" sx={{ color: 'text.secondary', paddingX: 1 }}>{group.title}</Typography>
        : null}
        <Box className="template-grid" sx={gridSx}>
          {group.entries.map((entry) => {
            const tileProps: TemplateTileProps = {
              category: categoriesById.get(entry.category),
              onSelect: () => onSelect?.(entry)
            };
            return renderTile
              ? <Box key={entry.id} sx={{ display: 'contents' }}><RenderSlot render={renderTile} props={{ entry, ...tileProps }} /></Box>
              : <DefaultTile key={entry.id} entry={entry} {...tileProps}/>;
          })}
        </Box>
      </Box>
    ));
  }

  return (
    <Box
      ref={refForwarded}
      className={clsx(propClassName, 'template-panel')}
      sx={propSx}
      style={visibleRows && tileHeight ? {
        // Content-box: the rows are the height; the host's padding goes around them.
        boxSizing: 'content-box',
        // The tiles' height follows the width a scrollbar takes, so a bar that comes and goes resizes
        // the rows it was measured from, and the browser keeps it with nothing to scroll.
        scrollbarGutter: 'stable',
        height: `${Math.ceil(visibleRows * tileHeight + (visibleRows - 1) * TILE_GAP)}px`,
        minHeight: `${Math.ceil(tileHeight)}px`,
        ...propStyle
      } : propStyle}
      {...rest}
    >
      <Box ref={refGrid} onKeyDown={handleKeyDown}>
        {content}
      </Box>
    </Box>
  );
}));

TemplatePanel.displayName = 'TemplatePanel';
