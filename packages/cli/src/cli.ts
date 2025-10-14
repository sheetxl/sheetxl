#!/usr/bin/env node

import chalk from 'chalk'; // Import chalk

import * as SDK from '@sheetxl/sdk';
import * as IO from '@sheetxl/io'; // Import the whole module

// Force color level for testing purposes
if (process.stdout.isTTY) {
  chalk.level = 2; // 1 = basic 16 colors, 2 = 256 colors, 3 = truecolor
}

import { createCommand, Argument, Option, type Command } from 'commander';
// import pkg from '../package.json' with { type: "json" }; // need for visual studio code debugging?

async function main(): Promise<void> {
  const pkg = {
    version: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'local',
    description: 'SheetXL CLI',
  }

  let quiet:boolean = false;
  // color code.
  // TODO - allow for no output with a --quiet flag.
  SDK.Notifier.setOverrides({
    warn(message: string, options?: SDK.NotifierOptions): void {
      const details = options?.details;
      console.warn(chalk.red(message, details ? chalk.dim(details) : ''));
    }

  });
  // command mode
  const program:Command = createCommand('sheetxl')
    .hook('preAction', async (
      thisCommand: Command,
      actionCommand: Command,
    ) => {
      const licenseCommands = ['activate', 'deactivate', 'license'];
      const actionName = actionCommand.name();
      if (!licenseCommands.includes(actionName)) {
        // ensure license details are printing before any other items.
        await SDK.LicenseManager.getDetails();
      }
      if (actionName === 'sheetxl' || actionName === 'repl') {
        if (!SDK.LicenseManager.wasPrinted()) {
          const details = await SDK.LicenseManager.getDetails();
          if (!quiet && (!details.isEval() || details.hasExceptions())) {
            await SDK.LicenseManager.printBanner();
            SDK.Notifier.log('');
          }
        }
      }
    })

  const modules = {
    sdk: SDK,
    io: IO,
    notifier: SDK.Notifier,
    program,
  }

  program
    .version(pkg?.version ?? '1.0.0')
    .description(pkg?.description ?? '')
    .showHelpAfterError(false) //(add --help for additional information)')
    .addOption(new Option('--quiet', 'To be quiet.'))
    .hook('preAction', () => {
      quiet = program.opts().quiet;
    })
    .action(async () => {
      // Default action: if no command provided, start REPL
      const module = await import('./commands/repl.ts');
      await module.default(null, [], modules);
    });

  // Handle unknown commands
  program.on('command:*', function (operands) {
    console.error(chalk.red(`Unknown command: ${operands[0]}`));
    console.error(chalk.dim('Run "sheetxl --help" to see available commands.'));
    process.exit(1);
  });

  // Custom error handling for better messages
  program.configureOutput({
    writeErr: (str) => {
      // Customize error messages
      if (str.includes('too many arguments')) {
        const match = str.match(/Expected (\d+) arguments but got (\d+)/);
        if (match) {
          console.error(chalk.red('Invalid command or arguments.'));
          console.error(chalk.dim('Run "sheetxl --help" to see available commands.'));
          return;
        }
      }
      process.stderr.write(chalk.red(str));
    }
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

  program.command('deactivate')
    .description('Deactivate License key.')
    .addHelpText('after', `Remove license key.`)
    .action(async (...args: any[]) => {
      const module = await import('./commands/deactivate.ts');
      await module.default(args, modules);
    });

  program.command('license')
    .description('Print the license')
    .addHelpText('after', `Print the license.`)
    .action(async (...args: any[]) => {
      await SDK.LicenseManager.print(true);
    });
  // Before general commands but after license commands

  program
    .command('run')
    .option('--stdio')
    .option('-w --workbook <file>')
    .argument('<script>')              // the script file
    .argument('[scriptArgs...]')       // capture ALL remaining tokens as an array
    .description('Run a TypeScript or JavaScript script.')
    .addHelpText('after', `\nExample:\n  sheetxl run script.ts\n  sheetxl run myScript.js`)
    .action(async (script: string, scriptArgs: string[], opts: Record<string, string>) => {
      const module = await import('./commands/run.ts');
      await module.default(modules, script, scriptArgs, opts);
    });

  // this is repl help
  // program
  //   .command('help')
  //   .description('Show help information.')
  //   .action(async (...args: any[]) => {
  //     const module = await import('./commands/help.ts');
  //     await module.default(args, modules);
  //   });

  /**
   * Explicit repl command (same as default)
   */
  program
    .command('repl')
    .argument("[workbook]", "Workbook file to load")
    .description('Start interactive REPL mode.')
    .addHelpText('after', `\nRun either with no arguments or with a workbook`)
    .action(async (workbookPath?: string, ...args: any[]) => {
      const module = await import('./commands/repl.ts');
      await module.default(workbookPath, args, modules);
    });

  await program.parseAsync(process.argv);
}

main();