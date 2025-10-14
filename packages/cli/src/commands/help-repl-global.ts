import chalk from 'chalk'; // Import chalk

// private
import type { Modules } from '../types/_Types';

export default (args?: any[], modules?: Modules): void => {
  console.log(
`🧠 SheetXL REPL Help:

Available helpers:
- read(path):       Reads a file and returns a SheetXL workbook
- write(path, wb):  Writes a workbook to a file (alias for writeFile)

Available namespaces:
- SheetXL SDK (from @sheetxl/sdk)
- SheetXL IO (from @sheetxl/io)

Tips:
- You can access any @sheetxl/sdk API directly, e.g., new Workbook()
- Use .exit to leave the REPL

To see the full API documentation, visit:
📚 Getting Started: ${chalk.blue('https://www.sheetxl.com/docs/guides/getting-started/cli')}
📚 API: ${chalk.blue('https://api.sheetxl.com')}
`
);
}