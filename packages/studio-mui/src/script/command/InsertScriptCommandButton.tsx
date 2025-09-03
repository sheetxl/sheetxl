import React, { memo, forwardRef, useEffect, useState, useCallback } from 'react';

import { alpha } from '@mui/system';
import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { WebhookOutlined } from '@mui/icons-material';

import { ScriptFormulaIcon, ScriptMacroIcon } from '@sheetxl/utils-mui';

import {
  KeyCodes, useCommands, CommandButtonType, ICommands
} from '@sheetxl/utils-react';

import {
  CommandButton, ExhibitDivider, ExhibitMenuItem, CommandPopupButton, CommandPopupButtonProps,
  defaultCreatePopupPanel, ExhibitPopupPanelProps, themeIcon
} from '@sheetxl/utils-mui';

import { ScriptNewIcon, DocumentationIcon } from '@sheetxl/utils-mui';

import { fetchDirectory, type DirectoryFile, DEFAULT_SCRIPT_PATH } from '../utils';

const IconSx = { fontSize: '0.8rem', marginRight: '4px' };

const InsertSnippetMenuItem = memo((props: any) => { // TODO - type
  const {
    disabled,
    snippet,
    description,
    handleInsert,
    sx: propSx,
    ...rest
  } = props;
  let icon: React.ReactNode;
  if (snippet.metadata?.icon === 'formula') {
    icon = <ScriptFormulaIcon sx={IconSx} />;
  } else if (snippet.metadata?.icon === 'macro') {
    icon = <ScriptMacroIcon sx={IconSx} />;
  } else {
    icon = <WebhookOutlined sx={IconSx} />;
  }
  return (
    <ExhibitMenuItem
      sx={{
        maxWidth: '460px', // TODO - or the max width of the device
        display: 'flex',
        '*': {
          lineHeight: '1.2'
        },
        ...propSx
      }}
      disabled={disabled}
      // selected={selected}
      // tooltipProps={{ // causes flicker at the moment
      //   description: (<><div>Some descriptive info will go here</div></>),
      //   maxWidth: 1000
      // }}
      icon={icon}
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
      onMouseUp={(e) => { if (e.button !== 0) return; handleInsert(snippet) }}
      onKeyDown={(e: React.KeyboardEvent) => {
        // button prevents space so we don't check it
        // if (e.isDefaultPrevented()) return;
        if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
          handleInsert(snippet);
        }
      }}
      {...rest}
    >
      <Box
        sx={{
        // bold and larger
          display: 'flex',
          flex: '1 1 100%',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Typography
          component="div"
        >
          {snippet.metadata?.title ?? snippet.path}
        </Typography>
        <Typography
          variant="caption"
          component="div"
          sx={{
            // whiteSpace: 'pre-wrap', {/* uncomment if we want to preserve height */}
            color: (theme: Theme) => alpha(theme.palette.text.secondary ?? theme.palette.text.primary, .6),
            // paddingTop: formattedValue && formattedValue.length > 0 ? '1px' : undefined,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {snippet.metadata?.summary}
        </Typography>
      </Box>
    </ExhibitMenuItem>
  )
});


export interface InsertScriptCommandButtonProps extends CommandPopupButtonProps {
  /**
   * Path to fetch directory scripts from.
   */
  scriptPath?: string;
}

/**
 * Menu for Inserting new Scripts
 */
export const InsertScriptCommandButton: React.FC<InsertScriptCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, InsertScriptCommandButtonProps>((props: InsertScriptCommandButtonProps, refForwarded) => {
  const {
    commands: propsCommands,
    commandHook: propCommandHook,
    scope,
    disabled: propDisabled = false,
    scriptPath=DEFAULT_SCRIPT_PATH,
    ...rest
  } = props;

  const [snippets, setSnippets] = useState<DirectoryFile[]>([]);
  const [loading, setLoading] = useState(true);

  // we use executeScript just to get the context.
  const resolvedCommands = useCommands(propsCommands, ['executeSelectedScript']);
  const contextScript:any = resolvedCommands[0]?.context?.();

  useEffect(() => {
    const loadSnippets = async () => {
      try {
        const loadedSnippets = await fetchDirectory(scriptPath);
        setSnippets(loadedSnippets);
      } catch (error: any) {
        // console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadSnippets();
  }, [scriptPath]);

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, _commands: ICommands.IGroup) => {
    if (loading) {
      return <div>Loading...</div>;
    }

    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat: props.floatReference,
      commandHook: propCommandHook,
      scope: 'scripts',
      disabled: propDisabled
    }

    const handleInsert = (snippet: DirectoryFile) => {
      // console.log('handleSnippet');
      contextScript.getEditor()?.insertSnippet(snippet.content);
      props.closeFloat();
    }

    const elementSnippet = [];
    for (let i=0;i<snippets.length;i++) {
      const snippet:DirectoryFile = snippets[i];
      if (!snippet) continue;
      elementSnippet.push(
        <InsertSnippetMenuItem
          key={snippet.path}
          handleInsert={handleInsert}
          snippet={snippet}
        />
      )
    }

    const children = (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 100%',
          overflow: 'hidden'
        }}
      >
        {elementSnippet.length > 0 ? (<>
          <Box
            sx={{
              overflow: 'auto',
              flex: "1 1 100%"
            }}>
            {elementSnippet}
          </Box>
          <ExhibitDivider orientation="horizontal"/>
        </>): null }
        <CommandButton
          {...commandButtonProps}
          key={`help`}
          command={propsCommands.getCommand('help')}
          icon={themeIcon(<DocumentationIcon/>)}
        />
      </Box>
    );

    return defaultCreatePopupPanel({...props, children});
  }, [propDisabled, propCommandHook, scope, loading, contextScript]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      commands={propsCommands}
      disabled={propDisabled}
      commandHook={propCommandHook}
      scope={scope}
      label="Insert Script"
      tooltip="Inserts a script from a set of templates."
      createPopupPanel={createPopupPanel}
      icon={themeIcon(<ScriptNewIcon/>)}
      {...rest}
    />
  )
}));

export default InsertScriptCommandButton;