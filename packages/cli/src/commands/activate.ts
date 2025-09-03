import { type LicenseDetails, LicenseManager } from '@sheetxl/sdk';

import { Modules } from './Types';
/**
 * Uses a license key for this run.
 */
export default async (args: any[], modules?: Modules): Promise<void> => {
  const licenseKey: string = args[0];
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new Error('Invalid license key provided.');
  }

  const details:LicenseDetails = await LicenseManager.setLicenseKey(licenseKey);
  const isVerbose: boolean = modules?.program.opts()?.verbose ?? false;
  if (isVerbose) {
    if (details.exceptions().length === 0) {
      console.log(`✅ License key successfully activated and saved for future use.`);
    } else {
      console.error(`❌ License key is invalid or has exceptions:`);
    }
    LicenseManager.print();
  }
}
