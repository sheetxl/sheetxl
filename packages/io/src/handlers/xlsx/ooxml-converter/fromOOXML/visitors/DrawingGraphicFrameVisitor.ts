import type { IMovable } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { DrawingElementVisitor } from './DrawingElementVisitor';

export class DrawingGraphicFrameVisitor extends DrawingElementVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, json: IMovable.JSON): any {
    if (!elem) return;
    json = super.visit(context, elem, json);
    const elemNvPr: Element = context.evaluate("nvGraphicFramePr/cNvGraphicFramePr", elem) as Element;
    if (elemNvPr) {
      const elemLocks: Element = context.evaluate("graphicFrameLocks", elemNvPr) as Element;
      if (elemLocks) {
        if (elemLocks.hasAttribute("noChangeAspect")) {
          json.lockAspect = elemLocks.getAttribute("noChangeAspect") === "1";
        }
        const jsonLocks = {};
        // context.copyFromAttribute(elemPicLocks, "noChangeAspect", jsonMovable, "noChangeAspect", context.BOOLEAN_COPY);

        if (Object.keys(jsonLocks).length > 0) {
          json.locks = jsonLocks;
        }
      }
    }

    const elementGraphic: Element = context.evaluate("graphic/graphicData", elem) as Element;

    let jsonContent = {
      type: "graphicFrame",
      json: {}
    };

    const childNodes:NodeList = elementGraphic.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      // Anything can be added here so perhaps we should try to find the converter for anything
      if (elemChild.nodeType === 1) { // 1 - Node.ELEMENT_NODE;
        try {
          // We promote the chart type
          let type = elemChild.localName;
          if (type === "chart") {
            type = "chart";
          }
          jsonContent.type = type;
          const rId = elemChild.getAttribute("r:id");
          if (rId) {
            jsonContent.json = context.getRef(rId);
          }
        } catch (error: any) {
          console.warn(`Unable to parse graphicFrame`, error);
        }
      }
    }

    if (jsonContent) {
      json.content = jsonContent;
    }
    return jsonContent;
  }
}
