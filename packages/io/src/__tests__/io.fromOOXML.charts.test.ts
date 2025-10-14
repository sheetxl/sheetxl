import { describe, expect, it } from 'vitest';

import * as path from 'path';
import * as fs from 'fs'; // for write outputs

import { DOMParser } from '@xmldom/xmldom';

import { FromOOXMLConverter } from '../handlers/xlsx/ooxml-converter/FromOOXMLConverter';

describe("ioService", () => {

  it("Read OOXML Chart", () => {
    // const asString:string = fs.readFileSync(path.resolve(__dirname, '../data/simple-chart.xml'), {flag:'r', encoding:'ucs2'});
    // let asJSON = asXMLString
    // const asOut:ArrayBuffer = new TextEncoder().encode(JSON.stringify(asJson, null, 2));

    const location = path.resolve(__dirname, './data/simple-chart-utf8.xml');
    const buffer:ArrayBuffer = fs.readFileSync(path.resolve(__dirname, './data/simple-chart-utf8.xml'), {flag:'r'}) as any;
    const asXMLString = new TextDecoder().decode(buffer);
    const xmlDoc = new DOMParser().parseFromString(asXMLString, 'text/xml') as unknown as Document;
    const asJSON = new FromOOXMLConverter().convert(xmlDoc, location);

    expect(asJSON).toBeDefined();
    // writes test output to the repo root. uncomment if interested
    // fs.writeFileSync(path.resolve(__dirname, '../../../tmp/visit.json'), JSON.stringify(asJSON, null, 2));
  });


});