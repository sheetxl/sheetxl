// Import font setup for tests
async function setupShared() {
  try {
    const { LicenseManager } = await import('../packages/sdk/src/license');
    // LicenseManager.setLicenseKey(`visit https://my.sheetxl.com to generate a license key.`);
    // Without a license key, the suppress only delays.
    LicenseManager.suppressPrint('testing');

    const { TransactionStore } = await import('../packages/sdk/src/transaction');
    TransactionStore.setDefaultSync(true);
  } catch (error) {
    console.warn('⚠️ Could not setup:', error.message);
  }
}

// Run font setup
await setupShared();

export {};
