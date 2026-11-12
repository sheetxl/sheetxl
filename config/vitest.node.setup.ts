
async function setupFonts(): Promise<void> {
  try {
    // The built-in faces with their hinted widths, before any test measures: an autofit is
    // synchronous, and one that ran while the widths were loading would measure the unhinted table.
    const { IFontCollection } = await import('../packages/sdk/src/font/index.js');
    const fonts = IFontCollection.getShared();
    await fonts.load(['Calibri', { family: 'Calibri', bold: true }, 'Arial', { family: 'Arial', bold: true }]);
    await fonts.whenReady();
  } catch (error: any) {
    console.warn('⚠️  Could not configure font measurer:', error.message);
  }
}

// Run font setup
await setupFonts();

export {};
