import { type LicenseDetails, LicenseManager } from '@sheetxl/sdk';

import { Modules } from './Types';
/**
 * Uses a license key for this run.
 */
export default async (args: any[], modules?: Modules): Promise<void> => {
  // const isVerbose: boolean = modules?.program.opts()?.verbose ?? false;
  const detailsBefore = await LicenseManager.getDetails();
  if (detailsBefore.isEval()) {
    // if (isVerbose) {
      console.log(`No License to deactivate.`);
    // }
    return;
  }
  const details:LicenseDetails = await LicenseManager.setLicenseKey('eval', true);
  // if (isVerbose) {
    if (details.hasExceptions()) {
      console.log(`✅ License key successfully removed.`);
    } else {
      console.log(`⚠️ License deactivation completed with exceptions:`);
      details.getExceptions().forEach((ex) => console.log(` - ${ex}`));
      await LicenseManager.printDetails(true);
    }
  // }
}
