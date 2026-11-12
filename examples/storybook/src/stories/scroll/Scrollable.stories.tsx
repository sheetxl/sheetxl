import React, { useMemo, useRef } from 'react';

import {
  Scrollbar, ScrollPane, Viewport, useBoundSyncExternalStore, type ScrollPaneProps,
  type IScrollPaneElement, type ScrollbarProps, type ScrollCornerProps
} from '@sheetxl/utils-react';

import { asStory } from '../../components';

const renderRedScrollbar = (props: ScrollbarProps) => {
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

  const propsScrollPane:ScrollPaneProps = rest;

  const refScrollPane = useRef<IScrollPaneElement>(null);

  // A standalone ScrollPane (no grid): drive arbitrary content from a Viewport. The sizes
  // (a 100×100 view over 1000×1000 content) are pushed once; the ScrollPane subscribes for position +
  // sizes and drives scroll into it.
  const viewport = useMemo(() => {
    const controller = new Viewport();
    controller.setSizes(100, 100, 1000, 1000);
    controller.setBounds({ minLeft: 0, maxLeft: 900, minTop: 0, maxTop: 900 });
    return controller;
  }, []);
  const vp = useBoundSyncExternalStore(viewport, (s) => s.getMetrics());
  return (
    <div className="storybook-container">
      <ScrollPane
        {...propsScrollPane}
        viewport={viewport}
        ref={refScrollPane}
        showVerticalScrollbar={showVerticalScrollbar}
        showHorizontalScrollbar={showHorizontalScrollbar}
        renderScrollbarHorizontal={renderScrollbarHorizontal}
        renderScrollbarVertical={renderScrollbarVertical}
        renderScrollCorner={renderScrollCorner}
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
              left: `${250 - vp.left}px`,
              top: `${150 - vp.top}px`,
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


export const ScrollPaneFloating = asStory(Template);
ScrollPaneFloating.args = {
  renderScrollbarHorizontal: renderRedScrollbar,
  renderScrollbarVertical: renderRedScrollbar,
  renderScrollCorner: renderScrollCorner,
  showVerticalScrollbar: true,
  showHorizontalScrollbar: true,
};

ScrollPaneFloating.storyName = 'Floating'

const Story = {
  title: 'Scrollable',
  component: ScrollPane,
  parameters: { controls: { sort: 'requiredFirst' } }
};


export default Story;