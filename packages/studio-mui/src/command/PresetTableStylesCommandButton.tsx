import React, {
  useMemo, memo, forwardRef, useCallback, useState, useEffect, useRef
} from 'react';

import { Theme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { TooltipProps } from '@mui/material';

import {
  ITable, Table, ITableStyle, IStyleCollection
} from '@sheetxl/sdk';

import { GridSurfaceStyle } from '@sheetxl/grid-react';

import {
  useCommand, ICommand, useCallbackRef, ICommandHook, CommandButtonType,
  ICommands
} from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';

import {
  CommandButton, CommandPopupButtonProps, ExhibitPopupPanelProps,
  ExhibitMenuHeader, ExhibitTooltip, CommandPopupButton,
  ExhibitIconButton, ExhibitIconButtonProps, ContextMenu, defaultCreatePopupPanel,
  ExhibitDivider,
} from '@sheetxl/utils-mui';

import { TableStylePreview, TableStyleCanvasPreview } from '../components/table';

export interface PresetTableStylesCommandButtonProps extends CommandPopupButtonProps {

  command: ICommand<ITableStyle.StyleOptions, CommandContext.Table>;

  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  selectedTable?: ITable;
  onSelectTableStyleName?: (styleName: string) => void;

  bodyStyle?: GridSurfaceStyle;

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
  bodyStyle?: GridSurfaceStyle;

  /**
   * Purely selection concerns
   */
  selectedTableStyleName?: string;
  onSelectTableStyleName?: (styleName: string) => void;

  commands: ICommands.IGroup;
  commandHook: ICommandHook<any, any>;
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
    bodyStyle,
    parentFloat,
    commands,//: propCommands,
    disabled,
    commandHook,
    useCanvasPreview=true, // Note - this seems to be slower than html divs...
    canvas,
    ...rest
  } = props;

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      commandHook: commandHook,
      context: 'table',
      // disabled: propDisabled
    }
    const menus = (<>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('formatTableStyleClearCellStyles')}
        commandState={tableStyle}
        disabled={disabled}
      />
      <CommandButton // as the default action this should be first but we are being consistent with excel for now.
        {...commandButtonProps}
        style={{ // We want to indicate that this is the default action.
          fontWeight: 550
        }}
        command={commands.getCommand('formatTableStyle')}
        commandState={{
          name: tableStyle.getName()
        }}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('setDefaultTableStyle')}
        commandState={tableStyle.getName()}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      {/*
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('modifyTableStyle')}
        commandState={tableStyle?.getName()}
        disabled={disabled || !tableStyle || tableStyle.isBuiltIn()}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('duplicateTableStyle')}
        commandState={tableStyle?.getName()}
      />
      */}
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteTableStyle')}
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
    return defaultCreatePopupPanel({...props, children});
  }, [commands]);

  const isSelected = tableStyle?.getName() === selectedTableStyleName;
  const tablePreview:React.ReactElement = useMemo(() => {
    const tablePreviewProps = {
      table,
      tableStyle,
      styles,
      bodyStyle
    }
    if (useCanvasPreview) {
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
  }, [table, tableStyle, styles, bodyStyle]);

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
      tooltipProps={{
        label: tableStyle.getName() ?? 'None',
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
        parentFloat={parentFloat}
        createPopupPanel={createPopupPanel}
      >
        { retValue}
      </ContextMenu>
    );
    }
  return retValue;
});

const createDefaultTable = (styleOptions: ITableStyle.StyleOptions, styles: IStyleCollection): ITable => {
  const defaultSize = {
    rowStart: 0,
    colStart: 0,
    rowEnd: 4,
    colEnd: 4
  };
  return new Table({
    initialAnchor: defaultSize,
    styles,
    json: {
      name: 'PreviewTable',
      ref: defaultSize,
      description: 'PreviewTable',

      headerRowCount: 1, // The preview table has a headerRowCount of 1
      totalsRowCount: 0, // for testing

      styleOptions
    },
  });
}

export const PresetTableStylesCommandButton = memo(
  forwardRef<HTMLElement, PresetTableStylesCommandButtonProps>((props, refForwarded) => {
  const {
    commands: propCommands,
    command,
    commandHook,
    selectedTable: propSelectedTable,
    onSelectTableStyleName: propOnSelectTableStyleName,
    disabled: propDisabled = false,
    bodyStyle: propBodyStyle,
    disabledQuickKey = false,
    usePreviewIcon = false,
    // style: propStyle,
    //className: propClassName,
    ...rest
  } = props;

  const _ = useCommand(command);
  const context:CommandContext.Table = command?.context();
  const styles = context?.styles;

  const tableActive:ITable = propSelectedTable ?? context?.table?.();
  let quickCommandKey = 'insertTable';
  if (tableActive) {
    quickCommandKey = 'editTable';
  }

  const defaultTable = useMemo(() => {
    return createDefaultTable(tableActive?.getStyleOptions(), styles?.());
  }, [styles?.().getDefaultTableStyle(), tableActive?.getStyleOptions()]);

  const tableExternal:ITable = tableActive ?? defaultTable;
  const [table, setTable] = useState<ITable>(tableExternal);

  useEffect(() => {
    setTable(tableExternal);
  }, [tableExternal]);
  const bodyStyle = propBodyStyle ?? context?.bodyStyle();

  const handleOnSelectStyleName = useCallbackRef((styleName: string) => {
    propOnSelectTableStyleName?.(styleName);
    command?.execute({
      name: styleName
    }, commandHook);
  }, [command, propOnSelectTableStyleName, commandHook]);

  const refCanvas = useRef<HTMLCanvasElement>(null);
  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const propsStyleButton = {
      onSelectTableStyleName: handleOnSelectStyleName,
      styles: styles(),
      parentFloat: props.floatReference,
    }

    if (!refCanvas.current) {
      refCanvas.current = document.createElement('canvas');
    }
    const generateStyleButton = (styleName: string) => {
      const tableStyle:ITableStyle = styles().getTableStyle(styleName);
      if (!tableStyle) return null;

        return (
        <PresetTableStyleIconButton
          key={styleName}
          table={table}
          tableStyle={tableStyle}
          selectedTableStyleName={table.getStyleOptions().name}
          bodyStyle={context.bodyStyle()}

          commands={commands}
          commandHook={commandHook}
          canvas={refCanvas.current}
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
    const customStyles:ITableStyle[] = styles().getCustomTableStyles();
    const customNames = [];
    if (customStyles.length > 0) {
      for (let i=0; i<customStyles.length; i++) {
        if (customStyles[i].isShownInTableStyles())
          customNames.push(customStyles[i].getName());
      }
      presets.push(generateStyleCategory('Custom', customNames, false));
    }

    const lightNames = [];
    // If we have a none style we add an empty style to the light category
    if (tableActive && !tableActive.getStyleOptions().name) {
      lightNames.push(null);
    }
    // lightNames.push('TableStyleLight'+7);
    // presets.push(generateStyleCategory('Light', lightNames));

    for (let i=0;i<21;i++) {
      lightNames.push('TableStyleLight'+(i+1));
    }
    presets.push(generateStyleCategory('Light', lightNames, customNames.length > 0));
    const mediumNames = [];
    for (let i=0;i<28;i++) {
      mediumNames.push('TableStyleMedium'+(i+1));
    }
    presets.push(generateStyleCategory('Medium', mediumNames));
    const darkNames = [];
    for (let i=0;i<11;i++) {
      darkNames.push('TableStyleDark'+(i+1));
    }
    presets.push(generateStyleCategory('Dark', darkNames));

    let additionalOptions = null;
    if (tableActive) {
      additionalOptions = (
        <>
        <ExhibitDivider orientation="horizontal"/>
        <CommandButton
          variant={CommandButtonType.Menuitem}
          // context="table"
          command={commands.getCommand('formatTableStyleClearTableStyle')}
          commandHook={commandHook}
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
  }, [styles, styles?.().getTheme(), bodyStyle, table]);

  const isDisabled = propDisabled || !command || command.disabled();
  const icon = useMemo(() => {
    if (!context || !usePreviewIcon) {
      return command?.icon();
    }
    // return (
    //   <TableFormatPreview
    //     // value={(style as any)?.getName() ?? 'Custom'}
    //     table={table}
    //     tableStyle={table}
    //     styles={context.styles()}
    //     bodyStyle={context.bodyStyle()}
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
  }, [table, bodyStyle, isDisabled, command]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      quickCommand={disabledQuickKey ? undefined : quickCommandKey}
      createPopupPanel={createPopupPanel}
      commands={propCommands}
      label={command?.label()}
      commandState={tableActive}
      commandHook={commandHook}
      selected={tableActive !== null}
      // outlined={usePreviewIcon} // and not menu item (perhaps just have menu item honor outline prop even if it ignores)
      createTooltip={({children}: TooltipProps, disabled: boolean) => {
        return (
          <ExhibitTooltip
            label={command?.label()}
            description={command?.description()}
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