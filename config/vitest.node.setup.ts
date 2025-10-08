
async function setupFonts(): Promise<void> {
  try {
    // we don't alias because we don't want canvas in the test environment.
    const { IFont } = await import('../packages/sdk/src/font/index.js');
    const { getInstance: getSimpleMeasurer } = await import('../packages/sdk/src/font/SimpleFontMeasurer.js');
    IFont.setSharedMeasurer(getSimpleMeasurer());

    // const { IFont } = await import('../packages/sdk/src/font/index.js');
    // const { FontKitFontMeasurer } = await import('../packages/sdk/src/font/FontKitFontMeasurer.js');
    // IFont.setSharedMeasurer(FontKitFontMeasurer);
    // console.log('🔤 Font measurer configured successfully');
  } catch (error: any) {
    console.warn('⚠️  Could not configure font measurer:', error.message);
  }
}

// Run font setup
await setupFonts();

export {};
