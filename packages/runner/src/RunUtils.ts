import path from 'node:path';

/**
 * Resolve a file path against an optional env-variable base directory.
 *
 * Resolution order:
 *   1. Absolute path → returned as-is.
 *   2. Relative path + env var set → resolved against `process.env[envVar]`.
 *   3. Relative path, no env var → resolved against CWD.
 *
 * No existence checks are performed — this mirrors `path.resolve` semantics.
 * The caller is responsible for handling missing files or non-existent directories.
 */
export function resolvePath(raw: string, envVar: string = 'SHEETXL_IN'): string {
  if (path.isAbsolute(raw)) return raw;
  const envDir = envVar ? process.env[envVar] : undefined;
  return path.resolve(envDir ?? process.cwd(), raw);
}
