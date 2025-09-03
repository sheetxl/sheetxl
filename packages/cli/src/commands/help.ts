import chalk from 'chalk'; // Import chalk

export const help = () => {
  console.log(
`🧠 SheetXL REPL Help:

Available helpers:
- readWorkbook(path):       Reads a file and returns a SheetXL workbook
- writeWorkbook(path, wb):  Writes a workbook to a file (alias for writeFile)

- readFile(path):           Reads a file into a workbook handle
- writeFile(path, wb):      Writes a workbook to a file

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