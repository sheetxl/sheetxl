import React, { useCallback, useState, memo, forwardRef } from 'react';

import { CommonUtils } from '@sheetxl/utils';

import { Color } from '@sheetxl/sdk';

import { TabStrip, TabProps } from '@sheetxl/react';

/**
 * Illustration of customizing tabs strip without using any component library.
 */
const CustomTab: React.FC<TabProps> = memo(forwardRef<HTMLDivElement, TabProps>((props: TabProps, refForwarded) => {
  const {
    children,
    style,
    className,
    value,
    editing,
    editable,
    disabled,
    index,
    selectedIndex,
    background,
    activeColor,
    dragging,
    borderColor,
    borderWidth,
    ...rest
  } = props;
  return (
    <div
      ref={refForwarded}
      style={{
        ...style,
        display:'flex',
        flexDirection: 'column',
        background: (selectedIndex === index ? 'lightgray' : background),
        minHeight: '0px',
        fontFamily: 'inherit',
        fontSize: '16px',
        fontWeight: (selectedIndex === index ? '500' : '400'),
        lineHeight: '1',
        letterSpacing: '0px',
        textTransform: 'none',
        minWidth: 'unset',
        borderBottom: selectedIndex === index ? `${activeColor} solid 2px` : 'none',
        borderLeft: selectedIndex === index ? `${activeColor} solid 2px` : 'none',
        borderRight: selectedIndex === index ? `${activeColor} solid 2px` : 'none',
        borderBottomLeftRadius: selectedIndex === index ? '4px' : undefined,
        borderBottomRightRadius: selectedIndex === index ? '4px' : undefined,
        cursor: dragging ? undefined : 'pointer'
      }}
      {...rest}
    >
      <div
        style={{
          flex: '1 1 100%',
          display:'flex',
          flexDirection: 'row',
        }}
      >
        {children}
      </div>
    </div>
  );
}));

const Template: React.FC = (props) => {
  // const {
  //   showMenuSquare,
  //   ...rest
  // } = props as any;

  // This is the selected tab not the focused tab
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [sheetNames, setSheetNames] = useState<string[]>([
    'Sheet 1',
    'Sheet 2',
    'Sheet 3',
    'Sheet 4',
    'Sheet 5'
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

  // Should the editable label fire the tabindex when the name changes?
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
        createTabButton={(props) => {
          return <CustomTab {...props}/>
        }}
        activeColor={new Color('red')}
        editLabelProps={{
          createInput: (props) => {
            return (
              <input
                {...props}
                style={{
                  ...props.style,
                  color: 'red'
                }}
              />
            )
          }
        }}
      >
      </TabStrip>
    </div>
  );
};

export const TabStripWithCustomTabs = Template.bind({});
TabStripWithCustomTabs.args = {
  disabled:false
};


TabStripWithCustomTabs.storyName = "TabStrip with Custom Tabs";

const Story = {
  title: 'TabStrip',
  component: TabStripWithCustomTabs,
};
export default Story;