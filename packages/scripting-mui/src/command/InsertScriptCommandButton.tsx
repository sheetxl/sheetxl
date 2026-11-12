import type React from 'react';
import { memo, forwardRef, useEffect, useState, useCallback } from 'react';

import { alpha } from '@mui/system';
import { type Theme } from '@mui/material';
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import {
  KeyCodes, useCommands, CommandButtonType, DynamicIcon, useTranslator
} from '@sheetxl/utils-react';

import {
  CommandButton, ExhibitDivider, ExhibitMenuItem, CommandPopupButton,
  defaultRenderPopupPanel, type ExhibitPopupPanelProps, type CommandPopupButtonProps
} from '@sheetxl/utils-mui';

import { loadScriptTemplates, type ScriptTemplate, DEFAULT_SCRIPT_PATH } from '../utils';

const IconSx = { marginRight: '4px' };
const IconSize = '1em';

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
  const iconMeta = snippet.icon;
  if (iconMeta === 'formula') {
    icon = <DynamicIcon iconKey="ScriptFormula" size={IconSize} style={IconSx} />;
  } else if (iconMeta === 'macro') {
    icon = <DynamicIcon iconKey="ScriptMacro" size={IconSize} style={IconSx} />;
  } else {
    icon = <DynamicIcon iconKey='ScriptAutoRun' size={IconSize} style={IconSx} />;
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
      // propsTooltip={{ // causes flicker at the moment
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
          {snippet.title}
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
          {snippet.summary}
        </Typography>
      </Box>
    </ExhibitMenuItem>
  )
});


export interface InsertScriptCommandButtonProps extends CommandPopupButtonProps {
  /**
   * The script templates to read: a URL that serves `templates-scripting/contents.json`.
   * @defaultValue {@link DEFAULT_SCRIPT_PATH}
   */
  scriptPath?: string;
}

/**
 * Menu for Inserting new Scripts
 */
export const InsertScriptCommandButton: React.FC<InsertScriptCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, InsertScriptCommandButtonProps>((props: InsertScriptCommandButtonProps, refForwarded) => {
  const {
    groupKey,
    disabled: propDisabled,
    scriptPath=DEFAULT_SCRIPT_PATH,
    ...rest
  } = props;

  const t = useTranslator();

  const [snippets, setSnippets] = useState<ScriptTemplate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  // we use insertScript just to get the context.
  const [insertScript] = useCommands(['insertScript']);
  // Inserting a template edits the script, so it follows the command (read-only scripts disable it).
  const disabled = propDisabled || (insertScript?.disabled() ?? false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    // An offline app is expected to land here; the menu offers a retry rather than an error.
    loadScriptTemplates(scriptPath).then(
      (templates) => { if (!cancelled) { setSnippets(templates); setStatus('ready'); } },
      () => { if (!cancelled) { setSnippets([]); setStatus('error'); } }
    );
    return () => { cancelled = true; };
  }, [scriptPath, nonce]);

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    if (status === 'loading') {
      return <div>{t('insertScript.loading')}</div>;
    }

    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      groupKey: 'scriptsOptions',
      disabled
    }

    const handleInsert = (snippet: ScriptTemplate) => {
      insertScript?.execute(snippet.content);
      props.closeFloat?.();
    }

    const handleRetry = () => setNonce((n) => n + 1);

    const elementSnippet = [];
    if (status === 'error') {
      elementSnippet.push(
        <ExhibitMenuItem
          key="retry"
          onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
          onMouseUp={(e: React.MouseEvent) => { if (e.button !== 0) return; handleRetry() }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) handleRetry();
          }}
        >
          {t('insertScript.loadFailedRetry')}
        </ExhibitMenuItem>
      );
    }
    for (let i=0;i<snippets.length;i++) {
      const snippet:ScriptTemplate = snippets[i];
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
          key={`showKeyboardShortcuts`}
          commandKey={'showKeyboardShortcuts'}
        />
        <CommandButton
          {...commandButtonProps}
          key={`scriptingHelp`}
          commandKey={'scriptingHelp'}
        />
      </Box>
    );

    return defaultRenderPopupPanel({...props, children});
  }, [disabled, groupKey, status, snippets, insertScript, t]);

  return (
    <CommandPopupButton
      ref={refForwarded}
      disabled={disabled}
      groupKey={groupKey}
      label={insertScript?.getLabel(groupKey) ?? t('insertScript.fallbackLabel')}
      tooltip={insertScript?.getDescription()}
      renderPopupPanel={renderPopupPanel}
      icon={insertScript?.getIcon() ?? "ScriptInsert"}
      {...rest}
    />
  )
}));