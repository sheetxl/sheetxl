import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';

import * as OOXMLVisitorUtils from './OOXMLVisitorUtils';

export class DataPointVisitor implements Visitor {

  DataPointVisitor() {}

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    // If exists and not deleted than shown
    let jsonPointsElement: any/*JSON*/ = context.getFromPath(jsonParent, "points");
    let jsonPoints: any/*JSON*/ = null;
    if (jsonPointsElement) {
      jsonPoints = jsonPointsElement;
    } else {
      jsonPoints = {};
      context.setToPath(jsonParent, "points", jsonPoints);
    }

    let jsonPoint: any/*JSON*/ = {};
    let idx: string = context.getValAttrAsString("idx", elemParent);
    // if there is no idex then this is not added.
    if (idx !== null) {
       jsonPoints[idx] = jsonPoint;
    }

    VisitorUtils.parseValAttrAsBoolean(context, elemParent, jsonPoint, "bubble3D", "bubble3D");
    VisitorUtils.parseValAttrAsInteger(context, elemParent, jsonPoint, "explosion", "explosion");

    // TODO - test that this works
    OOXMLVisitorUtils.parseInvertIfNegative(context, elemParent, jsonPoint);

    // TODO - pictureOptions

    return jsonPoint;
  }

}

