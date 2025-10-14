import React, { useMemo, useState, memo, forwardRef } from 'react';

import clsx from 'clsx';

import { Theme } from '@mui/material/styles';
import { SxProps, alpha } from '@mui/system';

import { Box } from '@mui/material';

import { IWorkbook, ISheet, IWorkbookProtection } from '@sheetxl/sdk';

import { GridStyle } from '@sheetxl/grid-react';

import { DynamicIcon } from '@sheetxl/utils-react';

import { ExhibitMenuItem, SelectedIcon, FloatReference } from '@sheetxl/utils-mui';

import { useModelListener } from '@sheetxl/react';

export interface SheetsAllMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The workbook
   */
  workbook: IWorkbook;

  gridStyle?: GridStyle;
  /**
   * MUI SX props {@link https://mui.com/system/getting-started/the-sx-prop/}
   */
  sx?: SxProps<Theme>;

  floatReference: FloatReference;
  closeFloatAll: () => void;
}

/**
 * Menu showing all sheets in the workbook.
 */
export const SheetsAllMenu = memo(forwardRef<HTMLDivElement, SheetsAllMenuProps>(
  (props: SheetsAllMenuProps, refForwarded) => {
  const {
    workbook,
    gridStyle,
    floatReference,
    closeFloatAll,
    className: propClassName,
    ...rest
  } = props;

  const [sheetsVisible, setSheets] = useState<ISheet[]>(workbook?.getSheets().getItems());
  const [protectionWorkbook, setProtection] = useState<IWorkbookProtection>(workbook?.getProtection());
  useModelListener<IWorkbook, IWorkbook.IListeners>(workbook, {
    onSheetsChange: (source: IWorkbook) => {
      setSheets(source.getSheets().getItems());
    },
    onProtectionChange: (source: IWorkbook) => {
      setProtection(source?.getProtection());
    },
  });

  const items = useMemo(() => {
    const sheetMenus = [];

    const sheetsVisibleAndHidden = workbook.getSheets().getItems({visibility : ISheet.Visibility.Hidden });
    const activeSheet = workbook.getSelectedSheet();

    for (let i=0; i<sheetsVisibleAndHidden.length; i++) {
      const sheet = sheetsVisibleAndHidden[i];

      const visibility = sheet.getVisibility();
      if (visibility === ISheet.Visibility.VeryHidden)
        continue;
      const isSelected = activeSheet === sheet;
      const protectionSheet = sheet.getProtection().isLocked();
      const tabColor = sheet.getTabColor();

      const propBackground = gridStyle?.body.fill ?? 'transparent';
      let coloredBackground = null;
      let contrastTextColor = null;
      let background = propBackground;
      if (tabColor) {
        background = tabColor.toCSS();
        if (!isSelected) {
          contrastTextColor = tabColor.toBlackOrWhite().toCSS();
        }
        coloredBackground = (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              top: '4px',
              left: '40px', // TODO - this is hardcoded for the moment.
              right: '8px',
              bottom: '4px',
              background: isSelected ? background : 'transparent',
              borderRadius: '4px',
              border: `solid 1px ${gridStyle.header.edgeStrokeFill}`
            }}
          >
            <Box
              sx={{
                flex: '1 1 100%',
                boxSizing: 'content-box',
                opacity: (isSelected || visibility === ISheet.Visibility.Hidden ? '50%': '100%'),
                border: (theme: Theme) => isSelected ? `${propBackground} solid 1.5px` : `${theme.palette.divider} solid 1px`,
                background: (isSelected && tabColor) ? `linear-gradient(0deg, ${background} 0%, ${propBackground})`: background,
                borderRadius: '4px'
              }}
            />
          </Box>
        );
      }

      let iconStatus = null;
      if (protectionSheet) {
        iconStatus = <DynamicIcon iconKey="Lock"/>;
      }
      if (visibility !== ISheet.Visibility.Visible) { // overrides protection icon on purpose
        iconStatus = <DynamicIcon iconKey="VisibilityOff" style={{ opacity: !protectionWorkbook.isStructureAllowed() ? 0.7 : 1 }} color="secondary"/>;
      }
      if (iconStatus) {
        iconStatus = (
          <Box sx={{
            display: 'flex',
            flex: '1 1 100%',
            alignItems: 'center',
            ml:'16px',
            '& *': {
              lineHeight: '1em',
              fontSize: '1.3em'
            }
          }}>
            {/* <Box sx={{flex: '1 1 100%'}}/> */}
            {iconStatus}
        </Box>
        )
      }
      sheetMenus.push(
        <ExhibitMenuItem
          key={'' + i}//sheetRef.get}
          disabled={!protectionWorkbook.isStructureAllowed() && visibility === ISheet.Visibility.Hidden}
          sx={{
            color: (theme: Theme) => {
              let color = (isSelected ? theme.palette.primary.main: theme.palette.text.secondary);
              if (contrastTextColor)
                color = contrastTextColor;
              if (visibility === ISheet.Visibility.Hidden) {
                color = alpha(color, theme.palette.action.disabledOpacity);
              }
              return color;
            },
            borderLeft: (theme: Theme) => {
              return `${isSelected ? theme.palette.primary.main : 'transparent'} solid 2px`;
            },
            paddingLeft: '4px',
            paddingTop: '4px',
            paddingBottom: '4px',
            fontWeight: (isSelected ? '700' : '400'), // Copied from sheetTab. Also review
            // backgroundColor: (theme: Theme) => {
            //   return null; // TODO - read thumb color
            // },
            '&:hover': {
              fontWeight: '700'
            }
          }}
          icon={isSelected ? <SelectedIcon/> : undefined}
          onMouseDown={e => e.preventDefault()}
          onMouseUp={() => {
            Promise.resolve(floatReference.closeAll()).then(() => {
              try {
                sheet.select();
                //workbook.setActiveSheet(sheetRef);
              } catch (e) {
                console.error(e);
              }
            })
          }}
        >
          <>
            {coloredBackground}
            <Box
              sx={{
                paddingRight: '0px',
                paddingLeft: '4px',
                display: 'flex',
                flexDirection: 'row',
                flex: '1 1 100%',
                overflow: 'hidden',
                alignItems: 'center',
                zIndex: 2
              }}
            >
              <Box
                className='sheet-name'
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  alignItems: 'center',
                }}
              >
                {sheet.getName()}
                <Box
                  sx={{
                    height: '0px',
                    opacity: '0',
                    fontWeight: '700'
                  }}
                >
                  {sheet.getName()}
                </Box>
              </Box>
              {iconStatus}
            </Box>
          </>
        </ExhibitMenuItem>
      );
    }
    return sheetMenus;
  }, [workbook, protectionWorkbook, sheetsVisible, floatReference, gridStyle]);

  return (
    <Box
      ref={refForwarded}
      className={clsx("menu", propClassName)}
      {...rest}
    >
      {items}
    </Box>
  );
}));

SheetsAllMenu.displayName = "SheetsAllMenu";