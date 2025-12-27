import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class ChartTypeVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, _jsonParent: any/*JSON*/): any/*JSON*/ {
    let jsonChartType: any/*JSON*/ = {};

    VisitorUtils.parseValAttrAsString(context, elemParent, jsonChartType, "grouping", "grouping");
    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonChartType, "varyColors", "varyColors");
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonChartType, "gapWidth", "gapWidth", .01/*multiplier*/);
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonChartType, "overlap", "overlap", .01/*multiplier*/);
    this.parseType(context, elemParent, jsonChartType);
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonChartType, "bubbleScale", "bubbleScale");
    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonChartType, "showNegBubbles", "showNegativeBubbleValues");
    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonChartType, "sizeRepresents", "bubbleSizeRepresentsWidth");
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonChartType, "firstSliceAng", "startAngle");
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonChartType, "holeSize", "holeSize");
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonChartType, "scatterStyle", "scatterStyle");
    //TODO: c:dLbls
    this.parseAxisIds(context, elemParent, jsonChartType);

    // add to visitor for later
    if (Object.keys(jsonChartType).length > 0) {
      let types: any[] = context.getVisitorParamsState().get("types");
      if (!types) {
        types = [];
        context.getVisitorParamsState().set("types", types);
      }
      types.push(jsonChartType);
    }

    return jsonChartType;
  }

  parseType(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const chartTypeName: string = elemParent.localName;
    switch(chartTypeName) {
      case "areaChart" :
        jsonParent.type = "area";
        break;
      case "bubbleChart" :
        jsonParent.type = "bubble";
        break;
      case "doughnutChart" :
        jsonParent.type = "pie";
        break;
      case "lineChart" :
        jsonParent.type = "line";
        break;
      case "ofPieType" :
        jsonParent.type = "pie";
        break;
      case "pieChart" :
        jsonParent.type = "pie";
        break;
      case "scatterChart" :
        jsonParent.type = "scatter";
        break;
    }
  }

  //TODO: how to handle more than 2 ids
  parseAxisIds(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const axIds: NodeList = context.evaluate("axId", elemParent) as NodeList;
    if (!axIds || axIds.length === 0)//pie charts don't have axId
      return;
    const xAxisId: string = (axIds.item(0) as Element).getAttribute("val");
    jsonParent.xAxisId = xAxisId;
    const yAxisId: string = (axIds.item(1) as Element).getAttribute("val");
    jsonParent.yAxisId = yAxisId;
  }

}