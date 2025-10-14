import React, { CSSProperties, useState } from 'react';

import { Box } from '@mui/material';

import type { IWorkbook } from '@sheetxl/sdk';

import { Studio, WorkbookIO, type ReadWorkbookOptions } from '@sheetxl/studio-mui';

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  const optionsLoad: ReadWorkbookOptions = {
    source: null, // Will be set when fetching
    // maxColumns: 20,
    // maxRows: 100
  };

  const [fetchUrl, setFetchUrl] = useState<string>(`https://www.sheetxl.com/docs/examples/feature-highlights.xlsx`);
  const [workbook, setWorkbook] = useState<IWorkbook | Promise<IWorkbook>>(null);

  const [workbookTitle, setWorkbookTitle] = useState<string>('');

  /**
   * This example reads a an ArrayBuffer from a fetch but could get the ArrayBuffer
   * from any source. If then displays this in the Studio widget.
   *
   * The Studio widget requires an IWorkbook or a Promise<IWorkbook>
   * In this example we:
   * 1. fetch from a url to get an array buffer
   * 2. use the WorkbookIO.fromArrayBuffer method to convert a ArrayBuffer to an IWorkbook
   * 3. replace the null workbook with the resolved workbook
   */
  const handleClick = async (_e: React.MouseEvent<HTMLButtonElement, MouseEvent>): Promise<IWorkbook> => {
    // Note - We are using a fetch to get an ArrayBuffer but this could be any source.
    const fetchResponse = await fetch(fetchUrl);
    if(!fetchResponse.ok) {
      throw (`Unable to fetch: ${fetchResponse.url}`);
    }

    const importResults: IWorkbook = await WorkbookIO.read({
      ...optionsLoad,
      source: {
        input: fetchUrl
      },
      format: "Excel"
    });

    /* not needed but we want to show a title for the workbook too */
    setWorkbookTitle(importResults.getName());
    setWorkbook(importResults);
    return importResults;
  }

  const style: CSSProperties = {
    border: 'blue solid 2px',
    borderRadius: '8px',
    flex: '1 1 100%'
  }

  /**
   * Show an input control until we type a url a file, then show the workbook.
   */
  return (
    <Box
      sx={{
        minHeight: "560px", // arbitrary min height to layout nicely.
        display: 'flex',
        position: 'relative',
      }}
    >
    {workbook ? <>
      <Studio
        sx={{
          ...style,
          position: 'absolute', /* to place correctly in storybook */
        }}
        {...rest}
        workbook={workbook} /* if null a default model is used. If set will use the model. If a promise of a model it will show a load until the promise resolves */
        title={workbookTitle} /* optional title to show in the header */
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
        <input
          style={{
            minWidth: '360px'
          }}
          name="input-url"
          autoComplete="off"
          value={fetchUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
            setFetchUrl(e.target.value);
          }}
        />
        <button
          onClick={handleClick}
        >
          Fetch
        </button>
      </Box>
    }
    </Box>
  );
};

export const WorkbookFromURL = Template.bind({});
WorkbookFromURL.args = {};
WorkbookFromURL.storyName = "From URL";

const Story = {
  title: 'Models/From URL',
  component: WorkbookFromURL,
  // tags: ['autodocs'],
};

export default Story;