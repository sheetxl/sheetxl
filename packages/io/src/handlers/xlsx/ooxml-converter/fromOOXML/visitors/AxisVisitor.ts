import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class AxisVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, _jsonParent: any/*JSON*/): any/*JSON*/ {
    let jsonAxis: any/*JSON*/ = {};
    //TODO: c:auto
    this.parseScaling(context, elemParent, jsonAxis);
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonAxis, "majorUnit", "majorUnits");
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonAxis, "minorUnit", "minorUnits");
    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonAxis, "delete", "shown");
    this.parseOrientation(context, elemParent, jsonAxis);
    this.parseNumFormat(context, elemParent, jsonAxis);

    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "majorTickMark", "majorTickMarks");
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "minorTickMark", "minorTickMarks");
    //sheetxl model stores c:crosses enum and c:crossesAt value in the same property crosses
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "crosses", "crosses");
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonAxis, "crossesAt", "crosses");
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "crossBetween", "crossBetween");

    this.parseLabelAlign(context, elemParent, jsonAxis);
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonAxis, "lblOffset", "labelOffset");
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "tickLblPos", "labelPosition");
    const noMultiLevelLbl: number = context.getValAttrAsInteger("noMultiLvlLbl", elemParent);
    jsonAxis.labelMultiLevel = noMultiLevelLbl !== null && noMultiLevelLbl === 0;

    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonAxis, "tickMarkSkip", "tickMarkSkip");
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonAxis, "tickLblSkip", "labelInterval");
    this.parseDisplayCustOrBuiltInUnit(elemParent, context, jsonAxis);
    this.parseTimeUnits(context, elemParent, jsonAxis, "majorUnitDates", "majorTimeUnit", "majorUnit");
    this.parseTimeUnits(context, elemParent, jsonAxis, "minorUnitDates", "minorTimeUnit", "minorUnit");
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonAxis, "baseTimeUnit", "baseUnitDates");
    let axesMap: Map<string, any> = context.getVisitorParamsState().get("axes");
    if (!axesMap) {
      context.getVisitorParamsState().set("axes", new Map());
    }
    const axesId: string = context.getValAttrAsString("axId", elemParent);
    context.getVisitorParamsState().get("axes").set(axesId, jsonAxis);
    return jsonAxis;
  }

  parseTimeUnits(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/, jsonKey: string, timeUnitXPath: string, unitXPath: string) {
    const jsonMajorUnits: any/*JSON*/ = {};
    let majorTimeUnit: string = context.getValAttrAsString(timeUnitXPath, elemParent);
    if (majorTimeUnit !== null) {
      jsonMajorUnits.dem = majorTimeUnit;
      let majorUnit: string = context.getValAttrAsString(unitXPath, elemParent);
      jsonMajorUnits.amt = majorUnit;
    }
    if (Object.keys(jsonMajorUnits).length > 0)
      jsonParent[jsonKey] = jsonMajorUnits;
  }

  parseDisplayCustOrBuiltInUnit(elemParent: Element, context: ExecutionContext, jsonAxis: any/*JSON*/) {
    let custUnits: string = context.getValAttrAsString("dispUnits/builtInUnit", elemParent);
    if (!custUnits)
      custUnits = context.getValAttrAsString("dispUnits/custUnit", elemParent);
    if (custUnits)
      jsonAxis.displayUnits = custUnits;
  }

  parseLabelAlign(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    let attrValue: string = context.getValAttrAsString("lblAlgn", elemParent);
    if (attrValue !== null) {
      if ("ctr" === attrValue) {
        jsonParent.labelAlign = "center";
      } else if ("l" === attrValue) {
        jsonParent.labelAlign = "left";
      } else if ("r" === attrValue) {
        jsonParent.labelAlign = "right";
      }
    }
  }

  parseOrientation(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const attrValue: string = context.getValAttrAsString("AxPos", elemParent);
    if (attrValue !== null) {
      if ("b" === attrValue) {
        jsonParent.orientation = "bottom";
      } else if ("l" === attrValue) {
        jsonParent.orientation = "left";
      } else if ("r" === attrValue) {
        jsonParent.orientation = "right";
      } else if ("t" === attrValue) {
        jsonParent.orientation = "top";
      }
    }
  }

  parseNumFormat(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const jsonLabels: any/*JSON*/ = {};
    const numFmtElement: Element = context.evaluate("numFmt", elemParent) as Element;
    if (numFmtElement !== null) {
      if (numFmtElement.hasAttribute("formatCode"))
      jsonLabels.formatCode = numFmtElement.getAttribute("formatCode");
      if (numFmtElement.hasAttribute("sourceLinked"))
        jsonLabels.sourceLinked = "1" === numFmtElement.getAttribute("sourceLinked");
    }
    if (Object.keys(jsonLabels).length > 0)
      jsonParent.labels = jsonLabels;
  }

  parseScaling(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const scalingOrientation: string = context.getValAttrAsString("scaling/orientation", elemParent);
    if (scalingOrientation !== null) {
      if (scalingOrientation === "minMax") {
        jsonParent.inverted = false;
      } else { // it is maxMin
        jsonParent.inverted = true;
      }
    }
    const logBase: number = context.getValAttrAsFloat("scaling/logBase", elemParent);
    if (logBase !== null) {
      jsonParent.logBase = logBase;
      jsonParent.scaleType = "log";
    }
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonParent, "scaling/max", "max");
    VisitorUtils.parseValAttrAsFloat(context, elemParent, jsonParent, "scaling/min", "min");
  }

  afterVisit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    if (jsonParent.fill && jsonParent.labels) {
      //move fill since excel don't support "dLbls" tag for its labels,
      //instead it is wrapped inside "txPr" tag
      jsonParent.labels.fill = jsonParent.fill;
      delete jsonParent.fill;
    }
    let isLabelsDelete: boolean = context.getValAttrAsBoolean("delete", elemParent);
    if (isLabelsDelete !== null) {
      context.setToPath(jsonParent, "labels.shown", isLabelsDelete !== true);
      context.setToPath(jsonParent, "shown", isLabelsDelete !== true);
    }

    const displayUnitsLabel: any/*JSON*/ = context.getFromPath(jsonParent, "dispUnits.displayUnitsLabel");
    if (displayUnitsLabel) {
      context.setToPath(jsonParent, "displayUnitsLabel", displayUnitsLabel);
      delete jsonParent.dispUnits;
    }

    const elemTitle: Element = context.evaluate("title", elemParent) as Element;
    context.setToPath(jsonParent, "title.shown", elemTitle !== null);

    const elemMinorGridlines: Element = context.evaluate("minorGridlines", elemParent) as Element;
    context.setToPath(jsonParent, "gridLinesMinor.shown", elemMinorGridlines !== null);

    const elemMajorGridlines: Element = context.evaluate("majorGridlines", elemParent) as Element;
    context.setToPath(jsonParent, "gridLinesMajor.shown", elemMajorGridlines !== null);
  }
}