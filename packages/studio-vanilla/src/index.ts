/**
 * Bundled vanilla
 */

export * from './Types';

import type { ISheetXL, InitializationOptions, Attached } from './Types';
import { doAttach } from './Instance';

import type { StudioElement, StudioProps } from './Types';
import type { ResolvedDependencies } from './_Types'; // Import the Runtime interface

import { resolveDependencies } from './StaticResolver';

let _resolved: ResolvedDependencies;

const _initialize = async (options: string | InitializationOptions): Promise<ResolvedDependencies> => {
  if (_resolved) return _resolved;
  const deps = await resolveDependencies(options);
  return deps;
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

const SheetXL = SheetXLModule;
export { SheetXL };
export default SheetXL;