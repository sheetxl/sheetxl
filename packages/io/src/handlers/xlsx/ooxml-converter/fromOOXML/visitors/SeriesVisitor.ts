import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { parseValAttrAsInteger, parseValAttrAsBoolean } from '../VisitorUtils';

import * as OOXMLVisitorUtils from './OOXMLVisitorUtils';

export class SeriesVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, _jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonSeries: any/*JSON*/ = {};
    //TODO test : c:explosion
    parseValAttrAsInteger(context, elemParent, jsonSeries, "explosion", "explosion");

    let elemXRange: Element = context.evaluate("cat/*/f", elemParent) as Element;
    if (!elemXRange) {
      elemXRange = context.evaluate("xVal/*/f", elemParent) as Element;
    }

    let xRange: string = null;
    if (elemXRange !== null && elemXRange.firstChild !== null) {
      xRange = elemXRange.firstChild.nodeValue;
    }

    if (!elemXRange) {
      elemXRange = context.evaluate("cat/strLit", elemParent) as Element;
      if (!elemXRange)
        elemXRange = context.evaluate("cat/numLit", elemParent) as Element;
      if (elemXRange)
        xRange = this.parsePointsAsString(context, elemXRange);
      // TODO - check for filtered literals, these are all stored in the cache. - pretty hacky in office
    }

    if (xRange !== null) {
      jsonSeries.xRange = xRange;
    }

    let elemValRange: Element = context.evaluate("val/*/f", elemParent) as Element;
    if (!elemValRange) {
      elemValRange = context.evaluate("yVal/*/f", elemParent) as Element;
    }

    let valRange: string = null;
    if (elemValRange && elemValRange.firstChild) {
      valRange = elemValRange.firstChild.nodeValue;
    }

    if (!elemValRange) {
      elemValRange = context.evaluate("val/numLit", elemParent) as Element;
      if (elemValRange !== null)
        valRange = this.parsePointsAsString(context, elemValRange);
      // TODO - check for filtered literals, these are all stored in the cache. - pretty hacky in office
    }

    if (valRange !== null) {
      jsonSeries.valRange = valRange;
    }

    this.parseTitleRangeOrValue(context, elemParent, jsonSeries);
    parseValAttrAsInteger(context, elemParent, jsonSeries, "idx", "idx");
    parseValAttrAsBoolean(context, elemParent, jsonSeries, "smooth", "smooth");
    //offsetChart is the index of the last ChartType element in types array
    const chartTypes: any[] = context.getVisitorParamsState().get("types");
    const offsetChart: number = chartTypes.length-1;
    jsonSeries.offsetChart = offsetChart;

    // add to series map
    let jsonSeriesArray: any[] = context.getVisitorParamsState().get("series");
    if (!jsonSeriesArray) {
      jsonSeriesArray = [];
      context.getVisitorParamsState().set("series", jsonSeriesArray);
    }
    jsonSeriesArray.push(jsonSeries);

    return jsonSeries;
  }

  parseTitleRangeOrValue(context: ExecutionContext, elemParent: Element, jsonSeries: any/*JSON*/): void {
    const elemTitleRange: Element = context.evaluate("tx/strRef/f", elemParent) as Element;
    if (elemTitleRange !== null) {
      const titleRange: string = elemTitleRange.firstChild.nodeValue;
      context.setToPath(jsonSeries, "title.range", titleRange);
    } else {//parse node title value
      const nodeTitleValue: Element = context.evaluate("tx/v", elemParent) as Element;
      if (nodeTitleValue !== null) {
        context.setToPath(jsonSeries, "title.text.simpleRun", nodeTitleValue.firstChild.nodeValue);
      }
    }
  }

  parsePointsAsString(context: ExecutionContext, elemParent: Element): string {
    let retValue: string = "{";
    const pointCount: number = context.getValAttrAsInteger("ptCount", elemParent);
    const points: Element = context.evaluate("pt", elemParent) as Element;
    const listPoints: any[] = [];
    for (let i=0; points && pointCount && i<pointCount; i++ ) {
      let value: string = null;
      // TODO - refactor this to not use evalulate but instead all children directly
      let point: Element = context.evaluate("pt[@idx='" + i + "']/v", elemParent) as Element;
      if (point instanceof Node)
        value = (point as Node).textContent;
      listPoints[i] = value;
    }
    for (let i=0; i<listPoints.length; i++) {
      if (i > 0) retValue += ",";
      if (listPoints[i] !== undefined)
        retValue += listPoints[i];
    }
    retValue += "}";

    return retValue;
  }

  afterVisit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    OOXMLVisitorUtils.parseInvertIfNegative(context, elemParent, jsonParent);

    let jsonPoints: any/*JSON*/ = context.getFromPath(jsonParent, "points");
    if (jsonPoints) {
      const indxs = Object.keys(jsonPoints);
      for (let i=0; i<indxs.length; i++) {
        const indx = indxs[i];
        const point: any/*JSON*/ = context.getFromPath(jsonPoints, indx);
        if (!point)
          continue;
        let pointMarker: any/*JSON*/ = context.getFromPath(point, "markers");
        if (!pointMarker)
          continue;

        context.setToPath(jsonParent, "markers.points." + indx, pointMarker);
        delete point.markers;
      }
      // TODO - scan for empty points
    }
    // TODO - if points empty remove
  }

}