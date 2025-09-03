import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class MarkerVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const parentNodeName: string = (elemParent.parentNode as Element).localName;
    if (parentNodeName === "ser" || parentNodeName === "dPt") {
      const marker: any/*JSON*/ = {};
      const size: string = context.getValAttrAsString("size", elemParent);
      if (size !== null) {
        marker.size = size;
      }
      const type: string = context.getValAttrAsString("symbol", elemParent);
      if (type) {
        marker.type = type;
      }
      jsonParent.markers = marker;
      return marker;
    }
    return null;
  }
}
