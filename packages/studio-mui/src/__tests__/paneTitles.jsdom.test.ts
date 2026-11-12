import { describe, it, expect } from 'vitest';

import { Command } from '@sheetxl/utils-react';
import { DefaultTaskPaneRegistry, TaskPaneKey } from '@sheetxl/react';

import groupsEn from '../../resources/locales/en/groups.cmd.json';

import { registerStudioCommandCatalogs } from '../command/RegisterCatalog';
import { AnomaliesPlugin } from '../anomalies/AnomaliesPlugin';
import { CommentsPlugin } from '../comments/CommentsPlugin';
import { ConditionalFormatPlugin } from '../conditionalFormat/ConditionalFormatPlugin';
import { DataValidationPlugin } from '../dataValidation/DataValidationPlugin';
import { ExternalLinksPlugin } from '../externalLink/ExternalLinksPlugin';
import { FormatPlugin } from '../format/FormatPlugin';
import { NamedPlugin } from '../named/NamedPlugin';
import { TablePlugin } from '../table/TablePlugin';

/**
 * A Studio pane gives no title or icon of its own: both come from the catalog record that shares
 * its key, so they are translated with the rest of the chrome.
 */
describe('Studio pane titles', () => {
  const cases: { plugin: () => () => void; key: string }[] = [
    { plugin: AnomaliesPlugin, key: 'anomalies' },
    { plugin: CommentsPlugin, key: TaskPaneKey.Comments },
    { plugin: ConditionalFormatPlugin, key: TaskPaneKey.ConditionalFormat },
    { plugin: DataValidationPlugin, key: TaskPaneKey.DataValidation },
    { plugin: ExternalLinksPlugin, key: TaskPaneKey.ExternalLinks },
    { plugin: FormatPlugin, key: TaskPaneKey.FormatCells },
    { plugin: NamedPlugin, key: TaskPaneKey.Names },
    { plugin: TablePlugin, key: TaskPaneKey.TableDetails }
  ];

  it('each has a catalog record with a label and an icon', () => {
    const commands = (groupsEn as any).commands as Record<string, { label?: string, icon?: string }>;
    for (const { key } of cases) {
      expect(commands[key]?.label, key).toBeTruthy();
      expect(commands[key]?.icon, key).toBeTruthy();
    }
  });

  it('the pane reads its record', () => {
    registerStudioCommandCatalogs();
    // A key can be a command in more than one scope (`formatCells` is the sheet's too); the probe goes
    // where the title is read from.
    for (const { key } of cases) {
      const scope = Command.DefaultCommandRegistry.findByKey(key)!.name;
      Command.DefaultCommandCatalogService.register(scope, 'en', {
        scope, tag: 'en', version: 1, commands: { [key]: { label: `Probe ${key}` } }
      } as any, { sourceId: `test-pane-title-${key}` });
    }
    for (const { plugin, key } of cases) {
      const dispose = plugin();
      expect(DefaultTaskPaneRegistry.getRegisteredTaskPane(key)?.getTitle(), key).toBe(`Probe ${key}`);
      dispose();
    }
  });

  it('comments shows the manage icon', () => {
    registerStudioCommandCatalogs();
    const dispose = CommentsPlugin();
    expect(DefaultTaskPaneRegistry.getRegisteredTaskPane(TaskPaneKey.Comments)?.getIcon()).toBe('CommentManage');
    dispose();
  });
});
