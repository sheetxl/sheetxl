import { messageKey } from '@sheetxl/utils';

import { DefaultCommandButtonRegistry, DynamicIcon, CommandButtonType, type CommandButtonProps } from '@sheetxl/utils-react';

import { registerMovableCommandGroups, WORKBOOK_TOOLBARS_KEY } from '@sheetxl/react';

import { AutoColorPosition } from '../color';

import { FontFamilyCommandButton } from './FontFamilyCommandButton';
import { FontSizeCommandButton } from './FontSizeCommandButton';
import { BorderCommandButton } from './BorderCommandButton';
import { ColorCommandButton } from './ColorCommandButton';
import { InsertFunctionCommandPopupButton } from './InsertFunctionCommandPopupButton';
import { DocThemeCommandButton } from './DocThemeCommandButton';
import { PasteCommandButton } from './PasteCommandButton';
import { LocaleCommandButton } from './LocaleCommandButton';
import { CalculationOptionsCommandButton } from './CalculationOptionsCommandButton';

import { InsertCellControlCommandButton } from './InsertCellControlCommandButton';
import { InsertChartCommandButton } from '../chart/command';
import { ShapeGalleryCommandButton } from '../shape';

import { registerSheetCommandGroups } from './SheetCommandGroups';

/**
 * Registers **workbook-scoped** command groups - operations spanning the workbook (e.g. hiding
 * sheets), including groups that reference both sheet and workbook commands (the "most contained
 * dependency" wins).
 *
 * @remarks
 * A workbook contains sheets, so this also registers the {@link registerSheetCommandGroups | sheet}
 * groups. Grouped here so they can later move wholesale to the workbook package.
 */
export const registerWorkbookCommandGroups = (): void => {
  registerSheetCommandGroups();

  // Hide & Unhide: references sheet (hideColumns/Rows) + workbook (hideSheet) commands.
  DefaultCommandButtonRegistry.register({
    key: 'hideUnhideOptions',
    members: [
      'hideColumns',
      'hideRows',
      'hideSheet',
      '-',
      'unhideColumns',
      'unhideRows'
    ]
  }, true);

  // Format Cells: row/column sizing + visibility, with a nested Hide & Unhide group, closing on the
  // Format Cells pane itself (`formatCells`) - the menu is named for it, and Excel ends its
  // Cells > Format menu the same way.
  DefaultCommandButtonRegistry.register({
    key: 'cellsFormatOptions',
    members: [
      'resizeRows',
      'autoFitRows',
      '-',
      'resizeColumns',
      'autoFitColumns',
      '-',
      'hideUnhideOptions',
      '-',
      'formatCells'
    ]
  }, true);

  // A custom command button (a single command, no submembers) registered as a button *item* - it is
  // just `key + render`, referenced by key from a member list, and (once it has `contributions`)
  // injectable like any other item. The bottom-up proof that Home's bespoke controls fit the model.
  DefaultCommandButtonRegistry.register({
    key: 'formatFontFamily',
    render: (props) => <FontFamilyCommandButton {...(props as any)} commandKey="formatFontFamily"/>
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'formatFontSize',
    render: (props) => <FontSizeCommandButton {...(props as any)} commandKey="formatFontSize"/>
  }, true);

  // Same shape as `formatFontFamily`: one command (`formatBorder`) whose bespoke picker popup lives
  // entirely inside the component - the registry just wraps it in a `render`.
  DefaultCommandButtonRegistry.register({
    key: 'formatBorder',
    render: (props) => <BorderCommandButton {...(props as any)}/>
  }, true);

  // One command each; the color-picker panel config differs per instance (font vs fill).
  DefaultCommandButtonRegistry.register({
    key: 'formatFontColor',
    render: (props) => (
      <ColorCommandButton
        {...(props as any)}
        commandKey="formatFontColor"
        isSplit={true}
        propsPanel={{ disableAlpha: true }}
      />
    )
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'formatFillColor',
    render: (props) => (
      <ColorCommandButton
        {...(props as any)}
        commandKey="formatFillColor"
        isSplit={true}
        propsPanel={{ disableAlpha: true, autoColorLabelKey: messageKey('color.noFill'), autoColorPosition: AutoColorPosition.End }}
      />
    )
  }, true);

  // The Home ribbon tab, as a surface - an explicit ordered `members` list (like `dataToolbar`), with
  // `'-'` group separators. Cross-scope controls are *injected* rather than listed: the studio's Undo
  // (start edge, `order < 0`) and scripting's Run Script (end edge) contribute in. The leading `'-'`
  // separates injected Undo from Paste and collapses when Undo isn't present (bare workbook).
  // Ribbon-tab chrome lives in the CATALOG keyed by the panel entry (English included); the tab
  // strip (`WorkbookToolbars`) reads it back through the entry, so it follows a language switch.
  DefaultCommandButtonRegistry.register({
    key: 'homeToolbar',
    members: [
      '-',
      'pasteOptions', 'formatPainterToggle', 'copy',
      '-',
      'formatFontFamily', 'formatFontSize',
      'formatBoldToggle', 'formatItalicToggle', 'underlineOptions', 'textEffectsOptions',
      'formatBorder', 'formatFillColor', 'formatFontColor',
      '-',
      'horizontalAlignOptions', 'verticalAlignOptions', 'textRotateOptions', 'textOverflowOptions', 'mergeOptions',
      '-',
      'numberFormatOptions',
      '-',
      'conditionalFormatOptions', 'formatTableStyle', 'formatCellStyle',
      '-',
      'insertSheetOptions', 'deleteSheetOptions', 'cellsFormatOptions',
      '-',
      'insertFunctionSumOptions', 'fillOptions', 'clearOptions', 'sortFilterOptions', 'findOptions'
    ]
  }, true);

  // The Data ribbon tab, as a surface. The workbook owns the toolbar's shape; `insertData` (which
  // needs IO) is *injected* by the studio (see `registerStudioCommandGroups`), so a bare workbook
  // renders this toolbar without an import button; Workbook Links follows it in the same group (Excel's
  // Get Data / Queries & Connections).
  DefaultCommandButtonRegistry.register({
    key: 'dataToolbar',
    members: [
      // data from picture? / query & connections
      'refreshAll',
      'manageExternalLinks',
      '-',
      // convert to data type
      'sortOptions',
      'filterOptions',
      '-',
      'dataTextToColumnsOptions',
      // flashFill
      'dataRemoveDuplicates',
      '-',
      // Excel keeps protection on Review only; it is duplicated here beside the other edit gate.
      'dataValidationOptions',
      'protectionOptions',
      '-',
      // what-if analysis / forecast sheet
      'groupOptions',
      'ungroupOptions',
      'showDetail',
      'hideDetail'
      // subtotal
    ]
  }, true);

  // The built-in function-category pickers, registered as button ENTRIES (were inline `render` members).
  // Registering them by key lets other surfaces reference AND anchor against them — the scripting plugin
  // injects its "Custom" button right after `formulaCategory.web`. They MUST be real entries, not keyed inline
  // members: a keyed-but-unregistered member routes through the leaf path (`renderLeaf`), which injects
  // `commandKey` (leaks to the DOM) and an undefined `icon` (clobbers the category icon). Registered entries
  // render via `renderEntry`, which respects the entry's own `render` with no such injection.
  const FORMULA_CATEGORIES = [
    'financial', 'logical', 'text', 'dateTime', 'lookupReference', 'mathTrig', 'statDist', 'engineering',
    // 'cube', not supported
    'information', 'database', 'web'
  ];
  for (const category of FORMULA_CATEGORIES) {
    DefaultCommandButtonRegistry.register({
      key: `formulaCategory.${category}`,
      render: (props: CommandButtonProps) => <InsertFunctionCommandPopupButton category={category} {...(props as any)}/>
    }, true);
  }

  // The Formulas ribbon tab, as a surface. `custom` is intentionally NOT among the categories — user-defined
  // functions are a scripting concern, contributed by the scripting plugin as the "Custom" button
  // (`InsertFunctionContribution`, injected after `formulaCategory.web`). `calculate` is a sheet command and
  // `calculateAll` a workbook command (the "most contained dependency" reason this toolbar is at the workbook layer).
  DefaultCommandButtonRegistry.register({
    key: 'formulaToolbar',
    members: [
      // Insert Function (shift+F3) — the dialog/wizard, at the head of the tab as Excel has it. A LABELLED
      // button (`showLabel`, the `gridlinesOptions` / `workbookViewOptions` treatment): the fx glyph alone
      // is a formula-BAR idiom, and here it reads "Insert Function" from the command's own catalog chrome.
      // The same command the bar's fx button and this tab's Quick Function → "Function…" both execute, so
      // there is one insert-function behavior with three entry points, not three.
      { key: 'insertFunctionDialog', showLabel: true },
      '-',
      'insertFunctionSumOptions',
      '-',
      // recently used FunctionCategory / create a FunctionCategory popup
      ...FORMULA_CATEGORIES.map((category) => `formulaCategory.${category}`),
      '-',
      // defined names — name manager (Ctrl+F3) opens the `managedNames` pane.
      // TODO - define name / use in formula / create from selection
      'activeNameManager',
      '-',
      // trace precedents / trace dependents
      'sheetViewToggleFormulaView',
      '-',
      // calculate options
      'calculationOptions',
      'calculateAll',
      'calculate'
    ]
  }, true);

  // Calculation Options (Excel's Formulas → Calculation Options): the mode radio, the iterative
  // toggle with its two limits, and the two recalculations. A bespoke popup because the limits are
  // number fields, not commands; the same control rides in the formula bar.
  DefaultCommandButtonRegistry.register({
    key: 'calculationOptions',
    render: (props: CommandButtonProps) => <CalculationOptionsCommandButton {...(props as any)}/>
  }, true);

  // The Insert ribbon tab, as a surface. `insertImageOptions` is a registered sheet group; the shape
  // and chart galleries are bespoke controls, so they ride in as inline members.
  DefaultCommandButtonRegistry.register({
    key: 'insertToolbar',
    members: [
      'insertPivotTable',
      'insertTable',
      '-',
      // forms
      'insertImageOptions',
      { render: (props: CommandButtonProps) => <ShapeGalleryCommandButton {...(props as any)} commandKey="insertShape"/> },
      '-',
      { render: (props: CommandButtonProps) => <InsertCellControlCommandButton {...(props as any)}/> },
      '-',
      { render: (props: CommandButtonProps) => <InsertChartCommandButton {...(props as any)}/> },
      'insertSparklineOptions',
      '-',
      // slicer / timeline?
      'updateHyperlink',
      'updateComments'
      // textbox / smartArt / header & footer / symbols
    ]
  }, true);

  // The cell / range right-click menu, as a surface (see `WorkbookContextMenu`). This registers only
  // the always-present *spine*; the selection-conditional sections (hyperlink / note / comment / table
  // splits, row-vs-column hide/unhide/resize) are woven in by the component from live selection
  // state, and cannot be static. Hosts contribute cell-menu items by targeting `contextMenu` via
  // `contributions`. Paste stays a bespoke component (the menu variant needs `includePasteAllInPopup`);
  // `insertCellsOptions` / `deleteCellsOptions` are the CELL-scope split-button GROUPS (Shift/Rows/
  // Columns) — NO Insert/Delete Sheet here (the ribbon uses the `*SheetOptions` supersets for that);
  // `copy` resolves to the registered marching-ants control.
  DefaultCommandButtonRegistry.register({
    key: 'contextMenu',
    members: [
      'cut',
      'copy',
      { render: (props: CommandButtonProps) => (
        <PasteCommandButton {...(props as any)} commandKey="paste" includePasteAllInPopup={false}/>
      ) },
      '-',
      'insertCellsOptions',
      'deleteCellsOptions',
      'clearOptions',
      '-',
      'sortFilterOptions'
    ]
  }, true);

  // The drawing / movable right-click menu, as a surface (see `MovableContextMenu`). Fully static (no
  // selection conditionals), so unlike `contextMenu` the whole menu lives here. Its submenus are the
  // drawing groups react shares with the drawing tabs. `copy` resolves to the registered marching-ants
  // control. Hosts contribute via `contributions: { movableContextMenu }`.
  registerMovableCommandGroups();
  DefaultCommandButtonRegistry.register({
    key: 'movableContextMenu',
    members: [
      'copy',
      '-',
      'drawGroupOptions',
      'moveForwardOptions',
      'moveBackwardOptions',
      '-',
      'toggleLockAspectRatio',
      '-',
      'drawAlignOptions',
      'drawFlipOptions',
      '-',
      'drawSizingOptions',
      '-',
      'formatMovable'
    ]
  }, true);

  // The sheet-tab right-click menu, as a surface (see `SheetTabMenu`). The bespoke "Rename" item (an
  // inline tab-strip edit trigger, not a command) is woven in by the component right after `deleteSheet`
  // - it needs float / tab-strip closures, so it can't be static. The tab-color picker keeps its bespoke
  // panel config here (a leaf render entry, like the gridlines color). Hosts contribute sheet-tab items
  // via `contributions: { sheetTabMenu }`.
  DefaultCommandButtonRegistry.register({
    key: 'sheetTabMenu',
    members: [
      'addSheet',
      'deleteSheet',
      // 'Rename' woven in here by the component.
      'duplicateSheet',
      'protectionOptions',
      // Bespoke config + no menu-shared props (matches the original standalone button), so it ignores
      // the render props rather than spreading them.
      { render: () => (
        <ColorCommandButton
          variant={CommandButtonType.Menuitem}
          commandKey="formatSheetTabColor"
          icon={<DynamicIcon iconKey="stroke.colored"/>}
          propsPanel={{ disableAlpha: true, autoColorLabelKey: messageKey('color.noTabColor'), autoColorPosition: AutoColorPosition.End }}
        />
      ) },
      '-',
      'hideSheet'
    ]
  }, true);

  // Freeze Panes (was `FreezeCommandButton`): quick-click toggles freeze; the popup offers the
  // directional variants + unfreeze.
  DefaultCommandButtonRegistry.register({
    key: 'freezeOptions',
    defaultKey: 'freezeToggle',
    members: [
      'freezeToggle',
      'freezeToggleHorizontal',
      'freezeToggleVertical',
      '-',
      'unfreeze'
    ]
  }, true);

  // Protection, on the Data toolbar and the sheet-tab menu. Quick-click protects, pauses or resumes,
  // and never unprotects (pausing keeps the password and options); unprotecting is the popup's
  // toggle. The popup adds the session/view toggles and the way into the pane that owns everything
  // else (options, ranges, cells, the workbook).
  DefaultCommandButtonRegistry.register({
    key: 'protectionOptions',
    defaultKey: 'protectionSheetProtectOrPause',
    members: [
      'protectionSheetToggle',
      'protectionSheetPause',
      'protectionHighlight',
      '-',
      // Acting on the selection, so it sits apart from the sheet-wide toggles above and from the
      // pane below — which is where every other protection surface now lives.
      'protectionUnlockRange',
      '-',
      'manageProtection'
    ]
  }, true);

  // Gridlines (was `ViewGridLinesCommandButton`): quick-click toggles gridlines; the popup adds the
  // gridline color picker (a bespoke `ColorCommandButton` member) and the per-row/column toggles.
  DefaultCommandButtonRegistry.register({
    key: 'gridlinesOptions',
    defaultKey: 'gridlinesToggle',
    showLabel: true, // toolbar shows the split-toggle checkmark + "Gridlines" text
    members: [
      'gridlinesToggle',
      // Keyless inline so it resolves via `renderInline` (group props: variant only), not
      // `renderLeaf` - the latter would inject `label: undefined` (blanking the command's "Gridlines
      // Color" label) and `commandState` (which leaks to the DOM through ColorCommandButton's `...rest`).
      {
        render: (props: CommandButtonProps) => (
          <ColorCommandButton
            {...(props as any)}
            commandKey="sheetViewFormatGridlinesColor"
            icon={<DynamicIcon iconKey="stroke.colored"/>}
            propsPanel={{ disableAlpha: true }}
          />
        )
      },
      '-',
      'sheetViewToggleGridlinesColumns',
      'sheetViewToggleGridlinesRows'
    ]
  }, true);

  // Headings (was `ViewHeadingsCommandButton`): quick-click toggles the headings; the popup offers the
  // numeric toggle and per-row/column toggles.
  DefaultCommandButtonRegistry.register({
    key: 'headingsOptions',
    defaultKey: 'sheetViewToggleShowHeadings',
    showLabel: true, // toolbar shows the split-toggle checkmark + "Headings" text
    members: [
      'sheetViewToggleShowHeadings',
      'sheetViewToggleShowHeadingsNumeric',
      '-',
      'sheetViewToggleShowHeadingColumns',
      'sheetViewToggleShowHeadingRows'
    ]
  }, true);

  // The workbook regional-format (locale) picker — one workbook command (`locale`) whose bespoke
  // picker popup lives entirely inside the component (the `formatFontFamily` shape). It is
  // referenced by key from the studio's `languageOptions` panel; registered here because the
  // command — and the property it edits — belong to the workbook.
  DefaultCommandButtonRegistry.register({
    key: 'locale',
    render: (props) => <LocaleCommandButton {...(props as any)} variant="menuitem"/>
  }, true);

  // Workbook View (was `WorkbookViewCommandButton`): a plain popup of the workbook-chrome toggles
  // (formula bar, tabs, status bar, scrollbars). No quick command and no icon, so `showLabel` makes it
  // a text-only button; the label resolves (translated) from `cmd.workbookViewOptions.label`.
  DefaultCommandButtonRegistry.register({
    key: 'workbookViewOptions',
    showLabel: true,
    members: [
      'workbookViewToggleShowFormulaBar',
      'workbookViewToggleShowTabs',
      'workbookViewToggleShowStatusBar',
      '-',
      'workbookViewToggleShowHorizontalScrollBar',
      'workbookViewToggleShowVerticalScrollBar'
    ]
  }, true);

  // The workbook theme picker - `selectTheme` is a workbook command with a bespoke picker. Registered
  // by key (not an inline member) so the studio's Language & Region panel can anchor after it.
  DefaultCommandButtonRegistry.register({
    key: 'selectTheme',
    render: (props: CommandButtonProps) => <DocThemeCommandButton {...(props as any)} commandKey="selectTheme"/>
  }, true);

  // The Review ribbon tab, as a surface (Excel Online's Review tab, less what we don't have).
  DefaultCommandButtonRegistry.register({
    key: 'reviewToolbar',
    members: [
      'workbookStatistics',
      '-',
      'commentOptions',
      '-',
      'editNote',
      '-',
      'protectionOptions'
    ]
  }, true);

  // The View ribbon tab, as a surface. Studio-owned view controls are *injected* by anchor (see
  // `registerStudioCommandGroups`): Full Screen after `freezeOptions`, Dark Mode before
  // `sheetBackgroundOptions`, Language & Region after `selectTheme`. Scripting's Run Script lands at
  // the end edge (`ScriptingPlugin`). A bare workbook renders none of them.
  DefaultCommandButtonRegistry.register({
    key: 'viewToolbar',
    members: [
      'sheetZoomOptions',
      '-',
      'freezeOptions',
      '-',
      'gridlinesOptions',
      'headingsOptions',
      'workbookViewOptions',
      '-',
      'sheetViewToggleFormulaView',
      'sheetViewToggleShowZeros',
      'showCommentsPane',
      '-',
      'sheetBackgroundOptions',
      '-',
      'selectTheme'
    ]
  }, true);

  // The **main toolbar strip** - the ordered ribbon tabs, as a contribution surface. `WorkbookToolbars`
  // renders one tab per resolved member, so plugins add tabs by contributing into `workbookToolbars`
  // (the same seam a plugin uses for a button). The contextual `tableToolbar` is NOT listed here: it is
  // *contributed* by the `table` command contributor while a table is active (see
  // `contributeTableCommands`) and removed otherwise - so the Table tab appears / disappears with
  // no logic in `WorkbookToolbars`.
  DefaultCommandButtonRegistry.register({
    key: WORKBOOK_TOOLBARS_KEY,
    members: [
      'homeToolbar',
      'insertToolbar',
      'formulaToolbar',
      'dataToolbar',
      'reviewToolbar',
      'viewToolbar'
    ]
  }, true);
};
