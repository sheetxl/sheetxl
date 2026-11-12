---
sidebar_position: 65
title: Write a Runner Script
description: Write a script once and run it from the CLI, from your own Node program, or from an AI agent.
---

A **runner script** is a TypeScript (or JavaScript) file that does one job to a workbook: load
it, change it, report on it, hand it back. You write the job. The runner handles the rest: opening
the file, giving your script a workbook, collecting what it logs, and saving the result.

The same script runs from three places with no changes:

| Where | How it starts |
| --- | --- |
| The terminal | `sheetxl -f script.ts book.xlsx` |
| Your own Node program | `Runner.run(wb, args, { target: 'script.ts' })` from `@sheetxl/runner` |
| An AI agent | The MCP server's `run` tool, with the same script |

## Your first runner script

A runner script exports a default function that takes a `RunContext`:

```ts title="hello.ts"
import { type RunContext } from '@sheetxl/runner';

export default function main(ctx: RunContext) {
  const { wb, log } = ctx;
  const sheet = wb!.getWorksheet();
  sheet.getRange('A1').setValue('Hello from a runner script');
  log('wrote A1 on', sheet.getName());
}
```

Run it against a workbook and save the result somewhere new:

```bash
npx sheetxl -f hello.ts book.xlsx --out hello.xlsx
```

That's it. Name no workbook and you get a blank one. Add `--save` instead of `--out` to write back
to the file you opened. Nothing is written unless you ask.

## The run context

Every script sees the same five things, whichever way it was started:

| Member | What it is |
| --- | --- |
| `wb` | The workbook the run is against. The CLI always provides one (blank if you named none). A host calling `Runner.run` directly may pass `null`. |
| `args` | Anything passed after `--` on the command line, parsed for you (see below). |
| `log` | Your reporting channel. Works like `console.log`: `log('rows:', n)`. Log an SDK object, such as `log(range.getStats())`, and it renders as a markdown report. Log a promise and the settled value is printed. |
| `warn` | Something surprising but survivable. Goes to stderr. |
| `error` | Something wrong. Goes to stderr. |

Use `log` rather than `console.log`. On the CLI they look alike, but `log` is what travels to an
agent or a UI host, and it knows how to render SDK objects.

### Arguments

Everything after `--` reaches your script as `args`:

```bash
npx sheetxl -f summarize.ts book.xlsx -- --region EU --dry-run report.csv
```

```ts
ctx.args.region    // 'EU'          named flags are spread onto args itself
ctx.args['dry-run'] // true         a flag with no value is a boolean
ctx.args._         // ['report.csv'] positionals, in order
ctx.args.kv        // { region: 'EU', 'dry-run': true }
ctx.args.raw       // the tail exactly as typed
```

Values are strings or booleans. Coerce them yourself (`Number(args.limit)`). Repeated flags keep
the last one. Reading `args.region` is the form that also works when an agent calls the script
through MCP, where `args` is the caller's JSON object.

## What to return

Return whatever answers the question. The CLI renders it the way it renders an inline expression:
an SDK object becomes a report, a plain object or array becomes a table, a scalar prints plainly,
and `--json` gives the raw value. Returning nothing is normal when the output is your `log`.

One return value is special. **Return an `IWorkbook` and it becomes the workbook of the run**: the
one written by `--save` or `--out`, and the one the next script in a chain receives. That is how a
script that builds a workbook from scratch hands it back:

```ts title="generate.ts"
import { Workbook } from '@sheetxl/sdk';
import { type RunContext } from '@sheetxl/runner';

export default async function main(ctx: RunContext) {
  const wb = ctx.wb ?? new Workbook();
  const sheet = wb.getWorksheetAt(0);
  sheet.setName('Budget');
  sheet.getRange('A1:C1').setValues([['Region', 'Q1', 'Q2']]);
  sheet.getRange('A2:C3').setValues([['North', 1200, 1500], ['South', 2000, 2250]]);
  sheet.getRange('D2').setValue('=B2+C2');
  await wb.getCalculation().ready();
  ctx.log('built', sheet.getName());
  return wb;
}
```

```bash
npx sheetxl -f generate.ts --out budget.xlsx
```

If you change the workbook you were given and return nothing, that workbook is still what gets
saved. You only need to return a workbook when you made a new one.

## Chaining scripts

Repeat `-f` and the scripts run in order, each receiving the workbook the previous one left:

```bash
npx sheetxl -f normalize.ts -f validate.ts -f summarize.ts raw.xlsx --out clean.xlsx
```

The run's printed result is the last script's return value. `args` are shared by every script in
the chain, like environment variables in a shell pipeline.

Each script runs as **one transaction**: one undo step, one round of change events, and a script
that throws leaves the workbook untouched. This also keeps a script that writes many cells fast,
because the writes share one commit instead of paying for one each.

## Embedding the runner in your own program

`@sheetxl/runner` is a small MIT library for Node. Use it when your build step, server job, or test
suite should run scripts the same way the CLI does.

```bash
npm install @sheetxl/runner @sheetxl/sdk @sheetxl/io
```

```ts title="build-report.ts"
import { WorkbookIO } from '@sheetxl/sdk';
import { IOPlugin } from '@sheetxl/io';
import Runner from '@sheetxl/runner';

await WorkbookIO.install(IOPlugin);

const wb = await WorkbookIO.read('data/raw.xlsx');

const result = await Runner.run(
  wb,
  { raw: ['--region', 'EU'], kv: { region: 'EU' }, _: [] },
  { target: 'scripts/transform.ts' }
);

// The script may have returned a new workbook; otherwise it worked on `wb`.
const ended = (result as any)?.isIWorkbook ? result : wb;
await WorkbookIO.write(ended, 'out/report.xlsx');
```

`run` takes the workbook and the args as positional arguments, then an options object. The
options are where the host wiring lives:

| Option | What it does |
| --- | --- |
| `target` | What to run: a path or URL to a `.ts`/`.js` file, `{ code, filename }` for inline source, `{ runner: fn }` for a function you already have, or an array of any of these to run as a pipeline. |
| `timeoutMs` | Fail the run if a script takes longer than this. |
| `signal` | An `AbortSignal` to cancel with. |
| `notifier` | Where `log`, `warn`, and `error` go. Defaults to the SDK's console notifier. |
| `render` | How a logged SDK object is turned into text. The CLI passes its markdown renderer; without one, objects fall back to JSON. |
| `cwd` | The directory relative paths resolve against. Defaults to the process directory. |

`run` resolves to exactly what the last script returned. If you also need the workbook the run
ended on, check whether the result is a workbook, as the example does.

TypeScript scripts load without a build step. `typescript` is a peer dependency, so make sure it is
installed in the project that runs them.

### Running a function directly

You do not need a file. Hand `run` a function and you get the same context, batching, and logging:

```ts
await Runner.run(wb, undefined, {
  target: {
    runner: ({ wb, log }) => {
      wb!.getWorksheet().getRange('A1').setValue(42);
      log('set A1');
    }
  }
});
```

## Where files resolve

A relative path in `args` resolves against the directory you ran from. When a script is run from
CI or an editor launch config, it is often handier to pin a base directory once. The runner exports
`resolvePath` for that: an absolute path is returned as is, a relative one resolves under the
`SHEETXL_IN` environment variable when set, and otherwise under the current directory.

```ts
import { resolvePath } from '@sheetxl/runner';

const fixture = resolvePath(String(ctx.args.test));  // honors $SHEETXL_IN
```

## Runner scripts and macros

A runner script and a [Live Scripting](../30-concepts/40-scripting.mdx) macro are both TypeScript against the
SheetXL API, but they live in different places. A macro is stored in the workbook and runs inside
the spreadsheet UI, in a browser sandbox. A runner script is a file in your repo and runs in Node,
with the file system and your dependencies available. Reach for a runner script when the job is
"take this file, do this, write that file", and for a macro when a user should trigger it from the
sheet.

## Learn more

- The [CLI guide](../20-getting-started/4-cli.mdx) covers every flag, including `--in.*` and
  `--out.*` format options and converting between formats with no script at all.
- [User-Defined Functions](./60-write-a-custom-function.md) covers formula functions, which use `IRange` rather than
  the live workbook.
