import type  { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { ChartTypeVisitor } from './ChartTypeVisitor';

export class BarChartTypeVisitor extends ChartTypeVisitor implements Visitor {
  parseType(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/) {
    const barDir: string = context.getValAttrAsString("barDir", elemParent);
    if (barDir) {
      if (barDir === "col") {
        jsonParent.type = "column";
      } else {//bar - TODO: confirm this
        jsonParent.type = "bar";
      }
    }
  }
}