import type React from 'react';
import { useState } from 'react';

import { Worksheet } from '@sheetxl/sdk';

import { WorksheetElement } from '@sheetxl/react';
import { Layer, VirtualDiv } from '@sheetxl/grid-react';

import { asStory } from '../../components';

const Template: React.FC = (props) => {
  const {
    maxColumns,
    maxRows,
    showRowHeaders,
    showColumnHeaders,
    ...rest
  } = props as any;

  const [sheet] = useState(() => {
    const sheet = new Worksheet();
    sheet.setEntireSize({
      width: maxColumns,
      height: maxRows
    });
    return sheet;
  });

  return (
    <WorksheetElement
      style={{ // For Docs view we are 400px by 'full width'
        flex: "1",
        minHeight: "400px",
        width: "100%",
        height: "100%",
      }}
      sheet={sheet} // Required
      layers={[
        // Each layers[] item is a grid child, so it must be Layer-rooted (law 4: the flat stack);
        // the widget itself is a VirtualDiv — a real div placed at a range (hittable by default).
        <Layer key="sticky">
          <VirtualDiv
            tabIndex={0}
            range={{
              colStart: 2,
              rowStart: 2,
              colEnd: 5,
              rowEnd: 6
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#FFF8C5',
              border: '1px solid #E6D88A',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
              // NOTE: do NOT transition `transform` — the box's scroll tracking IS its transform, so a
              // transform transition makes the note glide/lag on every scroll instead of staying anchored.
              transition: 'box-shadow 120ms ease',
              font: '13px/1.4 system-ui, sans-serif',
              color: '#5C4A00'
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                background: '#F4E58A',
                borderBottom: '1px solid #E6D88A',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span style={{ fontSize: 14 }}>📌</span> Sticky note
            </div>
            <div style={{ padding: '8px 10px', flex: '1 1 auto' }}>
              I am a sticky note.
            </div>
          </VirtualDiv>
        </Layer>
      ]}
      showRowHeaders={showRowHeaders}
      showColumnHeaders={showColumnHeaders}
      {...rest}
    />
  );

};

export const SheetWithLayers = asStory(Template);
SheetWithLayers.args = {
  maxRows: 200,
  maxColumns: 200,
  showRowHeaders: true,
  showColumnHeaders: true
};

SheetWithLayers.storyName = "with layers";

const Story = {
  title: 'Sheet/With Layers',
  component: WorksheetElement,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;