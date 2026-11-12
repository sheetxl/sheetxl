import React, { useEffect, useMemo, useState } from 'react';

import { Workbook, type IWorkbook, type IWorksheet } from '@sheetxl/sdk';

import {
  WorkbookElement, RangeAnnotationLayer, addRangeAnnotations, clearRangeAnnotations, nextRangeAnnotation,
  prevRangeAnnotation, hoverRangeAnnotation, unhoverRangeAnnotation, useRangeAnnotations,
  type WorksheetElementProps
} from '@sheetxl/react';

import { asStory } from '../../components';

/**
 * **`RangeAnnotationLayer` — an agent's findings as boxes + tags that never get lost.** A prebuilt
 * layer the host injects through the sheet's `layers` (it is not part of the default stack).
 *
 * `addRangeAnnotations(workbook, intent, ranges)` is what the MCP `highlight` tool calls. Each call is
 * a **walk**. A tag is a pointer on the range's corner and its review number; the current one, and
 * the one under the pointer, grow into the card (label, walk arrows, dismiss). Hover is shared: rest
 * on a row in the list at the right and the tag on the grid opens too, and the other way round.
 *
 * The tag is a `StickyPortal` with `whenOff: 'clamp'`: scroll a finding off-screen and its tag does
 * not vanish — it waits at the edge with its pointer turned toward the range (click reveals it).
 * While the range is only partly obstructed (its top under the header), the tag **flips** to the
 * range's visible bottom edge rather than sliding over the header.
 */

const seed = (sheet: IWorksheet): void => {
  sheet.getRange('B2:D2').setValues([['Region', 'Units', 'Revenue']]);
  sheet.getRange('B3:D6').setValues([['East', 10, 100], ['West', 20, 250], ['North', 15, 175], ['South', 12, 140]]);
  sheet.getRange('B8:D8').setValues([['Total', '=SUM(C3:C6)', '=SUM(D3:D6)']]);
  sheet.getRange('F2:H2').setValues([['Month', 'Plan', 'Actual']]);
  sheet.getRange('F3:H8').setValues([
    ['Jan', 100, 98], ['Feb', 100, 104], ['Mar', 100, 87], ['Apr', 100, 112], ['May', 100, 99], ['Jun', 100, 0]
  ]);
  sheet.getRange('F40').setValue('far below');
  sheet.getRange('T8').setValue('far right');
};

const Template: React.FC<{ seedWalk?: boolean }> = ({ seedWalk = true }) => {
  // Stable: the layer reads the store itself, so the sheet props never change identity.
  const propsSheet = useMemo<Partial<WorksheetElementProps>>(() => ({
    layers: [<RangeAnnotationLayer key="annotations" />]
  }), []);
  const workbook = useMemo<IWorkbook>(() => {
    const wb = new Workbook();
    seed(wb.getSelectedWorksheet()!);
    // For a script driving the story from outside (a headless check scrolls by pixels this way).
    (window as unknown as { __sxlAnnotationsStory?: { workbook: IWorkbook } }).__sxlAnnotationsStory = { workbook: wb };
    return wb;
  }, []);
  const { navigable, position, annotations, current, hovered } = useRangeAnnotations(workbook);
  const [walks, setWalks] = useState<number>(0);

  const sheetName = workbook.getWorksheet().getName();
  const q = (addr: string): string => `'${sheetName}'!${addr}`;

  const review = (): void => {
    setWalks((n) => n + 1);
    addRangeAnnotations(workbook, 'finding', [
      { range: q('B2:D6'), label: `Walk ${walks + 1}: the regions table. Units and revenue agree with the source except North, whose revenue looks like it was typed in thousands.` },
      { range: q('H5'), label: 'March actual is 13% under plan.' },
      { range: q('H6'), label: 'April actual is 12% over plan — the two months may be a timing shift.' },
      { range: q('H8'), label: 'June has no actual yet; the total below treats it as zero.' },
      { range: q('F40'), label: 'A value far below — scroll to see the tag wait at the edge.' },
      { range: q('T8'), label: 'A value far right.' }
    ]);
  };
  const question = (): void => {
    addRangeAnnotations(workbook, 'question', [
      { range: q('D3:D6'), label: 'Is revenue in thousands?' },
      { range: q('C8:D8'), label: 'Should the totals include the pending June row?' }
    ]);
  };
  // The agent's cursor: a box alone, or with a word on what it is doing (every other click).
  const [workingLabeled, setWorkingLabeled] = useState(false);
  const working = (): void => {
    const row = 3 + Math.floor(Math.random() * 4);
    addRangeAnnotations(workbook, 'working', [{ range: q(`B${row}:D${row}`), label: workingLabeled ? 'Checking this row against the source' : undefined }]);
    setWorkingLabeled((v) => !v);
  };

  // A walk on first paint, so the story opens on something to look at.
  useEffect(() => {
    if (seedWalk) review();
  }, []);

  const btn: React.CSSProperties = { font: '12px system-ui', padding: '3px 10px', borderRadius: 4, border: '1px solid #bbb', background: '#f4f4f6', cursor: 'pointer' };

  return (
    <div className="storybook-container" style={{ height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 6px', flexWrap: 'wrap', font: '12px monospace', color: '#555' }}>
          <button style={btn} onClick={review}>finding walk</button>
          <button style={btn} onClick={question}>question</button>
          <button style={btn} onClick={working}>working cursor</button>
          <button style={btn} onClick={() => prevRangeAnnotation(workbook)}>↑ prev</button>
          <button style={btn} onClick={() => nextRangeAnnotation(workbook)}>↓ next</button>
          <button style={btn} onClick={() => clearRangeAnnotations(workbook)}>clear</button>
          <span>{annotations.length} annotations · {position}/{navigable.length}</span>
        </div>
        <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, gap: 6 }}>
          <WorkbookElement workbook={workbook} propsSheet={propsSheet} style={{ flex: '1 1 auto', height: '100%' }} />
          {/* A host's list of the same annotations: hover is shared with the grid. */}
          <ol
            data-testid="annotation-list"
            style={{ width: 220, margin: 0, padding: '4px 0 4px 24px', font: '12px system-ui', color: '#333', overflow: 'auto' }}
          >
            {navigable.map((a) => (
              <li
                key={a.id}
                data-annotation-id={a.id}
                onPointerEnter={() => hoverRangeAnnotation(workbook, a.id)}
                onPointerLeave={() => unhoverRangeAnnotation(workbook, a.id)}
                style={{
                  padding: '3px 6px', borderRadius: 4, cursor: 'default',
                  background: a === hovered ? '#eef3ff' : 'transparent',
                  outline: a === current ? '2px solid rgb(38,150,90)' : 'none'
                }}
              >
                <span style={{ color: '#888' }}>{a.range.slice(a.range.indexOf('!') + 1)}</span>
                {a.label ? <span> — {a.label.length > 48 ? `${a.label.slice(0, 48)}…` : a.label}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export const Annotations = asStory(Template);
Annotations.storyName = 'Range annotations (boxes, tags, edge marker)';

const Story = {
  title: 'Float',
  component: Annotations
};
export default Story;
