import React from 'react';

import {
  ScrollPane, Scrollbar, type ScrollbarProps, type ScrollCornerProps
} from  '@sheetxl/utils-react';

import { asStory, sharedCellRenderer, ScrollableGrid } from '../../components';

/**
 * Uses scrollableGrid to provide default scrollbars.
 */
const Template: React.FC = (props) => {
  const {
    showVerticalScrollbar,
    showHorizontalScrollbar,
    renderScrollbarHorizontal,
    renderScrollbarVertical,
    renderScrollCorner,
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
        renderScrollCorner={renderScrollCorner}
        renderCells={sharedCellRenderer}
      />
    </div>
  );
};


export const Scrollable = asStory(Template);
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

const renderScrollCorner = (props: ScrollCornerProps) => {
  const { size: _size, ...rest } = props;
  // The corner is a grid cell sized by the scrollbar gutters — just fill it.
  return (
    <button
      style={{
        width: '100%',
        height: '100%',
        background: 'green',
        border: 'blue solid 2px'
      }}
      {...rest}
    />
  );
};

export const CustomScrollElements = asStory(Template);
CustomScrollElements.args = {
  renderScrollbarHorizontal: createRedScrollbar,
  renderScrollbarVertical: createRedScrollbar,
  renderScrollCorner: renderScrollCorner,
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