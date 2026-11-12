/**
 * The npm dist-tag a SheetXL build reads its published companion packages from (the workbook and
 * script templates).
 *
 * @remarks
 * A prerelease build (`0.8.0-beta.6`) reads the dist-tag named by its prerelease id (`beta`). A stable
 * build reads `latest`, returned as `undefined` so the URL carries no tag. A local build is
 * development, so it reads the newest packages, on `beta`.
 *
 * @param version The build's version, `VERSION` from `@sheetxl/sdk`.
 */
export function releaseChannel(version: string): string | undefined {
  if (version === 'local') return 'beta';
  return /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version)?.[1];
}
