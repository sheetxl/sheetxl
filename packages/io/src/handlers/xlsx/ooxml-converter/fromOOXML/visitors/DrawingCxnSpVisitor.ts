import type { IMovable } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { DrawingSpVisitor } from './DrawingSpVisitor';

export class DrawingCxnSpVisitor extends DrawingSpVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, json: IMovable.JSON): any {
    if (!elem) return;
    json = super.visit(context, elem, json);
    const elemNvPr: Element = context.evaluate("nvCxnSpPr/cNvCxnSpPr", elem) as Element;
    if (elemNvPr) {
      const elemLocks: Element = context.evaluate("cxnSpLocks", elemNvPr) as Element;
      if (elemLocks) {
        if (elemLocks.hasAttribute("noChangeAspect")) {
          json.lockAspect = elemLocks.getAttribute("noChangeAspect") === "1";
        }
        const jsonLocks = {};
        // context.copyFromAttribute(elemPicLocks, "noChangeAspect", jsonGraphic, "noChangeAspect", context.BOOLEAN_COPY);

        if (Object.keys(jsonLocks).length > 0) {
          json.locks = jsonLocks;
        }
      }
    }
    // specific connection shape properties
    context.warn(`Unable to import '${json.name}', connection shapes are not supported.`);
    const jsonContent = {};
    json.content = {
      type: "cxnSp",
      json: jsonContent
    };
    return jsonContent;
  }
}
