/**
 * Dynamic cdn
 */

import {
  type ISheetXL, type InitializationOptions, type Attached
} from './Types'; // Import the interface

import { type IStudioElement, type StudioProps } from './Types'; // Import the interface

import { doAttach, doInitialize } from './Instance';
import { showLoadingPanel, showErrorPanel, hidePanel } from './Panels';

import { type ResolvedDependencies } from './_Types';

let _resolved: ResolvedDependencies;

const _initialize = async (options: string | InitializationOptions): Promise<ResolvedDependencies> => {
  if (_resolved) return _resolved;
  const asOptions: InitializationOptions | undefined = typeof options === 'string' ? { selector: options } : options;
  // The resolver and its chunks (React, studio-mui) are the bulk of the download, so the panel
  // has to be up before the first import or it only appears once everything has arrived.
  if (asOptions?.selector) {
    showLoadingPanel(asOptions.selector, asOptions.loading);
  }
  try {
    const { resolveDependencies } = await import('./DynamicResolver');
    const runtime = await resolveDependencies(asOptions?.dependencies);
    _resolved = await doInitialize(runtime, asOptions);
  } catch (error: any) {
    if (asOptions?.selector) {
      hidePanel(asOptions.selector);
      showErrorPanel(asOptions.selector, {
        message: `Failed to load: ${error instanceof Error ? error.message : String(error)}`,
        ...asOptions.error
      });
    }
    throw error;
  }
  return _resolved;
}

const SheetXLModule: ISheetXL = {
  async attachStudio(selector: string | InitializationOptions, props?: StudioProps): Promise<IStudioElement & Attached<StudioProps>> {
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
  const selector = scriptTag.dataset?.target ?? `#sheetxl`;
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

// Both spellings are public: the CDN loader reads `module.SheetXL` (loader.ts) and copy-pasted
// integrations such as demo-cdn read `module.default`. Dropping either breaks deployed pages.
const SheetXL = SheetXLModule;
export { SheetXL };
export default SheetXL;