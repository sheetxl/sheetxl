import { describe, it, expect, afterEach } from 'vitest';

import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import { OptionsDialog } from '@sheetxl/utils-mui';

/**
 * Guards the dialog's **busy affordance**: while `onValidateOption` is in flight the activated
 * button must show a spinner and the others must go inert.
 *
 * @remarks
 * This exists because the feature shipped silently broken. The spinner state was correct, but the
 * button list is built in a `useMemo` that did not list it as a dependency — so the memo kept
 * handing back the pre-validation buttons and the dialog just sat there. Nothing in a type check or
 * a headless read of the component shows that; only rendering it does.
 *
 * Validation here is slow *on purpose* — the real one is a ~1s key derivation, which is exactly the
 * case a user cannot tell apart from a hang.
 */
describe('OptionsDialog (busy)', () => {
  const OPTIONS = ['Ok', 'Cancel'];

  // The dialog portals into document.body, so a leftover from a failed test would be found by the
  // next one's queries (and clicked instead of its own button).
  afterEach(() => { document.body.innerHTML = ''; });

  /**
   * Activating the DEFAULT option submits the form, and the submit handler waits out the button's
   * ripple before validating — so a bare click() has not started anything yet.
   */
  const RIPPLE_SETTLE = 300;
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, RIPPLE_SETTLE)); });

  const mount = async (props: Record<string, unknown>) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(createElement(OptionsDialog as never, { options: OPTIONS, ...props })); });
    return {
      unmount: async () => { await act(async () => { root.unmount(); }); container.remove(); }
    };
  };

  /** Dialog content is portaled, so query the document rather than the mount container. */
  const buttonByLabel = (label: string): HTMLButtonElement | null => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return (buttons.find((b) => b.textContent?.trim() === label) ?? null) as HTMLButtonElement | null;
  }

  // The spinner is always mounted (its animation must already be running when revealed — a
  // CircularProgress mounted mid-interaction renders as a 1px dash), so "showing" is opacity.
  const spinner = (): HTMLElement | null => document.querySelector('.MuiCircularProgress-root');
  const spinnerShown = (): boolean => spinner()?.style.opacity === '1';

  it('shows a spinner on the activated option and disables the rest while validating', async () => {
    let release: (value: boolean) => void = () => {};
    const validating = new Promise<boolean>((resolve) => { release = resolve; });

    const { unmount } = await mount({
      open: true,
      description: 'Enter something',
      onValidateOption: () => validating
    });

    const ok = buttonByLabel('Ok');
    expect(ok).toBeTruthy();
    expect(spinner()).not.toBeNull(); // mounted up front...
    expect(spinnerShown()).toBe(false); // ...but not visible until validating

    await act(async () => { ok!.click(); });
    await settle();

    // In flight: spinner on Ok, Cancel inert so it cannot resolve the dialog out from under it.
    expect(spinnerShown()).toBe(true);
    expect(buttonByLabel('Cancel')?.disabled).toBe(true);

    await act(async () => { release(false); await validating; });
    await act(async () => {});

    // Rejected: the dialog stays open and Ok is usable again — it must not latch disabled.
    expect(spinnerShown()).toBe(false);
    expect(buttonByLabel('Ok')?.disabled).toBe(false);

    await unmount();
  });

  it('does not gate cancel behind validation', async () => {
    // A dialog whose validator keeps failing must still be dismissable.
    let cancelled = false;
    const { unmount } = await mount({
      open: true,
      description: 'Enter something',
      onValidateOption: async () => false,
      onCancel: () => { cancelled = true; }
    });

    await act(async () => { buttonByLabel('Cancel')!.click(); });

    expect(cancelled).toBe(true);
    await unmount();
  });
});
