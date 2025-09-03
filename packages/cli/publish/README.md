# CLI

![SheetXL](https://www.sheetxl.com/logo-text.svg)

[![NPM Version](https://img.shields.io/npm/v/sheetxl?color=blue)](https://www.npmjs.com/package/sheetxl)

The official command-line interface for interacting with the SheetXL ecosystem.

---

## Quick Start

The easiest way to use the SheetXL CLI is by running it directly without a permanent installation. All you need is Node.js (v22+) installed (v24 recommended),

Open your terminal and run:

```bash
npx sheetxl
```

*(If you use `pnpm`, you can use `dlx sheetxl`)*

This will start an interactive REPL (Read-Eval-Print Loop), pre-loaded with the SheetXL SDK.

```sh
Welcome to the SheetXL REPL!

sheetxl > help
```

## Usage

The CLI can be used in three main ways: as an [**interactive REPL**](#interactive-repl), for [**executing scripts**](#executing-scripts) files, or for running [**direct commands**](#direct-commands).

### Interactive REPL

Running the CLI with no arguments starts the interactive session. This is a powerful JavaScript environment for prototyping, running calculations, or managing your workbooks programmatically.

```bash
npx sheetxl
```

Inside the REPL, you have access to special commands:

* `.help`: Shows all available dot commands.
* `.docs`: Opens the official SheetXL documentation in your browser.
* `.clear`: Clears the terminal screen.
* `.exit`: Exits the REPL session.

#### Accessing the SDK API

You can also access the sdk directly

```javascript title="REPL Session"
wb = new Workbook();
wb.getRange('a1').setValues([[1]]);
wb.getRange('a1').getValues();
```

> For a complete list of all available classes and methods, please see our full [SDK API Documentation](https://api.sheetxl.com).

### Executing Scripts

For automation and more complex tasks, you can pass a local JavaScript file to the CLI for execution. The script will run within the SheetXL environment, with the SDK available.

```bash
npx sheetxl path/to/your/script.js
```

### Direct Commands

You can also run specific built-in commands directly. This is useful for one-off tasks.

#### Activate Your License

To activate your license key, run the `activate` command:

```bash
npx sheetxl activate YOUR_LICENSE_KEY_HERE
```

This will store your license key for future use.

## About SheetXL

SheetXL is the developer-first ecosystem built to bring Excel-class power to your application stack. Stop burning sprints on endless grid rewrites and manual data manipulation.

This CLI is your command-line gateway to the SheetXL SDK, designed for scripting, automation, and interactive prototyping.

To learn more and get a commercial license key, visit our website:
**[https://www.sheetxl.com](https://www.sheetxl.com)**

## License

The `sheetxl` CLI is licensed under the [MIT License](https://github.com/sheetxl/sheetxl/LICENSE.md).

Use of the full SheetXL platform requires a commercial license, available at [my.sheetxl.com](https://my.sheetxl.com).
