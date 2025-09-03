---
sidebar_position: 840
title: Scripting Security
sidebar_label: "Scripting Security 🚧"
draft: true
---

## 🛡️ Security Goals

* Safer than Excel Desktop
* Safe as Office Script without the limitations
* Fully auditable, restrictable, and embeddable

### The Challenge: Power and Security in Spreadsheet Scripting

Spreadsheets demand powerful scripting for automation and complex modeling. Traditionally, this meant VBA, offering immense power but exposing users and organizations to significant security risks due to lack of a security model. Newer solutions like Office Script prioritize security by severely limiting features and the execution environment – a safer but often overly restrictive approach.

> SheetXL rejects the false choice that users have to pick **power** ***or*** **security**. Browsers have proven security and flexibility can coexist.

### Our Approach: Leverage Modern Web Security, Not Limitations

Organizations operate securely on the web every day, relying on the sophisticated security architecture built into modern browsers. Instead of imposing artificial limits found in some platforms, or accepting the OS-level risks of legacy tools like VBA, we harness the browser's inherent capabilities – Iframe, CSP, and WebWorkers – to execute user scripts safely.

---

## Browser Security: Default-Safe

#### A Multi-Layered Strategy

SheetXL employs standard, robust web security primitives to isolate and control user scripts running in the browser:

>“Designed defensively and secured against the open web—where code comes from everywhere, and safety is a requirement, not an option.”

### 1. `<iframe>` Sandboxing (Core Isolation)

* User scripts execute within a dynamically created `<iframe>` configured with the `sandbox="allow-scripts"` attribute.
* **Effect:** This assigns the iframe a unique, opaque origin, enforcing the browser's Same-Origin Policy. By default, scripts **cannot**:
    * Access or manipulate the parent page's DOM.
    * Read cookies, localStorage, or sessionStorage from the parent origin.
    * Navigate the top-level page or create popups (unless explicitly granted, which SheetXL does not).
    * Directly access the user's file system or OS resources (a fundamental protection browsers provide).

Ensures that malicious or buggy scripts are prevented from causing harm.

### 2. Web Workers (Responsiveness & Termination)

* SheetXL's core calculation engine runs in a Web Worker to keep the UI responsive.
* User script execution (within the sandbox iframe) also leverages workers.
* **Security Benefit:** Workers run in separate threads and unresponsive or runaway scripts (e.g., infinite loops causing resource exhaustion) can be **programmatically terminated** by SheetXL after a timeout. This provides a vital mitigation strategy against Denial-of-Service (DoS) scenarios – offering recovery where platforms might otherwise simply freeze.

### 3. Content Security Policy (CSP) (Defense-in-Depth)

* SheetXL by default will apply strict CSP headers to the sandbox iframe environment.
* **Effect:** This adds another layer of control, allowing policies such as disabling `eval()` and related functions (`unsafe-eval`) or restricting network requests even further, minimizing the attack surface *within* the already sandboxed environment.

### Security Outcomes: Safe by Default, Flexible by Design

By leveraging these standard browser mechanisms, SheetXL provides an environment where:

* Scripts are fundamentally isolated from the host OS and file system.
* Scripts are isolated from the main web application's data and context.
* Runaway scripts can be terminated to prevent lasting freezes.
* Security relies on well-understood web standards, not opaque limitations.

This strong baseline allows SheetXL to expose a more flexible and powerful API for interacting *with spreadsheet data and functions* compared to security-through-limitation approaches, without introducing any new attack vectors.

---

## Node Security

>Designed for trusted internal workflows where system access is controlled.

SheetXL's can also run server-side in Node.js. This mode is intended for trusted server environments, such as internal risk calculations, data pipelines, or back-office reporting systems. In these scenarios, the scripts are written and controlled by your team, and have access to files, databases, or internal APIs.

This is not a “user scripting sandbox.” Instead, it’s an execution engine with full system access—comparable to using pandas in Python or calling shell scripts from R. It is powerful, but intended only for trusted code in trusted environments.

If you need to execute untrusted scripts server-side, you can rely on traditional isolation techniques: e.g., process isolation, VMs, containers, or secure runtimes like Deno or Firejail.

---

## Summary

| Runtime | Default Mode | Suitable For |
|---------|--------------|--------------|
| Browser | Safe         | Embedded apps, untrusted scripts |
| Node.js | Open         | Internal servers, trusted logic |

---

## Configuration & Policy Controls

### Trusted Source Enforcement

* An optional security policy can be enabled to restrict script execution based on origin.
* **Effect:** When active, SheetXL will only execute scripts loaded from URLs matching a pre-defined allowlist of trusted sources. This provides strong control over code provenance and prevents the execution of scripts from unknown or untrusted domains.
* This policy complements the runtime isolation provided by the iframe sandbox.

---

## Conclusion

### Aligning with Modern Web Security

SheetXL prioritizes security by building on the battle-tested foundation of the modern web. In browser-based deployments, it offers a scripting environment that is significantly safer than VBA—and far more flexible than highly restricted alternatives.

You can have both **safety** and **flexibility** in a spreadsheet engine.

### 🔐 Model Comparison

>Office Script achieves security by restricting capabilities. SheetXL achieves it by isolating them.

| Feature / Constraint                           | Excel VBA  | Office Script   | SheetXL (Sandboxed)        |
|------------------------------------------------|------------|-----------------|----------------------------|
| ✅ Limited filesystem access                   | ❌        | ✅              | ✅                        |
| ✅ Restricted network access (e.g. `fetch`)    | ❌        | ✅              | ✅ Configurable           |
| ✅ Controlled dynamic code execution (`eval`)  | ❌        | ✅              | ✅ Internal-only          |
| ✅ Supports in-cell custom functions           | ✅        | ❌              | ✅                        |
| ✅ Isolated from DOM and global context        | ❌        | ✅              | ✅                        |
| ✅ Supports user-editable scripting            | ✅        | ⚠️ Limited      | ✅ (with policy controls) |
| ✅ Auditable and versionable scripts           | ❌        | ✅              | ✅ Git-backed             |
| ✅ Execution runs in isolated sandbox          | ❌        | ✅              | ✅ iframe sandbox         |

:::note
Excel VBA does not use eval() per se, but allows arbitrary code execution with equivalent (or greater) risk.
:::

## Caveats

Resource Exhaustion: Still a concern (DoS), needs mitigation (timeouts/termination).
