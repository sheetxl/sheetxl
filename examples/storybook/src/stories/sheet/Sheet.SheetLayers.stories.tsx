import React, { useMemo } from 'react';

import { Workbook, type ICellRange, type IWorkbook } from '@sheetxl/sdk';

import { CellInsertLayer, SheetLayers, WorkbookElement, useGridSurface } from '@sheetxl/react';
import { Layer, VirtualDiv } from '@sheetxl/grid-react';

import { asStory } from '../../components';

const createWorkbook = (): IWorkbook => {
  const workbook = new Workbook();
  const sheet = workbook.getWorksheetAt(0);
  sheet.getRange('B2:D6').setValues([
    ['Item', 'Qty', 'Price'],
    ['Apples', 4, 1.2],
    ['Pears', 2, 1.5],
    ['Plums', 6, 0.8],
    ['Figs', 3, 2.4]
  ]);
  sheet.getRange('B2:D6').addTable(true).setName('Fruit');
  return workbook;
};

const frame: React.CSSProperties = { position: 'relative', height: 420, width: '100%' };

/**
 * Insert buttons in both header strips: hover a row (column) header near a border, then the button.
 * Left alone, the layer inserts entire rows (columns).
 */
const InsertButtonsTemplate: React.FC = () => {
  const workbook = useMemo(createWorkbook, []);
  return (
    <div style={frame}>
      <WorkbookElement workbook={workbook}>
        <SheetLayers surface={['rowHeaders', 'cells']}>
          <CellInsertLayer axis="row" />
        </SheetLayers>
        <SheetLayers surface={['columnHeaders', 'cells']}>
          <CellInsertLayer axis="column" />
        </SheetLayers>
      </WorkbookElement>
    </div>
  );
};

export const InsertButtons = asStory(InsertButtonsTemplate);
InsertButtons.storyName = 'Insert buttons';

/**
 * The same layer narrowed by `resolve`: the button is offered only beside the table's body, and an
 * insert covers only the table's columns.
 */
const resolveTableRow = (row: ICellRange): ICellRange | null => {
  const table = row.getWorksheet().getTables().getItems({ name: 'Fruit', address: row })[0];
  // The border above the header row is outside the table.
  if (!table || row.getCoords().rowStart === table.getRange().getCoords().rowStart) return null;
  return row.getIntersect(table.getRange());
};

const InsertIntoTableTemplate: React.FC = () => {
  const workbook = useMemo(createWorkbook, []);
  return (
    <div style={frame}>
      <WorkbookElement workbook={workbook}>
        <SheetLayers surface={['rowHeaders', 'cells']}>
          <CellInsertLayer resolve={resolveTableRow} />
        </SheetLayers>
      </WorkbookElement>
    </div>
  );
};

export const InsertIntoTable = asStory(InsertIntoTableTemplate);
InsertIntoTable.storyName = 'Insert into a table';

/**
 * A layer of your own on two surfaces: a marker in the row header and a band across the cells, for
 * one row. `useGridSurface` tells each copy which part it draws.
 */
const FlaggedRow: React.FC<{ row: number }> = ({ row }) => {
  const surface = useGridSurface();
  if (surface === 'rowHeaders') {
    return (
      <Layer>
        <VirtualDiv
          range={{ rowStart: row, colStart: 0, rowEnd: row, colEnd: 0 }}
          style={{ pointerEvents: 'none', borderLeft: '4px solid #e8a33d' }}
        />
      </Layer>
    );
  }
  if (surface === 'cells') {
    return (
      <Layer>
        <VirtualDiv
          range={{ rowStart: row, colStart: 0, rowEnd: row, colEnd: 25 }}
          style={{ pointerEvents: 'none', background: 'rgba(232, 163, 61, 0.15)' }}
        />
      </Layer>
    );
  }
  return null;
};

const AcrossSurfacesTemplate: React.FC = () => {
  const workbook = useMemo(createWorkbook, []);
  return (
    <div style={frame}>
      <WorkbookElement workbook={workbook}>
        <SheetLayers surface={['rowHeaders', 'cells']}>
          <FlaggedRow row={3} />
        </SheetLayers>
      </WorkbookElement>
    </div>
  );
};

export const AcrossSurfaces = asStory(AcrossSurfacesTemplate);
AcrossSurfaces.storyName = 'A layer across surfaces';

const Story = {
  title: 'Sheet/Sheet Layers',
  component: SheetLayers
};
export default Story;
