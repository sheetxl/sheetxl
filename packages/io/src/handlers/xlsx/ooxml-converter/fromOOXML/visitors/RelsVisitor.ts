import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

/**
 * Capture rels
 */
export class RelsVisitor  implements Visitor {
  visit(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemRels:Element = childNodes.item(i) as Element;
      if (elemRels.nodeType === 1 && elemRels.localName === 'Relationship') { // 1 - Node.ELEMENT_NODE;
        this.processRelationship(context, elemRels, jsonParent);
      }
    }
    return jsonParent;
  }

  processRelationship(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonRel = {};

    context.copyFromAttribute(elem, "Target", jsonRel, "target");
    context.copyFromAttribute(elem, "Type", jsonRel, "type");
    context.copyFromAttribute(elem, "TargetMode", jsonRel, "targetMode");
    const id = elem.getAttribute("Id");
    jsonParent[id] = jsonRel
  }

}