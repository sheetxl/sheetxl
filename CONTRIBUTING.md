# SheetXL Contributing Guide

Welcome, and thank you for your interest in contributing to SheetXL!

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before you join in the SheetXL community.

## Asking Questions

If you encounter any issues while using SheetXL, you can seek help in the following communities:

- [Discord community](https://discord.gg/NTKdwUgK9p)
- [GitHub Discussions](https://github.com/sheetxl/sheetxl/discussions)

## Reporting Issues

If you encounter any issues or have any suggestions while using SheetXL, please feel free to raise them in the Github Issues. We will respond promptly.

To better assist you, we recommend:

- Before submitting an issue, please search to see if someone has already raised a similar question.
- We provide an [issue template](https://github.com/sheetxl/sheetxl/issues) and encourage you to fill it out with sufficient information, which helps us quickly identify the problem.

> If you're new to submitting issues, we recommend to read [How To Ask Questions The Smart Way](http://www.catb.org/~esr/faqs/smart-questions.html) and [How to Report Bugs Effectively](https://www.chiark.greenend.org.uk/~sgtatham/bugs.html) before posting. Well-written bug reports help us and help you!

## Contributing Code

### Install dependencies

SheetXL requires Node.js >= 22.0.0. We recommend using nvm or fnm to switch between different versions of Node.js.

```shell
git clone http://github.com/sheetxl/sheetxl
cd sheetxl

# install pnpm package manager
pnpm i -g pnpm

# install dependencies
pnpm install

# build the components
pnpm build

```

### Develop Example

The suggested environment is visual studio code as this will add helpful plugins and launch scripts.

```shell
cd examples/studio-mui
pnpm build
pnpm dev
```

Select Launch and Debug (Ctrl+Shift+D) -> Studio MUI - Example

### Folder READMEs

Every source folder should have a `README.md` that orients a developer to the folder
without requiring them to read the code first.

Three sections are expected:

**What it is** — One short paragraph. State the standalone mental model: what problem
this code solves and what the key design constraint is. No analogies to other systems.
No "for SheetXL" (redundant — we're already in the repo). If you can't describe it
without referencing something else, the model isn't clear yet.

**Things to know** — The non-obvious rules, invariants, and gotchas. The things a
developer would only learn after weeks of reading code or making a mistake. If it's
derivable from reading the files, it doesn't belong here.

**Dependency rules** — What this folder may and may not import from. State it even
though it isn't enforced. Making the rule explicit makes violations visible in review.

### Naming/Coding Conventions

- Interfaces that start with capital letter `I` are expected to be implemented by classes. These should never be cloned or sliced.
- Non public items begin with `_`. This is applied to fields, methods, files, and even folders.
- A boolean that can be set is a `get`/`set` pair (`getVisible`/`setVisible`). `is` is for a
  predicate that is derived and has no setter (`isMinimumAuto`, `isSecondaryAxis`).

#### Imports

- Use 'type' modifier before all Typescript only imports. We replicated type for each import to allow
  for grouping imports by library/package.

```ts Individual type imports
import { type A, type B } from '@sheetxl/sdk';
```

- Sort imports by library import with
  - 3rd party first followed by internal
  - Monorepo packages by dependencies
  - Local Packages repos

## Branch strategy

```text
feature/xxx  ──PR──→  next  ──PR──→  main
                        ↓               ↓
                   @next on npm     @latest on npm
                   (1.x.y-next.N)    (1.x.y)
```

- Always branch from `next`, not `main`
- PR feature branches back into `next` to trigger a canary release
- PR `next` → `main` when the canary is stable — this triggers the production release
- Hotfixes to `main` directly are acceptable for critical patches

## Commit messages

Releases are fully automatic via [semantic-release](https://semantic-release.gitbook.io). The version bump is derived from commit messages — never edit version numbers manually.

| Prefix | Bump | Example |
| --- | --- | --- |
| `feat:` | minor | `feat: add XLOOKUP wildcard support` |
| `fix:` | patch | `fix: SUMIF ignoring empty string criteria` |
| `docs:` | patch | `docs: update FORECAST.ETS parameter table` |
| `chore:` | patch | `chore: bump dependencies` |
| `refactor:` | patch | `refactor: simplify date serial conversion` |
| `test:` | patch | `test: add ACCRINT edge cases` |
| `build:` | patch | `build: add formulas-extended to SDK pipeline` |
| `ci:` | patch | `ci: add next branch to release trigger` |
| `feat!:` or `BREAKING CHANGE:` | major | `feat!: rename IFormulaContext.get → resolve` |

Use a scope when helpful: `fix(statistical): ETS b_0 initialization`.

## Releases

You never run `pnpm publish` manually — CI handles everything on merge.

**Canary** — merge a feature branch into `next`:

```bash
npm install @sheetxl/sdk@next
```

**Stable** — open a PR from `next` → `main` and merge:

```bash
npm install @sheetxl/sdk
```

## Adding a new package

1. Create `packages/<name>/` with the standard structure (see any existing package)
2. Set `"privateRepo": true` in `package.json` if the package's source should not appear in the public open-source repo (it can still publish to npm)
3. Add `"release:package": "cd build && pnpm publish --no-git-checks --access public --tag ${PUBLISH_TAG:-latest}"` to its scripts
4. If it contains formulas, add a `FormulaCompilerPlugin` entry in that package's own `vite.config.ts` (input `./src`, output `./src/.generated`) and point its `package.json` `.` export at the generated entry — sdk consumes it as a normal dependency (see `packages/formulas`)

## Public vs private packages

`config/publishPublicRepo.ts` controls what appears in the public GitHub repo. This is independent of npm's `private` — a package can be published to npm while kept out of the public source repo (e.g. commercial formulas ship as obfuscated bundles):

| `package.json` field | Effect |
| --- | --- |
| `"privateRepo": true` | Excluded from the public repo (source stays private; still publishable to npm) |
| `"privateRepo": false` | Included in the public repo, regardless of `private` |
| Neither field | Falls back to npm `private` (`"private": true` → excluded) |

## Adding a new formula

Formula files live in `packages/formulas/src/` (open-source) or `packages/formulas-extended/src/` (commercial). Each file is a plain TypeScript module — no registration, no boilerplate. The formula package's build (its `FormulaCompilerPlugin`) discovers and wires everything automatically into its generated entry; sdk consumes that entry as a dependency.

See `.github/instructions/formulas.instructions.md` for design invariants, coercion rules, and testing requirements.
