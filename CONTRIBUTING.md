
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

Select Launch an Debug (Ctrl+Shift+D) -> Vite App
