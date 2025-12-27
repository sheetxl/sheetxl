import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

export class LegendVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonLegend: any/*JSON*/ = {};
    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonLegend, "overlay", "overlay");

    VisitorUtils.parseValAttrAsString(context, elemParent, jsonLegend, "legendPos", "position");

    jsonParent.legend = jsonLegend;
    return jsonLegend;
  }
}