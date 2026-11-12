import React, { useCallback, useEffect, useState } from 'react';

import { type IGroup, type IMovable, type IShape, Worksheet, type ITextFrame } from '@sheetxl/sdk';

import { type MovableElementProps, WorksheetElement } from '@sheetxl/react';
import { GroupEditor } from '@sheetxl/react/group';
import { ShapeEditor } from '@sheetxl/react/shape';

import { asStory } from '../../components';

/**
 * **Shapes in a sheet.** A dozen presets placed as movables: drag, resize and rotate them with the
 * selection frame, and drag the yellow adjustment handle of a selected shape to change its adjust
 * values (one undoable step on release). The geometry is re-evaluated at the movable's unzoomed
 * bounds and stretched to fill its frame, so a resize reshapes the preset as Excel does and zoom
 * thickens the lines. The group is a movable of its own whose members are ordinary shapes.
 */

type Placement = {
  bounds: { x: number; y: number; width: number; height: number };
  rotation?: number;
} & ({ type?: 'shape'; json: IShape.JSON } | { type: 'group'; json: IGroup.JSON });

const text = (lines: string[]): ITextFrame.JSON => ({ paragraphs: lines.map((line) => ({ runs: [{ text: line }] })) });

/** A shape member of a group, placed in the group's child space. */
const member = (json: IShape.JSON, x: number, y: number, width: number, height: number, rotation?: number): IMovable.JSON => ({
  anchor: { tl: { x, y }, br: { x: width, y: height } },
  content: { type: 'shape', json },
  ...(rotation ? { rotation } : {}),
});

const SHAPES: Placement[] = [
  { json: { geometry: 'roundRect', text: text(['Rounded']) }, bounds: { x: 40, y: 30, width: 160, height: 80 } },
  { json: { geometry: 'ellipse', text: text(['Ellipse']) }, bounds: { x: 230, y: 30, width: 160, height: 80 } },
  { json: { geometry: 'rightArrow', adjustments: { adj1: 40000 } }, bounds: { x: 420, y: 30, width: 160, height: 80 } },
  { json: { geometry: 'wedgeRectCallout', text: text(['Callout']) }, bounds: { x: 610, y: 30, width: 160, height: 80 } },
  { json: { geometry: 'star5', fill: { type: 'solid', color: 'FFC000' } as any }, bounds: { x: 40, y: 150, width: 120, height: 120 } },
  { json: { geometry: 'cube', fill: { type: 'solid', color: '70AD47' } as any }, bounds: { x: 190, y: 150, width: 140, height: 120 } },
  { json: { geometry: 'can' }, bounds: { x: 360, y: 150, width: 100, height: 130 } },
  { json: { geometry: 'pie', adjustments: { adj1: 0, adj2: 270 * 60000 } }, bounds: { x: 490, y: 150, width: 120, height: 120 } },
  { json: { geometry: 'smileyFace' }, bounds: { x: 640, y: 150, width: 120, height: 120 } },
  { json: { geometry: 'triangle', text: text(['Rotated']) }, bounds: { x: 40, y: 310, width: 140, height: 100 }, rotation: 30 },
  { json: { geometry: 'rect', fill: { type: 'none' } as any, stroke: { width: 2.25, fill: { type: 'solid', color: 'C00000' } } as any }, bounds: { x: 220, y: 310, width: 160, height: 100 } },
  {
    type: 'group',
    json: {
      childBounds: { x: 0, y: 0, width: 300, height: 100 },
      members: [
        member({ geometry: 'roundRect', text: text(['Step 1']) }, 0, 20, 80, 60),
        member({ geometry: 'rightArrow' }, 90, 35, 40, 30),
        member({ geometry: 'roundRect', text: text(['Step 2']) }, 140, 20, 80, 60),
        member({ geometry: 'ellipse' }, 240, 0, 60, 100, 90),
      ],
    },
    bounds: { x: 420, y: 310, width: 360, height: 100 },
  },
];

interface StoryArgs {
  debugGeometry: boolean;
}

const Template: React.FC<StoryArgs> = ({ debugGeometry }) => {
  const [sheet] = useState(() => new Worksheet());
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      for (const p of SHAPES) {
        const movable: IMovable = await sheet.getMovables().add({ type: p.type ?? 'shape', json: p.json, bounds: p.bounds } as any);
        if (p.rotation) movable.setRotation(p.rotation);
      }
      if (live) setPlaced(true);
    })();
    return () => { live = false; };
  }, [sheet]);

  const renderMovable = useCallback((props: MovableElementProps) => {
    const { movable, ...rest } = props;
    if (!movable) return <></>;
    const type = movable.getContent().getType();
    if (type === 'group') return <GroupEditor {...rest} movable={movable} container={movable.getContent()} />;
    if (type !== 'shape') return <></>;
    return <ShapeEditor {...rest} movable={movable} shape={movable.getContent<IShape>()} debugGeometry={debugGeometry} />;
  }, [debugGeometry]);

  return (
    <div className="storybook-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 'none', font: '12px system-ui, sans-serif', padding: '4px 6px' }}>
        {placed ? `${SHAPES.length} shapes` : 'placing shapes…'} · select one and drag its yellow handle · Ctrl+wheel zooms
      </div>
      <WorksheetElement
        style={{ flex: 1, minHeight: 0 }}
        sheet={sheet}
        renderMovable={renderMovable}
      />
    </div>
  );
};

export const SheetShapes = asStory(Template);
SheetShapes.storyName = 'Shapes in a sheet';
SheetShapes.args = { debugGeometry: false };

const Story = {
  title: 'Shapes',
  component: SheetShapes,
  argTypes: {
    debugGeometry: { control: 'boolean', description: 'Draw each geometry\'s text rectangle (red) and connection sites (green).' },
  },
};
export default Story;
