import { describe, it, expect } from 'vitest';

import { Command } from '@sheetxl/utils-react';
import { DefaultTaskPaneRegistry, DefaultSheetLayersRegistry } from '@sheetxl/react';

import { AnomaliesCommands } from '../anomalies/AnomaliesCommands';
import { AnomaliesPlugin } from '../anomalies/AnomaliesPlugin';
import { ChartPlugin } from '../chart/ChartPlugin';
import { CommentsPlugin } from '../comments/CommentsPlugin';
import { ConditionalFormatPlugin } from '../conditionalFormat/ConditionalFormatPlugin';
import { DataValidationPlugin } from '../dataValidation/DataValidationPlugin';
import { ExternalLinksPlugin } from '../externalLink/ExternalLinksPlugin';
import { FormatPlugin } from '../format/FormatPlugin';
import { NamedPlugin } from '../named/NamedPlugin';
import { PicturePlugin } from '../picture/PicturePlugin';
import { PivotPlugin } from '../pivot/PivotPlugin';
import { ProtectionPlugin } from '../protection/ProtectionPlugin';
import { ShapePlugin } from '../shape/ShapePlugin';
import { SlicerPlugin } from '../slicer/SlicerPlugin';
import { TablePlugin } from '../table/TablePlugin';

/**
 * A Studio plugin registers into the default registries and returns a function that removes
 * everything it registered.
 */
describe('Studio plugins return their disposer', () => {
  const panes = (keys: string[]): boolean[] => keys.map((k) => DefaultTaskPaneRegistry.getRegisteredTaskPane(k) !== null);
  const buttons = (keys: string[]): boolean[] => keys.map((k) => Command.DefaultCommandButtonRegistry.get(k) !== null);

  const cases: { name: string; plugin: () => () => void; panes?: string[]; buttons?: string[] }[] = [
    { name: 'Anomalies', plugin: AnomaliesPlugin, panes: ['anomalies'], buttons: ['anomalies.showPane.review'] },
    { name: 'Comments', plugin: CommentsPlugin, panes: ['comments'] },
    { name: 'ConditionalFormat', plugin: ConditionalFormatPlugin, panes: ['conditionalFormatDetails'] },
    { name: 'DataValidation', plugin: DataValidationPlugin, panes: ['dataValidationDetails'] },
    { name: 'ExternalLinks', plugin: ExternalLinksPlugin, panes: ['externalLinks'] },
    { name: 'Format', plugin: FormatPlugin, panes: ['formatCells'] },
    { name: 'Named', plugin: NamedPlugin, panes: ['managedNames'] },
    { name: 'Pivot', plugin: PivotPlugin, panes: ['pivotTableFields'] },
    { name: 'Protection', plugin: ProtectionPlugin, panes: ['manageProtection', 'protectedRangeDetails'] },
    { name: 'Table', plugin: TablePlugin, panes: ['tableDetails'] },
    { name: 'Picture', plugin: PicturePlugin, buttons: ['changePictureOptions', 'pictureHyperlinkOptions', 'cropAspectOptions', 'cropOptions'] },
    { name: 'Shape', plugin: ShapePlugin, buttons: ['changeShapeGallery'] },
    { name: 'Slicer', plugin: SlicerPlugin, buttons: ['formatSlicerStyle', 'insertSlicer'] }
  ];

  for (const c of cases) {
    it(`${c.name}: registers, then its disposer removes it all (twice is harmless)`, () => {
      const dispose = c.plugin();
      if (c.panes) expect(panes(c.panes)).toEqual(c.panes.map(() => true));
      if (c.buttons) expect(buttons(c.buttons)).toEqual(c.buttons.map(() => true));
      dispose();
      if (c.panes) expect(panes(c.panes)).toEqual(c.panes.map(() => false));
      if (c.buttons) expect(buttons(c.buttons)).toEqual(c.buttons.map(() => false));
      expect(() => dispose()).not.toThrow();
    });
  }

  it('Anomalies: its disposer also removes its sheet layer and its workbook commands', () => {
    const dispose = AnomaliesPlugin();
    expect(Command.DefaultCommandRegistry.getDynamic('workbook')).toContain(AnomaliesCommands);
    expect(Command.DefaultCommandButtonRegistry.get('anomalies.showPane.review')?.defaultKey).toBe('showAnomaliesPane');
    dispose();
    expect(Command.DefaultCommandRegistry.getDynamic('workbook')).not.toContain(AnomaliesCommands);
    expect(DefaultSheetLayersRegistry.unregister('anomalies')).toBe(false);
  });

  it('Chart: returns a disposer', () => {
    const dispose = ChartPlugin();
    expect(typeof dispose).toBe('function');
    dispose();
  });

  it('a remover leaves a later registration of the same key alone', () => {
    const removeFirst = DefaultTaskPaneRegistry.registerTaskPane({ key: 'probePane', getTitle: () => 'one', component: () => null }, true);
    const removeSecond = DefaultTaskPaneRegistry.registerTaskPane({ key: 'probePane', getTitle: () => 'two', component: () => null }, true);
    removeFirst();
    expect(DefaultTaskPaneRegistry.getRegisteredTaskPane('probePane')?.getTitle()).toBe('two');
    removeSecond();
    expect(DefaultTaskPaneRegistry.getRegisteredTaskPane('probePane')).toBeNull();

    const registry = Command.DefaultCommandButtonRegistry;
    const removeA = registry.register({ key: 'probeButton', members: ['a'] }, true);
    const removeB = registry.register({ key: 'probeButton', members: ['b'] }, true);
    removeA();
    expect(registry.get('probeButton')?.members).toEqual(['b']);
    removeB();
    expect(registry.get('probeButton')).toBeNull();

    const removeL1 = DefaultSheetLayersRegistry.register({ key: 'probeLayers', layers: null }, true);
    const removeL2 = DefaultSheetLayersRegistry.register({ key: 'probeLayers', layers: null }, true);
    removeL1();
    expect(DefaultSheetLayersRegistry.unregister('probeLayers')).toBe(true);
    removeL2();
  });
});
