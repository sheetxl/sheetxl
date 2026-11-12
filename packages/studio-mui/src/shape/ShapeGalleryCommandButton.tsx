import { memo, forwardRef, useCallback, useMemo } from 'react';

import { Box } from '@mui/material';

import { type IShape } from '@sheetxl/sdk';

import {
  useCommands, useCallbackRef, useTranslator, usePersistentState, DynamicIcon
} from '@sheetxl/utils-react';

import {
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

import { ShapeGallery, shapeIconKey, type ShapeGalleryEntry } from '@sheetxl/react';

export interface ShapeGalleryCommandButtonProps extends CommandPopupButtonProps {
  /**
   * The command a pick runs, with the entry's JSON. Its label, description and enablement are the
   * button's.
   */
  commandKey: string;
  /** Gallery sections to leave out, by key: Change Shape and Crop to Shape have no `lines`. */
  excludeCategories?: readonly string[];
}

const RECENT_SHAPES_KEY = 'shape.recentShapes';
/** One row of the gallery grid. */
const MAX_RECENT_SHAPES = 12;
const EmptyRecent: readonly string[] = Object.freeze([]);

/** Every entry of the gallery by its key: what a remembered key resolves to. */
const GalleryEntries: ReadonlyMap<string, ShapeGalleryEntry> = new Map(
  ShapeGallery.flatMap((category) => category.entries.map((entry) => [entry.key, entry] as const))
);

/**
 * A popup gallery of the preset shapes by section, as Excel lays it out. Picking one runs
 * `commandKey` with what the entry states: Insert > Shapes, Change Shape and Crop to Shape are this
 * gallery on their commands. Entries picked here are remembered by key, most recent first, in a
 * Recently Used Shapes section shown above the gallery once there are any.
 */
export const ShapeGalleryCommandButton = memo(
  forwardRef<HTMLElement, ShapeGalleryCommandButtonProps>((props, refForwarded) => {
  const {
    groupKey: propGroupKey,
    disabled: propDisabled,
    label: propLabel,
    icon: propIcon,
    commandKey,
    excludeCategories,
    ...rest
  } = props;
  const t = useTranslator();

  const command = useCommands<void, IShape.JSON>([commandKey])[0];
  const categories = useMemo(
    () => (excludeCategories?.length ? ShapeGallery.filter((category) => !excludeCategories.includes(category.key)) : ShapeGallery),
    [excludeCategories]
  );
  const disabled = propDisabled ?? command?.disabled();

  const [persistedRecent, setRecent] = usePersistentState<readonly string[]>(RECENT_SHAPES_KEY, EmptyRecent);
  // The store may hold anything an older build (or another app) wrote.
  const recent = useMemo((): readonly ShapeGalleryEntry[] => {
    if (!Array.isArray(persistedRecent)) return [];
    const entries: ShapeGalleryEntry[] = [];
    for (const key of persistedRecent) {
      const entry = typeof key === 'string' ? GalleryEntries.get(key) : undefined;
      if (entry && !entries.includes(entry)) entries.push(entry);
      if (entries.length === MAX_RECENT_SHAPES) break;
    }
    return entries;
  }, [persistedRecent]);

  const handleInsert = useCallbackRef((entry: ShapeGalleryEntry) => {
    command?.execute(entry.json);
    setRecent((prev) => {
      const next = [entry.key];
      for (let i = 0; Array.isArray(prev) && i < prev.length && next.length < MAX_RECENT_SHAPES; i++) {
        if (prev[i] !== entry.key && GalleryEntries.has(prev[i])) next.push(prev[i]);
      }
      return Object.freeze(next);
    });
  }, [command]);

  const renderPopupPanel = useCallback((panelProps: ExhibitPopupPanelProps) => {
    const { closeFloatAll } = panelProps;
    const renderSection = (key: string, label: string, entries: readonly ShapeGalleryEntry[], index: number) => (
      <Box key={key} sx={{ display: 'flex', flexDirection: 'column' }}>
        {index > 0 ? <ExhibitDivider orientation="horizontal"/> : null}
        <ExhibitMenuHeader>
          {label}
        </ExhibitMenuHeader>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, auto)',
            justifyContent: 'start',
            gap: '2px',
            marginBottom: '6px'
          }}
        >
          {entries.map((entry) => (
            <ExhibitIconButton
              key={entry.key}
              dense
              disabled={disabled}
              propsTooltip={{ label: t(entry.label), simple: true }}
              icon={<DynamicIcon iconKey={shapeIconKey(entry.key)} />}
              onClick={() => {
                closeFloatAll?.();
                handleInsert(entry);
              }}
            />
          ))}
        </Box>
      </Box>
    );
    const shown = recent.filter((entry) => categories.some((category) => category.entries.includes(entry)));
    const offset = shown.length > 0 ? 1 : 0;
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 12px',
          maxHeight: '100vh',
          overflowY: 'auto'
        }}
      >
        {offset ? renderSection('recent', t('shape.recentShapes'), shown, 0) : null}
        {categories.map((category, index) => renderSection(
          category.key,
          t(category.label),
          category.entries,
          index + offset
        ))}
      </Box>
    );
  }, [disabled, recent, categories, t]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel(propGroupKey)}
          description={command?.getDescription(propGroupKey)}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      label={propLabel ?? command?.getLabel(propGroupKey)}
      disabled={disabled}
      selected={false}
      icon={propIcon ?? <DynamicIcon iconKey={shapeIconKey('Shapes')} />}
      {...rest}
    />
  );
}));
