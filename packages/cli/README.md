# SheetXL CLI

<p align="center">
  <a href="https://www.sheetxl.com" target="_blank">
    <img src="https://www.sheetxl.com/logo-text.svg" alt="SheetXL Logo" width="180" />
  </a>
</p>

This examples creates a cli for interactive with the '@sheetxl/sdk.

This is also an entry point for debugging node functionality.

## To Run as a cli

``` shell
pnpm build
pnpm sheetxl extract assets/simple
```

::: note
Changes to packages are not auto rebuilt for running the built cli. If dev changes are needed use the launcher
or the Node CLI.
:::

```shell
npx sheetxl
```

In Node CLI

```shell title="Set a Value"
wb = new Workbook()
wb.getRange('a1').setValues([[1]])
wb.getRange('a1').getValues()
```

In Node CLI (from cli dir)

```shell title="Update a workbook"
handle = await readFile("./assets/simple.xlsx")
wb = handle.workbook
await writeFile("./assets/output.xlsx", wb)
```

See for more on node Repl. https://nodejs.org/api/repl.html
