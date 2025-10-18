import React, { useCallback, useState } from 'react';

import { Theme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { IconButton } from '@mui/material';

import { CommonUtils } from '@sheetxl/utils';
import { TabStrip } from '@sheetxl/react';
import { DynamicIcon } from '@sheetxl/utils-react';
import { ExhibitIconButton } from '@sheetxl/utils-mui';
import {
  renderScrollButtonEdge, renderScrollButtonStart, renderScrollButtonEnd
} from '@sheetxl/utils-mui';

import { SheetTab } from '@sheetxl/studio-mui';


/**
 * Use the MUI Tab from workbook project to apply polished MUI styling to custom tabs.
 */
const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  // This is the selected tab not the focused tab
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [sheetNames, setSheetNames] = useState<string[]>([
    'Sheet 1',
    'Sheet 2',
    'Sheet 3',
    'Sheet 4',
    'Sheet 5*',
    'Sheet 6',
    'Sheet a',
    'Sheet b',
    'Sheet c',
    'Sheet d',
    'Sheet e',
    'Sheet f',
    'Sheet g',
    'Sheet h',
    'Sheet i',
    'Sheet j',
    'Sheet k',
    'Sheet l',
    'Sheet m',
    'Sheet n',
    'Sheet o',
    'Sheet p',
    'Sheet q',
    'Sheet r',
    'Sheet s',
    'Sheet t',
    'Sheet u',
    'Sheet v',
  ]);

  const handleSelectedTabIndexChange = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleTabNameChange = useCallback ((index: number, value: string) => {
    setSheetNames((items) => {
      const newItems = [...items];
      newItems[index] = value;
      return newItems;
    });
  }, []);

  // Should the editable label fire the tabindex and the name changes?
  // review when integrating into sheet
  const handleTabMove = useCallback((indexFrom: number, indexTo: number) => {
    setSheetNames((items) => CommonUtils.arrayMove(items, indexFrom, indexTo));
    setSelectedIndex((prev) => {
      // If moving selected
      if (indexFrom === prev)
        return indexTo;
      // if to/from don't cross then return previous
      if ((indexFrom < prev && indexTo < prev) ||
          (indexFrom > prev && indexTo > prev))
        return prev;
      if (indexFrom < prev)
        return prev-1;
      else
        return prev+1;
    });
  }, []);

  return (
    <Box
      sx={{ // For Canvas view we want to center @ 75%
        width: '75%',
        position: 'relative',
        display: 'flex',
      }}
    >
      <TabStrip
        style={{

        }}
        {...props}
        selectedTabIndex={selectedIndex}
        tabNames={sheetNames}

        onSelectedTabIndexChange={handleSelectedTabIndexChange}
        onTabNameChange={handleTabNameChange}
        onTabMove={handleTabMove}
        background="white"
        activeColor={null}
        renderScrollButtonStart={renderScrollButtonStart}
        renderScrollButtonEnd={renderScrollButtonEnd}
        renderScrollButtonEdge={renderScrollButtonEdge}
        renderTabButton={(props) => {
          return <SheetTab {...props}/>
        }}
        propsEditLabel={{
          styleHover: {
            fontWeight: '700'
          }
        }}
      >
        <ExhibitIconButton
          style={{
            padding: '0px',
            margin: '0px 0px',
            border: 'none'
          }}
          dense={true}
          outlined={false}
          color="primary" aria-label="menu"
          icon={<DynamicIcon iconKey="Menu" />}
        />
      </TabStrip>
      <div style={{ minWidth: '4px'}}/>
      <IconButton
        disabled={rest.disabled}
        sx={{
          padding: '0',
          height: '24px', // why is this required?
          "&:hover:not([disabled])": {
            color: (theme:Theme) => {
              return theme.palette.primary.main;
            }
          }
        }}
        aria-label="addTab"
        size="small"
      >
        <DynamicIcon iconKey="AddCircle" />
      </IconButton>
    </Box>
  );
};

export const TabStripMUI = Template.bind({});
TabStripMUI.args = {
  disabled:false
};


TabStripMUI.storyName = "TabStrip with MUI";

const Story = {
  title: 'TabStrip',
  component: TabStripMUI,
};
export default Story;