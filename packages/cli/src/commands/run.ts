import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk'; // Import chalk

import { IWorkbook, Notifier } from '@sheetxl/sdk';

import type { ArgV, Context } from '../types';

// private
import type { Modules } from '../types/_Types';
// private
import { _Utils } from '../utils';

export default async (modules: Modules, script: string, scriptArgs: string[], opts: Record<string, string>): Promise<void> => {

  const args: ArgV = _Utils.parseTailArgs(scriptArgs);

  let workbook: IWorkbook | null = null;
  if (opts.workbook) {
    try {
      // TODO - if not quiet then add progress
      // TODO - const options = _Utils.parseCompositeOptions('in', args);
      const options = {};
      workbook = await _Utils.readWorkbook(opts.workbook, options);
    } catch (error) {
      Notifier.error(`Unable to parse '${opts.workbook}' as a workbook`, { details: error });
      return;
      // process.exit(1);
    }
    if (workbook) {
      // TODO - Notifier.log(`Using workbook '${asPath}'`);
    }
  }

  const ctx: Context = {
    sdk: modules.sdk,
    io: modules.io,
    notifier: modules.notifier,
    args,
    workbook,
  }

  const fileName: string = script;
  // Resolve the full path to the script
  const scriptPath = path.resolve(process.cwd(), fileName);
  // Check if file exists
  if (!fs.existsSync(scriptPath)) {
    Notifier.error(`Script not found:`, { details: scriptPath });
    return;
  }

  // Check if file is readable
  try {
    fs.accessSync(scriptPath, fs.constants.R_OK);
  } catch (error: any) {
    Notifier.error('Unable to read file:', { details: scriptPath });
    return;
    // process.exit(1);
  }

  const ext = path.extname(scriptPath).toLowerCase();
  try {
    // For TypeScript files, use tsx loader
    if (ext === '.ts' || ext === '.tsx') {
      // Use tsx to register TypeScript loader and import
      const { register } = await import('tsx/esm/api');
      const unregister = register();

      try {
        const fileUrl = pathToFileURL(scriptPath).href;
        const module = await import(fileUrl);

        // Execute default export if it's a function
        if (typeof module.default === 'function') {
          await module.default(ctx);
        }
      } finally {
        unregister();
      }
    }
    // For JavaScript files, use dynamic import directly
    else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      const fileUrl = pathToFileURL(scriptPath).href;
      const module = await import(fileUrl);
      // Execute default export if it's a function
      if (typeof module.default === 'function') {
        await module.default(ctx);
      }
    }
    else {
      Notifier.error(`Unsupported file type:`, { details: `${ext} (expected .ts, .tsx, .js, .mjs, or .cjs)` });
      return;
      // process.exit(1);
    }

    // Notifier.log(chalk.green(`✓ Script completed successfully`));
  } catch (error: any) {
    Notifier.error('Script execution failed:', { details: error.message });
    if (error.stack) {
      console.error(chalk.dim(error.stack));
    }
    return;
    // process.exit(1);
  }
}