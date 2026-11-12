import { createElement } from 'react';

import { defineLazyModule } from '@sheetxl/utils';
import { Command, DefaultCommandButtonRegistry } from '@sheetxl/utils-react';

import {
  DefaultTaskPaneRegistry, DefaultSheetLayersRegistry, RangeAnnotationLayer, type RangeAnnotation
} from '@sheetxl/react';
import { lazyPanel } from '@sheetxl/utils-mui';

import { registerStudioCommandCatalogs } from '../command/RegisterCatalog';

import { AnomaliesCommands } from './AnomaliesCommands';
import { ANOMALIES_PANE_KEY, ANOMALIES_SOURCE, SHOW_ANOMALIES_PANE } from './_source';

const AnomaliesTaskPane = lazyPanel(
  defineLazyModule('studio:anomaliesTaskPane', () => import('./AnomaliesTaskPane'), {
    select: (m) => ({ default: m.AnomaliesTaskPane })
  }).load
);

const isAnomaly = (annotation: RangeAnnotation): boolean => annotation.source === ANOMALIES_SOURCE;

/** The Review toolbar's Anomalies button. */
export const ANOMALIES_REVIEW_BUTTON = 'anomalies.showPane.review';

/**
 * Anomalies: where the selected sheet breaks its own patterns.
 *
 * @remarks
 * Registers the `showAnomaliesPane` command (on the `workbook` scope), its button on the Review
 * toolbar after Workbook Statistics, the **Anomalies** pane it toggles, and the sheet layer that draws
 * the outline the pane puts on the finding it is showing. Returns a function that removes them.
 */
export const AnomaliesPlugin = (): (() => void) => {
  // The command's label, description and icon ship in this package's catalogs.
  registerStudioCommandCatalogs();
  const removeCommands = Command.DefaultCommandRegistry.registerDynamic('workbook', AnomaliesCommands);

  const removeButton = DefaultCommandButtonRegistry.register({
    key: ANOMALIES_REVIEW_BUTTON,
    defaultKey: SHOW_ANOMALIES_PANE,
    contributions: { reviewToolbar: { anchor: 'workbookStatistics', order: 1 } }
  }, true);

  const removePane = DefaultTaskPaneRegistry.registerTaskPane({
    key: ANOMALIES_PANE_KEY,
    component: AnomaliesTaskPane
  }, true);

  const removeLayer = DefaultSheetLayersRegistry.register({
    key: 'anomalies',
    layers: createElement(RangeAnnotationLayer, { key: 'anomalies-annotations', filter: isAnomaly })
  }, true);

  return (): void => {
    removeLayer();
    removePane();
    removeButton();
    removeCommands();
  };
}
