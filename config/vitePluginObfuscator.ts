import { type Plugin, mergeConfig } from 'vite';

import { createFilter } from '@rollup/pluginutils';

import ObfPackages from 'javascript-obfuscator';

const defaultOptions = {
  // global: false,
  // options: {},
  exclude: ['node_modules/**'],
  obfuscate: ObfPackages.obfuscate,
  global: false,
  // NOTE: `include` (which files get obfuscated) is intentionally NOT declared here. This file is
  // part of the shared `config/` dir that is copied to the PUBLIC repo, so a file list would be a
  // source-level roadmap to the private license code. The list is supplied as `policy` by the
  // consuming package's (private) vite.config.ts via `createLibraryConfig({ obfuscate: [...] })`.
  // Only the generic strength options below live here — the technique itself is not a secret.
  options: {
    // https://github.com/javascript-obfuscator/javascript-obfuscator#javascript-obfuscator-options
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 5,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 5,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 1
  }
};

export function obfuscator(override?: any): Plugin {
  const options = mergeConfig(defaultOptions, override);

  // Guard: @rollup/pluginutils `createFilter` treats a missing/empty `include` as "match everything".
  // Obfuscating an entire bundle is never intended here (and would be enormous), so require an explicit,
  // non-empty include list; without one the plugin is an inert no-op rather than a bundle-wide transform.
  const include = Array.isArray(options.include) ? options.include.filter(Boolean) : options.include;
  const enabled = Array.isArray(include) ? include.length > 0 : !!include;
  const filter = enabled ? createFilter(include, options.exclude) : () => false;

  return {
    name: 'vite-plugin-obfuscator',
    apply: 'build', // Only apply during build, not dev

    transform: options.global ? undefined : function (code, id) {
      if (!filter(id)) return null;

      if (options?.options?.log) {
        this.info(`transform ${id}`);
      }

      const obfuscationResult = options.obfuscate(code, {
        ...options.options,
        inputFileName: id,
        sourceMap: true,
      });

      return {
        code: obfuscationResult.getObfuscatedCode(),
        map: obfuscationResult.getSourceMap(),
      };
    },

    renderChunk: !options.global ? undefined : function (code, chunk) {
      if (!filter(chunk.fileName)) return null;
      if (options?.options?.log) {
        console.log('renderChunk', chunk.fileName);
      }
      const obfuscationResult = options.obfuscate(code, {
        ...options.options,
        inputFileName: chunk.fileName,
        sourceMap: true,
      });

      return {
        code: obfuscationResult.getObfuscatedCode(),
        map: obfuscationResult.getSourceMap(),
      };
    }
  };
}