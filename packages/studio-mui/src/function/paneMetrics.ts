/**
 * Each page's PREFERRED height, in px — what it asks for, not what it gets.
 *
 * @remarks
 * Internal to this folder (not exported from the package).
 *
 * Neither page can be content-sized: the search page's list is as long as the search found (~15000px
 * of rows), and the argument page GROWS a row every time a rest parameter's last one is filled. So
 * each declares the height it wants and gives its one scrolling region the remainder.
 *
 * They no longer have to AGREE. A host showing both ({@link InsertFunctionWizard}) sizes itself to
 * the taller of the two and lets each page fill it — which is what keeps Next/Back from resizing the
 * window under the pointer, and is a fact about the host rather than a number each page has to be
 * told. And a preference is all these are: both pages shrink below them when the host is shorter (a
 * short window, a taskpane), which is what a hard `height` here could not do.
 */

/**
 * The search page's own sum — a search field (40) + a category field (40) + the hint (88), the 16px
 * gaps between them and its 12px top padding, with the function list taking the remainder. The list
 * asks for little here on purpose: in the wizard the page renders at the taller argument page's
 * height, and the difference all lands in the list.
 */
export const FUNCTION_SEARCH_PANE_HEIGHT = 415;

/**
 * The argument page's, which is the taller: prose (the function's summary at the top, the focused
 * argument's description at the bottom) is what a first-time user of a function is here to read.
 * The extra goes to the argument rows, which is where the user is working — and, on the search
 * page, to its function list, which simply shows more rows.
 */
export const FUNCTION_ARGUMENTS_PANE_HEIGHT = 450;

/** What a host showing BOTH pages sizes to: the taller page's preference. */
export const FUNCTION_PANE_HEIGHT = Math.max(FUNCTION_SEARCH_PANE_HEIGHT, FUNCTION_ARGUMENTS_PANE_HEIGHT);
