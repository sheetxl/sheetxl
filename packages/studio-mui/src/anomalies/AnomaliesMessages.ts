import { messageKey } from '@sheetxl/utils';

import { ICell } from '@sheetxl/sdk';

/** The message keys of the Anomalies pane. */
export const AnomaliesMessages = {
  analyze: messageKey('anomalies.analyze'),
  dismiss: messageKey('anomalies.dismiss'),
  intro: messageKey('anomalies.intro'),
  none: messageKey('anomalies.none'),
  /** `{sheet}`, `{regions}`, `{cells}`, `{elapsed}` (ms). */
  summary: messageKey('anomalies.summary'),
  /** `{rows}`, `{cols}`, `{rank}`. */
  region: messageKey('anomalies.region'),
  /** `{check}`, `{layer}`. */
  checkInLayer: messageKey('anomalies.checkInLayer'),
  runAlongRow: messageKey('anomalies.evidence.runAlongRow'),
  runAlongColumn: messageKey('anomalies.evidence.runAlongColumn'),
  /** `{value}`. */
  expected: messageKey('anomalies.evidence.expected'),
  /** `{value}`. */
  actual: messageKey('anomalies.evidence.actual'),
  /** `{value}`. */
  reference: messageKey('anomalies.evidence.reference'),
  /** `{value}`. */
  omitted: messageKey('anomalies.evidence.omitted'),
  /** `{count}`. */
  thickness: messageKey('anomalies.evidence.thickness'),
  oneEachSide: messageKey('anomalies.evidence.oneEachSide')
} as const;

const Check = ICell.ErrorCheck;

/** The message key of each check's name. Keyed by every check, so a new one cannot go unnamed. */
export const ANOMALY_CHECK_LABELS: Readonly<Record<ICell.ErrorCheck, string>> = {
  [Check.EvaluatesToError]: messageKey('anomalies.check.evalError'),
  [Check.TextDate]: messageKey('anomalies.check.twoDigitTextYear'),
  [Check.NumberAsText]: messageKey('anomalies.check.numberStoredAsText'),
  [Check.InconsistentFormula]: messageKey('anomalies.check.formula'),
  [Check.OmittedCells]: messageKey('anomalies.check.formulaRange'),
  [Check.UnlockedFormula]: messageKey('anomalies.check.unlockedFormula'),
  [Check.EmptyCellReference]: messageKey('anomalies.check.emptyCellReference'),
  [Check.ListDataValidation]: messageKey('anomalies.check.listDataValidation'),
  [Check.InconsistentListFormula]: messageKey('anomalies.check.calculatedColumn'),
  [Check.HardcodeInRun]: messageKey('anomalies.check.hardcodeInRun'),
  [Check.StyleBreak]: messageKey('anomalies.check.styleBreak'),
  [Check.StyleRole]: messageKey('anomalies.check.styleRole'),
  [Check.RepeatedReference]: messageKey('anomalies.check.repeatedReference'),
  [Check.DegenerateCall]: messageKey('anomalies.check.degenerateCall'),
  [Check.SumIncludesSubtotal]: messageKey('anomalies.check.sumIncludesSubtotal'),
  [Check.MisalignedReference]: messageKey('anomalies.check.misalignedReference'),
  [Check.ApproximateMatch]: messageKey('anomalies.check.approximateMatch'),
  [Check.LookupShape]: messageKey('anomalies.check.lookupShape'),
  [Check.ExternalReference]: messageKey('anomalies.check.externalReference'),
  [Check.ErrorConstant]: messageKey('anomalies.check.errorConstant'),
  [Check.LinkLabelMismatch]: messageKey('anomalies.check.linkLabelMismatch'),
  [Check.KeyLabelMismatch]: messageKey('anomalies.check.keyLabelMismatch'),
  [Check.SignVsSiblings]: messageKey('anomalies.check.signVsSiblings'),
  [Check.LiteralMatchesInput]: messageKey('anomalies.check.literalMatchesInput'),
  [Check.TwinBlockDivergence]: messageKey('anomalies.check.twinBlockDivergence'),
  [Check.ScaleOutlier]: messageKey('anomalies.check.scaleOutlier'),
  [Check.UnreferencedInput]: messageKey('anomalies.check.unreferencedInput'),
  [Check.RowGap]: messageKey('anomalies.check.rowGap'),
  [Check.ConstantFrequency]: messageKey('anomalies.check.constantFrequency')
};
