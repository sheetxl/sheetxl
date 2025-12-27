import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { DOMParser } from '@xmldom/xmldom';

import { FromOOXMLConverter } from '../handlers/xlsx/ooxml-converter/FromOOXMLConverter';

// import { Color } from '@sheetxl/sdk';

describe("ioService", () => {

  // it("Read All Default Themes", () => {
  //   /** Used for scrapping themes */
  //   return;

  //   const loadThemeJSON = (themeName:string) => {
  //     const location = path.resolve(__dirname, `../data/themes/${themeName}.xml`);
  //     const buffer:ArrayBuffer = fs.readFileSync(location, {flag:'r'});
  //     const asXMLString = new TextDecoder().decode(buffer);
  //     const xmlDoc = new DOMParser().parseFromString(asXMLString, 'text/xml')
  //     const asJSON = new FromOOXMLConverter().convert(xmlDoc, location);
  //     return asJSON;
  //   }

  //   const printThemeColors = (themeName:string) => {
  //     const asJSON = loadThemeJSON(themeName);
  //     const keys = [
  //       'dk1',
  //       'lt1',
  //       'dk2',
  //       'lt2',
  //       'accent1',
  //       'accent2',
  //       'accent3',
  //       'accent4',
  //       'accent5',
  //       'accent6',
  //       'hlink',
  //       'folHlink',
  //     ];
  //     let retValue = `["${asJSON.colors.name}", `;
  //     for (let i=0; i<keys.length; i++) {
  //       const key = keys[i];
  //       const color = Color.parse(asJSON.colors[key]);
  //       const asString = color.toString();
  //       retValue += `"${asString}"`;
  //       if (i < keys.length - 1) {
  //         retValue += `, `;
  //       }
  //     }
  //     retValue += `]`;
  //     return retValue;
  //   }

  //   const _printThemeFonts = (themeName:string) => {
  //     const asJSON = loadThemeJSON(themeName);

  //     return `["${asJSON.fonts.name}", "${asJSON.fonts.majorFont}", "${asJSON.fonts.minorFont}"]`;
  //   }

  //   const _printThemeSummary = (themeName: string) => {
  //     const asJSON = loadThemeJSON(themeName);

  //     return `["${themeName}", "${asJSON.colors.name}", "${asJSON.fonts.name}"]`;
  //   }

  //   const themes = [
  //     'Atlas',
  //     'Banded',
  //     'Basis',
  //     'Berlin',
  //     'Celestial',
  //     'Circuit',
  //     'Damask',
  //     'Depth',
  //     'Dividend',
  //     'Droplet',
  //     'Facet',
  //     'Frame',
  //     'Gallery',
  //     'Integral',
  //     'Ion Boardroom',
  //     'Ion',
  //     'Madison',
  //     'Main Event',
  //     'Mesh',
  //     'Metropolitan',
  //     // 'Office Theme',
  //     'Organic',
  //     'Parallax',
  //     'Parcel',
  //     'Quotable',
  //     'Retrospect',
  //     'Savon',
  //     'Slate',
  //     'Slice',
  //     'Vapor Trail',
  //     'View',
  //     'Wisp',
  //     'Wood Type'
  //   ];
  //   let all = ``;
  //   for (let i=0; i<themes.length; i++) {
  //     let results = printThemeColors(themes[i]);
  //     // let results = printThemeFonts(themes[i]);
  //     // let results = printThemeSummary(themes[i]);
  //     all += results;
  //     if (i < themes.length - 1) {
  //       all += `,\n`;
  //     }
  //   }

  //   console.log(all);
  //   expect(true).toBe(true);
  // });

  it("Read OOXML Theme", () => {
    const location = path.resolve(__dirname, './data/theme.xml');
    const buffer:ArrayBuffer = fs.readFileSync(location, {flag:'r'}) as any;
    const asXMLString = new TextDecoder().decode(buffer);
    const xmlDoc = new DOMParser().parseFromString(asXMLString, 'text/xml')
    const asJSON = new FromOOXMLConverter().convert(xmlDoc as any, location);

    expect(asJSON).toBeDefined();
    // writes test output to the repo root. uncomment if interested
    // fs.writeFileSync(path.resolve(__dirname, '../../../tmp/theme.json'), JSON.stringify(asJSON, null, 2));
  });

});