# SheetXL CLI

<p align="center">
  <a href="https://www.sheetxl.com" target="_blank">
    <img src="https://www.sheetxl.com/logo-text.svg" alt="SheetXL Logo" width="180" />
  </a>
</p>
# @sheetxl/runner

The `SheetXL` runner library enables simple execution of predefined scripts for updating
workbooks.

## Install

```bash
npm i -D @sheetxl/runner
```

## Using  the runner

``` ts
export type Runner = (workbook: IWorkbook | null, args: ArgV | undefined, options: RunOptions) => Promise<IWorkbook | any | void>;
```

The two data inputs are positional — the workbook and the args. Everything else is host wiring and
lives in `RunOptions`, `target` included.

`run` hands back whatever the script returned: a tally, a range, nothing. A returned `IWorkbook` is
also the workbook the run ended on — the one to write for `--save`/`--out` — so a host that needs it
reads it off the result:

```ts
const result = await Runner.run(wb, args, { target: 'scripts/transform.ts' });
const ended = (result as IWorkbook)?.isIWorkbook ? result as IWorkbook : wb;
```

``` ts
import { Workbook } from '@sheetxl/sdk';
import { Runner } from '@sheetxl/runner';

const wb = new Workbook();

await Runner.run(wb, { raw: ['--region', 'EU'], kv: { region: 'EU' }, _: [] }, {
  target: 'scripts/transform.ts'
});

```

## Example Runner Script

This is a basic runner script. Runners scripts are designed to update a workbook
the load/saving is handled by the runner.

This examples reads the region argument and updates the first cell.

```ts
import Runner, { type RunContext } from '@sheetxl/runner';

export default async function main(ctx: RunContext) {
  const { wb, log, args } = ctx;
  wb.getWorksheet().getRange('A1').setValue(args.region);
  log('updated value');
}
```
