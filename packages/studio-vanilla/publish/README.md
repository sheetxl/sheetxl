# Studio Vanilla

![SheetXL](https://www.sheetxl.com/logo-text.svg)

![npm](https://img.shields.io/npm/v/@sheetxl/studio-vanilla)
![license](https://img.shields.io/npm/l/@sheetxl/studio-vanilla)

> Embed the full SheetXL spreadsheet UI into any web page with zero dependencies.

This makes it easy to use the full SheetXL spreadsheet UI in any web project, regardless of framework.

Studio Vanilla can be integrated in a few ways.

---

## 1. Using a Bundler

Using a bundler will provide the most configuration options when including in your application build.

```bash
# Using pnpm
pnpm install @sheetxl/studio-vanilla
```

After installation, you can import and use the SheetXL.attachStudio method.

```javascript
import { SheetXL } from '@sheetxl/studio-vanilla';

// The attach method will render the spreadsheet into the specified DOM element.
SheetXL.attachStudio("#sheetxl");
```

## 2. Quickest Start (CDN)

For instant, no-build-step integration, add the following HTML snippet to your page.

```html
<!DOCTYPE html>
<html>
<head>
  <title>SheetXL Demo</title>
</head>
<body>
  <div id="sheetxl" style="height: 600px; width: 100%;"></div>
  <script type="module">
    (await import("https://cdn.jsdelivr.net/npm/@sheetxl/studio-vanilla@latest/cdn/index.js")).default.attachStudio("#sheetxl");
  </script>
</body>
</html>
```

---

## API

- `SheetXL.attachStudio(selectorOrElement: string | HTMLElement, options?: object): void`
  Renders the spreadsheet UI into the target element.

> **Note:** React and MUI are bundled internally.
