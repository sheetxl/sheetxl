export { LicenseManager, type LicenseDetails } from '@sheetxl/sdk';

export {
  useModelListener, useRangeListener, DefaultTaskPaneRegistry, WorkbookIO
} from '@sheetxl/react';

export * from './command';

export * from './form';

// The card list's building blocks, for a host composing its own list (an agent's findings) with the
// Studio panes' card, card-media chip and search field. The panels themselves stay internal.
export {
  ItemCard, ItemCardAction, ItemsSearchField, type ItemCardProps, type ItemCardActionProps,
  type ItemsSearchFieldProps, type ItemBodyProps
} from './itemsPanel';
export { PresetChip, type PresetChipProps } from './conditionalFormat/PresetChip';

// The Insert Function widgets (search / arguments / the wizard over both). Exported — unlike the
// `dialog` shells around them — because they are meant to be composed elsewhere: the arguments panel
// is wanted as a debug pane in the script editor (`@sheetxl/scripting-mui`).
export * from './function';

export * from './border';
export * from './color';
export * from './theme';

export * from './toolbar';
export * from './statusBar';
export * from './formulaBar';

// The built-in task panes load the first time they are opened, so the panes and the panels inside
// them are not exported: an export here would put their code back in every host's startup bundle.
export * from './named/INamedCollectionEditor';
export * from './named/NamedCollectionEditor';
export * from './named/NamedPlugin';
export * from './externalLink/ExternalLinksPlugin';
export * from './comments/CommentCard';
export * from './comments/CommentsPlugin';
export * from './anomalies/AnomaliesPlugin';
export * from './presence';

export * from './filter';
export * from './table/TableStylePreview';
export * from './table/TableStyleCanvasPreview';
export * from './table/TablePlugin';
export * from './slicer';
export * from './fill';
export * from './format/NumberFormatOption';
export * from './format/FormatPlugin';
export type { FormatTab, FormatPaneArgs } from './format/FormatTaskPane';
export * from './protection/PasswordField';
export * from './protection/ProtectionPlugin';

export * from './sheet';
export * from './workbook';

export * from './theme';

export * from './studio';

// No default export: `Studio` (and everything else) is exported by name above. Mixing a default with
// named exports at the package entry triggers rolldown's MIXED_EXPORTS warning and forces awkward
// `.default` access for CJS consumers; every consumer already imports `{ Studio }`.