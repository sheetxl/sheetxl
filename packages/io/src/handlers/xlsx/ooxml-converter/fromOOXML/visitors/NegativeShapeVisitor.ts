import type { ExecutionContext } from '../ExecutionContext';
import { ShapePropertiesVisitor } from './ShapePropertiesVisitor';

export class NegativeShapeVisitor extends ShapePropertiesVisitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonFill: any/*JSON*/ = this.processFill(context, elemParent, jsonParent);
    if (Object.keys(jsonFill).length > 0)
      jsonParent.fillNegative = jsonFill;
    const jsonStroke: any/*JSON*/ = this.processStroke(context, elemParent, jsonParent);
    if (Object.keys(jsonStroke).length > 0)
      jsonParent.strokeNegative = jsonStroke;
    //TODO: effects
    return jsonParent;
  }

}
