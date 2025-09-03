import React from 'react';
import * as ReactJSXTransform from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom/client';
import * as ReactDOMClient from 'react-dom/client';
import * as StudioMUI from '@sheetxl/studio-mui';

export type * from './Types';

import type { InitializationOptions } from './Types';
import { doInitialize } from './Instance';

import type { ResolvedDependencies } from './_Types'; // Import the Runtime interface

let _resolved: ResolvedDependencies;

export const resolveDependencies = async (options: string | InitializationOptions): Promise<ResolvedDependencies> => {
  if (_resolved) return _resolved;
  // This is needed to prevent bundlers from treeshaking Studio away
  if (StudioMUI.Studio === undefined) {
    throw new Error('StudioMUI.Studio is undefined. Make sure @sheetxl/studio-mui is correctly installed.');
  }
  _resolved = await doInitialize(
    {
      React,
      ReactJSXTransform,
      ReactDOM,
      ReactDOMClient,
      StudioMUI
    },
    typeof options === 'object' ? (options as InitializationOptions): undefined
  );
  return _resolved;
}