// Opt this jsdom environment into React's act() support. The mount tests drive React with the raw
// `act()` from 'react' (not Testing Library); without this flag React warns "not configured to
// support act(...)" AND does not deterministically flush updates inside `await act(...)`, so a
// controlled round-trip can settle a tick late — which flaked ReferenceInput's F4 test in CI while
// passing locally. Setting it makes act() flush synchronously, the behavior those tests assume.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no canvas: its getContext() already answers null, and the UI text measurers fall back to
// an estimate on null. This answers the same without jsdom printing "Not implemented" for each file.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

async function setupSimpleFonts(): Promise<void> {
  try {
    // The text engine and the built-in faces before any test wraps: jsdom takes the browser's
    // lazy wasm, and a wrap before it lands is an error, the one a browser host avoids by waiting
    // for `whenReady()`; the hinted companions so a synchronous autofit measures the final table.
    const { IFontCollection } = await import('../packages/sdk/src/font/index.js');
    const fonts = IFontCollection.getShared();
    await fonts.load(['Calibri', { family: 'Calibri', bold: true }, 'Arial', { family: 'Arial', bold: true }]);
    await fonts.whenReady();
  } catch (error: any) {
    console.warn('⚠️ Could not configure font measurer:', error.message);
  }
}
await setupSimpleFonts();

/**
 * We are not using the `CanvasFontMeasurer` library in jsdom tests.
 *
 * We do this because it introduces a dependence on the `canvas` package, which is
 * a heavyweight library that requires native bindings and can complicate test environments.
 *
 * ⚠️ Why we avoid `canvas` in jsdom:
 *   1. Requires native dependencies (e.g., Cairo, Pango, libjpeg).
 *   2. Requires a full native toolchain (e.g., Python, node-gyp, VS Build Tools).
 *   3. Slows down test environments and may break in CI/CD.
 *
 * If you *must* use real canvas-based measurement in jsdom tests:
 *
 * ✅ Steps to enable `canvas` in jsdom (not recommended unless required):
 *
 *   # Install node-canvas and its dependencies
 *   pnpm add -D canvas
 *
 *   # Ensure you have a native build toolchain installed:
 *   # (For Windows, install windows-build-tools or Visual Studio Build Tools)
 *   npm install -g windows-build-tools
 */

// ❌ Not called per comments above — uncomment below if you need canvas-based measurement.
/*
async function setupCanvasFonts() {
  try {
    if (typeof window !== 'undefined' && navigator.userAgent.includes('jsdom')) {
      // Only patch when running in jsdom
      const { createCanvas } = await import('canvas');

      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (type: string) {
          const canvas = createCanvas(this.width, this.height);
          return canvas.getContext('2d');
        },
      });
    }

    const { IFont } = await import('../packages/sdk/src/font/index.js');
    const { CanvasFontMeasurer } = await import('../packages/sdk/src/font/CanvasFontMeasurer.js');

    IFont.setSharedMeasurer(CanvasFontMeasurer);
  } catch (error: any) {
    console.warn('⚠️ Could not configure font measurer:', error.message);
  }
}
// await setupCanvasFonts();

*/
export {};
