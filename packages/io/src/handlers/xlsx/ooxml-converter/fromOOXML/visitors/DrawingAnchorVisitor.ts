import type { IMovable } from '@sheetxl/sdk';
import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { toPixels } from '../NumberUtils';

export class DrawingAnchorVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): Partial<IMovable.JSON> {
    if (!elem) return;

    const asMovable:Partial<IMovable.JSON> = {};
    // TODO - use enums?
    context.copyFromAttribute(elem, "editAs", asMovable, "anchorType");

    asMovable.anchor = {} as IMovable.AnchorOffset;

    this.processOffsetCoord(context, context.evaluate("from", elem) as Element, asMovable.anchor, "from");
    this.processOffsetCoord(context, context.evaluate("to", elem) as Element, asMovable.anchor, "to");

    if (!jsonParent.movables)
      jsonParent.movables = [];

    jsonParent.movables.push(asMovable);
    return asMovable;
  }

  processOffsetCoord(context: ExecutionContext, elem: Element, jsonParent: Partial<IMovable.AnchorOffset>, property: string): Partial<IMovable.AnchorOffset> {
    if (!elem) return;

    const offsetCoords:IMovable.OffsetCoords = {
      c: 0,
      r: 0,
      x: 0,
      y: 0,
    };

    if (context.evaluate("col", elem) as Element)
      offsetCoords.c = parseInt((context.evaluate("col", elem) as Element).textContent);
    if (context.evaluate("row", elem) as Element)
      offsetCoords.r = parseInt((context.evaluate("row", elem) as Element).textContent);
    if (context.evaluate("colOff", elem) as Element)
      offsetCoords.x = toPixels((context.evaluate("colOff", elem) as Element).textContent);
    if (context.evaluate("rowOff", elem) as Element)
      offsetCoords.y = toPixels((context.evaluate("rowOff", elem) as Element).textContent);


    if (property === 'from') {
      jsonParent.tl = offsetCoords;
    } else {
      jsonParent.br = offsetCoords;
    }

    return jsonParent;
  }
}