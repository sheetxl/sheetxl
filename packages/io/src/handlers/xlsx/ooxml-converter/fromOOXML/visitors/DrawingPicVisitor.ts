import type { IMovable, IPicture } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { DrawingElementVisitor } from './DrawingElementVisitor';

export class DrawingPicVisitor extends DrawingElementVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonHandle: IMovable.JSON): IMovable.JSON {
    if (!elem) return;
    const jsonMovable: IMovable.JSON = super.visit(context, elem, jsonHandle) as IMovable.JSON;
    const elemNvPr: Element = context.evaluate("nvPicPr/cNvPicPr", elem) as Element;
    if (elemNvPr) {
      /* what is this looks like noChangeAspect */
      context.copyFromAttribute(elem, "preferRelativeResize", jsonMovable, "preferRelativeResize", context.BOOLEAN_COPY);

      const elemLocks: Element = context.evaluate("picLocks", elemNvPr) as Element;
      if (elemLocks) {
        if (elemLocks.hasAttribute("noChangeAspect")) {
          jsonMovable.lockAspect = elemLocks.getAttribute("noChangeAspect") === "1";
        }
        const jsonLocks = {};

        context.copyFromAttribute(elemLocks, "noChangeArrowheads", jsonMovable, "noChangeArrowheads", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noChangeShapeType", jsonMovable, "noChangeShapeType", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noEditPoints", jsonMovable, "noEditPoints", context.BOOLEAN_COPY);

        // these all belong to movables
        // context.copyFromAttribute(elemLocks, "noChangeAspect", jsonMovable, "noChangeAspect", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noAdjustHandles", jsonMovable, "noAdjustHandles", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noCrop", jsonMovable, "noCrop", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noGrp", jsonMovable, "noGrp", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noMove", jsonMovable, "noMove", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noResize", jsonMovable, "noResize", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noRot", jsonMovable, "noRot", context.BOOLEAN_COPY);
        context.copyFromAttribute(elemLocks, "noSelect", jsonMovable, "noSelect", context.BOOLEAN_COPY);
        if (Object.keys(jsonLocks).length > 0) {
          jsonMovable.locks = jsonLocks;
        }
      }
    }


    const blip: Element = context.evaluate("blipFill/blip", elem) as Element;
    let resId: any;
    if (blip) {
      const rId = blip.getAttribute("r:embed") ?? blip.getAttribute("embed");
      if (!rId) {
        console.warn('no rId found for blip', blip);
        return;
      };
      resId = context.getRef(rId, true/*asBinary*/);
    }

    const json: IPicture.JSON = {
      resId
    };
    jsonHandle.content = { type: 'picture', json };
    return jsonMovable;
  }
}
