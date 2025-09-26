import React, {
  useMemo, memo, forwardRef, useCallback
} from 'react';

// import clsx from 'clsx';

// import { useMeasure } from 'react-use';

import { Theme } from '@mui/material/styles';
import { Box, BoxProps } from '@mui/material';
import { TooltipProps } from '@mui/material';

import {
  IStyle, IStyleCollection, ICell, ITextFrame, IFont
} from '@sheetxl/sdk';

import { GridSurfaceStyle } from '@sheetxl/grid-react';

import {
  useCommand, ICommand, useCallbackRef, ICommandHook, CommandButtonType, ICommands
} from '@sheetxl/utils-react';

import {
  StaticBorderRenderer, StaticBorderRendererProps,
  CommandContext
  // SheetCellRenderer
} from '@sheetxl/react';

import {
  CommandButton, ExhibitPopupPanelProps,
  ExhibitMenuHeader, ExhibitTooltip, ExhibitDivider, CommandPopupButton, CommandPopupButtonProps,
  ExhibitIconButton, ExhibitIconButtonProps, ContextMenu, defaultCreatePopupPanel
} from '@sheetxl/utils-mui';

export interface PresetCellStylesCommandButtonProps extends CommandPopupButtonProps {

  command: ICommand<IStyle.INamed, CommandContext.NamedStyle>;

  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

  selectedNamed?: IStyle.INamed;
  onSelectNamed?: (style: IStyle.INamed) => void;

  bodyStyle?: GridSurfaceStyle;

  usePreviewIcon?: boolean;
}

interface StaticCellRendererProps extends BoxProps {
  value: string;
  cellStyle: IStyle.Update;
  styles: IStyleCollection;
  createTemporaryCell(update: ICell.Update): ICell;
  bodyStyle: GridSurfaceStyle;
  borderProps?: StaticBorderRendererProps
  disabled?: boolean;
}

// TODO - make this a more generalized component. A StaticCellRender and have use this as an HOC
const StaticCellRenderer = memo(forwardRef<HTMLElement, StaticCellRendererProps>((props, forwardRef) => {
  const {
    value,
    cellStyle: propCellStyle,
    styles,
    createTemporaryCell,
    bodyStyle,
    sx: propSx,
    borderProps,
    disabled: propDisabled,
    ...rest
  } = props;

  // const [refMeasure, { width: measureWidth=0, height: measureHeight=0 }] = useMeasure<HTMLDivElement>();

  const cellTemplate = useMemo(() => {
    return createTemporaryCell({ value, style: propCellStyle });
  }, [value, propCellStyle, createTemporaryCell]);

  const style = useMemo(() => {
    return cellTemplate.getStyle();
  }, [cellTemplate, bodyStyle]);

  const fill = useMemo(() => {
    return style.getFill().toCSS(bodyStyle?.darkMode ?? false);
  }, [style]);

  const insets = style.getInsets();
  const font = style.getFont();

  const getBorderAt = useCallback(() => {
    return style.getBorder();
  }, [style]);

  return (
    <Box
      ref={forwardRef}
      // className={clsx({
      //     ['Mui-disabled']: propDisabled,
      //   }, "static-cell-renderer")
      // }
      sx={{
        width: '100px',
        height: '100%',
        textOverflow: 'ellipsis',
        display: 'flex',
        alignItems: 'stretch',
        background: bodyStyle?.fill,
        filter: propDisabled ? 'grayscale(0.4) opacity(0.8);' : 'none', // move this to StaticCellRenderer as a disabled prop
        '& .fill': {
          flex: '1 1 100%',
          overflow: 'hidden',
          ...fill
        },
        '& .text': {
          // lineHeight: `${editorPlacedFrame?.lines[0]?.bounds.height ?? 0}px`,
          // height: editorPlacedFrame?.bounds.height ?? 0,
          flex: '1 1 100%',
          ...font.toCSS(bodyStyle?.darkMode ?? false, 1),
          boxSizing: "border-box",
          padding: `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px`,
          margin: '0px',
          // borderWidth: 0,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'baseline', // doesn't work
          textDecoration: font.toCSS().textDecoration,
          textAlign: ITextFrame.toCSSHorizontalTextAlign(cellTemplate.getRenderHorizontalAlignment()),
          background: 'transparent', // We let the editorContainer paint the background
          maxHeight: '100%',
          whiteSpace: 'pre', // Never allow wrap in preview(cellStyle.alignment.overflow === 'wrap' ? 'normal' : 'pre'),
          wordWrap: 'break-word' // TODO - implement
        },
        ...propSx
      }}
      {...rest}
    >
      <StaticBorderRenderer
        getBorderAt={getBorderAt}
        darkMode={bodyStyle?.darkMode ?? false}
        rowCount={1}
        columnCount={1}
        style={{
          height: '100%',
          width: '100%',
          ...borderProps?.style
        }}
        {...borderProps}
      >
        {/* <SheetCellRenderer
          style={{
            width: measureWidth,
            height: measureHeight,
            overflow: 'hidden',
            position: 'absolute',
            paddingLeft: '4px',
            paddingRight: '4px',
            marginLeft: '-1px', // render render fills extend 1px in all directions
            marginTop: '-1px',
            marginRight: '-1px',
            marginBottom: '-1px',
          }}
          // theme={model.getStyle().getTheme()}
          value={cellTemplate}
          bodyStyle={bodyStyle}
          bounds={{
            x: 0,
            y: 0,
            width: measureWidth,
            height: measureHeight
          }}
        /> */}
        <Box
          className="fill"
          // ref={refMeasure}
          sx={{
            // opacity: 0,
            paddingLeft: '4px',
            paddingRight: '4px',
            marginLeft: '-1px', // render render fills extend 1px in all directions
            marginTop: '-1px',
            marginRight: '-2px', // to account for -1 left
            marginBottom: '-2px', // to account for -1 top
            // overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box className="text">
            {value}
          </Box>
        </Box>
      </StaticBorderRenderer>
    </Box>
  );
}));

interface PresetStyleIconButtonProps extends ExhibitIconButtonProps {
  hasContextMenu?: boolean;
  createTemporaryCell(update: ICell.Update): ICell | null;
  bodyStyle?: GridSurfaceStyle;
  styles: IStyleCollection;

  namedStyle: IStyle.INamed;
  selectedNamed?: IStyle.INamed;
  onSelectNamed?: (named: IStyle.INamed) => void;

  commands: ICommands.IGroup;
  commandHook: ICommandHook<any, any>;
}

const PresetStyleIconButton = memo((props: PresetStyleIconButtonProps) => {
  const {
    styles,
    namedStyle,
    selectedNamed,
    hasContextMenu = true,
    bodyStyle,
    onSelectNamed,
    createTemporaryCell,
    parentFloat,
    commands,
    disabled,
    commandHook,
    ...rest
  } = props;

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      commandHook: commandHook,
      context: 'cellStyle',
      // disabled: propDisabled
    }
    const menus = (<>
      <CommandButton
        {...commandButtonProps}
        style={{ // We want to indicate that this is the default action.
          fontWeight: 550
        }}
        command={commands.getCommand('formatCellStyle')}
        commandState={namedStyle}
        disabled={disabled}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('modifyCellStyle')}
        // TODO - we want to disable closing the parent menu.
        // Think through the best way to do this.
        // commandHook={{
        //   ...commandHook,
        //   onExecute: (command: ICommand): void => {
        //     console.log('modifyCellStyle', command);
        //   }
        // }}
        commandState={{ named: namedStyle }}
      />
      <CommandButton
        {...commandButtonProps}
        command={commands.getCommand('deleteCellStyle')}
        // TODO - we want to disable closing the parent menu.
        // Think through the best way to do this.
        // commandHook={{
        //   ...commandHook,
        //   onExecute: (command: ICommand): void => {
        //     console.log('deleteCellStyle', command);
        //   }
        // }}
        commandState={namedStyle}
        disabled={disabled || namedStyle?.getName() === IStyle.BuiltInName.Normal}
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
      tooltipProps={{
        label: namedStyle.getName(),
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
        value={namedStyle.getName()}
        cellStyle={{ named: namedStyle.getName() }}
        styles={styles}
        createTemporaryCell={createTemporaryCell}
        bodyStyle={bodyStyle}
      />
    </ExhibitIconButton>
  );

  if (hasContextMenu) {
    retValue = (
      <ContextMenu
        label={namedStyle.getName()}
        parentFloat={parentFloat}
        createPopupPanel={createPopupPanel}
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
    commands: propCommands,
    command,
    commandHook,
    selectedNamed: propSelectedNamed,
    onSelectNamed: propOnSelectNamed,
    disabled: propDisabled = false,
    bodyStyle: propBodyStyle,
    usePreviewIcon = true,
    ...rest
  } = props;

  const _ = useCommand(command);
  const context:CommandContext.NamedStyle = command?.context();
  const getStyles = context?.styles;
  const named = propSelectedNamed ?? context?.named();
  const bodyStyle = propBodyStyle ?? context?.bodyStyle();

  const handleOnSelectNamed = useCallbackRef((named: IStyle.INamed) => {
    propOnSelectNamed?.(named);
    command?.execute(named, commandHook);
  }, [command, propOnSelectNamed, commandHook]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const propsStyleButton = {
      onSelectNamed: handleOnSelectNamed,
      styles: getStyles(),
      parentFloat: props.floatReference,
    }

    const customStyles:IStyle.INamed[] = getStyles().getCustomNamed();
    // because customStyles also include customized built ins
    const customStylesMap:Map<string, IStyle.INamed> = new Map();
    const customUniqueNames:string[] = [];
    for (let i=0; i<customStyles.length; i++) {
      customStylesMap.set(customStyles[i].getName(), customStyles[i]);
      if (getStyles().getNamed(customStyles[i].getName()).getBuiltInID() === null) {
        customUniqueNames.push(customStyles[i].getName());
      }
    }

    const generateStyleButton = (styleName: string) => {
      let namedStyle:IStyle.INamed = customStylesMap.get(styleName);
      if (!namedStyle)
        namedStyle = getStyles().getNamed(styleName);
      if (!namedStyle || namedStyle.isHidden()) return null;

      return (
        <PresetStyleIconButton
          key={styleName}
          namedStyle={namedStyle}
          selectedNamed={named}
          bodyStyle={context.bodyStyle()}
          createTemporaryCell={context.createTemporaryCell}
          commands={propCommands}
          commandHook={commandHook}
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


    const generateStyleGroupCategory = (categoryName: string, styleGroups: React.ReactElement[]) => {
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
    presets.push(generateStyleCategory('Custom', customUniqueNames, false));
    presets.push(generateStyleCategory('Good, Bad and Neutral', [
      IStyle.BuiltInName.Normal,
      IStyle.BuiltInName.Bad,
      IStyle.BuiltInName.Good,
      IStyle.BuiltInName.Neutral
    ], customUniqueNames.length > 0));
    presets.push(generateStyleCategory('Data and Model', [
      IStyle.BuiltInName.Calculation,
      IStyle.BuiltInName.CheckCell,
      IStyle.BuiltInName.ExplanatoryText,
      IStyle.BuiltInName.FollowedHyperlink,
      IStyle.BuiltInName.Hyperlink,
      IStyle.BuiltInName.Input,
      IStyle.BuiltInName.LinkedCell,
      IStyle.BuiltInName.Note,
      IStyle.BuiltInName.Output,
      IStyle.BuiltInName.WarningText
    ]));
    presets.push(generateStyleCategory('Titles and Headings', [
      IStyle.BuiltInName.Heading1,
      IStyle.BuiltInName.Heading2,
      IStyle.BuiltInName.Heading3,
      IStyle.BuiltInName.Heading4,
      IStyle.BuiltInName.Title,
      IStyle.BuiltInName.Total
    ]));

    let stylesGroup = [];
    stylesGroup.push(generateStyleGroup('Accent 1', [
      IStyle.BuiltInName.Accent1_20,
      IStyle.BuiltInName.Accent1_40,
      IStyle.BuiltInName.Accent1_60,
      IStyle.BuiltInName.Accent1
    ]));
    stylesGroup.push(generateStyleGroup('Accent 2', [
      IStyle.BuiltInName.Accent2_20,
      IStyle.BuiltInName.Accent2_40,
      IStyle.BuiltInName.Accent2_60,
      IStyle.BuiltInName.Accent2
    ]));
    stylesGroup.push(generateStyleGroup('Accent 3', [
      IStyle.BuiltInName.Accent3_20,
      IStyle.BuiltInName.Accent3_40,
      IStyle.BuiltInName.Accent3_60,
      IStyle.BuiltInName.Accent3
    ]));
    stylesGroup.push(generateStyleGroup('Accent 4', [
      IStyle.BuiltInName.Accent4_20,
      IStyle.BuiltInName.Accent4_40,
      IStyle.BuiltInName.Accent4_60,
      IStyle.BuiltInName.Accent4
    ]));
    stylesGroup.push(generateStyleGroup('Accent 5', [
      IStyle.BuiltInName.Accent5_20,
      IStyle.BuiltInName.Accent5_40,
      IStyle.BuiltInName.Accent5_60,
      IStyle.BuiltInName.Accent5
    ]));
    stylesGroup.push(generateStyleGroup('Accent 6', [
      IStyle.BuiltInName.Accent6_20,
      IStyle.BuiltInName.Accent6_40,
      IStyle.BuiltInName.Accent6_60,
      IStyle.BuiltInName.Accent6
    ]));
    presets.push(generateStyleGroupCategory('Themed Cell Styles', stylesGroup));

    presets.push(generateStyleCategory('Number Format', [
      IStyle.BuiltInName.Comma,
      IStyle.BuiltInName.Comma0,
      IStyle.BuiltInName.Currency,
      IStyle.BuiltInName.Currency0,
      IStyle.BuiltInName.Percent
    ]));
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
          command={commands.getCommand('newCellStyle')}
          context={'styles'} // Note - not a single style
          commandHook={commandHook}
          disabled={propDisabled}
        />
      </Box>
    );
  }, [named, getStyles?.().getTheme(), bodyStyle]);

  const createBoundedCellTemplate = useCallbackRef((update: ICell.Update): ICell => {
    const maxFontSize = 18 / IFont.getDeviceScale();
    const cellTemplate:ICell = context?.createTemporaryCell(update);
    if (cellTemplate.getStyle().getFont().getSize() <= maxFontSize)
      return cellTemplate;
    return cellTemplate.createTemporaryCell({ style: { font: { size: maxFontSize } }});
  }, [context?.createTemporaryCell]);

  const isDisabled = propDisabled || !command || command.disabled();
  const icon = useMemo(() => {
    if (!context || !usePreviewIcon) {
      return command?.icon();
    }
    return (
      <StaticCellRenderer
        value={named?.getName() ?? 'Custom'}
        cellStyle={named ? { named: named.getName() } : undefined }
        styles={context.styles()}
        createTemporaryCell={createBoundedCellTemplate}
        bodyStyle={context.bodyStyle()}
        className={"outline-hover"}
        disabled={isDisabled}
        sx={{
          marginRight: '4px',
          borderRadius: '2px',
          minHeight: `calc(100% - 2px)`,
          overflow: 'hidden',
          outline:(theme: Theme) => `1px solid ${theme.palette.action.hover}`
        }}
        borderProps={{
          style: {
            height: 'calc(100% - 2px)',
            width: 'calc(100% - 1px)',
          }
        }}
      />
    );
  }, [named, bodyStyle, isDisabled, command]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      createPopupPanel={createPopupPanel}
      outlined={usePreviewIcon}
      commands={propCommands}
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
      selected={false}
      disabled={isDisabled}
      label={command?.label()}
      icon={icon}
      {...rest}
    />
  )
}));