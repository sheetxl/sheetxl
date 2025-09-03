import type { IMovable } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { DrawingElementVisitor } from './DrawingElementVisitor';

export class DrawingSpVisitor extends DrawingElementVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, json: IMovable.JSON): any {
    if (!elem) return;
    json = super.visit(context, elem, json);
    const elemNvPr: Element = context.evaluate("nvSpPr/cNvSpPr", elem) as Element;
    if (elemNvPr) {
      const elemLocks: Element = context.evaluate("spLocks", elemNvPr) as Element;
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

    context.warn(`Unable to import '${json.name}', shapes are not supported.`);
    const jsonContent = {};
    json.content = {
      type: "sp",
      json: jsonContent
    };
    return jsonContent;
  }
}
