import { useCallback, useEffect, useState } from 'react';

import { type ResourceIndex, listResources, releaseChannel } from '@sheetxl/utils';
import { VERSION } from '@sheetxl/sdk';

const channel = releaseChannel(VERSION);

/**
 * Where the template catalog is read from when no `templatePath` is given: the published
 * `@sheetxl/templates-workbook` for this build's release channel.
 */
export const DEFAULT_TEMPLATE_PATH = `https://unpkg.com/@sheetxl/templates-workbook${channel ? `@${channel}` : ''}/dist`;

/** The resource kind and package a catalog is listed under: `<path>/templates-workbook/contents.json`. */
const TEMPLATE_KIND = 'templates';
const TEMPLATE_PACKAGE = 'templates-workbook';

/** The catalog schema this build understands. A catalog with another major version is not shown. */
const TEMPLATE_SCHEMA = 1;

/** A group of templates. Each category is a folder in the catalog. */
export interface TemplateCategory {
  /** The folder name. Entries refer to their category by this id. */
  id: string;
  /** The display title. */
  title: string;
  description?: string;
  icon?: string;
  /** A CSS color for the light theme. The dark theme shows it inverted. */
  color?: string;
}

/** One template in a catalog. */
export interface TemplateEntry {
  /** The template's path within the catalog (`finance/invoice.xlsx`). Stable across renames of its title. */
  id: string;
  /** The display title. Also used as the name of the opened workbook. */
  title: string;
  /** The id of the {@link TemplateCategory} it belongs to. */
  category: string;
  description?: string;
  tags?: string[];
  /** A preview image, when the catalog has one. */
  thumbnailUrl?: string;
  /** The preview on the dark grid, when the catalog has one. */
  thumbnailDarkUrl?: string;
  /** The workbook to open. */
  sourceUrl: string;
}

/** The loaded state of a template catalog. */
export interface TemplateCatalog {
  status: 'loading' | 'ready' | 'error';
  /** The categories, in the catalog's display order. */
  categories: TemplateCategory[];
  entries: TemplateEntry[];
  error?: unknown;
  /** Fetch the catalog again, for use after an error. */
  retry: () => void;
}

export interface TemplateCatalogOptions {
  /**
   * The catalog to read: a URL that serves `templates-workbook/contents.json`. Use it to pin a
   * version (`https://unpkg.com/@sheetxl/templates-workbook@1.4.0/dist`) or to serve your own.
   * @defaultValue {@link DEFAULT_TEMPLATE_PATH}
   */
  path?: string;
}

type LoadedCatalog = Pick<TemplateCatalog, 'categories' | 'entries'>;

/** Title-case a file or folder name: `project-management` → `Project Management`. */
const toTitle = (name: string): string => {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * An absolute URL for a catalog asset. Absolute because a template may be opened in a new window
 * through `?source`, which a relative catalog path would not survive.
 */
const resolveUrl = (base: string, relPath: string): string => {
  const url = `${base}${base.endsWith('/') ? '' : '/'}${TEMPLATE_PACKAGE}/${relPath}`;
  return typeof document === 'undefined' ? url : new URL(url, document.baseURI).href;
};

const asString = (value: unknown): string | undefined => typeof value === 'string' && value ? value : undefined;

/**
 * Map a catalog's resource index to categories and entries, with asset URLs resolved against
 * `path`. Exported for tests.
 *
 * @internal
 */
export const toTemplateCatalog = (index: ResourceIndex, path: string): LoadedCatalog => {
  const metaCategories = Array.isArray(index.meta?.categories) ? index.meta.categories as Record<string, unknown>[] : [];
  const categories: TemplateCategory[] = [];
  const known = new Set<string>();
  for (const raw of metaCategories) {
    const id = asString(raw?.id);
    if (!id || known.has(id)) continue;
    known.add(id);
    categories.push({
      id,
      title: asString(raw.title) ?? toTitle(id),
      description: asString(raw.description),
      icon: asString(raw.icon),
      color: asString(raw.color)
    });
  }

  const entries: TemplateEntry[] = [];
  for (const raw of index.entries) {
    const path_ = raw.path;
    const segments = path_.split('/');
    // A template sits in exactly one category folder. Anything else (sidecars, thumbnails, stray
    // files at the root) is not a template.
    if (segments.length !== 2 || !/\.(?:xlsx|sxl|csv)$/i.test(path_)) continue;
    const category = asString(raw.category) ?? segments[0];
    if (!known.has(category)) {
      known.add(category);
      categories.push({ id: category, title: toTitle(category) });
    }
    const thumbnail = asString(raw.thumbnail);
    const thumbnailDark = asString(raw.thumbnailDark);
    entries.push({
      id: path_,
      title: asString(raw.title) ?? toTitle(segments[1]),
      category,
      description: asString(raw.description),
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : undefined,
      thumbnailUrl: thumbnail ? resolveUrl(path, thumbnail) : undefined,
      thumbnailDarkUrl: thumbnailDark ? resolveUrl(path, thumbnailDark) : undefined,
      sourceUrl: resolveUrl(path, path_)
    });
  }
  return { categories, entries };
};

/** One fetch per catalog path for the session; a failed fetch is dropped so `retry` fetches again. */
const _catalogs = new Map<string, Promise<LoadedCatalog>>();

/** @internal Fetch a catalog ahead of the gallery that shows it. Shared with {@link useTemplateCatalog}. */
export const loadCatalog = (path: string = DEFAULT_TEMPLATE_PATH): Promise<LoadedCatalog> => {
  let cached = _catalogs.get(path);
  if (!cached) {
    cached = (async (): Promise<LoadedCatalog> => {
      const found = await listResources(TEMPLATE_KIND, TEMPLATE_PACKAGE, path);
      // Only a generated catalog carries `meta.schema`. A root with no `contents.json` still answers
      // with a bare file scan, which has no categories and whose files are not relative to `path`.
      const index = found.find((candidate) => candidate.meta?.schema !== undefined);
      if (!index) throw new Error(`No template catalog found at '${path}'.`);
      const schema = Math.floor(Number(index.meta?.schema));
      if (schema !== TEMPLATE_SCHEMA) {
        console.warn(`Template catalog at '${path}' has schema ${index.meta?.schema}; expected ${TEMPLATE_SCHEMA}.`);
        return { categories: [], entries: [] };
      }
      return toTemplateCatalog(index, path);
    })();
    _catalogs.set(path, cached);
    cached.catch(() => { _catalogs.delete(path); });
  }
  return cached;
};

/**
 * Load a workbook template catalog.
 *
 * @remarks
 * The catalog is fetched once per `path` and shared by every caller.
 */
export const useTemplateCatalog = (options: TemplateCatalogOptions = {}): TemplateCatalog => {
  const { path = DEFAULT_TEMPLATE_PATH } = options;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<Omit<TemplateCatalog, 'retry'>>({ status: 'loading', categories: [], entries: [] });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => prev.status === 'loading' ? prev : { status: 'loading', categories: [], entries: [] });
    loadCatalog(path).then(
      (loaded) => { if (!cancelled) setState({ status: 'ready', ...loaded }); },
      (error: unknown) => { if (!cancelled) setState({ status: 'error', categories: [], entries: [], error }); }
    );
    return () => { cancelled = true; };
  }, [path, nonce]);

  const retry = useCallback((): void => { setNonce((n) => n + 1); }, []);
  return { ...state, retry };
};
