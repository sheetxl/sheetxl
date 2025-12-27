import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { parseValAttrAsBoolean, parseValAttrAsString } from '../VisitorUtils';

export class ChartVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    parseValAttrAsBoolean(context, elemParent, jsonParent, "plotVisOnly", "plotVisOnly");
    parseValAttrAsString(context, elemParent, jsonParent, "dispBlanksAs", "dispBlanksAs");
    parseValAttrAsBoolean(context, elemParent, jsonParent, ".//extLst/ext/dataDisplayOptions16/dispNaAsBlank", "dispNaAsBlank");
    parseValAttrAsBoolean(context, elemParent, jsonParent, "showDLblsOverMax", "showDLblsOverMax");

    // context.warn(`'Charts' are not supported.`);
    return jsonParent;
  }

  afterVisit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): void {
    try {
      // Add shown for title
      // TODO - review why we do this in the afterVisit and either move (to models?) or document.
      const attrValue: boolean = context.getValAttrAsBoolean("autoTitleDeleted", elemParent);
      const xmlElementTitle: Element = context.evaluate("title", elemParent) as Element;
      context.setToPath(jsonParent, "title.shown", (attrValue === true || !xmlElementTitle) ? false : true);
      // if legend is an element than it is shown
      const xmlElement: Element = context.evaluate("legend", elemParent) as Element;
      context.setToPath(jsonParent, "legend.shown", xmlElement !== null);
    } catch (error: any) {
      throw new Error("Unexpected Error parsing Chart: " + error);
    }
  }
}