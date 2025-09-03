import type { Bounds } from '@sheetxl/sdk';
// import { IShape } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import * as VisitorUtils from '../VisitorUtils';
import * as NumberUtils from '../NumberUtils';
import { ColorContainerVisitor } from './ColorContainerVisitor';

export class ShapePropertiesVisitor extends ColorContainerVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonShape: any): any/*JSON*/ { // IShape.JSON
    try {
      const elemXfrm: Element = context.evaluate("xfrm", elem) as Element;
      if (elemXfrm) {
        VisitorUtils.parseRotation(elemXfrm, jsonShape);
        const bounds:Bounds = {
          x: 0, y: 0, width: 0, height: 0
        };
        const elemOff = context.evaluate("off", elemXfrm) as Element;
        if (elemOff) {
          bounds.x = NumberUtils.toPixels(elemOff.getAttribute("x")) ?? 0;
          bounds.y = NumberUtils.toPixels(elemOff.getAttribute("y")) ?? 0;
        }
        const elemExt = context.evaluate("ext", elemXfrm) as Element;
        if (elemOff) {
          bounds.width = NumberUtils.toPixels(elemExt.getAttribute("cx")) ?? 0;
          bounds.height = NumberUtils.toPixels(elemExt.getAttribute("cy")) ?? 0;
        }
        jsonShape.bounds = bounds;
      }

      const elemPresetGeom: Element = context.evaluate("prstGeom", elem) as Element;
      if (elemPresetGeom?.hasAttribute('prst')) {
        jsonShape.geometry = elemPresetGeom?.getAttribute("prst");
      } else {
        const elemCustGeom: Element = context.evaluate("customGeom", elem) as Element;
        if (elemCustGeom) {
          console.warn('customGeom not supported yet');
        }
      }

      const jsonFill: any/*JSON*/ = this.processFill(context, elem, jsonShape);
      if (jsonFill && Object.keys(jsonFill).length > 0)
        jsonShape.fill = jsonFill;
      const jsonStroke: any/*JSON*/ = this.processStroke(context, elem, jsonShape);
      if (jsonStroke && Object.keys(jsonStroke).length > 0)
        jsonShape.stroke = jsonStroke;
      //TODO: effects
      return jsonShape;
    } catch (error: any) {
      console.warn(error);
      throw new Error("Unexpected Error parsing Shape Properties element");
    }
  }

}

