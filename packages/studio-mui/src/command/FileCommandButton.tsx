import type React from 'react';
import { memo, forwardRef, useState, useEffect, useMemo } from 'react';

import { type Theme } from '@mui/material';

import { type IWorkbookIO } from '@sheetxl/sdk';

import {
  CommandButtonType, useCallbackRef, useCommandButtonEntry, useCommandButtonRegistry, useCommands
} from '@sheetxl/utils-react';

import { WorkbookIO, useWorkbook, useWorkbookFormat } from '@sheetxl/react';

import {
  CommandButton, CommandPopupButton, defaultRenderPopupPanel, renderMembers,
  ExhibitDivider, LabelIcon, type ExhibitPopupPanelProps, type CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface FileCommandButtonProps extends CommandPopupButtonProps { }

// TODO - revisit  with. https://wicg.github.io/file-system-access/. Only supported in some browsers (not safari, might be still ok with fallback)
export const FileCommandButton: React.FC<FileCommandButtonProps & { ref?: any }> = memo(
  forwardRef<any, FileCommandButtonProps>((props, _refForwarded) => {
  const {
    groupKey = "workbook",
    disabled: propDisabled,
    ...rest
  } = props;

  // Load write formats asynchronously
  const [writeFormats, setWriteFormats] = useState<IWorkbookIO.FormatType[]>([]);
  // assume to be unchanging
  const canWrite = WorkbookIO.canWrite();
  const canRead = WorkbookIO.canRead();

  useEffect(() => {
    let mounted = true;
    WorkbookIO.getWriteFormats().then(formats => {
      if (mounted) {
        setWriteFormats(formats);
      }
    });
    return () => { mounted = false; };
  }, []);

  // The format a Save As with NO argument lands on — what the lead menu entry has to name. It
  // follows the handle (`useWorkbookFormat`), so saving a `.sxl` as `.xlsx` re-labels the menu.
  const workbook = useWorkbook();
  const originFormat = useWorkbookFormat(workbook);
  const currentFormat = useMemo<IWorkbookIO.FormatType | null>(() => {
    if (writeFormats.length === 0) return null;
    // `Origin.getFormat()` is a resolved KEY ('SheetXL') — or, for a handle minted from a bare path,
    // the extension ('sxl'), since one is not derivable from the other without the registry. Both
    // are matched, key first.
    const hint = originFormat?.toLowerCase();
    const bound = hint
      ? (writeFormats.find((format) => format.key.toLowerCase() === hint)
        ?? writeFormats.find((format) => format.exts?.some((ext) => ext.toLowerCase() === hint)))
      : undefined;
    // Nothing bound (a new workbook), or bound to something nothing registered can WRITE (a
    // read-only format): mirror the fallback the io layer applies in exactly this case
    // (`DEFAULT_WRITE_EXT` in `WorkbookIO.write`) — the label would otherwise promise a format the
    // save does not deliver. A host may install a format set without ours (e.g. a csv-only embed),
    // hence the last two.
    return bound
      ?? writeFormats.find((format) => format.exts?.some((ext) => ext.toLowerCase() === 'sxl'))
      ?? writeFormats.find((format) => !format.advanced)
      ?? writeFormats[0];
  }, [writeFormats, originFormat]);

  // Chrome for the lead entry is BORROWED from the current format's own command rather than
  // authored here: that label is already localized ('as Excel Workbook') and already carries the
  // per-format icon, so there is no second string to translate and no way for the two entries to
  // disagree. A host that registered no per-format commands simply keeps the generic 'as…'.
  const [currentFormatCommand] = useCommands(currentFormat ? `saveWorkbookAs${currentFormat.key}` : []);

  // New is a registered panel (`newWorkbookOptions`), so a plugin can add its own ways to start a
  // workbook; with nothing added it stays a plain button.
  const registry = useCommandButtonRegistry();
  const newMembers = registry.resolveMembers('newWorkbookOptions') ?? ['newWorkbook'];

  const renderPopupPanel = useCallbackRef((props: ExhibitPopupPanelProps) => {
    const commandButtonProps = {
      variant: CommandButtonType.Menuitem,
      // parentFloat now flows via FloatStackProvider (the popup content is wrapped by useFloatStack).
      groupKey,
      disabled: propDisabled
    }
    const children = (<>
      {newMembers.length > 1 ?
        <CommandPopupButton
          {...commandButtonProps}
          quickCommand={'newWorkbook'}
          renderPopupPanel={(propsNew: ExhibitPopupPanelProps) => {
            const newItems = renderMembers(newMembers, {
              variant: CommandButtonType.Menuitem,
              dividerOrientation: 'horizontal',
              groupKey: 'newWorkbookOptions',
              registry,
              propsCommandButton: { disabled: propDisabled },
              propsCommandPopup: { disabled: propDisabled }
            });
            return defaultRenderPopupPanel({...propsNew, children: newItems, onClick: () => {
              propsNew.closeFloatAll?.();
            }});
          }}
        />
      : <CommandButton
          {...commandButtonProps}
          commandKey={'newWorkbook'}
        />
      }
      <ExhibitDivider orientation="horizontal"/>
      {canRead ?
        <CommandPopupButton
          {...commandButtonProps}
          quickCommand={'openWorkbook'}
          renderPopupPanel={(propsOpen: ExhibitPopupPanelProps) => {
            const commandButtonPropsOpen = {
              ...commandButtonProps,
              // parentFloat flows via FloatStackProvider (nested popup content is wrapped too).
              groupKey: 'openWorkbookOptions'
            };
            // Open from device / from web — modeled on `insertData`, but these REPLACE the workbook
            // (no `mutator` tag), so they stay enabled on a protected sheet.
            const openItems = [
              <CommandButton
                {...commandButtonPropsOpen}
                key="device"
                commandKey={'openWorkbook'}
              />,
              <CommandButton
                {...commandButtonPropsOpen}
                key="web"
                commandKey={'openWorkbookFromUrl'}
              />
            ];
            return defaultRenderPopupPanel({...propsOpen, children: openItems, onClick: () => {
              propsOpen.closeFloatAll?.();
            }});
          }}
        /> : null
      }
      { canWrite && writeFormats.length > 0 ?
        <CommandPopupButton
          {...commandButtonProps}
          quickCommand={'saveWorkbook'}
          renderPopupPanel={(propsSaveAs: ExhibitPopupPanelProps) => {
            const commandButtonPropsSaveAs = {
              ...commandButtonProps,
              // parentFloat flows via FloatStackProvider (nested popup content is wrapped too).
              groupKey: 'saveWorkbookOptions'
            };

            // The generic Save As leads: no format argument, so the picker opens on the workbook's
            // CURRENT format with every other one still listed — which is exactly why it is labelled
            // with that format instead of a bare 'as…'. It stays the GENERIC command (not the
            // current format's own, which would do the same thing) so the entry keeps Ctrl+Shift+S
            // on its tooltip; the per-format entries below are the same command with the format
            // supplied.
            const saveAsItems: React.JSX.Element[] = [
              <CommandButton
                {...commandButtonPropsSaveAs}
                key="saveWorkbookAs"
                commandKey={'saveWorkbookAs'}
                label={currentFormatCommand?.getLabel('saveWorkbookOptions')}
                icon={currentFormatCommand?.getIcon('saveWorkbookOptions')}
              />
            ];
            // Everything the lead entry is NOT: its own format is already stated above, and an
            // `advanced` format is demoted to the picker's "save as type" dropdown on purpose.
            const otherFormats = writeFormats.filter((formatType: IWorkbookIO.FormatType) => {
              return !formatType.advanced && formatType.key !== currentFormat?.key;
            });
            // No divider when there is nothing under it (a lone registered format).
            if (otherFormats.length > 0) {
              saveAsItems.push(<ExhibitDivider key="divider" orientation="horizontal"/>);
            }
            otherFormats.forEach((formatType: IWorkbookIO.FormatType) => {
              const formatKey = formatType.key;
              const commandKey = `saveWorkbookAs${formatKey}`;
              saveAsItems.push(
                <CommandButton
                  {...commandButtonPropsSaveAs}
                  key={formatKey}
                  commandKey={commandKey}
                />
              );
            });
            return defaultRenderPopupPanel({...propsSaveAs, children: saveAsItems, onClick: () => {
              propsSaveAs.closeFloatAll?.();
            }});
          }}
        /> : null
      }
    </>);
    return defaultRenderPopupPanel({...props, children, onClick: (e) => {
      if (e.isDefaultPrevented())
        return;
      props.closeFloatAll?.();
    }});
  }, [propDisabled, groupKey, writeFormats, currentFormat, currentFormatCommand, newMembers, registry]);

  // Chrome from this component's registered entry (StudioCommandGroups 'fileOptions'), where it
  // resolves through the language service; literals are the not-registered fallback. (A host could
  // use different labels depending on context — e.g. 'Import' or 'Workbook' when embedded.)
  const entry = useCommandButtonEntry('fileOptions');
  const menuLabel = entry?.getLabel?.() ?? 'File';
  const menuTooltip = entry?.getDescription?.() ?? 'Options for saving and loading the workbook.';
  return (
    <CommandPopupButton
      disabled={propDisabled}
      groupKey={groupKey}
      label={menuLabel} // tooltip
      tooltip={menuTooltip}
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
      renderPopupPanel={renderPopupPanel}
      icon={<LabelIcon
        className='label'
        icon={null}
        label={menuLabel}
      />}
    />
  )

}));

FileCommandButton.displayName = "FileCommandButton";