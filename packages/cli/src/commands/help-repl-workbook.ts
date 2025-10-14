import chalk from 'chalk'; // Import chalk

// private
import type { Modules } from '../types/_Types';

export default (args?: any[], modules?: Modules): void => {
  console.log(
`🧠 SheetXL REPL Workbook Help:

Available helpers:
- write(path):  Writes a workbook to a file

Available namespaces:
- SheetXL SDK (from @sheetxl/sdk)
- SheetXL IO (from @sheetxl/io)

Tips:
- You can access any Workbook API directly, e.g., getRange('A1:E5')
- Use .exit to leave the REPL

To see the full API documentation, visit:
📚 Getting Started: ${chalk.blue('https://www.sheetxl.com/docs/guides/getting-started/cli')}
📚 API: ${chalk.blue('https://api.sheetxl.com')}
`
);
}