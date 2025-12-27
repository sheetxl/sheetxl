import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class PlotAreaVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    //TODO: what about layout tag?
    let jsonPlotArea: any/*JSON*/ = {};
    jsonParent.plotArea = jsonPlotArea;
    return jsonPlotArea;
  }

}