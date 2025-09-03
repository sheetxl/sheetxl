import React, { useCallback, useState } from 'react';

import { CommonUtils } from '@sheetxl/utils';
import { TabStrip } from '@sheetxl/react';

const createScrollMenuButton = function() {
  return (
    <div
      style={{
        background: 'grey',
        marginLeft: '4px',
        marginRight: '4px',
        minHeight: '24px',
        minWidth: '24px',
        padding: '0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* empty placeholder */}
    </div>
  );
}

/**
 * Minimum tabStrip
 */
const Template: React.FC = (props) => {
  const {
    showMenuSquare,
    ...rest
  } = props as any;

  // This is the selected tab not the focused tab
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [sheetNames, setSheetNames] = useState<string[]>([
    'Sheet 1',
    'Sheet 2',
    // 'Sheet 3',
    // 'Sheet 4',
    // '1',
    // 'A     ',
    // 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    // 'Sheet 6',
    // 'Sheet a',
    // 'Sheet b',
    // 'Sheet c',
    // 'Sheet d',
    // 'Sheet e',
    // 'Sheet f',
    // 'Sheet g',
    // 'Sheet h',
    // 'Sheet i',
    // 'Sheet j',
    // 'Sheet k',
    // 'Sheet l',
    // 'Sheet m',
    // 'Sheet n',
    // 'Sheet o',
    // 'Sheet p',
    // 'Sheet q',
    // 'Sheet r',
    // 'Sheet s',
    // 'Sheet t',
    // 'Sheet u',
    // 'Sheet v',
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

  // Should the editable label fire the tabindex and when the name changes?
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
    <div
      style={{ // For Canvas view we want to center @ 75%
        width: '75%',
        position: 'relative'
      }}
    {...rest}
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
      >
        {showMenuSquare ? createScrollMenuButton() : <></>}
      </TabStrip>
    </div>
  );
};

export const TabStripBasic = Template.bind({});
TabStripBasic.args = {
  disabled: false,
  showMenuSquare: true
};


TabStripBasic.storyName = "TabStrip";

const Story = {
  title: 'TabStrip',
  component: TabStripBasic,
};
export default Story;