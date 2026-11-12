/**
 * Guards the node/ambient-types boundary.
 *
 * tsconfig.base.json sets `"types": []`, so a program's ambient surface is only what it asks for:
 * `"types": ["node"]` in a tsconfig (cli / runner / mcp - node programs), or a first-party
 * `/// <reference types="node" />` in a file that really is node-only (the `*.node.ts` variants and
 * build-time plugin code). What that does NOT stop is a DEPENDENCY's d.ts pulling node types in -
 * `@types/papaparse` and `vite` both carry `/// <reference types="node" />`, and TypeScript honors it
 * program-wide. Code can then compile against `Buffer` / `process` / `fs` purely because a transitive
 * `@types` package happened to be installed, and break the moment a package without that dependency
 * compiles the same source (which is exactly how io-xlsx started failing on sdk's crypto module).
 *
 * This re-type-checks every package with dependency-injected node types blocked. Anything that still
 * needs them has to say so itself.
 *
 * Usage: node scripts/check-ambient-types.mjs [package ...]
 */
import { dirname, resolve } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const formatHost = {
  getCurrentDirectory: () => ROOT,
  getCanonicalFileName: f => f,
  getNewLine: () => ts.sys.newLine,
};

/** A compiler host that ignores `/// <reference types="node" />` written inside node_modules. */
function createBlockingHost(options) {
  const host = ts.createCompilerHost(options, true);
  host.resolveTypeReferenceDirectiveReferences = (names, containingFile, redirect, opts, containingSourceFile) => {
    const fromDependency = !!containingSourceFile && containingSourceFile.fileName.includes('/node_modules/');
    return names.map(n => {
      const name = typeof n === 'string' ? n : n.fileName;
      const mode = typeof n === 'string' ? undefined : n.resolutionMode;
      if (name === 'node' && fromDependency) return { resolvedTypeReferenceDirective: undefined };
      return ts.resolveTypeReferenceDirective(name, containingFile, opts, host, redirect, undefined, mode);
    });
  };
  return host;
}

let failed = 0;
for (const pkg of readdirSync(`${ROOT}/packages`).filter(p => !only.length || only.includes(p))) {
  const cfgPath = `${ROOT}/packages/${pkg}/tsconfig.build.json`;
  if (!existsSync(cfgPath)) continue;

  const parsed = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, {
    ...ts.sys,
    getCurrentDirectory: () => dirname(cfgPath),
    onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, ' ')); },
  });
  const options = { ...parsed.options, noEmit: true };
  const program = ts.createProgram({ rootNames: parsed.fileNames, options, host: createBlockingHost(options) });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    failed++;
    console.log(`\n✗ ${pkg} — ${diagnostics.length} error(s) once dependency-supplied node types are removed:`);
    console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics.slice(0, 20), formatHost));
    if (diagnostics.length > 20) console.log(`  ... ${diagnostics.length - 20} more`);
  } else {
    console.log(`✓ ${pkg}`);
  }
}

if (failed) {
  console.log(
    `\n${failed} package(s) depend on node types they never declared. Either the code belongs in a ` +
    `\`*.node.ts\` variant (which declares \`/// <reference types="node" />\`), or it should use the ` +
    `web-standard API instead.`
  );
  process.exit(1);
}
console.log('\nAmbient node types are declared, not inherited.');
