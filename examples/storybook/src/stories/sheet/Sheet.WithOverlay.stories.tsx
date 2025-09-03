import React, { useState, useMemo } from 'react';

import { GridView } from '@sheetxl/grid-react';

import { CoordUtils } from '@sheetxl/utils';
import { Sheet } from '@sheetxl/sdk';

import { SheetElement } from '@sheetxl/react';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    showRowHeaders,
    showColumnHeaders,
    ...rest
  } = props as any;

  const [sheet] = useState(() => {
    return new Sheet({
      maxColumns,
      maxRows
    });
  });

  const overlays:((view: GridView) => React.ReactNode)[] = useMemo(() => {
    return [
      (view: GridView): React.ReactNode => {
        const range = {
          colStart: 4,
          rowStart: 15,
          colEnd: 14,
          rowEnd: 20
        }

        // Ouf of range don't show
        if (!CoordUtils.isRangeWithinRange(range, view.getVisibleRangeCoords())) {
          return;
        }

        const bounds = view.getRangeCoordsBounds(range);
        const { x:left, y:top } = bounds;
        let { width, height } = bounds;
        if (width === 0 || height === 0) // hidden row/column
          return;

        // Coordinates are provided in zoomed coordinates but the grid does not
        // auto zoom. This allows the grid to decide the logic itself.
        // TODO - provide a HOC that wraps the logic here.
        const zoom = view.getZoom();
        if (zoom !== 1) {
          width = width / zoom;
          height = height / zoom;
        }

        return (
          <div
            style={{
              position: 'absolute',
              willChange: 'top, left, width, height',
              left, top, width, height,
              clipPath: 'inset(0px)', // prevent overflow (if desired)
              transform: (zoom !== 1) ? `translate(-50%, -50%) scale(${zoom}) translate(50%, 50%)` : undefined,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'stretch',
              overflow: 'none',
              pointerEvents: 'auto'
            }}
            key={"testing"}
          >
            <button
              style={{
                flex: '1'
              }}
            >
              <span>
                Floating Button; click me and I will do nothing
              </span>
            </button>
          </div>
        )
      }
    ];
  }, []);

  return (
    <SheetElement
      style={{ // For Docs view we are 400px by 'full width'
        flex: "1",
        minHeight: "400px",
        width: "100%",
        height: "100%",
      }}
      sheet={sheet} // Required
      overlays={overlays}
      showRowHeaders={showRowHeaders}
      showColumnHeaders={showColumnHeaders}
      {...rest}
    />
  );

};

export const SheetWithOverlays = Template.bind({});
SheetWithOverlays.args = {
  maxRows: 200,
  maxColumns: 200,
  showRowHeaders: true,
  showColumnHeaders: true
};

SheetWithOverlays.storyName = "with overlays";

const Story = {
  title: 'Sheet',
  component: SheetElement,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;
