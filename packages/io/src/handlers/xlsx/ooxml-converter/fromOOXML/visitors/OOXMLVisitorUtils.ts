import type { ExecutionContext } from '../ExecutionContext';

export const parseInvertIfNegative = (context: ExecutionContext, elemParent: Element, jsonNode: any/*JSON*/): void => {
  const isInvertIfNegative: boolean = context.getValAttrAsBoolean("invertIfNegative", elemParent);
  if (isInvertIfNegative === true) {
    const elemInvertFillFormat: Element = context.evaluate("extLst/ext/invertSolidFillFmt", elemParent) as Element;

    // If invertIfNegative is declared but there is no invertSolid then we hardcode
    if (!elemInvertFillFormat) {
      // hardcode to white fill and black stroke
      const jsonFillSolidColor: any/*JSON*/ = {};
      jsonFillSolidColor.val = "FFFFFF";
      const jsonFillSolid: any/*JSON*/ = {};
      jsonFillSolid.solid = jsonFillSolidColor;

      jsonNode.fillNegative = jsonFillSolid;

      const jsonStrokeFillSolidColor: any/*JSON*/ = {};
      jsonStrokeFillSolidColor.val = "000000";
      const jsonFillStrokeSolid: any/*JSON*/ = {};
      jsonFillStrokeSolid.solid = jsonStrokeFillSolidColor;
      const jsonStroke: any/*JSON*/ = {};
      jsonStroke.fill = jsonFillStrokeSolid;
      jsonNode.strokeNegative = jsonStroke;
    } else if (jsonNode.fill && jsonNode.fillNegative) {
      const jsonAdjusts: any/*JSON*/ = context.getFromPath(jsonNode, "fill.solid.adjs");
      // Note - Excel uses the alpha adjustments from the fill for the negative alpha.
      if (jsonAdjusts) {
        context.setToPath(jsonNode, "fillNegative.solid.adjs", jsonAdjusts);
      }
    }
  }
}
