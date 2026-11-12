import type React from 'react';
import { useMemo, memo, forwardRef, useCallback } from 'react';

// import clsx from 'clsx';

import { type Theme, useTheme } from '@mui/material';
import { Box } from '@mui/material';

import { DefaultLanguagePackService } from '@sheetxl/utils';

import {
  IFont, ICellStyle, ITextFrame, builtInStyleNameDisplay, type ICell
} from '@sheetxl/sdk';

import {
  useCommands, useCallbackRef, useTranslator, type TranslateFn, CommandButtonType, DynamicIcon
} from '@sheetxl/utils-react';

import { StaticCellRenderer, useGridColorScheme, type CommandContext } from '@sheetxl/react';

import {
  CommandButton, ExhibitMenuHeader, ExhibitTooltip, ExhibitDivider, CommandPopupButton,
  ExhibitIconButton, ContextMenu, defaultRenderPopupPanel,
  type ExhibitPopupPanelProps, type CommandPopupButtonProps, type  ExhibitIconButtonProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

/**
 * The localized DISPLAY name for a style. Built-in names resolve through the
 * catalog ('Good' -> 'Gut'); custom names pass through unchanged. The canonical
 * `getName()` stays the identity (keys, `cellStyle.named`, selection compares).
 */
const localizeStyleName = (name: string, t: TranslateFn): string => {
  const display = builtInStyleNameDisplay(name);
  return display ? t(display.key, display.params) : name;
};

/**
 * Sort style names by their LOCALIZED display name, collated in the active UI
 * language (Excel orders the gallery by the shown name: en `Bad, Good, Neutral`
 * → de `Gut, Neutral, Schlecht`). `numeric` keeps `Heading 2` before `Heading 10`.
 */
const sortByLocalizedName = (names: readonly string[], t: TranslateFn): string[] => {
  const collator = new Intl.Collator(DefaultLanguagePackService.getActive(), { numeric: true });
  return [...names].sort((a, b) => collator.compare(localizeStyleName(a, t), localizeStyleName(b, t)));
};

export interface PresetCellStylesCommandButtonProps extends CommandPopupButtonProps {

  commandKey: string; // ICommand<ICellStyle.INamed, CommandContext.NamedStyle>;

  selectedNamed?: ICellStyle.INamed;
  onSelectNamed?: (style: ICellStyle.INamed) => void;

  usePreviewIcon?: boolean;
}

interface PresetStyleIconButtonProps extends ExhibitIconButtonProps {
  hasContextMenu?: boolean;
  createCell(update: ICell.Update): ICell | null;

  namedStyle: ICellStyle.INamed;
  selectedNamed?: ICellStyle.INamed;
  onSelectNamed?: (named: ICellStyle.INamed) => void;
}

const PresetStyleIconButton = memo((props: PresetStyleIconButtonProps) => {
  const {
    namedStyle,
    selectedNamed,
    hasContextMenu = true,
    onSelectNamed,
    createCell,
    disabled,
    ...rest
  } = props;

  const t = useTranslator();
  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      context: 'cellStyle',
      // disabled: propDisabled
    }
    const menus = (<>
      <CommandButton
        {...commandButtonProps}
        style={{ // We want to indicate that this is the default action.
          fontWeight: 550
        }}
        commandKey={'formatCellStyle'}
        commandState={namedStyle}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        commandKey={'modifyCellStyle'}
        commandState={{ named: namedStyle }}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'deleteCellStyle'}
        commandState={namedStyle}
        disabled={disabled || namedStyle?.getName() === ICellStyle.BuiltInName.Normal}
      />
    </>
    );

    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {menus}
        </Box>
      </Box>
    );
    return defaultRenderPopupPanel({...props, children});
  }, []);

  const isSelected = namedStyle?.getName() === selectedNamed?.getName();

  let retValue = (
    <ExhibitIconButton
      sx={{
        borderRadius: '2px',
        padding: '2px',
        margin: '0px 0px',
        display: 'flex',
        border: (theme: Theme) => {
          return `solid ${(isSelected ? theme.palette.primary.dark : 'transparent')} 1px`
        },
      }}
      key={namedStyle.getName()}
      propsTooltip={{
        label: localizeStyleName(namedStyle.getName(), t),
        placement: 'bottom-start', //'right-end'
      }}
      disabled={disabled}
      icon={null}
      onClick={() => {
        onSelectNamed?.(namedStyle);
      }}
      {...rest}
    >
      <StaticCellRenderer
        value={localizeStyleName(namedStyle.getName(), t)}
        cellStyle={{ named: namedStyle.getName() }}
        createCell={createCell}
      />
    </ExhibitIconButton>
  );

  if (hasContextMenu) {
    retValue = (
      <ContextMenu
        label={localizeStyleName(namedStyle.getName(), t)}
        renderPopupPanel={renderPopupPanel}
      >
        { retValue}
      </ContextMenu>
    );
    }
  return retValue;
});


export const PresetCellStylesCommandButton = memo(
  forwardRef<HTMLElement, PresetCellStylesCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    selectedNamed: propSelectedNamed,
    onSelectNamed: propOnSelectNamed,
    disabled: propDisabled,
    usePreviewIcon = true,
    groupKey,
    ...rest
  } = props;

  const t = useTranslator();
  const [command] = useCommands([commandKey]);
  const context:CommandContext.NamedStyle = command?.getContext();
  const getStyles = context?.styles;
  const named = propSelectedNamed ?? context?.named();
  // The swatch renders plain DOM (`StaticCellRenderer` is UI-kit-free), so the one themed value it
  // needs — the hover outline — is resolved here rather than through an `sx` callback.
  const theme = useTheme();
  // Self-source the grid's light/dark intent; the portaled preview + popup adopt the grid surface via
  // `data-sxl-theme-*` below (replacing the removed `context.systemColors`).
  const gridColorScheme = useGridColorScheme();

  const handleOnSelectNamed = useCallbackRef((named: ICellStyle.INamed) => {
    propOnSelectNamed?.(named);
    command?.execute(named);
  }, [command, propOnSelectNamed]);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const styles = getStyles?.();
    const propsStyleButton = {
      onSelectNamed: handleOnSelectNamed
    }

    const customStyles:ICellStyle.INamed[] = styles?.getNamedStyles().getItems({ type: 'custom' });
    // because customStyles also include customized built ins
    const customStylesMap:Map<string, ICellStyle.INamed> = new Map();
    const customUniqueNames:string[] = [];
    const customStylesLength = customStyles ? customStyles.length ?? 0 : 0;
    for (let i=0; i<customStylesLength; i++) {
      customStylesMap.set(customStyles[i].getName(), customStyles[i]);
      if (styles?.getNamedStyles().getByName(customStyles[i].getName())?.getBuiltInID() === null) {
        customUniqueNames.push(customStyles[i].getName());
      }
    }

    const generateStyleButton = (styleName: string) => {
      let namedStyle:ICellStyle.INamed | null | undefined = customStylesMap.get(styleName);
      if (!namedStyle)
        namedStyle = styles?.getNamedStyles().getByName(styleName);
      if (!namedStyle || namedStyle.isHidden()) return null;

      return (
        <PresetStyleIconButton
          key={styleName}
          namedStyle={namedStyle}
          selectedNamed={named}
          createCell={context.createCell}
          {...propsStyleButton}
        />
      );
    }

    const generateStyleCategory = (categoryName: string, styleNames: string[], showDivider: boolean=true) => {
      const buttons = [];
      for (let i=0; i<styleNames.length; i++) {
        const button = generateStyleButton(styleNames[i]);
        if (button)
          buttons.push(button);
      }
      if (buttons.length === 0) return null;
      return (
        <Box
          key={categoryName}
        >
          { showDivider ? <ExhibitDivider orientation="horizontal"/> : null }
          <ExhibitMenuHeader
            key={categoryName +'-header'}
          >
            {categoryName}
          </ExhibitMenuHeader>
          <Box
            key={categoryName +'-presets'}
            sx={{
              display: 'flex',
              gap: `${2}px`,
              marginBottom: '6px',
              flexWrap: 'wrap',
              width: `${106 * 6 + (2 * 5)}px`,
              maxWidth: '100%'
            }}
          >
            {buttons}
          </Box>
        </Box>
      );
    }

    const generateStyleGroup = (groupKey: string,  styleNames: string[]) => {
      const buttons = [];
      for (let i=0; i<styleNames.length; i++) {
        const button = generateStyleButton(styleNames[i]);
        if (button)
          buttons.push(button);
      }
      if (buttons.length === 0) return null;
      return (
        <Box
          key={groupKey +'-presets'}
          sx={{
            display: 'flex',
            gap: `${2}px`,
            marginBottom: '6px',
            flexWrap: 'wrap',
            flexDirection: 'column',
            flex: '0 0 0%'
          }}
        >
          {buttons}
        </Box>
      );
    }


    const generateStyleGroupCategory = (categoryName: string, styleGroups: (React.ReactElement | null)[]) => {
      return (
        <Box
          key={categoryName}
        >
          <ExhibitDivider orientation="horizontal"/>
          <ExhibitMenuHeader key={categoryName +'-header'}>
            {categoryName}
          </ExhibitMenuHeader>
          <Box
            key={categoryName +'-presets'}
            sx={{
              display: 'flex',
              gap: `${2}px`,
              flexWrap: 'wrap',
              alignItems: 'start',
              flexDirection: 'row'
            }}
          >
            {styleGroups}
          </Box>
        </Box>
      );
    }

    const presets = [];
    presets.push(generateStyleCategory(t('cellStyle.category.custom'), customUniqueNames, false));
    // Excel orders each text category by the LOCALIZED name; `Normal` is pinned
    // first (the reset/default), the rest collate in the active language.
    presets.push(generateStyleCategory(t('cellStyle.category.goodBadNeutral'), [
      ICellStyle.BuiltInName.Normal,
      ...sortByLocalizedName([
        ICellStyle.BuiltInName.Bad,
        ICellStyle.BuiltInName.Good,
        ICellStyle.BuiltInName.Neutral
      ], t)
    ], customUniqueNames.length > 0));
    presets.push(generateStyleCategory(t('cellStyle.category.dataModel'), sortByLocalizedName([
      ICellStyle.BuiltInName.Calculation,
      ICellStyle.BuiltInName.CheckCell,
      ICellStyle.BuiltInName.ExplanatoryText,
      ICellStyle.BuiltInName.FollowedHyperlink,
      ICellStyle.BuiltInName.Hyperlink,
      ICellStyle.BuiltInName.Input,
      ICellStyle.BuiltInName.LinkedCell,
      ICellStyle.BuiltInName.Note,
      ICellStyle.BuiltInName.Output,
      ICellStyle.BuiltInName.WarningText
    ], t)));
    presets.push(generateStyleCategory(t('cellStyle.category.titlesHeadings'), sortByLocalizedName([
      ICellStyle.BuiltInName.Heading1,
      ICellStyle.BuiltInName.Heading2,
      ICellStyle.BuiltInName.Heading3,
      ICellStyle.BuiltInName.Heading4,
      ICellStyle.BuiltInName.Title,
      ICellStyle.BuiltInName.Total
    ], t)));

    let stylesGroup = [];
    stylesGroup.push(generateStyleGroup('Accent 1', [
      ICellStyle.BuiltInName.Accent1_20,
      ICellStyle.BuiltInName.Accent1_40,
      ICellStyle.BuiltInName.Accent1_60,
      ICellStyle.BuiltInName.Accent1
    ]));
    stylesGroup.push(generateStyleGroup('Accent 2', [
      ICellStyle.BuiltInName.Accent2_20,
      ICellStyle.BuiltInName.Accent2_40,
      ICellStyle.BuiltInName.Accent2_60,
      ICellStyle.BuiltInName.Accent2
    ]));
    stylesGroup.push(generateStyleGroup('Accent 3', [
      ICellStyle.BuiltInName.Accent3_20,
      ICellStyle.BuiltInName.Accent3_40,
      ICellStyle.BuiltInName.Accent3_60,
      ICellStyle.BuiltInName.Accent3
    ]));
    stylesGroup.push(generateStyleGroup('Accent 4', [
      ICellStyle.BuiltInName.Accent4_20,
      ICellStyle.BuiltInName.Accent4_40,
      ICellStyle.BuiltInName.Accent4_60,
      ICellStyle.BuiltInName.Accent4
    ]));
    stylesGroup.push(generateStyleGroup('Accent 5', [
      ICellStyle.BuiltInName.Accent5_20,
      ICellStyle.BuiltInName.Accent5_40,
      ICellStyle.BuiltInName.Accent5_60,
      ICellStyle.BuiltInName.Accent5
    ]));
    stylesGroup.push(generateStyleGroup('Accent 6', [
      ICellStyle.BuiltInName.Accent6_20,
      ICellStyle.BuiltInName.Accent6_40,
      ICellStyle.BuiltInName.Accent6_60,
      ICellStyle.BuiltInName.Accent6
    ]));
    presets.push(generateStyleGroupCategory(t('cellStyle.category.themed'), stylesGroup));

    presets.push(generateStyleCategory(t('cellStyle.category.numberFormat'), [
      ICellStyle.BuiltInName.Comma,
      ICellStyle.BuiltInName.Comma0,
      ICellStyle.BuiltInName.Currency,
      ICellStyle.BuiltInName.Currency0,
      ICellStyle.BuiltInName.Percent
    ]));
    return (
      <Box
        // Popup is portaled outside the grid subtree; adopt the grid surface so the `auto` colors in the
        // preview swatches (var(--sxl-sys-color-*)) resolve against the grid via the float-carried scope class.
        data-sxl-theme-surface="grid"
        data-sxl-theme-mode={gridColorScheme}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '100%',
          paddingTop: (theme: Theme) => `${theme.shape.borderRadius}px`,
          paddingBottom: (theme: Theme) => `${theme.shape.borderRadius}px`,
          // maxWidth: '700px'
        }}
      >
        <Box
          onContextMenu={() => {}}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '6px',
            paddingBottom: '0px',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}
        >
          {presets}
        </Box>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          variant={CommandButtonType.Menuitem}
          commandState={named}
          commandKey={'newCellStyle'}
          groupKey={'cellStyle'} // the styles-gallery group (groupLabels.cellStyle)
          disabled={propDisabled}
        />
      </Box>
    );
  }, [gridColorScheme, named, getStyles?.().getTheme(), t]);

  const createBoundedCellTemplate = useCallbackRef((update: ICell.Update): ICell | null => {
    if (!context) return null;
    const maxFontSize = 18 / IFont.getDeviceScale();
    const cellTemplate:ICell = context.createCell(update);
    // The swatch is a toolbar-sized box, not a row, so center rather than honor the style's vertical alignment.
    const alignment = { vertical: ITextFrame.VerticalAlignment.Center };
    if (cellTemplate.getStyle().getFont().getSize() <= maxFontSize)
      return cellTemplate.createCell({ style: { alignment }});
    return cellTemplate.createCell({ style: { alignment, font: { size: maxFontSize } }});
  }, [context?.createCell]);

  const isDisabled = propDisabled ?? (!command || command.disabled());
  const icon = useMemo(() => {
    if (!usePreviewIcon) {
      return command?.getIcon() ?? <DynamicIcon/>;
    }
    return (
      <StaticCellRenderer
        value={named ? localizeStyleName(named.getName(), t) : ''} // blank
        cellStyle={named ? { named: named.getName() } : {} }
        createCell={createBoundedCellTemplate}
        className={"outline-hover"}
        disabled={isDisabled}
        // `StaticCellRenderer` already adopts the grid surface on its own root (`data-sxl-theme-surface`),
        // so `auto` colors (var(--sxl-sys-color-*)) resolve against the grid — no `context.systemColors` needed.
        style={{
          marginRight: '4px',
          borderRadius: '2px',
          // The ribbon row is content-sized (`CommandToolbar` uses alignItems center / height unset),
          // so `height: 100%` on the swatch collapses to `auto` and a large-font style (Title, Heading)
          // would grow the swatch → grow the toolbar. Pin the swatch to the toolbar's own `--icon-size`
          // token (the height every sibling icon uses, density-aware), and clip — the preview font is
          // already capped in `createBoundedCellTemplate`, so switching styles never resizes the toolbar.
          height: 'var(--icon-size)',
          maxHeight: 'var(--icon-size)',
          overflow: 'hidden',
          lineHeight: 1.2,
          outline: `1px solid ${theme.palette.action.hover}`
        }}
        propsBorder={{
          style: {
            height: 'calc(100% - 2px)',
            width: 'calc(100% - 1px)',
          }
        }}
      />
    );
  }, [named, isDisabled, command, t, theme]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      renderPopupPanel={renderPopupPanel}
      outlined={usePreviewIcon}
      renderTooltip={({ children, disabled }: ButtonTooltipRenderProps) => {
        return (
          <ExhibitTooltip
            label={command?.getLabel()}
            description={command?.getDescription()}
            disabled={disabled}
          >
            {children}
          </ExhibitTooltip>
        );
      }}
      // TODO - last style selection?
      //onQuickClick={() => { activeCommand?.execute() }}
      selected={false}
      disabled={isDisabled}
      label={command?.getLabel(groupKey)}
      groupKey={groupKey}
      icon={icon}
      {...rest}
    />
  )
}));