import { memo, forwardRef, useCallback, useRef } from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type IPivotTable, type ITableStyle, type IStyleCollection } from '@sheetxl/sdk';

import { useCommands, useCallbackRef, useTranslator, CommandButtonType } from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import {
  CommandButton, ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton, ExhibitIconButton, ExhibitDivider,
  type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

// By module, not the `../pivot` barrel, as the table gallery imports its previews.
import { PivotStyleCanvasPreview } from '../pivot/PivotStyleCanvasPreview';

export interface PresetPivotStylesCommandButtonProps extends CommandPopupButtonProps {
  commandKey: string;
  /**
   * The pivot table the gallery shows and its quick action takes.
   * @defaultValue the pivot table the active cell is in
   */
  selectedPivot?: IPivotTable;
}

interface PresetPivotStyleIconButtonProps {
  /** `null` for None, which takes the style off. */
  tableStyle: ITableStyle | null;
  label: string;
  styles: IStyleCollection;
  options?: IPivotTable.StyleOptions;
  isSelected: boolean;
  disabled?: boolean;
  canvas: HTMLCanvasElement;
  onSelectStyleName: (styleName: string | null) => void;
}

const PresetPivotStyleIconButton = memo((props: PresetPivotStyleIconButtonProps) => {
  const { tableStyle, label, styles, options, isSelected, disabled, canvas, onSelectStyleName } = props;
  return (
    <ExhibitIconButton
      sx={{
        borderRadius: '2px',
        padding: '2px',
        margin: '0px 0px',
        display: 'flex',
        border: (theme: Theme) => `solid ${(isSelected ? theme.palette.primary.dark : 'transparent')} 1px`
      }}
      propsTooltip={{
        label,
        placement: 'bottom-start'
      }}
      disabled={disabled}
      icon={null}
      onClick={() => onSelectStyleName(tableStyle?.getName() ?? null)}
    >
      <PivotStyleCanvasPreview
        canvas={canvas}
        tableStyle={tableStyle}
        styles={styles}
        options={options}
      />
    </ExhibitIconButton>
  );
});

/** The built-in pivot styles' kinds, as their names start, in gallery order. */
const Categories = [
  { prefix: 'PivotStyleLight', label: 'tableStyle.category.light' },
  { prefix: 'PivotStyleMedium', label: 'tableStyle.category.medium' },
  { prefix: 'PivotStyleDark', label: 'tableStyle.category.dark' }
] as const;

/**
 * The pivot table style gallery: every style shown for pivot tables, the custom ones first, each a
 * swatch of the style over a small pivot table with the active table's options. A pick restyles
 * the active pivot table.
 */
export const PresetPivotStylesCommandButton = memo(
  forwardRef<HTMLElement, PresetPivotStylesCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    selectedPivot: propSelectedPivot,
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const t = useTranslator();
  const command = useCommands([commandKey])[0];
  const context: CommandContext.Pivot | undefined = command?.getContext();
  const styles = context?.styles?.();
  const pivot = propSelectedPivot ?? context?.pivot?.() ?? null;
  const options = pivot?.getStyleOptions();

  const handleOnSelectStyleName = useCallbackRef((styleName: string | null) => {
    command?.execute({ name: styleName });
  }, [command]);

  const refCanvas = useRef<HTMLCanvasElement>(null);
  const renderPopupPanel = useCallback((_props: ExhibitPopupPanelProps) => {
    if (!refCanvas.current) {
      refCanvas.current = document.createElement('canvas');
    }
    const canvas = refCanvas.current;
    const all: ITableStyle[] = styles?.getTableStyles().getItems({ shownIn: 'pivot' }) ?? [];

    const generateStyleCategory = (categoryName: string, categoryStyles: (ITableStyle | null)[], showDivider: boolean) => {
      if (categoryStyles.length === 0) return null;
      return (
        <Box key={categoryName}>
          { showDivider ? <ExhibitDivider orientation="horizontal"/> : null }
          <ExhibitMenuHeader>
            {categoryName}
          </ExhibitMenuHeader>
          <Box
            sx={{
              display: 'flex',
              gap: `${2}px`,
              marginBottom: '6px',
              flexWrap: 'wrap',
              width: `${(61 + 3 + 3) * 7 + (2 * 6)}px`,
              maxWidth: '100%'
            }}
          >
            {categoryStyles.map((tableStyle) => (
              <PresetPivotStyleIconButton
                key={tableStyle?.getName() ?? ''}
                tableStyle={tableStyle}
                label={tableStyle?.getName() ?? t('tableStyle.none')}
                styles={styles!}
                options={options}
                isSelected={(tableStyle?.getName() ?? null) === (options?.name ?? null)}
                disabled={propDisabled}
                canvas={canvas}
                onSelectStyleName={handleOnSelectStyleName}
              />
            ))}
          </Box>
        </Box>
      );
    };

    const presets = [];
    const custom = all.filter((style) => !style.isBuiltIn());
    presets.push(generateStyleCategory(t('tableStyle.category.custom'), custom, false));
    Categories.forEach(({ prefix, label }, i) => {
      // A built-in's name is its kind and its number; the gallery orders by the number.
      const numberOf = (style: ITableStyle): number => Number(style.getName().slice(prefix.length));
      const named = all
        .filter((style) => style.isBuiltIn() && style.getName().startsWith(prefix) && Number.isInteger(numberOf(style)))
        .sort((a, b) => numberOf(a) - numberOf(b));
      // Light opens with None, as Excel's does.
      presets.push(generateStyleCategory(t(label), i === 0 ? [null, ...named] : named, custom.length > 0 || i > 0));
    });

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '100%',
          paddingTop: (theme: Theme) => `${theme.shape.borderRadius}px`,
          paddingBottom: (theme: Theme) => `${theme.shape.borderRadius}px`
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            padding: '6px 16px'
          }}
        >
          {presets}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          variant={CommandButtonType.Menuitem}
          commandKey={'formatPivotStyleClear'}
          disabled={propDisabled}
        />
      </Box>
    );
  }, [styles, styles?.getTheme(), options, propDisabled, t]);

  const isDisabled = propDisabled ?? (!command || command.disabled());
  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      label={command?.getLabel(groupKey)}
      groupKey={groupKey}
      commandState={pivot}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => (
        <ExhibitTooltip
          label={command?.getLabel()}
          description={command?.getDescription()}
          disabled={disabled}
        >
          {children}
        </ExhibitTooltip>
      )}
      disabled={isDisabled}
      icon={command?.getIcon()}
      {...rest}
    />
  );
}));

PresetPivotStylesCommandButton.displayName = 'PresetPivotStylesCommandButton';
