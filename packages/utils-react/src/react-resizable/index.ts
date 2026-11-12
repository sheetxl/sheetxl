/**
 * Vendored from `react-resizable` (https://github.com/react-grid-layout/react-resizable).
 * MIT License — Copyright (c) 2016-2018 Samuel Reed.
 *
 * Inlined as TypeScript source so it bundles as ESM (the published package is CJS-only,
 * which the rolldown/vite bundler cannot link to bundled ESM React). No logic changes.
 */
export {default as Resizable} from './Resizable';
export {default as ResizableBox} from './ResizableBox';
export type {
  Axis,
  DefaultProps,
  DragCallbackData,
  Props,
  ReactRef,
  ResizableBoxState,
  ResizableState,
  ResizeCallbackData,
  ResizeHandleAxis,
} from './propTypes';
