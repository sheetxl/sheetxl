import React, { CSSProperties, useState } from 'react';

import { ErrorBoundary } from 'react-error-boundary';

import { Box } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';

import { type ReadWorkbookOptions, type WorkbookHandle } from '@sheetxl/io';

import { Studio, WorkbookIO } from '@sheetxl/studio-mui';

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;
  const optionsLoad: ReadWorkbookOptions = {
    source: null, // Will be set when fetching
    // maxColumns: 20,
    // maxRows: 100
  };

  const [workbook, setWorkbook] = useState<WorkbookHandle | Promise<WorkbookHandle>>(null);

  /**
   * This example reads a file from the local filesystem by showing a file input field until
   * a file is selected and then it will show the Studio widget.
   */
  const openFile = async (input: File | Promise<File> | string=null) => {
    const asFormatString = await WorkbookIO.getAllReadFormatsAsString();
    const sourceResolve = input ?? await CommonUtils.openFileDialog(asFormatString);
    if (!sourceResolve) return; // was a cancel
    /*
      The Studio will show a loading indicator if a workbook promise is passed.
      Additionally we want to set the title to the name of the file.
    */
    const loadResults:WorkbookHandle = await WorkbookIO.read({
      ...optionsLoad,
      source: sourceResolve
    });
    if (loadResults === null) { // cancelled
      setWorkbook(null);
      return;
    }
    setWorkbook(loadResults);
  }

  const style:CSSProperties = {
    border: 'blue solid 2px',
    borderRadius: '8px',
    flex: '1 1 100%',
  }

  /**
   * Show an input control until we select a file, then show the workbook.
   */
  return (
    <ErrorBoundary fallback={<div>failing at storybook</div>}>
    <Box
      sx={{
        minHeight: "560px", // arbitrary min height to layout nicely.
        display: 'flex',
        position: 'relative'
      }}
    >
    {workbook ? <>
      <Studio
        sx={{
          ...style,
          position: 'absolute',
        }}
        {...rest}
        workbook={workbook}
      />
    </> :
      <Box
        style={{
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          alignItems: 'start',
          ...style
        }}
      >
        {/* - Traditional file input but we also have a file input utility that easily attaches to any event that provides input choices.
        <input
          style={{
            minWidth: '360px'
          }}
          name: `from-file`,
          autoComplete: "off",
          type="file"
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
            if (e.target?.files?.length > 0)
              openFile(e.target.files[0]);
          }}
        />
        */}
        <button
          onClick={() => openFile()}
        >
          Open Workbook
        </button>
      </Box>
    }
    </Box>
    </ErrorBoundary>
  );
};

export const WorkbookFromFile = Template.bind({});
WorkbookFromFile.args = {};
WorkbookFromFile.storyName = "From File";

const Story = {
  title: 'Models/From File',
  component: WorkbookFromFile,
  // tags: ['autodocs'],
};

export default Story;