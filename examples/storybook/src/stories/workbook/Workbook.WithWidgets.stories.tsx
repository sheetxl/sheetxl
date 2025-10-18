import React, { useState, useRef } from 'react';

import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { Checkbox } from '@mui/material';
import { FormControlLabel } from '@mui/material';

import { IWorkbook, ICell } from '@sheetxl/sdk';

import { Studio, IWorkbookElement } from '@sheetxl/studio-mui';

import { RelaxedChangeTextField } from '../../components/RelaxedChangeTextField';
import { BoundedWidget, BoundedWidgetElementProps } from '../../components/BoundedWidget';

const Template: React.FC = () => {

  const [workbook, setWorkbook] = useState<IWorkbook>(null);
  // The widgets don't bind to the UI element but this is required for the goto link
  const refIWorkbookElement = useRef<IWorkbookElement>(null);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Paper
        sx={{
          flex: '0',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
          m: 0.5,
          px: 2,
          py: 1,
          gap: 2,
          rowGap: 1,
        }}
      >
        <BoundedWidget
          workbook={workbook}
          refIWorkbookElement={refIWorkbookElement}
          createWidget={(props: BoundedWidgetElementProps) => {
            const {
              range
            } = props;
            const cell:ICell = range?.getCells()[0][0]; // guaranteed to be non null
            return (
              <RelaxedChangeTextField // only fires onChange on enter or blur
                sx={{
                  width: '200px',
                  ...cell?.getStyle().getFill().toCSS(),
                }}
                size="small"
                InputProps={{
                  inputProps: {
                    sx: {
                      paddingTop: '3.5px', paddingBottom: '3.5px',
                      color: cell?.getStyle().getFont().getFill().toCSS(),
                    }
                  }
                }}
                disabled={range?.isInvalid() || !cell?.isEditAllowed()}
                value={cell?.toText()}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  range.setValue(event.target.value, { autoFit: true, description: `Type '${event.target.value}' from Widget` });
                }}
              />
            )
          }}
        />
        <BoundedWidget
          workbook={workbook}
          refIWorkbookElement={refIWorkbookElement}
          createWidget={({ range }) => {
            const cell = range?.getCells()[0][0]; // guaranteed to be non null
            // const update = range?.update;
            return (
              <FormControlLabel
                disabled={range?.isInvalid() || !cell?.isEditAllowed()}
                control={
                  <Checkbox
                    sx={{ padding: '1px', marginRight: '8px' }}
                    checked={!!cell?.getValue()} // truthy check
                    onChange={() => {
                      range.setValue(!cell.getValue(), { autoFit: true, description: `Toggle from Widget` });
                    }}
                  />
                }
                label="Is Checked"
                labelPlacement="end"
              />
            )
          }}
        />
      </Paper>
      <Paper
        sx={{
          position: "relative",
          flex: "1",
          m: 0.5,
          display: 'flex',
          alignItems: 'stretch'
        }}
      >
        <Studio
          workbook={workbook}
          onWorkbookChange={(model: IWorkbook) => setWorkbook(model)}
          ref={refIWorkbookElement}
          propsWorkbookTitle={{
            placeHolder: 'Untitled Widget Workbook'
          }}
          sx={{
            flex: '1 1 100%'
          }}
        />
      </Paper>
    </Box>
  );
};

export const WorkbookAppWithWidgets = Template.bind({});
WorkbookAppWithWidgets.args = {
};

WorkbookAppWithWidgets.storyName = "With Widgets";

const Story = {
  title: 'Workbook/With Widgets',
  component: Studio,
};
export default Story;
