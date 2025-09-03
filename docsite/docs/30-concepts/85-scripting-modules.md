---
sidebar_position: 850
title: Scripting Modules
sidebar_label: "Scripting Modules 🚧"
draft: true
---

## 🛡️ Script Modules

SheetXL introduces a new standard for portable, secure, and feature-rich scripting: **SXL Modules (`.sxlm`)**.

An SXL Module is a gzipped bundle that contains everything needed for robust, CSP-compliant spreadsheet scripting and automation.

---

### What’s inside an `.sxlm` file?

- **Compiled ESM JavaScript**
  The main script logic, ready for fast and secure execution, with embedded metadata functions.
- **TypeScript declaration file**
  Includes UI metadata auto-generated from TSDoc and types, enabling intelligent UI generation and documentation.
- **Source map**
  For debugging and transparency, allowing you to trace errors back to the original source.
- **Original source code**
  Included for auditing, editing, and community sharing.

---

### Why use SXL Modules?

- **Portability:**
  Run scripts locally or download securely from a remote server—ideal for automation, CI/CD, and sharing logic across teams.
- **Security:**
  Fully CSP-compliant—no `eval`, no dynamic code loading. Scripts can be delivered from secure, trusted sources.
- **Intelligent UI:**
  UI metadata enables auto-generated forms and documentation in the SheetXL Script Editor, making scripts more user-friendly and discoverable.
- **Debuggable:**
  Source maps and original code included for easy debugging and auditing.
- **Community & Enterprise:**
  Share, version, and distribute scripts via open-source or private repositories. SheetXL can read from a community git repo for script contributions.

---

### How to use SXL Modules with the CLI

**Run a local SXL Module:**

```bash
npx sheetxl myscript.sxlm
```

**Download and run from a secure server:**

```bash
npx sheetxl https://secure.example.com/scripts/myscript.sxlm
```

**In the REPL:**

```js
.load myscript.sxlm
```

---

### Creating SXL Modules

You can package your scripts into `.sxlm` modules using the SheetXL CLI:

```bash
npx sheetxl pack myscript.ts
```

This command bundles your script, metadata, types, and source map into a single portable `.sxlm` file.

---

### Example Use Cases

- **Automate report generation or data transformation** in your build scripts.
- **Integrate spreadsheet logic into data pipelines** (dbt, Airflow, etc.).
- **Run tests or batch calculations headlessly** for CI/CD.
- **Distribute advanced spreadsheet logic** across teams or the community with versioned, auditable modules.

---

> **Note:**
> SXL Modules are ideal for automation, security, and sharing advanced spreadsheet logic.
