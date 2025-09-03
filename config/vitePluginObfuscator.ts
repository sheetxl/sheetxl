import { type Plugin, mergeConfig } from 'vite';

import { createFilter } from '@rollup/pluginutils';

import ObfPackages from 'javascript-obfuscator';

const defaultOptions = {
  // global: false,
  // options: {},
  // include: ['**/*.js', '**/*.ts'],
  exclude: ['node_modules/**'],
  obfuscate: ObfPackages.obfuscate,
  global: false,
  include: ['**/license/LicenseManager.ts'],
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

  const filter = createFilter(options.include, options.exclude);

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