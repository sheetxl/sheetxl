import type React from 'react';

import { type PaperProps } from '@mui/material';

import { type StudioProps } from './StudioProps';

/**
 * The props the studio consumes itself. Everything else passed to the studio (`id`, `data-*`,
 * `aria-*`, event handlers) is an element attribute and lands on the studio's root element, as it
 * would on a `div`. `className`, `style` and `sx` are applied to the root separately.
 */
const StudioPropKeys = [
  // Inherited from PaperProps but consumed by the studio rather than the root element.
  'square', 'elevation', 'variant', 'title', 'onKeyDown',
  // Studio's own props.
  'workbook', 'onWorkbookChange', 'onDocumentError', 'propsDocumentError', 'renderDocumentError',
  'propsDocumentLoading', 'renderDocumentLoading', 'propsWorkbook', 'onWorkbookLoad', 'onRenderSettled',
  'propsTaskPaneArea', 'renderTaskPaneArea', 'taskPaneSide', 'logo', 'onDirtyChange',
  'propsDocumentTitle', 'showFormulaBar', 'propsFormulaBar', 'renderFormulaBar', 'formulaBarPlacement',
  'virtualKeyboard', 'editable',
  'showStatusBar', 'propsStatusBar', 'renderStatusBar', 'propsToolbar', 'renderToolbar',
  'topLeft', 'topRight', 'muiTheme', 'tokens', 'cssBaseline', 'autoFocus', 'licenseKey', 'prefetch',
] as const satisfies readonly (keyof StudioProps)[];

type StudioPropKey = typeof StudioPropKeys[number];

// Fails to compile when a prop is added to StudioProps without being listed above; unlisted, it
// would be written to the root element as an attribute.
type UnlistedStudioProps = Exclude<keyof StudioProps, keyof Omit<PaperProps, 'autoFocus' | 'ref'> | StudioPropKey>;
const _allStudioPropsListed: [UnlistedStudioProps] extends [never] ? true : UnlistedStudioProps = true;
void _allStudioPropsListed;

const StudioPropKeySet: ReadonlySet<string> = new Set(StudioPropKeys);

/**
 * Splits props into those the studio consumes and those for its root element.
 */
export const splitStudioProps = <P extends Partial<StudioProps>>(
  props: P
): [studioProps: Partial<StudioProps>, elementProps: React.HTMLAttributes<HTMLDivElement>] => {
  const studioProps: Record<string, unknown> = {};
  const elementProps: Record<string, unknown> = {};
  for (const key in props) {
    (StudioPropKeySet.has(key) ? studioProps : elementProps)[key] = props[key];
  }
  return [studioProps as Partial<StudioProps>, elementProps as React.HTMLAttributes<HTMLDivElement>];
};
