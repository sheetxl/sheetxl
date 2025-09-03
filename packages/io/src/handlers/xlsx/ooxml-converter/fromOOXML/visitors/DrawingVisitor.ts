import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class DrawingVisitor implements Visitor {
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    return jsonParent;
  }
}
