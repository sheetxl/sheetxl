import { type ResourceEntry, listResources, releaseChannel } from '@sheetxl/utils';
import { VERSION } from '@sheetxl/sdk';

const channel = releaseChannel(VERSION);

/**
 * Where the script templates are read from when no `scriptPath` is given: the published
 * `@sheetxl/templates-scripting` for this build's release channel.
 */
export const DEFAULT_SCRIPT_PATH = `https://unpkg.com/@sheetxl/templates-scripting${channel ? `@${channel}` : ''}/dist`;

/** The resource kind and package a catalog is listed under: `<path>/templates-scripting/contents.json`. */
const TEMPLATE_KIND = 'templates';
const TEMPLATE_PACKAGE = 'templates-scripting';

/** The catalog schema this build understands. A catalog with another major version is not shown. */
const TEMPLATE_SCHEMA = 1;

/** How a script template runs, which is also the icon it shows. */
export type ScriptTemplateIcon = 'formula' | 'macro' | 'autostart';

/** One script template, with its source loaded. */
export interface ScriptTemplate {
  /** The template's path within the catalog (`add.ts`), or `null` for the blank template. */
  path: string | null;
  /** The display title. */
  title: string;
  summary?: string;
  icon?: ScriptTemplateIcon;
  /** The script source. */
  content: string;
}

const ICONS: readonly string[] = ['formula', 'macro', 'autostart'];

const asString = (value: unknown): string | undefined => typeof value === 'string' && value ? value : undefined;

/** A title for an entry the catalog did not title: `autoFillDown.ts` → `Auto Fill Down`, a formula `add.ts` → `ADD`. */
const toTitle = (path: string, icon?: ScriptTemplateIcon): string => {
  const name = (path.split('/').pop() ?? '').replace(/\.[^/.]+$/, '');
  if (icon === 'formula') return name.toUpperCase();
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/** An absolute URL for a catalog file. */
const resolveUrl = (base: string, relPath: string): string => {
  const url = `${base}${base.endsWith('/') ? '' : '/'}${TEMPLATE_PACKAGE}/${relPath}`;
  return typeof document === 'undefined' ? url : new URL(url, document.baseURI).href;
};

const loadTemplate = async (base: string, raw: ResourceEntry): Promise<ScriptTemplate | null> => {
  if (!/\.ts$/i.test(raw.path)) return null;
  const icon = ICONS.includes(raw.icon as string) ? raw.icon as ScriptTemplateIcon : undefined;
  const url = resolveUrl(base, raw.path);
  let content: string;
  try {
    const response = await fetch(url);
    // A single-page host answers an unknown path with its index page rather than a 404.
    if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) {
      throw new Error(response.ok ? 'not found' : response.statusText || String(response.status));
    }
    content = await response.text();
  } catch (error: any) {
    console.warn(`Script template '${url}' did not load: ${error?.message ?? error}`);
    return null;
  }
  return {
    path: raw.path,
    title: asString(raw.title) ?? toTitle(raw.path, icon),
    summary: asString(raw.summary),
    icon,
    content
  };
};

/** One load per catalog path for the session; a failed load is dropped so the next call tries again. */
const _catalogs = new Map<string, Promise<ScriptTemplate[]>>();

/**
 * Load the script templates at `path`, sources included, in the catalog's order.
 *
 * @remarks
 * Loaded once per `path` and shared by every caller. A template whose source does not load is left
 * out; a catalog that cannot be found rejects.
 */
export const loadScriptTemplates = (path: string = DEFAULT_SCRIPT_PATH): Promise<ScriptTemplate[]> => {
  let cached = _catalogs.get(path);
  if (!cached) {
    cached = (async (): Promise<ScriptTemplate[]> => {
      const found = await listResources(TEMPLATE_KIND, TEMPLATE_PACKAGE, path);
      // Only a generated catalog carries `meta.schema`. A root with no `contents.json` still answers
      // with a bare file scan, which has no titles and whose files are not relative to `path`.
      const index = found.find((candidate) => candidate.meta?.schema !== undefined);
      if (!index) throw new Error(`No script templates found at '${path}'.`);
      const schema = Math.floor(Number(index.meta?.schema));
      if (schema !== TEMPLATE_SCHEMA) {
        console.warn(`Script template catalog at '${path}' has schema ${index.meta?.schema}; expected ${TEMPLATE_SCHEMA}.`);
        return [];
      }
      const loaded = await Promise.all(index.entries.map((raw) => loadTemplate(path, raw)));
      return loaded.filter((template): template is ScriptTemplate => template !== null);
    })();
    _catalogs.set(path, cached);
    cached.catch(() => { _catalogs.delete(path); });
  }
  return cached;
};
