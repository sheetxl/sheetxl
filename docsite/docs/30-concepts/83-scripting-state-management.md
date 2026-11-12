---
sidebar_position: 830
title: State management
sidebar_label: "State management 🚧"
draft: true
---

## 🧠 State Management

SheetXL provides two hooks for managing state within scripts:

* **`useState()`**: Ephemeral, script-local state that persists across macro executions.
* **`useStorage()`**: Explicit, durable state designed for saving data across sessions or workbook reloads

Both hooks follow a familiar, React-style API for clarity and ease of use—but without automatic re-execution or rendering. Updates to state do not trigger other scripts to run.

---

### `useState()`: Script-Local, Session-Persistent State

Use `useState()` to maintain state across multiple executions of a script within the same session or workbook context. It's ideal for counters, toggles, flags, or working memory that doesn't need to survive a reload or export.

#### ✅ Characteristics

* Stores serializable values by key
* Retains state across script runs in the same workbook session
* **Does not persist across workbook reloads or exports**
* State must be **JSON-serializable**

#### 🧠 When to use

* Internal flags or transient values
* Session-only memory for macros
* In-memory coordination across functions in a script

---

### `useStorage()`: Durable, Auditable Persistence

Use `useStorage()` when your script needs to save and load durable state across sessions, workbook reloads, or user workflows. This is a more deliberate form of state management, suited to user preferences, application data, or caching.

#### ✅ Characteristics

* Persists state **across sessions** and reloads
* Stored in a **durable backing store** (e.g., workbook metadata, remote storage, or file system)
* State must be **JSON-serializable**
* Can be **scoped per key, script, or app** depending on configuration

#### 🧠 When to use

* User or app preferences
* Global counters or checkpoints
* Named caches for expensive computations
* Data intended to be reviewed, exported, or shared

---

### 🧱 Design Philosophy

| Feature                      | `useState()`         | `useStorage()`        |
|-----------------------------|----------------------|-----------------------|
| Lifetime                    | Use session session     | Workbook |
| Access                      | Ephemeral (in-memory) | Durable (external or workbook storage) |
| Usage                       | Lightweight values   | Structured or shared data |
| Serialization required?     | ✅ Yes               | ✅ Yes                |
| Triggers re-renders?        | ❌ No                | ❌ No                |
| Suitable for formulas?      | ⚠️ No (use formulas) | ⚠️ No                |

---

### ✅ Summary

* Use `useState()` for **ephemeral memory**—simple, fast, in-session state.
* Use `useStorage()` for **durable memory**—explicit, persistent, auditable.

This model allows SheetXL to offer both **familiarity for developers** and **clarity for teams**, without the hidden behaviors or complexity found in reactive UI frameworks.

:::info
Avoid closure-based state, as it is not persisted across sessions.
:::
