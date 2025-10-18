import React, { useRef, memo, forwardRef } from 'react';

import { mergeRefs } from 'react-merge-refs';

import { useMeasure } from 'react-use';

import { SplitPane } from '@sheetxl/utils-react';

import { Theme, useTheme } from '@mui/material/styles';


export interface StudioSplitPaneProps extends React.HTMLAttributes<HTMLDivElement> {

  mainElement?: React.ReactElement;

  sidebarElement?: React.ReactElement;
}

const styleFlexFull: React.CSSProperties = {
  flex: `1 1 100%`,
  display: 'flex',
  boxSizing: 'border-box'
}

/**
 * Wraps a Workbook element and a taskPane into a split pane.
 *
 * @remarks
 * This adds a split pane to support the task pane alongside the workbook.
 */
export const StudioSplitPane = memo(
  forwardRef<HTMLDivElement, StudioSplitPaneProps>((props, refForwarded) => {
  const {
    mainElement,
    sidebarElement,
    className: propClassName,
    style: propsStyle,
    ...rest
  } = props;

  const appTheme:Theme = useTheme();
  const [refMeasureContainer, { width: widthContainer }] = useMeasure<HTMLDivElement>();
  const isStandardScreen =  widthContainer > 530 || widthContainer === 0; // when 0 we are not yet measured

  const refLocal = useRef<HTMLDivElement>(null);

  let path = null;
  let width = 4;
  let height = 13;
  if (isStandardScreen) {
    path = 'm 3.6261898,11.36243 c 0,0.88365 -0.71627,1.59991 -1.59991,1.59991 -0.8836498,0 -1.60004965,-0.71626 -1.60004965,-1.59991 0,-0.88365 0.71639985,-1.6000508 1.60004965,-1.6000508 0.88364,0 1.59991,0.7164008 1.59991,1.6000508 m 0,-4.881294 c 0,0.88364 -0.71627,1.60004 -1.59991,1.60004 -0.8836498,0 -1.60004965,-0.7164 -1.60004965,-1.60004 0,-0.88365 0.71639985,-1.60005 1.60004965,-1.60005 0.88364,0 1.59991,0.7164 1.59991,1.60005 m 0,-4.881226 c 0,0.88365 -0.71627,1.60005 -1.59991,1.60005 C 1.14263,3.19996 0.42623015,2.48356 0.42623015,1.59991 0.42623015,0.71626 1.14263,0 2.0262798,0 c 0.88364,0 1.59991,0.71626 1.59991,1.59991';
  } else {
    path = 'M 1.59991,3.62619 C 0.71626,3.62619 0,2.90992 0,2.02628 0,1.1426301 0.71626,0.42623015 1.59991,0.42623015 c 0.88365,0 1.6000508,0.71639995 1.6000508,1.60004985 0,0.88364 -0.7164008,1.59991 -1.6000508,1.59991 m 4.881294,0 c -0.88364,0 -1.60004,-0.71627 -1.60004,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60004,-1.60004985 0.88365,0 1.60005,0.71639995 1.60005,1.60004985 0,0.88364 -0.7164,1.59991 -1.60005,1.59991 m 4.881226,0 c -0.88365,0 -1.60005,-0.71627 -1.60005,-1.59991 0,-0.8836499 0.7164,-1.60004985 1.60005,-1.60004985 0.88365,0 1.59991,0.71639995 1.59991,1.60004985 0,0.88364 -0.71626,1.59991 -1.59991,1.59991';
    width = 13;
    height = 4;
  }

  return (
    <SplitPane
      ref={mergeRefs([refLocal, refMeasureContainer, refForwarded]) as any}
      className={propClassName}
      style={propsStyle ? { ...styleFlexFull, ...propsStyle } : styleFlexFull}
      {...rest as any} // TODO - fix types
      fixedPane="after"
      position="40%"
      minAfter={isStandardScreen ? '280px' : '120px'}
      splitDirection={isStandardScreen ? 'row' : 'column'}

      propsResizer={{
        className: "styled-resizer",
        // todo - move this to css
        style: {
          minWidth: isStandardScreen ? '6px' : undefined,
          minHeight: isStandardScreen ? undefined : '6px',
          maskImage: `url("data:image/svg+xml,%3Csvg width='${width}' height='${height}' viewBox='0 0 ${width} ${height}' version='1.1' fill='${(appTheme.palette.text as any).icon ?? appTheme.palette.action.active}' xmlns='http://www.w3.org/2000/svg' xmlns:svg='http://www.w3.org/2000/svg'%3E%3Cpath d='${path}' /%3E%3C/svg%3E%0A")`,
          maskRepeat: 'no-repeat',
          maskPosition: isStandardScreen  ? 'left center' : 'top center',
        },
      }}
      elementBefore={mainElement}
      propsPaneBefore={{
        style: {
          flexDirection: 'column',
          marginRight: !sidebarElement ? '6px' : undefined,
        }
      }}
      elementAfter={sidebarElement}
      propsPaneAfter={{
        style: {
          marginLeft: isStandardScreen ? '0px' : '4px',
          marginRight: isStandardScreen ? '8px' : '4px'
        }
      }}
    />
  );
}));

StudioSplitPane.displayName = "StudioSplitPane";