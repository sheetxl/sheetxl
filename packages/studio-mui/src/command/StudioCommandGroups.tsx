import { DefaultCommandButtonRegistry, DynamicIcon } from '@sheetxl/utils-react';

import { UndoRedoCommandButton } from './UndoRedoCommandButton';
import { LanguageCommandButton } from './LanguageCommandButton';

import { registerWorkbookCommandGroups } from './WorkbookCommandGroups';

/**
 * Registers **studio-scoped** command groups - app/studio-level surfaces - and (by delegation) the
 * workbook and sheet groups it contains. Called once at studio module init (see `EagerStudio`).
 *
 * @remarks
 * The studio contains a workbook (which contains sheets), so this registers everything. Definitions
 * belong roughly to the command scope that creates their keys; keeping the three registrars split now
 * means each set can later move to its own package without untangling one function.
 */
export const registerStudioCommandGroups = (): void => {
  registerWorkbookCommandGroups();

  // File menu chrome — the panel itself is bespoke (`FileCommandButton` owns the popup with
  // write-format detection). The entry carries only its KEY: label/description live in the catalog
  // (`groups.cmd.json`, English included) and the component reads its own entry back.
  DefaultCommandButtonRegistry.register({
    key: 'fileOptions'
  }, true);
  // File > New: the ways to start a workbook. Plugins add theirs through `contributions`
  // (the templates feature adds "From Template…").
  DefaultCommandButtonRegistry.register({
    key: 'newWorkbookOptions',
    defaultKey: 'newWorkbook',
    members: [
      'newWorkbook'
    ]
  }, true);

  // Chrome-only entries for the other BESPOKE popup buttons (their popups are custom components, but
  // their head label/tooltip must resolve through the catalog like every other panel — the component
  // reads its own entry back instead of hardcoding a literal, which would never translate).
  // Key-only by design: no inline English anywhere — `groups.cmd.json` is the sole source.
  DefaultCommandButtonRegistry.register({
    key: 'appearanceOptions'
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'insertChartOptions'
  }, true);
  // Chrome for the Insert tab's cell control button (`InsertCellControlCommandButton`): the plain
  // checkbox button until a host registers another control type, then a split button over them.
  DefaultCommandButtonRegistry.register({
    key: 'insertCellControlOptions',
    defaultKey: 'insertCheckbox'
  }, true);
  DefaultCommandButtonRegistry.register({
    key: 'borderOptions'
  }, true);

  // Import Data: quick-click imports from a file; the popup offers file / web (modeled on insertImage).
  // The studio owns IO, so it *injects* this into the workbook-owned `dataToolbar` group at the start
  // (order < 0, no anchor → start edge), just before Workbook Links.
  DefaultCommandButtonRegistry.register({
    key: 'insertDataOptions',
    defaultKey: 'insertDataFromFile',
    contributions: {
      dataToolbar: { order: -1 }
    },
    members: [
      'insertDataFromFile',
      'insertDataFromURL'
    ]
  }, true);

  // Undo (its dropdown nests Redo). Studio-scoped - the studio owns the undo/redo stack - so it
  // *injects* into the workbook-owned Home toolbar at the start edge (`order < 0`), just like
  // `insertData` injects into `dataToolbar`. The leading `'-'` in `homeToolbar` separates it from Paste.
  DefaultCommandButtonRegistry.register({
    key: 'undo',
    contributions: { homeToolbar: { order: -1 } },
    render: (props) => <UndoRedoCommandButton {...(props as any)} quickCommand="undo"/>
  }, true);

  // Dark Mode: the grid / image dark-mode toggles are studio commands (they live in the studio's
  // persisted view state), so the studio *injects* them into the workbook-owned `viewToolbar`, grouped
  // with the sheet background just ahead of it. In a bare workbook (no studio) neither the commands nor
  // this panel exist.
  DefaultCommandButtonRegistry.register({
    key: 'darkModeOptions',
    contributions: { viewToolbar: { anchor: 'sheetBackgroundOptions', order: -1 } },
    members: [
      'enableDarkGrid',
      'enableDarkImages'
    ]
  }, true);

  // The UI language picker — backed by the studio `language` command (the active language is app
  // state contributed by `StudioCommandProvider`); the component supplies the registered-pack list.
  DefaultCommandButtonRegistry.register({
    key: 'language',
    render: (props) => <LanguageCommandButton {...(props as any)} variant="menuitem" />
  }, true);

  // Language & Region: a panel following the workbook theme. LANGUAGE is studio-scoped (which strings this
  // app renders); LOCALE is workbook-scoped (number/date formatting travels with the document, as
  // in Excel) — its command + picker are registered in `WorkbookCommandGroups`, referenced here.
  DefaultCommandButtonRegistry.register({
    key: 'languageOptions',
    contributions: { viewToolbar: { anchor: 'selectTheme', order: 1 } },
    members: [
      'language',
      'locale'
    ]
  }, true);

  // Full Screen: a studio command (it targets the whole app shell, not the workbook), injected into
  // the view toolbar just after Freeze Panes - both decide how much of the grid is in view.
  DefaultCommandButtonRegistry.register({
    key: 'fullScreenToggleView',
    defaultKey: 'fullScreenToggle',
    contributions: { viewToolbar: { anchor: 'freezeOptions', order: 1 } }
  }, true);

  // Help: a popup-only head (no quick command) - the status bar's trailing help button.
  DefaultCommandButtonRegistry.register({
    key: 'helpOptions',
    getIcon: () => <DynamicIcon iconKey="Help" style={{ transform: 'scale(0.75)' }}/>,
    members: [
      'showKeyboardShortcuts',
      '-',
      'gotoUrlGithub',
      'gotoUrlDiscord',
      'gotoUrlDocumentation',
      'gotoUrlIssue'
    ]
  }, true);
};
