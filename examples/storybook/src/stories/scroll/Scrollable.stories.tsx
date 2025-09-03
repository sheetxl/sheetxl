import React, { useState, useRef } from 'react';

import { TopLeft } from '@sheetxl/utils';
import {
  ScrollPane, ScrollPaneProps, IScrollPaneElement, Scrollbar, ScrollbarProps, ScrollableViewport
} from '@sheetxl/utils-react';

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

/**
 * Uses scrollableGrid to provide default scrollbars.
 */
const Template: React.FC = (props) => {
  const {
    showVerticalScrollbar,
    showHorizontalScrollbar,
    createHorizontalScrollbar,
    createVerticalScrollbar,
    createScrollCorner,
    ...rest
  } = props as any;

  const scrollPaneProps:ScrollPaneProps = rest;

  const refScrollPane = useRef<IScrollPaneElement>(null);

  // const viewport:ScrollableViewport =
  const [viewport, setViewport] = useState<ScrollableViewport>({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    totalWidth: 1000,
    totalHeight: 1000,
  });
  return (
    <div className="storybook-container">
      <ScrollPane
        {...scrollPaneProps}
        viewport={viewport}
        onScrollViewport={(scrollPoint: Partial<TopLeft>) => {
          setViewport((prev: ScrollableViewport) => {
            return {
              ...prev,
              top: scrollPoint.top ?? prev.top,
              left: scrollPoint.left ?? prev.left,
            }
          })
        }}
        ref={refScrollPane}
        showVerticalScrollbar={showVerticalScrollbar}
        showHorizontalScrollbar={showHorizontalScrollbar}
        createHorizontalScrollbar={createHorizontalScrollbar}
        createVerticalScrollbar={createVerticalScrollbar}
        createScrollCorner={createScrollCorner}
      >
        <div
         style={{
          border: '1px solid green',
          width: '100%',
          height: '100%',
          background: 'pink',
          overflow: 'hidden'
         }}
        >
          <button
            style={{
              position: 'relative',
              left: `${650 - viewport.left}px`,
              top: `${550 - viewport.top}px`,
              width: '100px',
              height: '20px'
            }}
            onClick={() => {
              // scrollPane is a regular component
              console.log(refScrollPane.current);
            }}
          >
            Floating
          </button>
        </div>

      </ScrollPane>
    </div>
  );
};


export const ScrollPaneTemplate = Template.bind({});
ScrollPaneTemplate.args = {
  createHorizontalScrollbar: createRedScrollbar,
  createVerticalScrollbar: createRedScrollbar,
  createScrollCorner: createCustomCorner,
  showVerticalScrollbar: true,
  showHorizontalScrollbar: true,
};

const Story = {
  title: 'Scrollable',
  component: ScrollPane,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;