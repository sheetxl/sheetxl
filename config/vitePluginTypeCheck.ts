import { resolve } from 'path';

import { type Plugin } from 'vite';

import ts from 'typescript';

export function typeCheck(tsconfigRelPath: string='tsconfig.build.json'): Plugin {
  return {
    name: 'vite-plugin-typecheck',
    apply: 'build',
    enforce: 'pre', // Run before other plugins
    configResolved(config) {
      const dir = config.root || process.cwd(); // fallback if undefined
      runTypeCheck(resolve(dir, tsconfigRelPath));
    }
  };
}

function runTypeCheck(tsconfigPath: string): void {
  const fullConfigPath = ts.findConfigFile(tsconfigPath, ts.sys.fileExists, 'tsconfig.build.json');
  if (!fullConfigPath) throw new Error('Could not find a valid tsconfig.json.');

  // Use getParsedCommandLineOfConfigFile to handle extends correctly
  const parsed = ts.getParsedCommandLineOfConfigFile(
    fullConfigPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diag) => {
        throw new Error('Unrecoverable TypeScript config error');
      },
    }
  );

  if (!parsed) {
    throw new Error(`Failed to parse TypeScript config at ${fullConfigPath}`);
  }

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost);
    throw new Error(`❌ TypeScript type check failed with ${diagnostics.length} error(s)L\n${formatted}`);
  }
}

const formatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  getCanonicalFileName: f => f,
  getNewLine: () => ts.sys.newLine,
};