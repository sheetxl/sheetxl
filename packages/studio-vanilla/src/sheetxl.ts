/**
 * Dynamic cdn
 */

import type {
  ISheetXL, InitializationOptions, Attached
} from './Types'; // Import the interface

import type { StudioElement, StudioProps } from './Types'; // Import the interface

import { doAttach, doInitialize } from './Instance';

import { ResolvedDependencies } from './_Types';

let _resolved: ResolvedDependencies;

const _initialize = async (options: string | InitializationOptions): Promise<ResolvedDependencies> => {
  if (_resolved) return _resolved;
  const { resolveDependencies } = await import('./DynamicResolver');
  const runtime = await resolveDependencies(typeof options === 'object' ? options?.dependencies : undefined);
  _resolved = await doInitialize(runtime, options);
  return _resolved;
}

const SheetXLModule: ISheetXL = {
  async attachStudio(selector: string | InitializationOptions, props?: StudioProps): Promise<StudioElement & Attached<StudioProps>> {
    if (!_resolved) {
      _resolved = await _initialize(selector);
    }
    return doAttach(_resolved, selector, 'Studio', props);
  },

  async initialize(options: InitializationOptions): Promise<void> {
    await _initialize(options);
    return;
  }
};

const scriptTag = document.currentScript;
// we are self-initializing script
if (scriptTag) {
  // console.log('SheetXL script tag:', scriptTag);
  // 2. Get the CSS selector from the 'data-target' attribute
  const selector = scriptTag.dataset ? scriptTag.dataset.target : `#sheetxl`;
  const targetElement = document.querySelector(selector);
  if (!targetElement) {
    console.error(`SheetXL: Target element "${selector}" not found in the document.`);
  }
  SheetXLModule.attachStudio(selector, { autoFocus: true })
    .then((studio) => {
      // console.log('SheetXL studio created and attached:', studio);
    })
    .catch((error) => {
      console.error('Error creating SheetXL studio:', error);
    });
}

const SheetXL = SheetXLModule;
export { SheetXL };
/**
 * SheetXL entry point as a default module export.
 */
export default SheetXL;