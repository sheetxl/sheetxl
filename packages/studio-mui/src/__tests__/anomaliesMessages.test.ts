import { describe, it, expect } from 'vitest';

import { ICell } from '@sheetxl/sdk';

import enMessages from '../../resources/locales/en/ui.msg.json';
import deMessages from '../../resources/locales/de/ui.msg.json';

import { AnomaliesMessages, ANOMALY_CHECK_LABELS } from '../anomalies/AnomaliesMessages';

/**
 * Every check the SDK can report has a name in the Anomalies pane, and every key the pane reads is in
 * the English pack and the German one.
 */
describe('Anomalies pane messages', () => {
  const keys = [...Object.values(AnomaliesMessages), ...Object.values(ANOMALY_CHECK_LABELS)];

  it('names every check', () => {
    expect(Object.keys(ANOMALY_CHECK_LABELS).sort()).toEqual(Object.values(ICell.ErrorCheck).sort());
  });

  it.each([['en', enMessages], ['de', deMessages]] as const)('%s has every key', (_tag, messages) => {
    expect(keys.filter((key) => !(key in messages))).toEqual([]);
  });
});
