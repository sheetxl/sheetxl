import { useMemo, useRef, type ReactNode } from 'react';

import { Command } from '@sheetxl/utils-react';

import { InputClipboardInjector } from '@sheetxl/react';

const { FocusActivation, CommandScopeProvider, CommandAnchorProvider, useCommandScope } = Command;

/** The `scriptEditor` scope's spec — a named REGION others contribute into (no contributor of its own). */
const SCRIPT_SCOPE_SPEC: Command.CommandScopeSpec = { scopeName: 'scriptEditor' };

/**
 * **Command bridge for the script editor container** (the task-pane analogue of `PaneScopeProvider`).
 *
 * Implements "**two resolvers, one registry**". The script pane renders alongside the grid inside
 * `WorkbookElement`'s `workbook` scope (the per-sheet `sheet` scope is owned by the grid, so task panes
 * don't inherit it), so this reads that ambient `workbook` scope, creates a `scriptEditor` **child** of it
 * (chain `scriptEditor → workbook → app`), and wraps the workspace in its own {@link CommandAnchorProvider}
 * anchored there:
 * - the **script toolbar** resolves via this resolver — its chain reaches the per-workbook commands
 *   scripting needs (`insertFunction`, `executeScript`, undo/redo);
 * - the **studio toolbars** keep resolving via the sheet/pane tracker.
 *
 * Sheet commands (`bold`, `copy`) resolve *up* the script chain, which is fine: the script toolbar renders
 * none of them, `keyBindings` are OFF (no keystroke leak), and `InputClipboardInjector` overrides
 * copy/cut/paste at the leaf so they act on the editor text, not the sheet.
 *
 * This bridge owns only the region's **scope + focus-tracked resolver**, and it is exactly those two
 * standard pieces — the **contributor** axis ({@link CommandScopeProvider}: create the scope, name its
 * element) and the **consumer** axis ({@link CommandAnchorProvider}: own a tracker + resolver). Nothing
 * here is script-specific except the scope name. The script-editor command behavior
 * (`saveScripts`/`insertScript`/`help`/…) is contributed by `ScriptEditor` (a descendant holding the live
 * editor handle) into this same scope, so the toolbar resolves them with no `IScriptEditor.Context`
 * marshalling. See design/COMMAND-DESIGN.md for the full topology.
 */
export const ScriptCommandProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const ambient = useCommandScope();     // the per-workbook `workbook` scope (provided by `WorkbookElement`)
  // The pane element, named twice for its two different jobs: `elementRef region` on the scope side (bound
  // its commands + record `scriptPane → scriptEditor` in the tree's shared region index, so the STUDIO
  // toolbars follow focus into the editor), and `elementRef` on the anchor side (bound this tracker's own
  // focus walk). `display: contents` → a ref handle without altering the pane's layout.
  const paneRef = useRef<HTMLDivElement>(null);
  // No ancestor command provider: pass through.
  if (!ambient) return children;
  return (
    <CommandScopeProvider spec={SCRIPT_SCOPE_SPEC} elementRef={paneRef} region>
      <ScriptAnchorProvider paneRef={paneRef}>{children}</ScriptAnchorProvider>
    </CommandScopeProvider>
  );
};

/**
 * The consumer half: a focus-driven resolver over the `scriptEditor` scope its parent just created (read
 * back off the context — which is why this is a separate component).
 */
const ScriptAnchorProvider = ({ paneRef, children }: {
  paneRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}): ReactNode => {
  const scriptScope = useCommandScope();
  // Focus-driven anchor, scoped to THIS region: reads the shared region map, **bounded** to the script pane
  // by `elementRef` below, with `scriptEditor` as the one-shot INITIAL anchor (this region has exactly one
  // anchor, known at construction). Focus in the sheet is OUTSIDE this region, so the walk finds nothing and
  // the anchor stays — that's why the script toolbar's buttons stay active regardless of sheet focus.
  const tracker = useMemo(
    () => (scriptScope ? new FocusActivation(scriptScope.getRoot(), scriptScope) : null),
    [scriptScope]
  );
  if (!tracker) return children;
  return (
    /* keyBindings OFF: legacy still owns keystrokes (see the sheet bridge).
       debounce: coalesce contribution/anchor changes into one re-resolve per settle. */
    <CommandAnchorProvider tracker={tracker} keyBindings={false} debounce={100} elementRef={paneRef}>
      {/* The script editor's tree has no `copy`, so its Copy button resolves disabled; the
          input-clipboard injector supplies one that acts on the focused editor selection. */}
      <InputClipboardInjector />
      <div className="script-editor-pane" style={{ display: 'contents' }} ref={paneRef}>
        {children}
      </div>
    </CommandAnchorProvider>
  );
};
