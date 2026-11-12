import type React from 'react';
import {
  useMemo, memo, forwardRef, useCallback, useState, useEffect, useRef
} from 'react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import {
  type ITable, Table, type ITableStyle, type IStyleCollection
} from '@sheetxl/sdk';

import {
  useCommands, useCallbackRef, useTranslator, CommandButtonType
} from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import {
  CommandButton, ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton,
  ExhibitIconButton, ContextMenu, defaultRenderPopupPanel, ExhibitDivider,
  type ExhibitIconButtonProps, type CommandPopupButtonProps, type ExhibitPopupPanelProps, type ButtonTooltipRenderProps
} from '@sheetxl/utils-mui';

// By module, not the `../table` barrel: the table panel imports this button from `../command`, so
// two barrels here would close a command <-> table cycle. The previews are leaves; the barrel is not.
import { TableStylePreview, TableStyleCanvasPreview } from '../table';

export interface PresetTableStylesCommandButtonProps extends CommandPopupButtonProps {

  commandKey: string;//ICommand<ITableStyle.StyleOptions, CommandContext.Table>;

  selectedTable?: ITable;
  onSelectTableStyleName?: (styleName: string) => void;

  usePreviewIcon?: boolean;

  disabledQuickKey?: boolean;
}


interface PresetTableStyleIconButtonProps extends ExhibitIconButtonProps {
  /**
   * The table style info is ignored
   */
  table: ITable;
  tableStyle: ITableStyle;
  styles: IStyleCollection;

  hasContextMenu?: boolean;
  /**
   * Purely selection concerns
   */
  selectedTableStyleName?: string;
  onSelectTableStyleName?: (styleName: string) => void;

  /**
   * If true uses a simple but 'faster' preview based on canvas.
   * @remarks
   * The simpler one matches Excel
   */
  useCanvasPreview?: boolean;
  /**
   * If provided then this context will be used.
   * @remarks
   * Ignored if useCanvasPreview is not set.
   */
  canvas?: HTMLCanvasElement;
}

const PresetTableStyleIconButton = memo((props: PresetTableStyleIconButtonProps) => {
  const {
    table,
    tableStyle,
    selectedTableStyleName,
    onSelectTableStyleName,
    styles,
    hasContextMenu = true,
    disabled,
    useCanvasPreview=true, // Note - this seems to be slower than html divs...
    canvas,
    ...rest
  } = props;
  const t = useTranslator();

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey: 'tableStyleOptions', // the style-swatch context menu — selects the compact `@tableStyleOptions` labels
      // disabled: propDisabled
    }
    const menus = (<>
      <CommandButton
        {...commandButtonProps}
        commandKey={'formatTableStyleClearCellStyles'}
        commandState={tableStyle}
        disabled={disabled}
      />
      <CommandButton // as the default action this should be first but we are being consistent with excel for now.
        {...commandButtonProps}
        style={{ // We want to indicate that this is the default action.
          fontWeight: 550
        }}
        commandKey={'formatTableStyle'}
        commandState={{
          name: tableStyle.getName()
        }}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        commandKey={'setDefaultTableStyle'}
        commandState={tableStyle.getName()}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      {/*
      <CommandButton
        {...commandButtonProps}
        commandKey={'modifyTableStyle'}
        commandState={tableStyle?.getName()}
        disabled={disabled || !tableStyle || tableStyle.isBuiltIn()}
      />
      <CommandButton
        {...commandButtonProps}
        commandKey={'duplicateTableStyle'}
        commandState={tableStyle?.getName()}
      />
      */}
      <CommandButton
        {...commandButtonProps}
        commandKey={'deleteTableStyle'}
        commandState={tableStyle?.getName()}
        disabled={disabled || !tableStyle || tableStyle.isBuiltIn()}
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

  const isSelected:boolean = tableStyle?.getName() === selectedTableStyleName;
  const tablePreview:React.ReactElement = useMemo(() => {
    const tablePreviewProps = {
      table,
      tableStyle,
      styles
    }
    if (useCanvasPreview) {
      // The canvas preview self-sources the grid scheme (useGridColorScheme) + resolves its window color
      return (
        <TableStyleCanvasPreview
          canvas={canvas}
          {...tablePreviewProps}
        />
      )
    } else {
      return (
        <TableStylePreview
          {...tablePreviewProps}
        />
      )
    }
  }, [table, tableStyle, styles]);

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
      key={tableStyle.getName()}
      propsTooltip={{
        label: tableStyle.getName() ?? t('tableStyle.none'),
        placement: 'bottom-start', //'right-end'
      }}
      disabled={disabled}
      icon={null}
      onClick={() => {
        onSelectTableStyleName?.(tableStyle?.getName());
      }}
      {...rest}
    >
      {tablePreview}
    </ExhibitIconButton>
  );

  if (hasContextMenu) {
    retValue = (
      <ContextMenu
        label={table.getStyleOptions().name}
        renderPopupPanel={renderPopupPanel}
      >
        { retValue}
      </ContextMenu>
    );
    }
  return retValue;
});

const createDefaultTable = (styleOptions: ITableStyle.StyleOptions | undefined, styles: IStyleCollection): ITable => {
  return new Table({
    size: {
      width: 5,
      height: 5
    },
    styles,
    json: {
      name: 'PreviewTable',
      description: 'PreviewTable',

      headerRowCount: 1, // The preview table has a headerRowCount of 1
      totalsRowCount: 0, // for testing

      style: styleOptions
    },
  });
}

export const PresetTableStylesCommandButton = memo(
  forwardRef<HTMLElement, PresetTableStylesCommandButtonProps>((props, refForwarded) => {
  const {
    commandKey,
    selectedTable: propSelectedTable,
    onSelectTableStyleName: propOnSelectTableStyleName,
    disabled: propDisabled,
    disabledQuickKey = false,
    usePreviewIcon = false,
    groupKey,
    // style: propStyle,
    //className: propClassName,
    ...rest
  } = props;

  const t = useTranslator();
  const command = useCommands([commandKey])[0];
  const context:CommandContext.Table = command?.getContext();
  const stylesFn = context?.styles;
  const styles = stylesFn?.();

  const tableActive:ITable | null = propSelectedTable ?? context?.table?.() ?? null;
  let quickCommandKey = 'insertTable';
  if (tableActive) {
    quickCommandKey = 'editTable';
  }

  const defaultTable = useMemo(() => {
    return createDefaultTable(tableActive?.getStyleOptions(), styles);
  }, [styles?.getTableStyles().getDefault(), tableActive?.getStyleOptions()]);

  const tableExternal:ITable = tableActive ?? defaultTable;
  const [table, setTable] = useState<ITable>(tableExternal);

  useEffect(() => {
    setTable(tableExternal);
  }, [tableExternal]);

  const handleOnSelectStyleName = useCallbackRef((styleName: string) => {
    propOnSelectTableStyleName?.(styleName);
    command?.execute({
      name: styleName
    });
  }, [command, propOnSelectTableStyleName]);

  const refCanvas = useRef<HTMLCanvasElement>(null);
  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const propsStyleButton = {
      onSelectTableStyleName: handleOnSelectStyleName,
      styles,
    }

    if (!refCanvas.current) {
      refCanvas.current = document.createElement('canvas');
    }
    const generateStyleButton = (styleName: string | null) => {
      if (!styleName) return null;
      const tableStyle:ITableStyle | null = styles?.getTableStyles().getByName(styleName);
      if (!tableStyle) return null;

        return (
        <PresetTableStyleIconButton
          key={styleName}
          table={table}
          tableStyle={tableStyle}
          selectedTableStyleName={table.getStyleOptions().name}
          canvas={refCanvas.current!}
          {...propsStyleButton}
        />
      );
    }

    const generateStyleCategory = (categoryName: string, styleNames: (string | null)[], showDivider: boolean=true) => {
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
          <ExhibitMenuHeader key={categoryName +'-header'}>
            {categoryName}
          </ExhibitMenuHeader>
          <Box
            key={categoryName +'-presets'}
            sx={{
              display: 'flex',
              gap: `${2}px`,
              marginBottom: '6px',
              flexWrap: 'wrap',
              width: `${(61 + 3 + 3) * 7 + (2 * 6)}px`,
              maxWidth: '100%'
            }}
          >
            {buttons}
          </Box>
        </Box>
      );
    }

    const presets = [];
    const customStyles:ITableStyle[] = styles?.getTableStyles().getItems({ type: 'custom' });
    const customNames = [];
    const customStylesLength = customStyles ? customStyles.length : 0;
    if (customStylesLength > 0) {
      for (let i=0; i<customStylesLength; i++) {
        const customStyle = customStyles[i];
        if (customStyle.isShownInTableStyles())
          customNames.push(customStyle.getName());
      }
      presets.push(generateStyleCategory(t('tableStyle.category.custom'), customNames, false));
    }

    const lightNames = [];
    // If we have a none style we add an empty style to the light category
    if (tableActive && !tableActive.getStyleOptions().name) {
      lightNames.push(null);
    }
    // lightNames.push('TableStyleLight'+7);
    // presets.push(generateStyleCategory('Light', lightNames));

    for (let i=0; i<21; i++) {
      lightNames.push('TableStyleLight'+(i+1));
    }
    presets.push(generateStyleCategory(t('tableStyle.category.light'), lightNames, customNames.length > 0));
    const mediumNames = [];
    for (let i=0; i<28; i++) {
      mediumNames.push('TableStyleMedium'+(i+1));
    }
    presets.push(generateStyleCategory(t('tableStyle.category.medium'), mediumNames));
    const darkNames = [];
    for (let i=0; i<11; i++) {
      darkNames.push('TableStyleDark'+(i+1));
    }
    presets.push(generateStyleCategory(t('tableStyle.category.dark'), darkNames));

    let additionalOptions = null;
    if (tableActive) {
      additionalOptions = (
        <>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          variant={CommandButtonType.Menuitem}
          // context="table"
          commandKey={'formatTableStyleClearTableStyle'}
          disabled={propDisabled}
        />
        </>
      )
    }

    return (
      <Box
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
            padding: '6px 16px'
          }}
        >
          {presets}
        </Box>
        {additionalOptions}
      </Box>
    );
  }, [styles, styles?.getTheme(), table, t]);

  const isDisabled = propDisabled ?? (!command || command.disabled());
  const icon = useMemo(() => {
    if (!context || !usePreviewIcon) {
      return command?.getIcon();
    }
    // return (
    //   <TableFormatPreview
    //     // value={(style as any)?.getName() ?? 'Custom'}
    //     table={table}
    //     tableStyle={table}
    //     styles={context.styles()}
    //     className={"outline-hover"}
    //     disabled={isDisabled}
    //     sx={{
    //       maxHeight: '24px',
    //       height: '24px',
    //       marginRight: '2px',
    //       // overflow: 'hidden',
    //       outline:(theme: Theme) => `1px solid ${theme.palette.action.hover}`
    //     }}
    //   />
    // );
  }, [table, isDisabled, command]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={disabledQuickKey ? undefined : quickCommandKey}
      renderPopupPanel={renderPopupPanel}
      label={command?.getLabel(groupKey)}
      groupKey={groupKey}
      commandState={tableActive}
      // outlined={usePreviewIcon} // and not menu item (perhaps just have menu item honor outline prop even if it ignores)
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
      disabled={isDisabled}
      icon={icon}
      {...rest}
    />
  )
}));