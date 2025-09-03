import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class LayoutVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const elementManualLayout: Element = context.evaluate("manualLayout", elemParent) as Element;

    if (elementManualLayout) {
      let jsonManualLayout: any/*JSON*/ = {};
      //  https://docs.microsoft.com/en-us/openspecs/office_standards/ms-oe376/2c28b9f6-2128-40c8-8eeb-248651dcd7f3
      // https://c-rex.net/projects/samples/ooxml/e1/Part4/OOXML_P4_DOCX_ST_LayoutMode_topic_ID0EUPSRB.html#topic_ID0EUPSRB
      VisitorUtils.parseValAttrAsFloat(context, elementManualLayout, jsonManualLayout, "x", "x");
      VisitorUtils.parseValAttrAsFloat(context, elementManualLayout, jsonManualLayout, "y", "y");
      VisitorUtils.parseValAttrAsFloat(context, elementManualLayout, jsonManualLayout, "w", "w");
      VisitorUtils.parseValAttrAsFloat(context, elementManualLayout, jsonManualLayout, "h", "h");

      VisitorUtils.parseValAttrAsString(context, elementManualLayout, jsonManualLayout, "xMode", "xMode");
      VisitorUtils.parseValAttrAsString(context, elementManualLayout, jsonManualLayout, "yMode", "yMode");
      VisitorUtils.parseValAttrAsString(context, elementManualLayout, jsonManualLayout, "wMode", "wMode");
      VisitorUtils.parseValAttrAsString(context, elementManualLayout, jsonManualLayout, "hMode", "hMode");

      if (Object.keys(jsonManualLayout).length > 0)
        jsonParent.manualLayout = jsonManualLayout;
    }
    return jsonParent;
  }
}
