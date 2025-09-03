import type { IMovable } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { DrawingSpVisitor } from './DrawingSpVisitor';

export class DrawingGrpSpVisitor extends DrawingSpVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, json: IMovable.JSON): any {
    if (!elem) return;
    json = super.visit(context, elem, json);
    const elemNvPr: Element = context.evaluate("nvGrpSpPr/cNvGrpSpPr", elem) as Element;
    if (elemNvPr) {
      const elemLocks: Element = context.evaluate("grpSpLocks", elemNvPr) as Element;
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
    // specific group shape properties
    context.warn(`Unable to import '${json.name}', group shapes are not supported.`);
    const jsonContent = {};
    json.content = {
      type: "grpSp",
      json: jsonContent
    };
    return jsonContent;
  }
}
