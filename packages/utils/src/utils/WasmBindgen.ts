import { base64ToArrayBuffer } from './BufferUtils';

/**
 * The shape of a `wasm-bindgen --target web` glue module: a default `init` and `initSync`, then the
 * exports the binding declares.
 */
export interface WasmBindgenGlue {
  default(input: { module_or_path: ArrayBuffer }): Promise<unknown>;
  initSync(input: { module: ArrayBuffer }): unknown;
}

/** The exports of a glue module, without its initializers. */
export type WasmBindgenExports<G extends WasmBindgenGlue> = Omit<G, 'default' | 'initSync'>;

/**
 * Instantiates a `wasm-bindgen --target web` module from its binary carried as base64, and returns
 * the glue's exports, ready to call.
 *
 * @param glue The glue module, `import * as glue from './<name>.js'`.
 * @param wasmBase64 The `<name>_bg.wasm` bytes as base64, the default export of the module
 * `scripts/build-wasm.mjs` writes beside the glue.
 *
 * @remarks
 * Each package that ships a binding keeps a module of its own that does nothing but import its
 * glue and its base64 and call this: a bundler makes a lazy chunk only from a literal `import()`
 * path, so those two imports cannot live here. The bytes are decoded rather than fetched as a
 * `data:` URL, which a Content Security Policy may forbid and Node's `fetch` cannot read.
 *
 * @example
 * ```ts
 * import * as glue from '../.generated/wasm/sdk.js';
 * import wasmBase64 from '../.generated/wasm/sdk_bg.inline.js';
 * export const wasm = await instantiateWasmBindgen(glue, wasmBase64);
 * ```
 */
export async function instantiateWasmBindgen<G extends WasmBindgenGlue>(
  glue: G,
  wasmBase64: string
): Promise<WasmBindgenExports<G>> {
  await glue.default({ module_or_path: base64ToArrayBuffer(wasmBase64) });
  return glue;
}

/**
 * {@link instantiateWasmBindgen} without the wait: compiles and instantiates on the calling
 * thread and returns the exports at once.
 *
 * @remarks
 * For Node and workers, where a module can be ready before anything synchronous runs. A browser's
 * main thread refuses a synchronous compile of more than a few kilobytes, so there the async form
 * is the only one.
 */
export function instantiateWasmBindgenSync<G extends WasmBindgenGlue>(
  glue: G,
  wasmBase64: string
): WasmBindgenExports<G> {
  glue.initSync({ module: base64ToArrayBuffer(wasmBase64) });
  return glue;
}
