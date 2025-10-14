import { describe, expect, it } from 'vitest';

// import * as XLSXTypes from 'xlsx/types'; // need for typescript. Should tree shake?
import * as XLSX from 'xlsx';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { DOMParser } from '@xmldom/xmldom';

import { ISheet, Theme } from '@sheetxl/sdk';

import { SaxParser } from '../sax';

import { FromOOXMLConverter } from '../handlers/xlsx/ooxml-converter/FromOOXMLConverter';
import { ConvertFromOptions } from '../handlers/xlsx/ooxml-converter/OOXMLTypes';
import { readAsJSONs, readAsBinary, arrayBufferToStringStream } from '../handlers/xlsx/ooxml-converter/UtilsOOXML';
import { createSheetSaxVisitor } from '../handlers/xlsx/ooxml-converter/fromOOXML/saxVisitors/SheetVisitor';

/**
 *
 * Apache POI has a lot of test data:
 *
 * https://svn.apache.org/repos/asf/poi/trunk/test-data/spreadsheet/
 *
 * SheetJS has a lot of test data too:
 */
describe("Excel Import/Export", () => {
  it("Import SAX", async () => {
    const array = fs.readFileSync(path.resolve(__dirname, './xlsx/smallest.xlsx'), {flag:'r'});//.buffer;

    const xlsxWB = XLSX.read(array, {
      type: 'array',
      sheets: [], // prevent xlsx from processing sheets as we do this ourselves
      cellStyles: false, // generate styles
      bookFiles: true, // add raw files to book object
      // password, // pass as option in above

      // cellDates: false, // Store dates as type d
      // cellNF: false, // Save number format string to the .z field
      // cellText: false, // Generate formatted text to the .w field
    });

    const getXLSXFile = (loc: string) => (xlsxWB as any).files[loc];

    const sheetJSON: ISheet.JSON = { merges: [] };
    const eventHandler:SaxParser.EventHandler = createSheetSaxVisitor(sheetJSON,
      (_relId: string, _asBinary: boolean=false): any => {
        return null;//getRef(relId, pathTarget, asBinary) ?? null;
      },
      (_str: string): number => {
        return 0;
      },
      // () => {
      // // console.log('read end');
      // }
    );
    const asArray = readAsBinary('xl/worksheets/sheet1.xml', getXLSXFile);
    const asReader = await arrayBufferToStringStream(asArray);
    await SaxParser.parseStream(asReader, eventHandler);

    expect(sheetJSON).toBeDefined();
  });


  // it("Import 2 Tables", async () => {
  //   const array = fs.readFileSync(path.resolve(__dirname, './xlsx/2tables.xlsx'), {flag:'r'});//.buffer;

  //   const workbook:IWorkbook = await fromBufferXLSX(array);
  //   const asJSOn:IWorkbook.JSON = await workbook.toJSON();
  //   expect(asJSOn).toBeDefined();
  // });


  it("Import", async () => {
    const array = fs.readFileSync(path.resolve(__dirname, './xlsx/styled.xlsx'), {flag:'r'});//.buffer;

    const xlsxWB = XLSX.read(array, {
      type: 'array',
      sheets: [], // prevent xlsx from processing sheets as we do this ourselves
      cellStyles: false, // generate styles
      bookFiles: true, // add raw files to book object
      // password, // pass as option in above

      // cellDates: false, // Store dates as type d
      // cellNF: false, // Save number format string to the .z field
      // cellText: false, // Generate formatted text to the .w field
    });

    const fromOOXMLConverter = new FromOOXMLConverter();
    const domParser = new DOMParser();
    const jsonThemes = readAsJSONs('themes', xlsxWB, domParser as any, fromOOXMLConverter);

    // We do this so that we can allow styles to resolve tinted colors
    const theme = new Theme(jsonThemes.entries().next().value[1]);
    const paramMap = new Map<string, any>();
    paramMap.set('parseColor', (str: string) => {
      return theme.parseColor(str);
    });
    const options:ConvertFromOptions = {
      paramMap
    }
    const jsonStyles = readAsJSONs('styles', xlsxWB, domParser as any, fromOOXMLConverter, options);

    // TODO - in the future allow sheets to be dynamically loaded
    //. TODO readAsJSON is not delegating to SAX parser. Clean this up
    // const jsonSheets = readAsJSONs('sheets', xlsxWB, domParser as any, fromOOXMLConverter);

    expect(jsonStyles).toBeDefined();
    expect(jsonThemes).toBeDefined();
    // expect(jsonSheets).toBeDefined();
  });



});