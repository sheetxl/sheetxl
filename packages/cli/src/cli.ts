#!/usr/bin/env node

import util from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import open from 'open';
import repl, { REPLServer } from 'node:repl'; // , { REPLServer }
import { type Context } from 'node:vm';

import chalk from 'chalk'; // Import chalk
// import isGit from 'git-branch-is';

import * as SDK from '@sheetxl/sdk';
import * as IO from '@sheetxl/io'; // Import the whole module
import { WorkbookIO, type ReadWorkbookOptions, type WriteWorkbookOptions } from '@sheetxl/io';
import type { IWorkbook } from '@sheetxl/sdk';

import { help } from './commands/help.ts'; // Import the help command

// Force color level for testing purposes
if (process.stdout.isTTY) {
  chalk.level = 2; // 1 = basic 16 colors, 2 = 256 colors, 3 = truecolor
}

import { createCommand, Argument, Option, type Command } from 'commander';
// import pkg from '../package.json' with { type: "json" }; // need for visual studio code debugging?

async function main(): Promise<any> {
  const pkg = {
    version: __BUILD_VERSION__,
    description: 'SheetXL CLI',
  }

  // Check if there are any arguments other than the node executable and the script name.
  // process.argv contains: ['/path/to/node', '/path/to/cli.js', 'arg1', 'arg2', ...]
  const hasCommands = process.argv.length > 2;
  if (!hasCommands) { // repl mode
    // Before general commands but after license commands
    await SDK.LicenseManager.print();
    console.log(`${chalk.green('Welcome to the SheetXL REPL!')}`);
    console.log(`${chalk.dim(`Type ${chalk.cyan('.help')} for REPL commands, or ${chalk.cyan('help')} for SheetXL API info.`)}`);
    /**
     * This custom writer function checks the type of the output.
     */
    const writer = (output: any): string => {
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

    // // Function to get the git branch, or an empty string if not a git repo
    // const getGitBranch = (): string => {
    //   try {
    //     // isGit.get() returns the current branch name
    //     const branch = isGit.get();
    //     return branch ? chalk.dim(` (${branch})`) : '';
    //   } catch (e) {
    //     return ''; // Not a git repository
    //   }
    // };
    // We could make this show eval
    const pwd = ''; // ${chalk.bold(getGitBranch())}

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

    // The completer function
    // const completer = (line: string) => {
    //   // TODO - perhaps use the typescript
    //   const completions = Object.keys(SDK); // Get all exports from your SDK
    //   completions.push('readFile', 'writeFile', 'readWorkbook', 'writeWorkbook'); // Add custom commands
    //   const hits = completions.filter((c) => c.startsWith(line));
    //   // If we have hits, return them. Otherwise, return the full list.
    //   return [hits.length ? hits : completions, line];
    // };

    const replServer: REPLServer = repl.start({
      prompt: `${chalk.cyanBright('SheetXL')}${pwd}${chalk.cyan(' > ')}`,
      // completer,
      writer,
      preview: false, // calls functions before we want it to
      ignoreUndefined: true,
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

    // Iterate over all named exports from WorkbookIO and add them to the context
    replServer.context.workbookIO = WorkbookIO; // deliberate shift in casing

    // TODO - should we give a third argument that is a callback to be like node readFile?
    const readFile = (fileName: string, options?: Omit<ReadWorkbookOptions, 'source'>) => {
      const normalized = path.normalize(fileName);
      const contents = fs.readFileSync(normalized);
      const fileObject = new File([contents], normalized);
      return WorkbookIO.read({
        ...options,
        source: fileObject
      });
    };
    replServer.context.readFile = readFile;

    replServer.context.readWorkbook = async (fileName: string, options?: Omit<ReadWorkbookOptions, 'source'>): Promise<IWorkbook> => {
      const handle = await readFile(fileName, options);
      return handle.workbook;
    };

    const writeFile = (fileName: string, workbook: IWorkbook, options?: Omit<WriteWorkbookOptions, 'destination'>) => {
      const normalized = path.normalize(fileName);
      WorkbookIO.writeFile(normalized, workbook);
    };
    replServer.context.writeFile = writeFile;
    replServer.context.writeWorkbook = writeFile; // just an alias

    // Iterate over all named exports from SDK and add them to the context
    // replServer.context.sdk = SDK; // ? Or as sdk?
    for (const key in SDK) {
      if (key === '_') {
        // console.log('in sdk', (SDK as any)[key]);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(SDK, key)) {
        (replServer.context as any)[key] = (SDK as any)[key];
      }
    }

    for (const key in IO) {
      if (key === '_') {
        // console.log('in io', (IO as any)[key]);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(IO, key)) {
        (replServer.context as any)[key] = (IO as any)[key];
      }
    }
    // replServer.context.io = IO; // ? Or as sdk?
    // replServer.context.help = help;
    Object.defineProperty(replServer.context, 'help', {
      get() {
        return help();
      }
    });

    return new Promise((resolve) => {
      replServer.on('exit', () => resolve(0));
    });
  }
  // command mode
  const program:Command = createCommand('sheetxl');

  const modules = {
    sdk: SDK,
    io: IO,
    program,
  }
  program
    .version(pkg?.version ?? '1.0.0')
    .description(pkg?.description ?? '')
    .showHelpAfterError('(add --help for additional information)')
    .addOption(new Option('--verbose', 'To be verbose.'))
    .hook('preAction', () => {
      // updateNotifier({ pkg }).notify({
      //   isGlobal: true,
      // });
    });

  program
    .command('activate')
    .description('Activate License key.')
    .addArgument(new Argument('<licenseKey>', 'The license key.').argRequired())
    .addHelpText('after', `Visit https://my.sheetxl.com to get your license key.`)
    .action(async (...args: any[]) => {
      const module = await import('./commands/activate.ts');
      await module.default(args, modules);
    });

    program
    .command('getNodeId')
    .description('Get the Node ID.')
    .addHelpText('after', `Returns a nodeId useable for license key activation.`)
    .action(async (...args: any[]) => {
      const id = await SDK.LicenseManager.getNodeId();
      console.log(id);
    });

  // program
  //   .option('--license <key>')
  //   .description('override license key for this run')
  //   .action(async (...args: any[]) => {
  //     // set temp variable
  //     await module.default(args, program);
  //   });
  // Before general commands but after license commands
  await SDK.LicenseManager.getDetails();

  /**
   * Command register
   *
   * @see https://github.com/tj/commander.js
   */
  // TODO - can for the commands later. Would need to have tsdocs or something
  program
    .command('extract')
    .description('Extract values.')
    .addArgument(new Argument('<file>', 'File to extract.').argRequired())
    .addArgument(new Argument('<range>', 'A workbook range to extract.').argOptional())
    .addOption(new Option('--password [password]', 'The password used to open the workbook.'))
    .hook('preAction', () => {
      // Maybe you want to check something, try to use hooks.
      // updateNotifier({ pkg }).notify({
      //   isGlobal: true,
      // });
    })
    .action(async (...args: any[]) => {
      const module = await import('./commands/extract.ts');
      await module.default(args, modules);
    });

  program.parseAsync(process.argv);
}

main();