import React from 'react';

import { ReactUtils } from '@sheetxl/utils-react';

import { type FormulaBarPlacement } from '../formulaBar';

/** What `detect-it` reports the device's primary pointer to be. */
type PrimaryInput = ReturnType<typeof ReactUtils.detectIt>['primaryInput'];

/**
 * Resolve the studio's `formulaBarPlacement` prop to an edge.
 *
 * @remarks
 * `'auto'` (or an omitted prop) follows the primary pointer `detect-it` measured at module load: a
 * device whose primary pointer is a finger (`pointer: coarse`) gets the bar below the grid, everything
 * else above. That is a static fact, not the live input modality, so the bar never jumps when a
 * tablet gains a mouse. It is deliberately not `deviceType === 'touchOnly'`: a phone that advertises
 * any fine pointer at all (an S Pen, a paired mouse, a screen-mirroring bridge) reports `hybrid`
 * while its primary pointer is still a finger. The server has no device and resolves to `'top'`.
 * `primaryInput` is a parameter so the rule can be exercised without the device.
 */
export const resolveFormulaBarPlacement = (
  placement: FormulaBarPlacement | 'auto' | undefined,
  primaryInput: PrimaryInput = typeof window === 'undefined' ? 'mouse' : ReactUtils.detectIt().primaryInput
): FormulaBarPlacement => {
  if (placement === 'top' || placement === 'bottom') return placement;
  return primaryInput === 'touch' ? 'bottom' : 'top';
};

/** The studio chrome, top to bottom, before the formula bar's slot is decided. */
export interface StudioChromeParts {
  toolbar: React.ReactNode;
  formulaBar: React.ReactNode;
  /** The grid and its task-pane split. */
  main: React.ReactNode;
  statusBar: React.ReactNode;
}

/** The line between the status bar and a formula bar under it: the grid frame's own seam token. */
const Divider = (): React.ReactElement => (
  <div style={{ flex: 'none', height: 0, borderTop: 'solid var(--sxl-color-base-border, light-dark(rgba(0, 0, 0, 0.26), rgba(255, 255, 255, 0.3))) 1px' }} />
);

/**
 * The studio's flex-column children in render order: the formula bar sits under the toolbar, or at
 * the very bottom under the status bar when placed at the bottom, so on a phone the entry area and
 * its input toolbar sit directly on the keyboard. The studio, not the status bar, draws the line
 * between the two. The elements themselves are untouched.
 */
export const orderStudioChrome = (placement: FormulaBarPlacement, parts: StudioChromeParts): React.ReactNode[] => {
  const keyed = (name: keyof StudioChromeParts): React.ReactNode => <React.Fragment key={name}>{parts[name]}</React.Fragment>;
  if (placement === 'bottom') {
    const divider = parts.statusBar && parts.formulaBar ? <Divider key="divider" /> : null;
    return [keyed('toolbar'), keyed('main'), keyed('statusBar'), divider, keyed('formulaBar')];
  }
  return [keyed('toolbar'), keyed('formulaBar'), keyed('main'), keyed('statusBar')];
};
