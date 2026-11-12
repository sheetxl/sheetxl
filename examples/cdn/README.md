# SheetXL Studio - Zero Install Demo

![SheetXL](https://www.sheetxl.com/logo-text.svg)

This example loads SheetXL Studio straight from a CDN: no build step, no `npm install`, no
framework. Copy a page, serve it over HTTP, and you have a spreadsheet.

## Pages

| File | What it shows |
| --- | --- |
| `index.html` | The deployed demo. A `<script type="module">` imports the CDN entry and calls `attachStudio` with a loading panel configured. |
| `html-simple.html` | The same import with nothing but the essentials. Start here if you are copying code into your own page. |
| `html-only.html` | No JavaScript. One `<script src=".../loader.js">` tag with `data-` attributes mounts the studio. |
| `html-only-top.html` | The loader tag placed in `<head>`, for pages that cannot add scripts at the end of `<body>`. |
| `styles.css` | Page chrome for the demos. Not needed by SheetXL. |
| `build.js` | Copies the pages to `build/` for hosting. Not needed to use them. |

Each file must be served over `http://` or `https://`. Opening it from `file://` fails because
module scripts and the CDN require an origin.

## Quick start

### With a few lines of JavaScript

```html
<div id="sheetxl" style="height: 600px;"></div>

<script type="module">
  const module = await import('https://cdn.jsdelivr.net/npm/@sheetxl/studio-vanilla@latest/cdn/index.js');
  const { SheetXL } = module;
  await SheetXL.attachStudio({
    selector: '#sheetxl',
    // licenseKey: 'visit https://my.sheetxl.com to generate a license key.',
    loading: { message: 'Loading SheetXL Studio...' }
  });
</script>
```

`attachStudio` resolves to a controller for the mounted studio. It exposes the studio API plus
`update(props)` to re-render with new props and `detach()` to unmount.

The CDN entry is small. It shows the `loading` panel at once, then downloads React and the studio
bundle. Pass `loading.message` and `loading.cssVars` so the panel reads against your page, or
`loading.hide: true` if you draw your own. An `error` panel takes the same options.

### With no JavaScript

```html
<div id="sheetxl" style="height: 600px;"></div>

<script
  src="https://cdn.jsdelivr.net/npm/@sheetxl/studio-vanilla@latest/cdn/loader.js"
  data-target="#sheetxl"
  data-auto-focus="true"
  defer>
</script>
```

Every `data-` attribute other than `data-target` and `data-license-key` is passed to the studio as
a prop.

## Picking a version

The pages use jsDelivr. The part after `@` is an npm dist-tag or an exact version:

| URL fragment | Loads |
| --- | --- |
| `@sheetxl/studio-vanilla@latest` | The current stable release. |
| `@sheetxl/studio-vanilla@beta` | The current prerelease. |
| `@sheetxl/studio-vanilla@0.7.27` | That version, forever. Pin this in production. |

The pages load `@latest`.

## License

Without a key the studio runs in trial mode. There are two ways to supply one:

- Pass `licenseKey` to `attachStudio`, or `data-license-key` to the loader tag.
- Serve a `sheetxl.lic` file next to the page. The studio fetches it from the page origin, so the
  key never appears in your HTML.

Generate a key at [my.sheetxl.com](https://my.sheetxl.com).

## Running locally

```bash
npm run dev
```

This serves the folder on `http://localhost:3000` and opens the browser. To test an unreleased build
of `@sheetxl/studio-vanilla`, serve its `build/` folder on another port and point `moduleUrl` in
`index.html` at `http://localhost:<port>/cdn/index.js`.

## Learn more

- [Quick Start (Vanilla)](https://www.sheetxl.com/docs/guides/getting-started/vanilla)
- [Documentation](https://www.sheetxl.com/docs)
- [GitHub](https://github.com/sheetxl)
