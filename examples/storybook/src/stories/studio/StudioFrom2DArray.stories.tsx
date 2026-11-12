import type React from 'react';
import { type CSSProperties, useRef, useMemo, useEffect } from 'react';

import { Workbook, type IWorkbook } from '@sheetxl/sdk';

import { type WorkbookLoadEvent } from '@sheetxl/react';

import { Studio, type IStudioElement } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    ...rest
  } = props as any;

  /*
   * Create a simple workbook. Wrap in a memo so that it is only created once.
   */
  const workbook:IWorkbook = useMemo(() => {
    const wb = new Workbook();
    wb.getWorksheet().getRange('A1:C3').setValues([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]);
    return wb;
  }, []);

  // update the sheet size to match the requested maxRows/maxColumns
  useEffect(() => {
    if (!workbook) return;
    workbook.getWorksheet().setEntireSize({
      width: maxColumns,
      height: maxRows
    });
  }, [maxRows, maxColumns, workbook]);

  const style:CSSProperties = {
    border: 'blue solid 2px',
    borderRadius: '8px',
    flex: '1 1 100%',
    minHeight: "460px", // arbitrary min height to layout nicely.
  }

  // Note used but for illustration purposes.
  const refWBElement = useRef<IStudioElement>(null);

  return (
    <Studio
      sx={style}
      ref={refWBElement}
      onWorkbookLoad={(e: WorkbookLoadEvent) => {
        // The on load source has the workbookElement and so does the ref.
        // From a workbook element you can
        const wbElement1 = refWBElement.current;
        const wbElement2 = e.source;
        const _wb1 = wbElement1!.getWorkbook();
        const _wb2 = wbElement2.getWorkbook();
      }}
      {...rest}
      workbook={workbook}
      title='From 2D Array'
    />
  );
};

export const StudioFrom2DArray = asStory(Template);
StudioFrom2DArray.args = {
  maxRows: 100,
  maxColumns: 20
};
StudioFrom2DArray.storyName = "From 2D Array";

const Story = {
  title: 'Studio/From 2D Array',
  component: StudioFrom2DArray,
  // tags: ['autodocs'],
};

export default Story;