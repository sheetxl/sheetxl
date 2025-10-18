import React, { useRef, memo, forwardRef, useMemo } from 'react';

import { mergeRefs } from 'react-merge-refs';

import { useMeasure } from 'react-use';

import { Theme } from '@mui/material/styles';

import { Box } from '@mui/material';

import { ICommand } from '@sheetxl/utils-react';

import { LogoNoPaddingIcon } from '@sheetxl/react';
import { ExhibitTooltip, useFloatStack } from '@sheetxl/utils-mui';

import { type WorkbookToolbarsProps, renderWorkbookToolbars } from '../toolbar';
import { AppearanceCommandButton } from '../command';

import { StandaloneFileCommandButton } from './StandaloneFileCommandButton';

export interface StudioToolbarProps extends WorkbookToolbarsProps {
  /**
   * optional logo to display in the toolbar
   */
  logo?: React.ReactNode;

  mainElement?: React.ReactNode;

  showFileMenu?: boolean;

  showAppearanceMenu?: boolean;
}

export const DEFAULT_LOGO = (
  <ExhibitTooltip
    label={"SheetXL"}
    description={"Visit me at sheetxl.com."}
  >
    <Box
      sx={{
        width:'24px',
        height: '24px',
        marginBottom: '4px',
        marginLeft: '6px'
      }}
    >
      <LogoNoPaddingIcon
        onClick={() => {
          window?.open('https://www.sheetxl.com', '_blank');
        }}
        style={{
          width:'24px',
          height: '24px',
          cursor: 'pointer'
        }}
      />
    </Box>
  </ExhibitTooltip>
);

/**
 * Wrap the workbooks toolbar with application level items. File Menu, Title, App settings menu, and App Logo
 */
export const StudioToolbar = memo(
  forwardRef<any, StudioToolbarProps>((props, refForwarded) => {
  const {
    commands,
    workbook,
    logo = DEFAULT_LOGO,
    mainElement,
    showFileMenu = true,
    showAppearanceMenu = true,
    ...rest
  } = props;

  const { reference } = useFloatStack();
  const [refMeasureContainer, { width: widthContainer }] = useMeasure<HTMLDivElement>();
  const isCompact =  widthContainer < 530;

  const startElement = (showFileMenu ?
    <StandaloneFileCommandButton
      commands={commands}
      commandHook={{
        beforeExecute(): void {
          reference?.closeAll();
        },
        onError(_command: ICommand<any, any>, _error: any, _args: any): void {
          // propCommandHook?.onError(command, error, args);
        }
      }}
    />
  : null);

  const endElement = (showAppearanceMenu ?
    <AppearanceCommandButton
      // outlined={outlined}
      commands={commands}
      commandHook={{
        beforeExecute(): void {
          reference?.closeAll();
        },
        onError(_command: ICommand<any, any>, _error: any, _args: any): void {
          // propCommandHook?.onError(command, error, args);
        }
      }}
    />
  : null);

  const wrapperSelect = (children: React.ReactNode) => {
    return (
      <Box
        sx={{
          display: 'flex',
          flex: '1',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: (theme: Theme) => theme.spacing(1),
          paddingLeft: (theme: Theme) => theme.spacing(1),
          paddingRight: (theme: Theme) => theme.spacing(1),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            flex: '1 1 100%',
            gap: (theme: Theme) => theme.spacing(0.5),
          }}
        >
          {logo}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: (theme: Theme) => theme.spacing(0.25),
            }}
          >
            {startElement}
            {children}
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flex: '1 1 300%',
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {mainElement}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'end',
            flex: (isCompact && !endElement) ? '0 0 auto' : '1 1 100%'
          }}
        >
          {endElement}
        </Box>
      </Box>
    );
  }

  const localPropsSelect = useMemo(() => {
    return {
      paddingLeft: (theme: Theme) => theme.spacing(1),
      paddingRight: (theme: Theme) => theme.spacing(1)
    }
  }, []);

  const refLocal = useRef<HTMLDivElement>(null);

  return (
    <Box
      ref={mergeRefs([refLocal, refMeasureContainer, refForwarded]) as any}
      {...rest}
    >
      {renderWorkbookToolbars({
        commands,
        isCompact,
        workbook,
        wrapperSelect,
        propsSelect: localPropsSelect,
        propsToolbars: {
          'Home': {
            sx: {}
          }
        }
      })}
    </Box>
  );
}));

StudioToolbar.displayName = "StudioToolbar";