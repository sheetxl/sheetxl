import React, { memo, forwardRef, useState, useEffect } from 'react';

import { Theme } from '@mui/material/styles';

import { CommandButtonType, useCallbackRef } from '@sheetxl/utils-react';

import {
  CommandButton, CommandPopupButton, CommandPopupButtonProps, defaultCreatePopupPanel,
  ExhibitDivider, ExhibitPopupPanelProps, LabelIcon
} from '@sheetxl/utils-mui';

import { WorkbookIO, WriteFormatType } from '../io';

export interface StandaloneFileCommandButtonProps extends CommandPopupButtonProps { }

// TODO - revisit  with. https://wicg.github.io/file-system-access/. Only supported in some browsers (not safari, might be still ok with fallback)
const StandaloneFileCommandButton: React.FC<StandaloneFileCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, StandaloneFileCommandButtonProps>((props, _refForwarded) => {
  const {
    commands,
    commandHook: propCommandHook,
    scope = "workbook",
    disabled: propDisabled = false,
    ...rest
  } = props;

  // Load write formats asynchronously
  const [writeFormats, setWriteFormats] = useState<WriteFormatType[]>([]);

  useEffect(() => {
    let mounted = true;
    WorkbookIO.getWriteFormats().then(formats => {
      if (mounted) {
        setWriteFormats(formats);
      }
    });
    return () => { mounted = false; };
  }, []);

  const createPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope,
      disabled: propDisabled
    }
    const children = (<>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('newWorkbook'))}
      />
      <ExhibitDivider orientation="horizontal"/>
      <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('openWorkbook'))}
      />
      {/* TODO - create an OpenWorkbookCommandButton to support nesting like insertImageFromUrl }
      {/* <CommandButton
        {...commandButtonProps}
        command={(commands.getCommand('openWorkbookFromUrl'))}
      /> */}
      <CommandPopupButton
        {...commandButtonProps}
        commands={commands}
        quickCommand={'saveWorkbook'}
        createPopupPanel={(propsSaveAs: ExhibitPopupPanelProps) => {
          const commandButtonPropsSaveAs = {
            ...commandButtonProps,
            parentFloat: propsSaveAs.floatReference,
            scope: 'saveWorkbook'
          };

          const saveAsItems = [];
          writeFormats.forEach((formatType: WriteFormatType) => {
            if (formatType.isDefault) return;
            const formatKey = formatType.key;
            const command = commands.getCommand(`saveWorkbookAs${formatKey}`);
            if (!command) {
              console.warn(`Unable to resolve command: 'saveWorkbookAs${formatKey}'`);
              return;
            }
            saveAsItems.push(
              <CommandButton
                {...commandButtonPropsSaveAs}
                key={formatKey}
                command={command}
              />
            );
          });
          return defaultCreatePopupPanel({...propsSaveAs, children: saveAsItems, onClick: () => {
            propsSaveAs.closeFloatAll();
          }});
        }}
      />
    </>);
    return defaultCreatePopupPanel({...props, children, onClick: (e) => {
      if (e.isDefaultPrevented)
        return;
      props.closeFloatAll();
    }});
  }, [propDisabled, commands, propCommandHook, scope, writeFormats]);

  const menuLabel = 'File'; // use different labels depending on context, For example in an embedded component 'Import' or 'Workbook' might make more sense.
  return (
    <CommandPopupButton
      commands={commands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      scope={scope}
      label={menuLabel} // tooltip
      tooltip="Options for saving and loading the workbook."
      sx={{
        paddingBottom: '0px',
        '& button': {
          // display: 'flex',
          paddingTop: '0px',
          paddingBottom: '0px',
          height: (theme: Theme) => `calc(1.25rem + ${theme.spacing(2)}px)` // the derived size of tabs (fontsize 1rem * lineHeight 1.25 + padding)
        }
      }}
      {...rest}
      createPopupPanel={createPopupPanel}
      icon={<LabelIcon
        className='label'
        icon={null}
        label={menuLabel}
      />}
    />
  )

}));

StandaloneFileCommandButton.displayName = "StandaloneFileCommandButton";
export { StandaloneFileCommandButton };