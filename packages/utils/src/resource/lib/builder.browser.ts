/**
 * Browser twin of the resource builder: every entry point that touches a filesystem throws.
 *
 * Writing a `contents.json` means scanning a directory and writing a file — neither of which exists
 * in a browser. Rather than ship a silently-degraded no-op (which would produce an empty listing and
 * a confusing "resource not found" much later), this fails loudly at the call.
 *
 * The read side has no such restriction: the `#resource` twins work on both platforms. Only BUILDING a
 * listing is node-only, and it is a build/CLI concern, so nothing in app code should reach this file.
 * If a bundle pulls it in, that import is the bug.
 *
 * Signatures MATCH the node twin exactly — the type is the contract, the platform is enforced at
 * runtime. Typing these as `never` would make a shared caller fail to compile depending on which
 * export condition happened to resolve, which is a build accident, not a real error. The one pure
 * function (`rootIndexFromPaths`) needs no platform and is the shared implementation, re-exported.
 */
import {
  type ResourceIndex, type ResourceRootIndex,
  type ResourceFileType, type ResourceKindDefinition
} from '../Types';
import { CONTENTS_FILE, rootIndexFromPaths } from '../Resource';

const unavailable = (fn: string): never => {
  throw new Error(
    `${fn} is not available in the browser: building a '${CONTENTS_FILE}' requires scanning a `
    + `directory and writing a file. Generate it at build time (ResourcesPlugin) or with the CLI, `
    + `and serve the result. Reading resources works on both platforms.`
  );
};

/** The directory resources live under when the container holds non-resource content too. */
export const RESOURCE_DIR = 'resources';

// Pure string functions — no platform, so they are the real implementation on both twins rather than
// a throwing stub. A browser host composing a served resource path is a legitimate thing to do.

/** The resource ROOT inside a container that holds non-resource content too. */
export function resourceRootIn(baseDir: string): string {
  return `${baseDir.replace(/[/\\]+$/, '')}/${RESOURCE_DIR}`;
}

/** Whether a file name is a generated listing — the one file a resource directory owns about itself. */
export function isResourceIndex(fileName: string): boolean {
  return fileName === CONTENTS_FILE;
}

export function registerResourceKind(_kind: string): void {
  unavailable('registerResourceKind');
}

export function registerResourceFileType(_kind: string, _type: ResourceFileType): void {
  unavailable('registerResourceFileType');
}

export function registerResourceKinds(_definitions: readonly ResourceKindDefinition[]): void {
  unavailable('registerResourceKinds');
}

export function resourceKinds(): string[] {
  return unavailable('resourceKinds');
}

export function resourceFileType(_fileName: string): { kind: string; type: ResourceFileType } | null {
  return unavailable('resourceFileType');
}

export function walkResourceFiles(_dir: string, _rel?: string): Promise<string[]> {
  return unavailable('walkResourceFiles');
}

export function buildResourceIndex(_kind: string, _pkgName: string, _dir: string): Promise<ResourceIndex> {
  return unavailable('buildResourceIndex');
}

export function writeResourceIndex(_kind: string, _pkgName: string, _dir: string): Promise<ResourceIndex> {
  return unavailable('writeResourceIndex');
}

export function buildRootIndex(_dir: string): Promise<ResourceRootIndex> {
  return unavailable('buildRootIndex');
}

export function writeRootIndex(_dir: string): Promise<ResourceRootIndex> {
  return unavailable('writeRootIndex');
}

export function classifyResource(_fileName: string): string | null {
  return unavailable('classifyResource');
}

export function placeResource(_fileName: string, _location: string | undefined): string | null {
  return unavailable('placeResource');
}

export interface StageResourcesOptions {
  outDir: string;
  projectRoot?: string;
  filter?: (pkgName: string) => boolean;
  clean?: boolean;
}
export interface StageResourcesResult {
  packages: string[];
  files: number;
}
export function stageResources(_options: StageResourcesOptions): Promise<StageResourcesResult> {
  return unavailable('stageResources');
}

export { CONTENTS_FILE, rootIndexFromPaths };
export type {
  ResourceEntry, ResourceIndex, ResourceRootIndex,
  ResourceFileContext, ResourceFileType, ResourceKindDefinition
} from '../Types';
