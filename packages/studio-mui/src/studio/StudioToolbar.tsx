import type React from 'react';
import { useRef, memo, forwardRef } from 'react';

import { useMergeRefs } from 'react-merge-refs';

import { useMeasure } from '@sheetxl/utils-react';

import { type Theme } from '@mui/material';
import { Box } from '@mui/material';

import { type IWorkbookElement } from '@sheetxl/react';

import { defaultRenderToolbar, type WorkbookToolbarsProps } from '../toolbar';

import { DefaultLogo } from './DefaultLogo';

export interface StudioToolbarProps extends WorkbookToolbarsProps {
  /**
   * The active workbook — application chrome (e.g. the centered `DocumentTitle` built by the studio)
   * reads it; the toolbar strip itself no longer needs it.
   */
  workbook?: IWorkbookElement | null;
  /**
   * optional logo to display in the toolbar
   */
  logo?: React.ReactNode;

  mainElement?: React.ReactNode;

  /**
   * Slot rendered at the start of the toolbar (after the logo, before the title).
   *
   * @remarks
   * Application-level chrome the studio no longer hardcodes — e.g. a file menu. The studio example
   * injects a {@link StandaloneFileCommandButton} here.
   */
  startElement?: React.ReactNode;

  /**
   * Slot rendered at the end of the toolbar.
   *
   * @remarks
   * Application-level chrome — e.g. an appearance (light/dark) menu. The studio example injects an
   * {@link AppearanceCommandButton} here.
   */
  endElement?: React.ReactNode;
}

/**
 * Wrap the workbooks toolbar with application level items: a logo, a centered title (`mainElement`),
 * and injectable {@link StudioToolbarProps.startElement} / {@link StudioToolbarProps.endElement} slots.
 */
export const StudioToolbar = memo(
  forwardRef<any, StudioToolbarProps>((props, refForwarded) => {
  const {
    workbook,
    className: propClassName,
    logo = DefaultLogo,
    mainElement,
    startElement,
    endElement,
    ...rest
  } = props;

  const [refMeasureContainer, { width: widthContainer }] = useMeasure<HTMLDivElement>();
  const isCompact =  widthContainer < 530;

  const wrapperSelect = (children: React.ReactNode) => {
    return (
      <Box
        sx={{
          display: 'grid',
          // Symmetric side tracks keep `mainElement` centered relative to the ENTIRE toolbar
          // (not the leftover whitespace). Each side takes only the space its content needs; the
          // rest of its track is whitespace. If a side's content exceeds its `1fr` share the track
          // grows past it (fr tracks won't shrink below content), pushing the center off-center.
          gridTemplateColumns: '1fr auto 1fr',
          flex: '1',
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
            justifyContent: 'start',
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
            minWidth: 0,
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
            justifyContent: 'end'
          }}
        >
          {endElement}
        </Box>
      </Box>
    );
  }

  const refLocal = useRef<HTMLDivElement>(null);
  const refMerged = useMergeRefs([refLocal, refMeasureContainer, refForwarded]);

  return (
    <Box
      {...rest}
      ref={refMerged as any}
      className={propClassName}
    >
      {defaultRenderToolbar({
        isCompact,
        wrapperSelect,
        // propsToolbars: {
        //   'homeToolbar': {
        //     sx: {}
        //   }
        // }
      })}
    </Box>
  );
}));

StudioToolbar.displayName = 'StudioToolbar';