import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class DataLabelsVisitor implements Visitor {

  private jsonKey: string;

  constructor(jsonKey: string) {
    this.jsonKey = jsonKey;
  }

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    let jsonDataLabel: any/*JSON*/ = {};
    let jsonRetValue: any/*JSON*/ = jsonDataLabel;
    // If exists and not deleted than shown

    let idx: string = context.getValAttrAsString("idx", elemParent);
    if (idx !== null) {
      jsonRetValue = {};
      jsonRetValue[idx] = jsonDataLabel;
    }

    const isLabelsDelete: boolean = context.getValAttrAsBoolean("delete", elemParent);
//    context.setToPath(jsonDataLabel, "shown", isLabelsDelete !== true);
    this.parseNumFormat(context, elemParent, jsonDataLabel);
    if (isLabelsDelete === true) { // everything defaults to false
      jsonDataLabel.showBubbleSize = false;
      jsonDataLabel.showCatName = false;
      jsonDataLabel.showLeaderLines = false;
      jsonDataLabel.showPercentage = false;
      jsonDataLabel.showSerName = false;
      jsonDataLabel.showVal = false;
      jsonDataLabel.showLegendKey = false;
    } else {
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showBubbleSize", "showBubbleSize");
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showCatName", "showCatName");
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showLeaderLines", "showLeaderLines");
      // TODO - leader lines also have stroke formatting capabilities
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showPercent", "showPercentage");
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showSerName", "showSerName");
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showVal", "showVal");
      VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "showLegendKey", "showLegendKey");
    }
    // TODO - This is c15:dataLabelsRange
//  VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonDataLabel, "valueFromCells", "valueFromCells");

    const separatorElement: Element = context.evaluate("separator", elemParent) as Element;
    if (separatorElement !== null) {
      jsonDataLabel.separator = separatorElement.textContent;
    }
    VisitorUtils.parseValAttrAsString(context, elemParent, jsonDataLabel, "dLblPos", "position");

    jsonParent[this.jsonKey] = jsonRetValue;
    return jsonDataLabel;
  }

  parseNumFormat(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    const numFmtElement: Element = context.evaluate("numFmt", elemParent) as Element;
    if (numFmtElement) {
      const formatCode: string = numFmtElement.getAttribute("formatCode");
      jsonParent.formatCode = formatCode;
      if (numFmtElement.hasAttribute("sourceLinked"))
        jsonParent.sourceLinked = "1" === numFmtElement.getAttribute("sourceLinked");
    }
    // SourceLinked is not here?
  }

}
