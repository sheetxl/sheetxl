import type React from 'react';

import { Box } from '@mui/material';

import { DefaultCommandButtonRegistry } from '@sheetxl/utils-react';

import { CommandButton, InputCommandButton, ToggleGroupButton } from '@sheetxl/utils-mui';

import { WalkingCopyCommandButton } from './WalkingCopyCommandButton';
import { TextEffectsCommandButton } from './TextEffectsCommandButton';
import { TextRotateGroupButton } from './TextRotateGroupButton';
import { NumberFormatCommandButton } from './NumberFormatCommandButton';
import { SheetZoomCommandButton } from './SheetZoomCommandButton';
import { PresetCellStylesCommandButton } from './PresetCellStylesCommandButton';
import { PresetTableStylesCommandButton } from './PresetTableStylesCommandButton';
import { PresetPivotStylesCommandButton } from './PresetPivotStylesCommandButton';
import { PresetScalesCommandButton } from '../conditionalFormat';
import { ColorCommandButton } from './ColorCommandButton';

/** A sparkline color picker for `commandKey`, labeled as its command is in the group it is a member of. */
const sparklineColor = (commandKey: string) => (props: any, groupKey?: string): React.JSX.Element => (
  <ColorCommandButton {...props} commandKey={commandKey} groupKey={groupKey} propsPanel={{ disableAlpha: true }}/>
);

/**
 * Registers **sheet-scoped** command groups - operations on a sheet's cells, rows, columns, and
 * drawings.
 *
 * @remarks
 * Definitions belong roughly to the command scope that creates the keys. Grouped here so they can
 * later move wholesale to the sheet package. See {@link registerWorkbookCommandGroups}.
 */
export const registerSheetCommandGroups = (): void => {
  // Pictures (Insert tab, as Excel's): the head only opens the popup, because the first thing to
  // choose is what the picture is. In a cell it is the cell's value (an `image` rich value); over
  // the cells it is a movable. Each offers file / URL.
  DefaultCommandButtonRegistry.register({
    key: 'insertImageInCellOptions',
    members: [
      'insertImageInCellFromFile',
      'insertImageInCellFromURL'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'insertImageOverCellsOptions',
    members: [
      'insertImageFromFile',
      'insertImageFromURL'
      // 'insertImageFromUnsplash'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'insertImageOptions',
    members: [
      'insertImageInCellOptions',
      'insertImageOverCellsOptions'
    ]
  }, true);

  // Insert > Sparklines: Excel's Line / Column / Win-Loss, each drawing the selection's rows in the
  // column beside them.
  DefaultCommandButtonRegistry.register({
    key: 'insertSparklineOptions',
    members: [
      'insertSparklineLine',
      'insertSparklineColumn',
      'insertSparklineWinLoss'
    ]
  }, true);

  // Comment (Review tab, as Excel's): quick-click inserts a comment, or shows the cell's thread.
  DefaultCommandButtonRegistry.register({
    key: 'commentOptions',
    defaultKey: 'updateComments',
    members: [
      'updateComments',
      'showCommentsPane',
      '-',
      'previousComment',
      'nextComment',
      '-',
      'deleteComments'
    ]
  }, true);

  // Sheet Background: quick-click adds a background (file dialog) or clears the one already there,
  // so the toolbar button reads as selected while the sheet has one; the popup offers file / URL /
  // delete. Modeled on `insertImageOptions` — the difference is the state, which is why the quick
  // command is a toggle rather than the file member.
  DefaultCommandButtonRegistry.register({
    key: 'sheetBackgroundOptions',
    defaultKey: 'sheetBackgroundToggle',
    showLabel: true, // the View tab shows the split-toggle checkmark + "Background" text
    members: [
      'sheetBackgroundFromFile',
      'sheetBackgroundFromURL',
      '-',
      'sheetBackgroundDelete'
    ]
  }, true);

  // Merge: quick-click toggles merge; the popup offers the merge variants + unmerge.
  DefaultCommandButtonRegistry.register({
    key: 'mergeOptions',
    defaultKey: 'mergeToggle',
    members: [
      'mergeToggle',
      'mergeHorizontal',
      'mergeVertical',
      '-',
      'unmerge'
    ]
  }, true);

  // Underline: a toggle group whose quick command follows the active underline style. The group key
  // is `'underlineOptions'` so members read their compact `groupLabels` (e.g. "Double" not "Double Underline").
  DefaultCommandButtonRegistry.register({
    key: 'underlineOptions',
    render: (props, groupKey) => (
      <ToggleGroupButton {...props} groupKey={groupKey} projectAs="quick"/>
    ),
    members: [
      'formatUnderlinedToggle',
      'formatUnderlinedDoubleToggle',
      'formatUnderlinedAccountingToggle',
      'formatUnderlinedAccountingDoubleToggle'
    ]
  }, true);

  // Text Overflow: a toggle group whose *icon* follows the active overflow mode (no quick command -
  // the head only opens the popup). Falls back to the default vertical-bottom icon when none is set.
  DefaultCommandButtonRegistry.register({
    key: 'textOverflowOptions',
    render: (props, groupKey) => (
      <ToggleGroupButton {...props} groupKey={groupKey} projectAs="icon" defaultIcon="TextVerticalBottom"/>
    ),
    members: [
      'formatTextOverflowVisibleToggle',
      'formatTextOverflowWrapToggle',
      'formatTextOverflowClipToggle',
      '-',
      'formatTextOverflowShrinkToggle'
      // 'formatTextOverflowEllipsisToggle' // not yet implemented
    ]
  }, true);

  // Sort: quick-click sorts ascending; the popup offers ascending / descending / custom.
  DefaultCommandButtonRegistry.register({
    key: 'sortOptions',
    defaultKey: 'sortAscending',
    showLabel: true, // toolbar shows the quick command's icon + "Sort" text
    members: [
      'sortAscending',
      'sortDescending',
      'sortCustom'
    ]
  }, true);

  // Filter: quick-click toggles the table filter; the popup offers toggle / clear / refresh.
  DefaultCommandButtonRegistry.register({
    key: 'filterOptions',
    defaultKey: 'tableFilterToggle',
    showLabel: true, // toolbar shows the quick command's icon + "Filter" text
    members: [
      'tableFilterToggle',
      'tableFilterClear',
      'tableFilterRefresh'
    ]
  }, true);

  // Text to Columns: one command (`dataTextToColumns`) parameterized by delimiter `state`, plus a
  // "Custom" member that renders a single-character input via its own `render`.
  DefaultCommandButtonRegistry.register({
    key: 'dataTextToColumnsOptions',
    defaultKey: 'dataTextToColumns',
    showLabel: true, // special case: shows the quick command's icon AND the "Text to Columns" label
    members: [
      { key: 'dataTextToColumns', getLabel: () => 'Comma',     getIcon: () => null, state: ',' },
      { key: 'dataTextToColumns', getLabel: () => 'Tab',       getIcon: () => null, state: '\t' },
      { key: 'dataTextToColumns', getLabel: () => 'Semicolon', getIcon: () => null, state: ';' },
      { key: 'dataTextToColumns', getLabel: () => 'Space',     getIcon: () => null, state: ' ' },
      {
        key: 'dataTextToColumns', getLabel: () => 'Custom', getIcon: () => null,
        render: (props) => (
          <InputCommandButton
            {...props as any}
            inputProps={{ maxLength: 1 }}
          />
        )
      }
    ]
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'fillOptions',
    members: [
      'fillDown',
      'fillRight',
      'fillUp',
      'fillLeft',
      '-',
      'fillSeries'
    ]
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'clearOptions',
    members: [
      'clearAll',
      'clearFormats',
      'clearContents',
      'clearFormulas',
      'clearComments',
      'clearNotes',
      '-',
      'clearHyperlinks'
    ]
  }, true);

  // Conditional Formatting (Home tab, mirroring Excel Online): preset submenus, the three scale
  // presets, then New Rule / Clear Rules / Manage Rules. A member that is itself a registered group
  // key nests as a submenu — no extra machinery.
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatHighlightOptions',
    members: [
      'conditionalFormatGreaterThan',
      'conditionalFormatLessThan',
      'conditionalFormatBetween',
      'conditionalFormatEqualTo',
      '-',
      'conditionalFormatTextContains',
      'conditionalFormatDateOccurring',
      'conditionalFormatDuplicateValues'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatTopBottomOptions',
    members: [
      'conditionalFormatTopItems',
      'conditionalFormatTopPercent',
      'conditionalFormatBottomItems',
      'conditionalFormatBottomPercent',
      '-',
      'conditionalFormatAboveAverage',
      'conditionalFormatBelowAverage'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatClearOptions',
    members: [
      'conditionalFormatClearSelection',
      'conditionalFormatClearSheet'
    ]
  }, true);
  // Data Validation (Data tab): the presets the selection can express, the marks
  // toggle, then New Rule / Clear Rules / Manage Rules, as Conditional Formatting's.
  DefaultCommandButtonRegistry.register({
    key: 'dataValidationClearOptions',
    members: [
      'dataValidationClearSelection',
      'dataValidationClearSheet'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'dataValidationOptions',
    members: [
      'dataValidationList',
      'dataValidationUnique',
      '-',
      'dataValidationShowInvalid',
      '-',
      'dataValidationNewRule',
      'dataValidationClearOptions',
      'manageDataValidation'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatOptions',
    members: [
      'conditionalFormatHighlightOptions',
      'conditionalFormatTopBottomOptions',
      '-',
      // The three scale commands resolve to their gallery entries (registered below).
      'conditionalFormatDataBar',
      'conditionalFormatColorScale',
      'conditionalFormatIconSet',
      '-',
      'conditionalFormatNewRule',
      'conditionalFormatClearOptions',
      'manageConditionalFormat'
    ]
  }, true);

  // Paste: quick paste + the paste-special variants (was `PasteCommandButton`). The panel key is
  // `pasteOptions` (not `paste`) so it never shadows the `paste` command - `'paste'` below resolves
  // straight to the command (disjoint keys).
  DefaultCommandButtonRegistry.register({
    key: 'pasteOptions',
    defaultKey: 'paste',
    members: [
      'paste',
      '-',
      'pasteValues',
      'pasteFormats',
      'pasteFormulas',
      'pasteTranspose',
      'pasteLinks'
    ]
  }, true);

  // Copy: a leaf render entry (one command, bespoke presentation) - the `copy` command with a "walking
  // marquee" icon (marching ants while the copy/cut marquee is live). Same shape as the Home
  // font/color controls (`formatFontFamily` etc.), just keyed by the command it renders. Registering
  // it here makes a bare `'copy'` member resolve to this button everywhere it is listed.
  DefaultCommandButtonRegistry.register({
    key: 'copy',
    render: (props) => <WalkingCopyCommandButton {...(props as any)} commandKey="copy"/>
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'sortFilterOptions',
    defaultKey: 'tableFilterToggle',
    members: [
      'sortAscending',
      'sortDescending',
      'sortCustom',
      '-',
      'tableFilterToggle',
      'tableFilterClear',
      'tableFilterRefresh'
    ]
  }, true);

  DefaultCommandButtonRegistry.register({
    key: 'findOptions',
    defaultKey: 'find',
    members: [
      'find',
      'findReplace',
      'goto'
    ]
  }, true);

  // Quick Function (was `InsertFunctionSumCommandPopupButton`). Panel key `insertFunctionSumOptions` ≠
  // the `insertFunctionSum` command (disjoint).
  DefaultCommandButtonRegistry.register({
    key: 'insertFunctionSumOptions',
    defaultKey: 'insertFunctionSum',
    members: [
      'insertFunctionSum',
      'insertFunctionAverage',
      'insertFunctionCount',
      'insertFunctionMax',
      'insertFunctionMin',
      '-',
      'insertFunctionDialog'
    ]
  }, true);

  // Insert split buttons. Two groups over the SAME cell-insert members, differing only by whether the
  // sheet-scope `addSheet` is appended:
  //   • `insertCellsOptions` — cell-scope only. Used by the cell CONTEXT MENU (right-click). Members'
  //     compact labels (`groupLabels`) are keyed by this group's key.
  //   • `insertSheetOptions` — the same + a divider + `addSheet`. Used by the Home RIBBON, where an
  //     Insert Sheet entry point belongs. `addSheet` is sheet-scope; it only coincidentally sits with
  //     cell-insert here (it also lives in `sheetTabMenu`).
  // (Cell members carry `@insertCellsOptions` compact labels, so they read compact in the context menu
  //  and full in the ribbon dropdown — matching Excel, whose Home▸Insert shows fuller wording.)
  const insertCellMembers = ['insertCellsShiftDown', 'insertCellsShiftRight', '-', 'insertRows', 'insertColumns'];
  DefaultCommandButtonRegistry.register({
    key: 'insertCellsOptions',
    defaultKey: 'insertCells',
    members: insertCellMembers
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'insertSheetOptions',
    defaultKey: 'insertCells',
    members: [...insertCellMembers, '-', 'addSheet']
  }, true);

  // Delete split buttons — mirror of insert (`deleteCellsOptions` = context menu, `deleteSheetOptions`
  // = ribbon with `deleteSheet`).
  const deleteCellMembers = ['deleteCellsShiftUp', 'deleteCellsShiftLeft', '-', 'deleteRows', 'deleteColumns'];
  DefaultCommandButtonRegistry.register({
    key: 'deleteCellsOptions',
    defaultKey: 'deleteCells',
    members: deleteCellMembers
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'deleteSheetOptions',
    defaultKey: 'deleteCells',
    members: [...deleteCellMembers, '-', 'deleteSheet']
  }, true);

  // Group / ungroup split buttons (Data ribbon). The head takes the axis from the selection; the
  // members name it, as Excel Online's menu does. Auto Outline and the settings ride the Group
  // menu and Clear Outline the Ungroup menu, as in Excel.
  DefaultCommandButtonRegistry.register({
    key: 'groupOptions',
    defaultKey: 'group',
    members: ['groupRows', 'groupColumns', '-', 'autoOutline', 'outlineSettings']
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'ungroupOptions',
    defaultKey: 'ungroup',
    members: ['ungroupRows', 'ungroupColumns', '-', 'clearOutline']
  }, true);

  // --- Home toolbar alignment / text controls -------------------------------------------------------
  // Toggle groups whose head reflects the active member (was `TextEffectsCommandButton` /
  // `HorizontalAlignCommandButton` / `VerticalAlignCommandButton` / `TextRotateCommandButton`). Same
  // shape as `underlineOptions` / `textOverflowOptions`: `ToggleGroupButton` computes the active toggle
  // and `projectAs` picks how it surfaces on the head. Placement/order lives in the `homeToolbar`
  // `members` list, which references these by key.

  // Text Effects: kept as a bespoke component (a leaf render entry). Unlike the exclusive align /
  // underline groups, its members (strike / super / subscript) are non-exclusive - none or several can
  // be active at once - so there is no single "active member" to project onto a `ToggleGroupButton`
  // head. The component owns that quirk.
  // Chrome lives on the ENTRY (not inside the component) so it flows through the registry's
  // translation wrapper and the i18n extraction; the component reads its own entry.
  DefaultCommandButtonRegistry.register({
    key: 'textEffectsOptions',
    render: (props) => <TextEffectsCommandButton {...(props as any)}/>
  }, true);

  // Horizontal Alignment: quick follows the active alignment. The popup leads with a bespoke row of
  // indent decrease / increase icon buttons (an inline keyless `render` member) before the alignment
  // toggles. Those commands carry the `quickAction` tag, so pressing one does not dismiss the popup.
  DefaultCommandButtonRegistry.register({
    key: 'horizontalAlignOptions',
    render: (props, groupKey) => (
      <ToggleGroupButton {...props} groupKey={groupKey} projectAs="quick"/>
    ),
    members: [
      {
        render: ({ disabled }) => (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <CommandButton commandKey="formatIndentDecrease" groupKey="horizontalAlignOptions" disabled={disabled}/>
            <CommandButton commandKey="formatIndentIncrease" groupKey="horizontalAlignOptions" disabled={disabled}/>
          </Box>
        )
      },
      '-',
      'formatAlignLeftToggle',
      'formatAlignCenterToggle',
      'formatAlignRightToggle',
      'formatAlignJustifyToggle',
      '-',
      'formatAlignCenterContinuousToggle',
      'formatAlignFillToggle',
      'formatAlignDistributedHorizontalToggle'
    ]
  }, true);

  // Vertical Alignment: the head *icon* follows the active alignment (no quick command); falls back to
  // the vertical-bottom icon when none is set.
  DefaultCommandButtonRegistry.register({
    key: 'verticalAlignOptions',
    render: (props, groupKey) => (
      <ToggleGroupButton {...props} groupKey={groupKey} projectAs="icon" defaultIcon="TextVerticalBottom"/>
    ),
    members: [
      'formatAlignTopToggle',
      'formatAlignMiddleToggle',
      'formatAlignBottomToggle',
      '-',
      'formatAlignJustifyVerticalToggle',
      'formatAlignDistributedVerticalToggle'
    ]
  }, true);

  // Text Orientation: an Excel-quirky head (quick applies 315deg by default, flips to a reset-to-0deg
  // once a custom angle is set) - see `TextRotateGroupButton`. The `formatTextRotateCustom` member
  // renders a numeric angle input; it is a leaf render entry (registered below, like `copy`) so a bare
  // member reference resolves to it.
  DefaultCommandButtonRegistry.register({
    key: 'textRotateOptions',
    render: (props, groupKey) => (
      <TextRotateGroupButton {...props} groupKey={groupKey}/>
    ),
    members: [
      'formatTextRotate0',
      '-',
      'formatTextRotate315',
      'formatTextRotate45',
      'formatTextRotate90',
      'formatTextRotateVertical',
      'formatTextRotate270',
      '-',
      'formatTextRotateCustom'
    ]
  }, true);

  // Custom Text Rotation: a leaf render entry keyed by its command - a single numeric-angle input (was
  // the inline `InputCommandButton` in `TextRotateCommandButton`). Referenced by the member above.
  DefaultCommandButtonRegistry.register({
    key: 'formatTextRotateCustom',
    render: (props) => (
      <InputCommandButton
        {...(props as any)}
        commandKey="formatTextRotateCustom"
        // Compact in-menu label is the command's `@textRotateOptions` groupLabel (catalog-backed),
        // not a literal — the full label ("Custom Text Rotation") stays for the shortcut dialog.
        groupKey="textRotateOptions"
        parseInput={(value: string): number => {
          const num = parseFloat(value);
          if (isNaN(num) || !isFinite(num)) { // revert back to original value (blank is an example)
            throw new Error('Invalid number');
          }
          return num;
        }}
        inputProps={{
          type: "number",
          maxLength: 4 // Not honored for inputType number so we manage in onchange and keypress
        }}
      />
    )
  }, true);

  // --- Bespoke Home toolbar controls ----------------------------------------------------------------
  // Self-contained popups, registered as leaf render entries (the same escape-hatch shape as the
  // color/border controls). Placement/order lives in the `homeToolbar` `members` list, which references
  // these by key; plain command buttons there (bold / italic / format-painter) need no entry at all -
  // a bare command key resolves to the default button.
  DefaultCommandButtonRegistry.register({
    key: 'numberFormatOptions',
    // Thread the 2nd-arg groupKey through so the quick-format buttons resolve their compact labels;
    // `{...props}` alone drops it (groupShared carries no groupKey).
    render: (props, groupKey) => <NumberFormatCommandButton {...(props as any)} groupKey={groupKey}/>
  }, true);
  // Zoom level - the status bar's zoom popup, also listed on the View tab (`viewToolbar`). The
  // component reads this entry back for its label/tooltip.
  DefaultCommandButtonRegistry.register({
    key: 'sheetZoomOptions',
    render: (props, groupKey) => <SheetZoomCommandButton {...(props as any)} groupKey={groupKey}/>
  }, true);
  // Preset cell / table styles - leaf render entries keyed by the command they render (like the colors).
  DefaultCommandButtonRegistry.register({
    key: 'formatCellStyle',
    render: (props) => <PresetCellStylesCommandButton {...(props as any)} commandKey="formatCellStyle"/>
  }, true);
  // The bespoke table-style gallery. Listed inline on the Home tab (`homeToolbar`), and *contributed*
  // into the contextual Table tab (`tableToolbar`, owned by the react table contributor) right before
  // its clear-style command - so the studio's gallery enriches the react-owned tab without the react
  // layer knowing about this studio control.
  DefaultCommandButtonRegistry.register({
    key: 'formatTableStyle',
    contributions: { tableToolbar: { anchor: 'formatTableStyleClearTableStyle', order: -1 } },
    render: (props) => <PresetTableStylesCommandButton {...(props as any)} commandKey="formatTableStyle"/>
  }, true);
  // The Sparkline tab's colors (Excel's Sparkline Color and Marker Color, and the axis color),
  // contributed into the react-owned tab as the table-style gallery is into the Table tab: Sparkline
  // Color and the Marker Color menu before the Axis menu, Axis Color into it after Show Axis.
  DefaultCommandButtonRegistry.register({
    key: 'sparklineColorSeries',
    contributions: { sparklineToolbar: { anchor: 'sparklineAxisOptions', order: -2 } },
    render: sparklineColor('sparklineColorSeries')
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'sparklineMarkerColorOptions',
    contributions: { sparklineToolbar: { anchor: 'sparklineAxisOptions', order: -1, divider: 'after' } },
    members: [
      'sparklineColorNegative',
      'sparklineColorMarkers',
      'sparklineColorHigh',
      'sparklineColorLow',
      'sparklineColorFirst',
      'sparklineColorLast'
    ]
  }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorNegative', render: sparklineColor('sparklineColorNegative') }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorMarkers', render: sparklineColor('sparklineColorMarkers') }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorHigh', render: sparklineColor('sparklineColorHigh') }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorLow', render: sparklineColor('sparklineColorLow') }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorFirst', render: sparklineColor('sparklineColorFirst') }, true);
  DefaultCommandButtonRegistry.register({ key: 'sparklineColorLast', render: sparklineColor('sparklineColorLast') }, true);
  // The cell context menu's Sparklines submenu (`WorkbookContextMenu`), shown while the cell has one.
  DefaultCommandButtonRegistry.register({
    key: 'sparklineOptions',
    members: ['sparklineEditData', '-', 'sparklineClear', 'sparklineClearGroups']
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'sparklineColorAxis',
    contributions: { sparklineAxisOptions: { anchor: 'sparklineRightToLeftToggle', order: -1 } },
    render: sparklineColor('sparklineColorAxis')
  }, true);
  // The pivot table style gallery, a member of the contextual PivotTable tab (`pivotToolbar`, owned by
  // the react pivot contributor).
  DefaultCommandButtonRegistry.register({
    key: 'formatPivotStyle',
    render: (props) => <PresetPivotStylesCommandButton {...(props as any)} commandKey="formatPivotStyle"/>
  }, true);
  // The conditional-format scale galleries - Excel's Data Bars / Color Scales flyouts. Leaf render
  // entries keyed by the command they render (like the styles above), so the `conditionalFormatOptions`
  // menu keeps listing them by command key and gets the flyout for free.
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatDataBar',
    render: (props, groupKey) => (
      <PresetScalesCommandButton
        {...(props as any)}
        groupKey={groupKey}
        commandKey="conditionalFormatDataBar"
        scaleType="dataBar"
      />
    )
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatColorScale',
    render: (props, groupKey) => (
      <PresetScalesCommandButton
        {...(props as any)}
        groupKey={groupKey}
        commandKey="conditionalFormatColorScale"
        scaleType="colorScale"
      />
    )
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'conditionalFormatIconSet',
    render: (props, groupKey) => (
      <PresetScalesCommandButton
        {...(props as any)}
        groupKey={groupKey}
        commandKey="conditionalFormatIconSet"
        scaleType="iconSet"
      />
    )
  }, true);
};
