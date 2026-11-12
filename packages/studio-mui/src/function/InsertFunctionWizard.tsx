import { useState, memo } from 'react';

import { Box } from '@mui/material';

import { type IFunction, type IRange, type IWorkbook } from '@sheetxl/sdk';

import { type OptionInput } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import { FunctionSearchPanel } from './FunctionSearchPanel';
import { FunctionArgumentsPanel } from './FunctionArgumentsPanel';
import { FUNCTION_PANE_HEIGHT } from './paneMetrics';

/** Which of the wizard's two pages is showing. */
export type InsertFunctionPage = 'search' | 'arguments';

/**
 * The class on each page's wrapper, carrying `data-page` and the `hidden` attribute.
 *
 * @remarks
 * Both pages stay MOUNTED once visited (see {@link InsertFunctionWizard}), so "is this page up" is a
 * question about `hidden`, not about what is in the document: `.insert-function-page[data-page="…"]:not([hidden])`.
 */
export const INSERT_FUNCTION_PAGE_CLASS = 'insert-function-page';

/**
 * The option identities the wizard's host acts on. Language-free (the labels are thunks) — this is
 * what arrives as `onOption`'s `option`.
 */
export const InsertFunctionOption = Object.freeze({
  /** Page 1's default — go fill the chosen function's arguments. */
  Next: 'Next',
  /** Page 2 → page 1, keeping the search behind it. */
  Back: 'Back',
  /** Insert: the seeded call from page 1, the assembled one from page 2. */
  Insert: 'Insert'
});

/**
 * The action row for a page — FIRST entry is the default (`OptionsDialog`'s own rule).
 *
 * @remarks
 * A helper rather than an action-model protocol: a second host (a taskpane, the script editor) reuses
 * ten lines of button logic by calling this, instead of implementing an interface to be handed the
 * same array. `OptionsDialog` re-reads `options`/`defaultOption` every render, so a page flip needs
 * nothing else.
 *
 * @param page The page being shown.
 * @param t    The host's translator — the labels resolve at render, so a language switch while the
 *             dialog is open re-localizes them.
 */
export const optionsForPage = (
  page: InsertFunctionPage,
  t: (key: string) => string
): OptionInput[] => {
  const insert: OptionInput = { id: InsertFunctionOption.Insert, label: () => t('insertFunction.insert') };
  if (page === 'arguments') {
    return [insert, { id: InsertFunctionOption.Back, label: () => t('insertFunction.back') }, 'Cancel'];
  }
  // Insert stays reachable from page 1 — Excel's "OK" only ever goes forward, but seeding `=NAME(`
  // into the cell and filling it there (with the editor's own hint showing) is the faster path for
  // anyone who already knows the function.
  return [
    { id: InsertFunctionOption.Next, label: () => t('insertFunction.next') },
    insert,
    'Cancel'
  ];
};

export interface InsertFunctionWizardProps {
  /** The catalog — page 1's search/browse. */
  context?: () => CommandContext.FormulaFunction | null | undefined;
  /** Which page is showing. CONTROLLED: the host owns it, because its action row depends on it. */
  page: InsertFunctionPage;
  /** The chosen function, and the second page's subject. */
  selected: IFunction | null;
  /** The selection changed (a click, an arrow key, or a new query landing on its own top row). */
  onChangeSelected: (fn: IFunction | null) => void;
  /** "That one" — a double-click in the list. The host takes its own default action. */
  onActivate?: () => void;
  /** The assembled call from page 2, on every change — `=SUM(A1:A5,B1)`. */
  onChangeCall?: (call: string) => void;
  /** Evaluation/resolution context for page 2. Defaults to the enclosing `WorkbookContext`. */
  workbook?: IWorkbook | null;
  /** The cell the call is being inserted into — page 2's anchor for bare references. */
  home?: Partial<IRange.CellCoords>;
  /** Class(es) for the showing page's root. */
  className?: string;
}

/**
 * The two pages of **Insert Function**, composed: pick a function, then fill its arguments.
 *
 * @remarks
 * Renders NO chrome — no title, no buttons, no window. The host owns the page state (`page` /
 * `onPageChange` at the call site) and builds its action row from {@link optionsForPage}, which is
 * what lets the same pair live in a dialog today and a taskpane later.
 *
 * **A page turn HIDES, it does not unmount.** Next/Back is one window changing what it shows, and
 * everything the user built on the page behind it survives: the query, the category, the scroll
 * position, and page 2's filled-in arguments. Re-mounting threw all of that away — going Back to
 * refine a search landed on an empty box with the whole catalog under it.
 *
 * What resets page 2 is therefore a different FUNCTION, not a page turn: it is keyed on the one it
 * was opened for. That is also why it does not mount until the first Next — an argument form for
 * every function arrowed past on page 1 would evaluate the whole time the user is still choosing.
 */
export const InsertFunctionWizard = memo<InsertFunctionWizardProps>((props: InsertFunctionWizardProps) => {
  const {
    context,
    page,
    selected,
    onChangeSelected,
    onActivate,
    onChangeCall,
    workbook,
    home,
    className
  } = props;

  /**
   * The function page 2 is filling — latched on the way IN, not read live from `selected`.
   *
   * @remarks
   * Two things fall out of the latch, both of them the point of it: a selection moving on page 1
   * cannot re-key (and so re-evaluate) the form hidden behind it, and coming Back to the SAME
   * function returns to the arguments already typed rather than to an empty form.
   */
  const [argsFunc, setArgsFunc] = useState<IFunction | null>(null);
  // Latched DURING render (React's documented "adjust state when a prop changes" pattern), not in an
  // effect: an effect lands a frame late, and that frame paints page 1 under page 2's buttons.
  if (page === 'arguments' && selected && selected !== argsFunc) setArgsFunc(selected);

  const isArguments = page === 'arguments' && !!argsFunc;

  return (
    // THE SIZER. The pages no longer agree on a height between themselves: each declares what it
    // wants and this takes the taller of the two, which is what keeps Next/Back from resizing the
    // window under the pointer. And it is a BASIS, not a fixed height — `flex: 1 1 auto` with
    // `minHeight: 0` means a host with less room to give (a short window) compresses the wizard, and
    // the showing page compresses its own scrolling region to match, instead of the dialog growing
    // past the bottom of the screen. See `paneMetrics`.
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: `${FUNCTION_PANE_HEIGHT}px`,
        flex: '1 1 auto',
        minHeight: 0
      }}
    >
      {/* The wrapper carries only the show/hide. `contents` rather than `block` when showing: it
          leaves the layout entirely, so each panel is the flex item of the sizer above — which is
          what its own sizing was written against. The `hidden` attribute says the same thing to
          everything that does not read CSS — assistive tech, and a test asking which page is up
          ({@link INSERT_FUNCTION_PAGE_CLASS}). Nothing needs `inert`: a `display: none` subtree is
          already untabbable. */}
      <Box
        className={INSERT_FUNCTION_PAGE_CLASS}
        data-page="search"
        hidden={isArguments}
        sx={{ display: isArguments ? 'none' : 'contents' }}
      >
        <FunctionSearchPanel
          className={className}
          context={context}
          selected={selected}
          onChangeSelected={onChangeSelected}
          onActivate={onActivate}
          // Not "on mount" any more — on ARRIVAL. Coming Back is a page turn now, and the search box
          // is where the keyboard belongs each time the page is shown, mount or not.
          autoFocus={!isArguments}
        />
      </Box>
      {argsFunc ? (
        <Box
          className={INSERT_FUNCTION_PAGE_CLASS}
          data-page="arguments"
          hidden={!isArguments}
          sx={{ display: isArguments ? 'contents' : 'none' }}
        >
          <FunctionArgumentsPanel
            // A different function is a different form — this is what clears the previous one's
            // arguments now that a page turn no longer does.
            key={argsFunc.getName()}
            className={className}
            func={argsFunc}
            workbook={workbook}
            home={home}
            autoFocus={isArguments}
            onChangeCall={onChangeCall}
          />
        </Box>
      ) : null}
    </Box>
  );
});

InsertFunctionWizard.displayName = 'InsertFunctionWizard';

export default InsertFunctionWizard;
