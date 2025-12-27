import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { ISheet } from '@sheetxl/sdk';

import { SaxParser } from '../sax/SaxParser';

import { createSheetSaxVisitor } from '../handlers/xlsx/ooxml-converter/fromOOXML/saxVisitors/SheetVisitor';
import { arrayBufferToStringStream } from '../handlers/xlsx/ooxml-converter/UtilsOOXML';

/**
 * Testing SAX
 */
describe("SAX", () => {

  it("OutOfOrder", async () => {

    const sheetJSON: ISheet.JSON = {};
    const eventHandler:SaxParser.EventHandler = createSheetSaxVisitor(sheetJSON, () => null, () => -1);

    const arrayBuffer:NonSharedBuffer = fs.readFileSync(path.resolve(__dirname, './data/simple-sheet.xml'), {flag:'r'});
    const asReader = await arrayBufferToStringStream(arrayBuffer);

    try {
      await SaxParser.parseStream(asReader, eventHandler, {
        xmlns: false
      });
    } catch (error: any) {
      console.warn(`Error parsing sheet`, error);
    }

    // const boundedTuples: any = tupleBuilder.build(); // IGrid.BoundedTuples
    // if (boundedTuples) {
    //   const tuples: any = boundedTuples.tuples;
    //   const bounds: any = boundedTuples.bounds;
    //   console.log('read data', tuples, bounds);
    //   // placeholder.data = tuples;
    //   return boundedTuples;
    // }
    expect(true).toEqual(true);
  });

  it("Simple", async () => {

    const eventHandler:SaxParser.EventHandler = createSheetSaxVisitor({}, () => null, () => -1);

    const arrayBuffer:NonSharedBuffer = fs.readFileSync(path.resolve(__dirname, './data/simple-sheet.xml'), {flag:'r'});
    const asReader = await arrayBufferToStringStream(arrayBuffer);

    await SaxParser.parseStream(asReader, eventHandler);

    // const boundedTuples: any = tupleBuilder.build(); // IGrid.BoundedTuples
    // if (boundedTuples) {
    //   const tuples: any = boundedTuples.tuples;
    //   const bounds: any = boundedTuples.bounds;
    //   console.log('read data', tuples, bounds);
    //   // placeholder.data = tuples;
    //   return boundedTuples;
    // }
    expect(true).toEqual(true);
  });

});