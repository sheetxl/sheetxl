import { type LicenseDetails, LicenseManager, Notifier } from '@sheetxl/sdk';

import { Modules } from './Types';
/**
 * Uses a license key for this run.
 */
export default async (args: any[], modules?: Modules): Promise<void> => {
  const detailsBefore = await LicenseManager.getDetails();
  if (detailsBefore.isEval()) {
    Notifier.log(`No License to deactivate.`);
    return;
  }
  const details:LicenseDetails = await LicenseManager.setLicenseKey('eval', true);
  if (details.hasExceptions()) {
    Notifier.log(`✅ License key successfully removed.`);
  } else {
    Notifier.log(`⚠️ License deactivation completed with exceptions:`);
    details.getExceptions().forEach((ex) => Notifier.log(` - ${ex}`));
    const quiet: boolean = modules?.program.opts()?.quiet ?? false;
    if (!quiet) {
      await LicenseManager.printDetails(true);
    }
  }
}
