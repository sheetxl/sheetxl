
async function setupSimpleFonts(): Promise<void> {
  try {
    // we don't alias because we don't want canvas in the test environment.
    const { IFont } = await import('../packages/sdk/src/font/index.js');
    const { getInstance: getSimpleMeasurer } = await import('../packages/sdk/src/font/SimpleFontMeasurer.js');
    IFont.setSharedMeasurer(getSimpleMeasurer());
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
