// Import font setup for tests
// async function setupFonts() {
//   try {
//     const { IFont } = await import('./packages/sdk/src/font/index.js');
//     const { SimpleFontMeasurer } = await import('./packages/sdk/src/font/SimpleFontMeasurer.js');

//     IFont.setSharedMeasurer(SimpleFontMeasurer);
//     console.log('🔤 Simple font measurer configured successfully (no canvas dependency)');
//   } catch (error: any) {
//     console.warn('⚠️  Could not configure font measurer:', error.message);
//     // Don't fail the setup if font configuration fails
//   }
// }

// // Run font setup
// setupFonts();

// console.log('✅ Global test setup complete');

// Make this file a module
export {};
