import React from 'react';

import { ScrollPane, Scrollbar, ScrollbarProps } from  '@sheetxl/utils-react';

import { ScrollableGrid } from '@sheetxl/grid-react';

import { sharedCellRenderer } from '../../components';

/**
 * Uses scrollableGrid to provide default scrollbars.
 */
const Template: React.FC = (props) => {
  const {
    showVerticalScrollbar,
    showHorizontalScrollbar,
    renderScrollbarHorizontal,
    renderScrollbarVertical,
    createScrollCorner,
    ...rest
  } = props as any;

  return (
    <div className="storybook-container">
      <ScrollableGrid
        {...rest}
        showVerticalScrollbar={showVerticalScrollbar}
        showHorizontalScrollbar={showHorizontalScrollbar}
        renderScrollbarHorizontal={renderScrollbarHorizontal}
        renderScrollbarVertical={renderScrollbarVertical}
        createScrollCorner={createScrollCorner}
        renderCell={sharedCellRenderer}
      />
    </div>
  );
};


export const Scrollable = Template.bind({});
Scrollable.args = {
  columnCount: 200,
  rowCount: 200,
  showVerticalScrollbar: true,
  showHorizontalScrollbar: true
};

Scrollable.storyName = "Scrollable Grid";

const createRedScrollbar = (props: ScrollbarProps) => {
  return (
    <Scrollbar
      style={{border: 'red solid 3px'}}
      {...props}
   />
   );
}

const createCustomCorner = ({ width, height }) => {
  return (
    <button style={{
      minWidth: `${width}px`,
      width: `${width}px`,
      minHeight: `${height}px`,
      height: `${height}px`,
      background: 'green',
      border: 'blue solid 2px'
    }}/>
  );
};

export const CustomScrollElements = Template.bind({});
CustomScrollElements.args = {
  renderScrollbarHorizontal: createRedScrollbar,
  renderScrollbarVertical: createRedScrollbar,
  createScrollCorner: createCustomCorner,
  columnCount: 200,
  rowCount: 200,
  showVerticalScrollbar: true,
  showHorizontalScrollbar: true
};


const Story = {
  title: 'Scrollable Grid',
  component: ScrollPane,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;