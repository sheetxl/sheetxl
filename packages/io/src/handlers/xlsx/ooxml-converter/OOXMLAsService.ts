// import { DAGM } from '@sheetxl/sdk';

// import { ChartShape } from '@sheetxl/sdk';
import type { IWorkbook } from '@sheetxl/sdk';

// import ToOOXMLConverter from './ToOOXMLConverter';

export const toOOXMLFromJson = function(_json: any = {}, workbookJSON: IWorkbook.JSON, _options: any = {}) {

  // let workbookDagm = null;//new MultiSheet(Workbook(workbookJSON));
  // let chartShapeOptions = {
  //   range: null,
  //   sheet: workbookDagm
  // };
  // if (options?.chartShape)
  //   Object.assign(chartShapeOptions, options.chartShape);

  // let chartShape = DAGM.newFromJSON(
  //   json,
  //   () => {
  //     return new ChartShape(chartShapeOptions);
  //   }
  // );

  // // TODO - make this more generic as it only works with charts
  // let converter = new ToOOXMLConverter();
  // let ooxml = converter.convert(chartShape, options);
  // return ooxml;
  return null;
}

export const fromOOXMLToJson = function(_xml: string, _options?: any) {
  // TODO - use this.
  // const xmlDoc = new DOMParser().parseFromString(xml, 'text/xml')
  // const asJSON = new FromOOXMLConverter().convert(xmlDoc, null);
  // const asString = JSON.stringify(asJSON, null, 2);
  return {};
}
