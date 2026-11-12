export * from './StudioProps';
export * from './Studio';
export * from './useStudioApp';

// EagerStudio is intentionally NOT re-exported here. It is loaded on demand via Studio.tsx's
// `import('./EagerStudio')`; re-exporting it from this (entry) barrel pulls it into the entry chunk
// and defeats that lazy split (rolldown: INEFFECTIVE_DYNAMIC_IMPORT). Keep the heavy workbook code in
// its own async chunk. If direct/non-lazy access is ever needed, expose it via a dedicated subpath
// export rather than the main entry.