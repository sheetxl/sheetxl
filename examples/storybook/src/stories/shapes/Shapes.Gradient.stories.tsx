import React, { useCallback, useEffect, useReducer, useState } from 'react';

import { IFill, type IMovable, type IShape, Worksheet, type ITextFrame } from '@sheetxl/sdk';

import { type MovableElementProps, WorksheetElement } from '@sheetxl/react';
import { ShapeEditor } from '@sheetxl/react/shape';

import { ExhibitFloatProvider } from '@sheetxl/utils-mui';

import { GradientEditor, toGradientValue, type GradientValue, registerStudioCommandCatalogs } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

// The editor's strings are the studio's; outside a Studio, the story registers them itself.
registerStudioCommandCatalogs();

/**
 * **Gradient fills on shapes.** Each shape states a gradient the way a cell does — `0…1` stop
 * offsets and the CSS angle (0 up, 90 right) — and the renderer lays it over the shape's frame as
 * an SVG gradient: linear at any angle, `scaled` or not (DrawingML's `lin/@scaled`: a scaled 45°
 * runs corner to corner), radial from a focus, and a gradient line. The editor on the right is the
 * Format pane's, bound to the first shape: drag a stop, press one for its color, press the ramp or
 * `+` for a new stop.
 */

const text = (lines: string[]): ITextFrame.JSON => ({ paragraphs: lines.map((line) => ({ runs: [{ text: line }] })) });

const gradient = (angle: number, extra?: Partial<IFill.GradientJSON>): IFill.GradientJSON => ({
  type: IFill.Type.Gradient,
  angle,
  stops: [{ offset: 0, color: 'ffffff' }, { offset: 1, color: '4472c4' }],
  ...extra,
});

type Placement = { json: IShape.JSON; bounds: { x: number; y: number; width: number; height: number } };

const SHAPES: Placement[] = [
  { json: { geometry: 'roundRect', fill: gradient(90), text: text(['edit me']) }, bounds: { x: 30, y: 30, width: 200, height: 100 } },
  { json: { geometry: 'rect', fill: gradient(180), text: text(['180°']) }, bounds: { x: 260, y: 30, width: 200, height: 100 } },
  { json: { geometry: 'rect', fill: gradient(135, { scaled: true }), text: text(['135° scaled']) }, bounds: { x: 490, y: 30, width: 200, height: 100 } },
  { json: { geometry: 'rect', fill: gradient(135, { scaled: false }), text: text(['135° unscaled']) }, bounds: { x: 720, y: 30, width: 200, height: 100 } },
  {
    json: {
      geometry: 'ellipse',
      fill: gradient(0, { gradientType: IFill.GradientType.Path, focus: { left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 } }),
      text: text(['radial']),
    },
    bounds: { x: 30, y: 160, width: 200, height: 120 },
  },
  {
    json: {
      geometry: 'rect',
      fill: gradient(0, { gradientType: IFill.GradientType.Path }),
      text: text(['radial, no focus']),
    },
    bounds: { x: 260, y: 160, width: 200, height: 120 },
  },
  {
    json: {
      geometry: 'star5',
      fill: { type: IFill.Type.Gradient, angle: 90, stops: [{ offset: 0, color: 'ffc000' }, { offset: 0.5, color: 'ff0000' }, { offset: 1, color: '7030a0' }] },
    },
    bounds: { x: 490, y: 160, width: 140, height: 130 },
  },
  {
    json: {
      geometry: 'rect',
      fill: { type: IFill.Type.None },
      stroke: { width: 8, fill: gradient(90, { stops: [{ offset: 0, color: 'ff0000' }, { offset: 1, color: '0000ff' }] }) },
      text: text(['gradient line']),
    },
    bounds: { x: 660, y: 160, width: 260, height: 120 },
  },
];

/**
 * The first shape's gradient in the Format pane's editor, applying live. With `deferredApply`,
 * the editor is re-rendered at once with the stops it still has and the write lands a tick later
 * — the order a host with a deferred model notification produces, which the editor must ride out.
 */
const BoundEditor: React.FC<{ shape: IShape; deferredApply: boolean }> = ({ shape, deferredApply }) => {
  const [, refresh] = useReducer((s: number) => s + 1, 0);
  useEffect(() => shape.addListeners({ onAnyChange: refresh }), [shape]);
  const fill = shape.getStyle().getFill();
  if (fill.getType() !== IFill.Type.Gradient) return <div>not a gradient</div>;
  return (
    <GradientEditor
      value={toGradientValue(fill as IFill.IGradient)}
      onChange={(value: GradientValue) => {
        const apply = (): void => {
          shape.getStyle().setFill({
            type: IFill.Type.Gradient,
            gradientType: value.gradientType,
            angle: value.angle,
            stops: value.stops.map((stop) => ({ offset: stop.offset, color: stop.color })),
          });
        };
        if (!deferredApply) { apply(); return; }
        refresh();
        setTimeout(apply, 30);
      }}
    />
  );
};

interface StoryArgs {
  deferredApply: boolean;
}

const Template: React.FC<StoryArgs> = ({ deferredApply }) => {
  const [sheet] = useState(() => new Worksheet());
  const [first, setFirst] = useState<IShape | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      let firstShape: IShape | null = null;
      for (const p of SHAPES) {
        const movable: IMovable = await sheet.getMovables().add({ type: 'shape', json: p.json, bounds: p.bounds } as any);
        firstShape ??= movable.getContent<IShape>();
      }
      if (live) setFirst(firstShape);
    })();
    return () => { live = false; };
  }, [sheet]);

  const renderMovable = useCallback((props: MovableElementProps) => {
    const { movable, ...rest } = props;
    if (!movable || movable.getContent().getType() !== 'shape') return <></>;
    return <ShapeEditor {...rest} movable={movable} shape={movable.getContent<IShape>()} />;
  }, []);

  return (
    <ExhibitFloatProvider>
      <div className="storybook-container" style={{ display: 'flex', height: '100%' }}>
        <WorksheetElement style={{ flex: 1, minWidth: 0 }} sheet={sheet} renderMovable={renderMovable} />
        <div className="gradient-pane" style={{ flex: 'none', width: 320, padding: 12, boxSizing: 'border-box', borderLeft: '1px solid #ddd' }}>
          {first ? <BoundEditor shape={first} deferredApply={deferredApply} /> : 'placing shapes…'}
        </div>
      </div>
    </ExhibitFloatProvider>
  );
};

export const Gradients = asStory(Template);
Gradients.storyName = 'Gradient fills';
Gradients.args = { deferredApply: false };

const Story = {
  title: 'Shapes',
  component: Gradients,
  argTypes: {
    deferredApply: { control: 'boolean', description: 'Re-render the editor before the write lands, as a host with deferred model notifications does.' },
  },
};
export default Story;
