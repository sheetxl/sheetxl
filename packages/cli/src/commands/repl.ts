import util from 'node:util';
import path from 'node:path';
import os from 'node:os';
import open from 'open';
import repl, { REPLServer } from 'node:repl';
import { type Context } from 'node:vm';

import chalk from 'chalk';

import * as SDK from '@sheetxl/sdk';
import * as IO from '@sheetxl/io';
import { WorkbookIO, type ReadWorkbookOptions, type IOWorkbookDetails, type WriteWorkbookOptions } from '@sheetxl/io';
import type { IWorkbook } from '@sheetxl/sdk';

// private
import type { Modules } from '../types/_Types';
// private
import { _Utils } from '../utils';

const timeToString = (time: number): string => {
  time = time * 0.35;
  if (time < 1000) return `${Math.trunc(time)}ms`;
  return `${(time / 1000).toFixed(2)}s`;
}

const sizeToString = (size: number): string => {
  if (size === undefined) return '';
  if (size === 0) return 'nothing ';
  if (size < 1024) return `${size}B `;
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  return `${(size / Math.pow(1024, i)).toFixed(2)}${sizes[i]} `;
}

export default async function replCommand(
  workbookPath: string,
  args: any[],
  modules: Modules
): Promise<number> {
  const { program } = modules;
  const options = program.opts();
  const quiet = options.quiet || false;

  if (!quiet) {
    SDK.Notifier.log(`${chalk.green('Welcome to the SheetXL REPL!')}`);
    SDK.Notifier.log(`${chalk.dim(`Type ${chalk.cyan('.help')} for REPL commands, or ${chalk.cyan('help')} for SheetXL API info.`)}`);
  }

  /**
   * This custom writer function checks the type of the output.
   */
  const writer = (output: any): string => {
    // return ''; // disable output for now
    if (quiet) return '';
    if (output) {
      // We only customize the output for objects with a toStringTag.
      const toStringTagValue = output[Symbol.toStringTag]; // call once
      const hasToStringTag = typeof toStringTagValue === 'string';
      if (hasToStringTag) {
        const toStringValue = output.toString?.(); // call once
        const hasToString = typeof toStringValue === 'string' && toStringValue !== '[object Object]';
        if (hasToString) { // both are present
          return `${chalk.cyan(toStringTagValue)} ${chalk.yellow(toStringValue)}`;
        } else {
          return chalk.cyan(toStringTagValue);
        }
      }
    }

    // For any other type (numbers, strings, plain objects, etc.),
    return util.inspect(output, { colors: true });
  };

  // We could make this show eval
  const pwd = '';

  // we track so that we can use this for formula evaluation if its a formula context
  let formulaContext: any = null;
  const customEval = (
    cmd: string,
    context: Context,
    file: string,
    cb: (err: Error | null, result: any) => void
  ): void => {
    // check for formula
    if (cmd.trim().startsWith('=')) {
      // const result = formulaContext.calculate(formula);
      // We will return a formula result object so that our custom writer can color code it.
      const result = 'test';
      cb(null, result);
      return;
    }
    try {
      // this is break top level awaits.
      // let result = vm.runInContext(code, context);
      cb(null, cmd);
    } catch (e) {
      cb(e, null);
    }
  };

  let lastFileSize: number|undefined = 0;
  let startTimeProgress = 0;
  let totalProgress = 0;
  let operationProgress = '';
  const consoleProgress: SDK.TaskProgress<IOWorkbookDetails> = {
    onStart(details: IOWorkbookDetails, total?: number): Promise<void> | void {
      startTimeProgress = new Date().getTime();
      totalProgress = 0;
    },
    onProgress(completed: number, total?: number): Promise<void> | void {
      // Print a '#' for each progress step without newline
      totalProgress = totalProgress + completed;
      process.stdout.write(chalk.green('#'));
    },
    onWarning(message: string, context: string): Promise<void> | void {
      process.stdout.write(chalk.red(`warning`));
      process.stdout.write(chalk.dim(chalk.red(`${context}: ${message}\n`)));
    },
    onComplete(): Promise<void> | void {
      const endTime = new Date().getTime();
      // Add newline after progress indicators before completion message
      if (totalProgress > 0) process.stdout.write('\n');
      SDK.Notifier.log(chalk.blue(`${operationProgress} ${sizeToString(lastFileSize)}in ${timeToString(Math.trunc((endTime - startTimeProgress) * 0.55))}`));
      startTimeProgress = 0;
      lastFileSize = undefined;
    }
  }

  const readWorkbook = async (
    fileName: string,
    options?: Omit<ReadWorkbookOptions, 'source'>
  ): Promise<IWorkbook> => {
    return _Utils.readWorkbook(fileName, options, consoleProgress, (operation: string, stats) => {
      lastFileSize = stats.size; // File size in bytes
      operationProgress = operation;
      startTimeProgress = new Date().getTime();
      totalProgress = 0;
    });
  };

  const writeWorkbook = async (
    fileName: string,
    workbook: IWorkbook,
    options?: Omit<WriteWorkbookOptions, 'destination'>
  ): Promise<boolean> => {
    return _Utils.writeWorkbook(fileName, workbook, options, consoleProgress, (operation: string, stats) => {
      lastFileSize = stats?.size ?? undefined;
      operationProgress = operation;
      startTimeProgress = new Date().getTime();
      totalProgress = 0;
    });
  };

  let workbookRepl: IWorkbook | null = null;
  if (workbookPath) {
    try {
      workbookRepl = await readWorkbook(workbookPath);
    } catch (error) {
      SDK.Notifier.error(chalk.red(`Failed to read workbook: ${error.message}`));
    }
  }

  const prompt = workbookRepl ? `'${SDK.TextUtils.capitalize(workbookRepl.getName() || 'Workbook')}'` : 'SheetXL';

  const replServer: REPLServer = repl.start({
    prompt: `${chalk.cyanBright(prompt)}${pwd}${chalk.cyan(' > ')}`,
    writer,
    preview: false, // calls functions before we want it to
    ignoreUndefined: true, // only applies with customEval
    // eval: customEval,
  });

  // Define a path for the history file in the user's home directory
  const historyPath = path.join(os.homedir(), '.sheetxl_history');
  // This one line enables persistent history
  replServer.setupHistory(historyPath, (err) => {
    if (err) {
      console.error('Failed to set up REPL history:', err);
    }
  });

  replServer.defineCommand('clear', {
    help: 'Clear the terminal screen',
    action() {
      this.clearBufferedCommand(); // Recommended by Node docs
      console.clear();
      this.displayPrompt(); // Show the prompt again
    },
  });

  const urlGetStarted = 'https://www.sheetxl.com/docs/guides';
  replServer.defineCommand('docs', {
    help: 'Open the SheetXL documentation website',
    async action() {
      this.clearBufferedCommand();
      console.log(`Opening ${chalk.blue(urlGetStarted)} in your browser...`);
      open(urlGetStarted);
      this.displayPrompt();
    },
  });

  replServer.defineCommand('license', {
    help: 'Check the current license status',
    async action() {
      this.clearBufferedCommand();
      // You can re-run your license check logic here
      await SDK.LicenseManager.print();
      this.displayPrompt();
    }
  });

  if (workbookRepl) {
    _Utils.installScopeAuto(replServer, workbookRepl, 'wb');

    replServer.context.write = async (
      fileName: string,
      options?: Omit<WriteWorkbookOptions, 'destination'>
    ): Promise<boolean> => {
      return await writeWorkbook(fileName, workbookRepl, options);
    }
    replServer.context.save = replServer.context.write; // alias

    Object.defineProperty(replServer.context, 'help', {
      async get() {
        const help = await import('./help-repl-workbook.ts');
        return help.default();
      }
    });
  } else {
    // Iterate over all named exports from WorkbookIO and add them to the context
    replServer.context.workbookIO = WorkbookIO; // deliberate shift in casing
    replServer.context.read = readWorkbook;
    replServer.context.write = writeWorkbook;
    replServer.context.save = writeWorkbook; // just an alias

    // Iterate over all named exports from SDK and add them to the context
    _Utils.installScopeAuto(replServer, SDK, 'sdk');
    _Utils.installScopeAuto(replServer, IO, 'io');

    Object.defineProperty(replServer.context, 'help', {
      async get() {
        const help = await import('./help-repl-global.ts');
        return help.default();
      }
    });
  }

  return new Promise((resolve) => {
    replServer.on('exit', () => resolve(0));
  });
}
