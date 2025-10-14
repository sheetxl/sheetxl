import { type LicenseDetails, LicenseManager, Notifier } from '@sheetxl/sdk';

// private
import type { Modules } from '../types/_Types';

/**
 * Uses a license key for this run.
 */
export default async (args: any[], modules?: Modules): Promise<void> => {
  const licenseKey: string = args[0];
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new Error('Invalid license key provided.');
  }

  const details: LicenseDetails = await LicenseManager.setLicenseKey(licenseKey);

  if (details.hasExceptions()) {
    Notifier.error(`❌ License key is invalid or has exceptions:`);
  } else {
    Notifier.log(`✅ License key successfully activated.`);
  }
  const quiet: boolean = modules?.program.opts()?.quiet ?? false;
  if (!quiet) {
    await LicenseManager.print();
  }
}
