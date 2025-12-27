import type { IMovable } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class DrawingElementVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, json: IMovable.JSON): IMovable.JSON {
    if (!elem) return;
    // We look for any attribute to add the name
    const elemCNvPr: Element = context.evaluate("*/cNvPr", elem) as Element;
    if (elemCNvPr) {
      context.copyFromAttribute(elemCNvPr, "name", json);
      context.copyFromAttribute(elemCNvPr, "desc", json);
      context.copyFromAttribute(elemCNvPr, "hidden", json, "hidden", context.BOOLEAN_COPY);

      context.copyFromAttribute(elemCNvPr, "id", json);
    }

    return json;
  }
}
