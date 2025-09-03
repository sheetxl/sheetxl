import { describe, expect, it } from 'vitest';

// import fs from 'fs'; // for write outputs

// import { DAGM } from '@sheetxl/sdk';

// import { CellRange } from '@sheetxl/sdk';
// import { Workbook } from '@sheetxl/sdk';
// import { MultiSheet } from '@sheetxl/sdk';

// // import { ChartShape } from '@sheetxl/sdk';

// import SIMPLE_JSON, { data } from '../data/simple-dispUnits-chart';

// import { FromOOXMLConverter } from '../handlers/xlsx/ooxml-converter/ToOOXMLConverter';

describe("ioService", () => {
  it("Write OOXML Chart", () => {

    // const testData = data;
    //console.log(testData);
    // const workbookJSON = {
    //   "sheets": [
    //     {
    //       "name": "Sheet1",
    //       "sheet": {
    //         "cells" : data,
    //       }
    //     }
    //   ]
    // }

    // let sheet = new MultiSheet(new Workbook(workbookJSON));
    // sheet.getPropertyAt('Sheet1', 1,1);
    // let chartJson =  SIMPLE_JSON;
    // let chartShape = DAGM.newFromJSON(
    //   chartJson,
    //   () => {
    //     return new ChartShape({
    //       range: CellRange.createRangeFrom2DArray(data),
    //       sheet
    //     });
    //   }
    // );

    // let converter = new ToOOXMLConverter();
    // let retValue = converter.convert(chartShape, { prettify: true });

    // expect(retValue !== null).toBe(true);

    // uncomment if interested
    // fs.writeFileSync('/tmp/visit2.xml', retValue);
  });

});