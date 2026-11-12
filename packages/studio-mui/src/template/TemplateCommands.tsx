import { memo, useEffect, useRef } from 'react';

import { defineLazyModule } from '@sheetxl/utils';

import {
  Command, DefaultCommandButtonRegistry, useCallbackRef, useNotifier, usePersistentState,
  type CommandContributionComponentProps
} from '@sheetxl/utils-react';

import { WorkbookIO } from '@sheetxl/react';

import { lazyModal, useModal } from '@sheetxl/utils-mui';

import { type TemplateEntry } from './useTemplateCatalog';

const LazyTemplateDialog = lazyModal(
  defineLazyModule('studio:templateDialog', () => import('./TemplateDialog')).load
);
const welcomeModule = defineLazyModule('studio:welcomeDialog', () => import('./WelcomeDialog'));
const LazyWelcomeDialog = lazyModal(welcomeModule.load);

/**
 * Load the welcome dialog and its catalog while the first workbook loads, so a welcome shown at
 * startup opens with the workbook rather than after it.
 *
 * @internal
 */
export const prefetchWelcome = (templatePath?: string): void => {
  welcomeModule.load().then(
    (module) => module.prefetchCatalog(templatePath),
    () => { /* showing it loads again, and reports */ }
  );
};

/** The argument `newWorkbookFromTemplate` and `showWelcome` accept. */
export interface TemplateDialogArgs {
  /**
   * The template catalog to show. Remembered for later dialogs, so a host passes it once.
   * Defaults to the published SheetXL templates.
   */
  templatePath?: string;
  /**
   * `showWelcome` only: the app is starting. The welcome is skipped when the user has unchecked
   * "Show at startup".
   */
  atStartup?: boolean;
}

/** Whether the welcome shows when the app starts. */
const SHOW_AT_STARTUP_KEY = 'studio.welcome.showAtStartup';

/**
 * Contributes the template commands onto the `app` scope: `newWorkbookFromTemplate` ("Choose a
 * template") and `showWelcome` (the startup surface).
 *
 * @remarks
 * Built only on public commands, as any plugin would be: a chosen template is handed to
 * `newWorkbook` as its `source`, which decides between replacing a clean workbook and opening a new
 * window.
 */
const TemplateCommands = memo((props: CommandContributionComponentProps) => {
  const { scope } = props;
  const { showModal } = useModal();
  const notifier = useNotifier();

  const refTemplatePath = useRef<string | undefined>(undefined);
  const [showAtStartup, setShowAtStartup] = usePersistentState<boolean>(SHOW_AT_STARTUP_KEY, true);

  const run = (key: string, args?: unknown): void => {
    void scope.resolve<void, any, unknown>(key)?.execute(args);
  };
  const openTemplate = (entry: TemplateEntry): void => {
    run('newWorkbook', { source: entry.sourceUrl, title: entry.title });
  };

  const showTemplates = useCallbackRef((args?: TemplateDialogArgs): void => {
    if (args?.templatePath) refTemplatePath.current = args.templatePath;
    const modal = showModal(LazyTemplateDialog, {
      templatePath: refTemplatePath.current,
      // Here too, so a user who turned the welcome off can find the way back.
      showAtStartup,
      onShowAtStartupChange: setShowAtStartup,
      onSelectTemplate: (entry: TemplateEntry) => {
        modal.hide();
        openTemplate(entry);
      },
      onDone: () => modal.hide(),
      onLoadError: (error: unknown) => {
        modal.destroy();
        notifier.showError(error as Error);
      }
    });
  }, [scope, showModal, showAtStartup, setShowAtStartup]);

  const showWelcome = useCallbackRef((args?: TemplateDialogArgs): void => {
    if (args?.templatePath) refTemplatePath.current = args.templatePath;
    if (args?.atStartup && !showAtStartup) return;
    const openWith = (key: string) => (): void => {
      modal.hide();
      run(key);
    };
    // A startup surface: the workbook behind it is a clean blank, so keeping it IS the blank workbook.
    const modal = showModal(LazyWelcomeDialog, {
      templatePath: refTemplatePath.current,
      showAtStartup,
      onShowAtStartupChange: setShowAtStartup,
      onBlank: () => modal.hide(),
      onOpenFromDevice: openWith('openWorkbook'),
      onOpenFromWeb: openWith('openWorkbookFromUrl'),
      onSelectTemplate: (entry: TemplateEntry) => {
        modal.hide();
        openTemplate(entry);
      },
      onDone: () => modal.hide(),
      onLoadError: (error: unknown) => {
        modal.destroy();
        notifier.showError(error as Error);
      }
    });
    // Whether the host can read is known only once the io layer has loaded, which at startup it
    // usually has not. Waiting for it held the dialog back by the whole io download, so the open
    // entries show at once and are taken away in the rare host that cannot read.
    void WorkbookIO.getReadFormats().then(() => {
      if (!WorkbookIO.canRead()) modal.update({ onOpenFromDevice: undefined, onOpenFromWeb: undefined });
    }, () => { /* an io that cannot load fails the open itself, which reports it */ });
  }, [scope, showModal, showAtStartup, setShowAtStartup]);

  useEffect(() => {
    const contribution = scope.contribution();
    contribution.updateCommand<void, any, TemplateDialogArgs>('newWorkbookFromTemplate', {
      tags: ['noTransaction', 'noRepeat'],
      callback: (args?: TemplateDialogArgs) => showTemplates(args)
    });
    contribution.updateCommand<void, any, TemplateDialogArgs>('showWelcome', {
      tags: ['noTransaction', 'noRepeat'],
      callback: (args?: TemplateDialogArgs) => showWelcome(args)
    });
    return () => contribution.remove();
  }, [scope, showTemplates, showWelcome]);

  return null;
});

TemplateCommands.displayName = 'TemplateCommands';

let registered = false;

/**
 * Registers the workbook templates feature: the template commands on the `app` scope and a
 * "From Template…" entry in the New menu. Idempotent.
 *
 * @remarks
 * The studio registers it by default. The command labels live in the studio catalog.
 */
export const TemplatesPlugin = (): void => {
  if (registered) return;
  registered = true;
  Command.DefaultCommandRegistry.registerDynamic('app', TemplateCommands);
  DefaultCommandButtonRegistry.register({
    key: 'templates.newFromTemplate',
    defaultKey: 'newWorkbookFromTemplate',
    contributions: { newWorkbookOptions: { order: 1 } }
  }, true);
};
