import type React from 'react';
import { type CSSProperties, useState } from 'react';

import { ErrorBoundary } from 'react-error-boundary';

import { Box } from '@mui/material';

import { type IWorkbook, type IWorkbookIO } from '@sheetxl/sdk';

import { WorkbookIO } from '@sheetxl/react';

import { Studio } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;
  const optionsLoad: IWorkbookIO.ReadOptions = {
    source: null, // Will be set when fetching
    // maxColumns: 20,
    // maxRows: 100
  };

  const [workbook, setWorkbook] = useState<IWorkbook | Promise<IWorkbook> | null>(null);

  /**
   * This example reads a file from the local filesystem by showing a file input field until
   * a file is selected and then it will show the Studio widget.
   */
  const openFile = async (input: File | Promise<File> | string | null = null) => {
    /*
      With no `source`, WorkbookIO.read lets the backing store resolve one — a File System
      Access open dialog, or an <input type=file> fallback — and resolves to null if the user
      cancels. Pass an explicit File (e.g. from a drag/drop or input element) to skip the dialog.
      The Studio shows a loading indicator if a workbook promise is passed.
    */
    const loadResults = await WorkbookIO.read({
      ...optionsLoad,
      source: input ?? null
    });
    setWorkbook(loadResults); // null when cancelled; the Studio handles null
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
        height: '100%', // fill the storybook root (which is 100% tall)
        minHeight: "560px", // arbitrary min height to layout nicely.
        display: 'flex',
        position: 'relative'
      }}
    >
    {workbook ? <>
      <Studio
        sx={style} /* Studio self-fills a sized parent; no position wrapper needed */
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

export const StudioFromFile = asStory(Template);
StudioFromFile.args = {};
StudioFromFile.storyName = "From File";

const Story = {
  title: 'Studio/From File',
  component: StudioFromFile,
  // tags: ['autodocs'],
};

export default Story;