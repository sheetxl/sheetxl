import type React from 'react';
import { useState, useMemo, memo, forwardRef } from 'react';

import { type Theme } from '@mui/material';
import { Box, type BoxProps } from '@mui/material';
import { Toolbar, type ToolbarProps } from '@mui/material';
import { Typography } from '@mui/material';

import {
  useCommands, KeyCodes, useImperativeElement, DynamicIcon, useFloatStack, FloatStackProvider,
  CommandFocusProvider, useCallbackRef, useCommandButtonRegistry,
  type CommandButtonOptions, type FloatReference,
  type CommandButtonEntry, type ICommandButtonRegistry
} from '@sheetxl/utils-react';

import { OverflowPalette } from '../button';

import { renderMembers } from './CommandGroup';

export interface CommandToolbarPopupButtonProps extends CommandButtonOptions {
}

export interface CommandToolbarButtonProps {
  propsCommandButton: CommandButtonOptions;

  propsCommandPopup: CommandToolbarPopupButtonProps;
}

export interface CommandToolbarProps extends ToolbarProps {

  propsCommandButton?: CommandButtonOptions;

  parentFloat?: FloatReference;

  /**
   * Key of a {@link CommandButtonEntry} registered in the {@link ICommandButtonRegistry}. The
   * toolbar becomes a **surface** over that panel: its `members` render (via `renderMembers`) inside
   * an {@link OverflowPalette}. Provide `groupKey` (registered), `members` (inline), or
   * `renderToolbarPalette` (fully custom) - `renderToolbarPalette` wins when supplied.
   */
  groupKey?: string;

  /**
   * An inline, anonymous member list - the un-registered alternative to `groupKey`.
   */
  members?: (string | '-' | null | CommandButtonEntry)[];

  /**
   * Registry to resolve `groupKey` from.
   *
   * @defaultValue the registry from {@link useCommandButtonRegistry} (context or shared singleton).
   */
  registry?: ICommandButtonRegistry;

  /**
   * Fully custom palette renderer (the escape hatch / back-compat). When provided it takes precedence
   * over `groupKey` / `members`.
   */
  renderToolbarPalette?: (props: CommandToolbarButtonProps) => React.ReactNode;

  ref?: React.Ref<HTMLDivElement>;
}

export interface CommandToolbarAttributes {
}

export interface ICommandToolbarElement extends HTMLDivElement, CommandToolbarAttributes {};

export interface LabelIconProps extends BoxProps {
  /** The panel/group this renders in — selects `groupLabels` variants (see `CommandButtonOptions.groupKey`). */
  groupKey?: string;
  commandKey?: string;
  label?: React.ReactElement<any> | string;
  /** `undefined` = default it (command icon, else the check glyph); `null` = exclude it (no icon). */
  icon?: React.ReactElement<any> | null;
}

const DefaultIcon = <DynamicIcon iconKey="Check"/>;
export const LabelIcon = (props: LabelIconProps) => {
  const {
    commandKey,
    label: propLabel,
    groupKey,
    icon: propIcon,
    sx: sxProps,
    ...rest
  } = props;

  const [command] = useCommands(commandKey ?? []);

  const icon = useMemo(() => {
    if (propIcon !== undefined) {
      return propIcon;//typeof propIcon === "function" ? propIcon(command) : propIcon ;
    }
    // If we are a menu and not selected we don't want the default checkmark icon
    let commandIcon = command?.getIcon(groupKey);
    if (commandIcon) {
      if (typeof commandIcon === "string") {
        commandIcon = <DynamicIcon iconKey={commandIcon}/>;
      }
      return commandIcon;
    }
    return DefaultIcon;
  }, [propIcon, groupKey, command]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        textTransform: 'none',
        alignItems: 'center',
        fontSize: (theme: Theme) => theme.typography.subtitle2.fontSize,
        // '& span': {
        //   lineHeight: '1',
        //   fontSize: (theme: Theme) => theme.typography.subtitle2.fontSize,
        //   // paddingTop: '3px', // to align with checkIcon a bit better
        //   paddingLeft: '2px',
        //   paddingRight: '2px',
        // },
        // color: (theme: Theme) => theme.palette.text.secondary,
        ...sxProps
      }}
      {...rest}
    >
      {icon}
      <Typography
        component="div"
        sx={{
          whiteSpace: 'nowrap',
          lineHeight: '1',
          paddingLeft: (theme: Theme) => theme.spacing(.25),
          paddingRight: (theme: Theme) => theme.spacing(.25),
          fontSize: 'inherit'
        }}
      >
        {propLabel ?? command?.getLabel(groupKey)}
      </Typography>
    </Box>
  );
}

export const CommandToolbar = memo(forwardRef<ICommandToolbarElement, CommandToolbarProps>(
  (props: CommandToolbarProps, refForwarded) => {
  const {
    sx: sxProps,
    propsCommandButton: propsCommandButtonProps,
    parentFloat,
    groupKey,
    members: propMembers,
    registry: propRegistry,
    renderToolbarPalette,//: propCreateToolbarPalette,
    children,
    ...rest
  } = props;

  // TODO - if children error and say use renderToolbarPalette

  const contextRegistry = useCommandButtonRegistry();
  const registry = propRegistry ?? contextRegistry;
  // Members of the toolbar surface: inline `members`, else the group resolved (explicit members
  // woven with any injected items).
  // `registry.getVersion()` is a dep so a **dynamically** contributed member (a feature adding into this
  // panel at runtime) re-resolves — the registry identity is stable, so without the version this memo
  // would stay pinned to the init-time membership.
  const members = useMemo(
    () => propMembers ?? (groupKey ? registry.resolveMembers(groupKey) : null) ?? null,
    [propMembers, groupKey, registry, registry.getVersion()]
  );

  // const renderToolbarPalette = useCallbackRef(propCreateToolbarPalette, [propCreateToolbarPalette]);
  const refLocal = useImperativeElement<ICommandToolbarElement, CommandToolbarAttributes>(refForwarded, () => ({
  }), []);

  const [relatedFocus, setRelatedFocus] = useState<HTMLElement | null>(null);

  // const refToolbarCommands = useRef<HTMLDivElement>();
  // We add this to the float stack so that closing popups don't try to restore focus to the toolbar
  const {
    reference: floatReferenceToolbar,
  } = useFloatStack({
    label: 'toolbar',
    anchor: refLocal.current,
    parentFloat,
    renderPopupPanel: null // no popup; the toolbar only takes part in the stack
  });

  // Published to descendant buttons via `CommandFocusProvider`; `useCommands` calls it after a command
  // executes. `useCallbackRef` keeps a stable identity while always reading the latest `relatedFocus`
  // (a `useCallback([])` would capture the first render's null). No-ops unless focus is still inside the
  // toolbar, so a remote dispatch (a keystroke from the grid) never yanks focus back here.
  const focusRelated = useCallbackRef(() => {
    const closureRelatedFocus = relatedFocus;
    if (closureRelatedFocus) {
      requestAnimationFrame(() => {
        if (refLocal.current?.contains(document.activeElement))
          closureRelatedFocus.focus();
      });
    }
  }, [relatedFocus]);

  const localPropsButton = useMemo(() => {
    return {
      dense: true,
      outlined: false,
      // disabled: true
    }
  }, []);

  // Neither dismiss-on-execute nor focus-restore is threaded per-button anymore — both are container
  // behaviors discovered from context by `useCommands`: the enclosing float owns close-on-execute
  // (`useFloat`), and the `CommandFocusProvider` below owns focus-restore. Context reaches nested popups
  // through the portal, which prop-threading missed (the insert-chart symptom).
  const localPropsCommandButton:CommandButtonOptions = useMemo(() => {
    return {
      ...(propsCommandButtonProps || {})
    }
  }, [propsCommandButtonProps]);

  const commandButtonProps = useMemo(() => {
    return {
      ...localPropsButton,
      ...localPropsCommandButton
    }
  }, [localPropsButton, localPropsCommandButton]);

  const localPropsCommandPopup = useMemo(() => {
    // parentFloat now flows to the buttons via the FloatStackProvider below
    // (value=floatReferenceToolbar), so no explicit injection is needed.
    return {
      ...localPropsCommandButton
    }
  }, [commandButtonProps, propsCommandButtonProps]);

  let columnGap = 0;
  if (!localPropsButton.dense)
    columnGap = columnGap + 2;
  if (localPropsButton.outlined)
    columnGap++;

  let verticalPadding = 2;
  if (!localPropsButton.dense)
    verticalPadding = 4;

  const palette = useMemo(() => {
    const paletteProps: CommandToolbarButtonProps = {
      propsCommandButton: commandButtonProps,
      propsCommandPopup: {
        ...localPropsCommandPopup,
        ...propsCommandButtonProps
      }
    };
    // Custom palette wins (escape hatch / back-compat).
    if (renderToolbarPalette) return renderToolbarPalette(paletteProps);
    // Default: the toolbar IS a surface over a group - walk its members inside an OverflowPalette.
    if (!members) {
      if (__DEV__ && groupKey) console.warn(`Command group '${groupKey}' is not registered.`);
      return null;
    }
    return (
      <OverflowPalette>
        {renderMembers(members, {
          dividerOrientation: 'vertical',
          groupKey,
          propsCommandButton: paletteProps.propsCommandButton,
          propsCommandPopup: paletteProps.propsCommandPopup,
          registry
        })}
      </OverflowPalette>
    );
  }, [commandButtonProps, localPropsCommandPopup, propsCommandButtonProps, renderToolbarPalette, members, groupKey, registry]);

  return (
    <Toolbar
      variant="dense"
      sx={{
        minHeight: 'unset',//42px',
        height: 'unset',
        paddingTop: `${verticalPadding}px`,
        paddingBottom: `${verticalPadding}px`,
        paddingLeft: '6px !important',
        paddingRight: '6px !important',
        flex: '1 1 0%',
        alignItems: 'center',
        userSelect: 'none',
        flexGrow: 1,
        display: 'flex',
        overflow: 'hidden',
        ...sxProps
      }}
      ref={refLocal}
      onFocus={(e: React.FocusEvent<HTMLElement>) => {
        if (e.relatedTarget && !relatedFocus) {
          // console.log('onfocus', e.relatedTarget);
          setRelatedFocus(e.relatedTarget as HTMLElement);
        }
      }}
      onBlur={(e: React.FocusEvent<Element>) => {
        if (relatedFocus && !((refLocal?.current?.contains(e.relatedTarget)))) {
          // console.log('onblur', e.relatedTarget);
          setRelatedFocus(null);
        }
      }}
      onKeyDown={(e: React.KeyboardEvent<any>) => {
        if (relatedFocus && e.which === KeyCodes.Escape) {
          // console.log('workbook escape', relatedFocus);
          // console.log('toolbar on key restore focus');
          relatedFocus.focus();
        }
      }}
      {...rest}
    >
      <div
        ref={refLocal}
        style={{
          flex: '1 1 100%',
          display: 'flex',
          flexWrap: 'wrap',
          rowGap: `${verticalPadding}px`,
          columnGap: `${columnGap}px`,
          alignItems: 'center',
          maxWidth: `100%`
        }}
      >
        <FloatStackProvider value={floatReferenceToolbar}>
          <CommandFocusProvider value={focusRelated}>
            {palette}
          </CommandFocusProvider>
        </FloatStackProvider>
      </div>
    </Toolbar>
  );
}));

CommandToolbar.displayName = "CommandToolbar";
