import { IFill, IStyledFont, IBorder, IFont } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import  * as UtilsOOXML from '../../UtilsOOXML';
import * as VisitorUtils from '../VisitorUtils';

export class SheetColorContainerVisitor implements Visitor {

  visit(_context: ExecutionContext, _elemParent: Element, _jsonParent: any/*JSON*/): any/*JSON*/ {
  }

  /**
   * Slightly different than drawML. We could attempt to rationalize or merge.
   */
  processDataBarColor(context: ExecutionContext, elemColor: Element, jsonParent: any/*JSON*/, key: string, auto: string='dk1'): any/*JSON*/ {
    if (!elemColor) return;

    const strColor = UtilsOOXML.processDataBarColor(
      (name: string): string => {
        return elemColor.getAttribute(name);
      },
      auto
    )

    if (strColor) {
      jsonParent[key] = strColor;
    }
    return jsonParent;
  }

  processFonts(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const childNodes: NodeList = elem.childNodes;
    let index:number = 0;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'font') {
        const jsonFont:IStyledFont.Properties<string> = {};
        this.processFont(context, elemChild, jsonFont);
        jsonParent[index++] = jsonFont;
      }
    }

    return jsonParent;
  }

  processFont(context: ExecutionContext, elem: Element, jsonFont: IStyledFont.Properties<string>): any/*JSON*/ {
    if (context.getValAttrAsBoolean("b", elem, true)) {
      jsonFont.weight = 700; // magic bold weight
    } else {
      // jsonFont.weight = 400;
    }

    if (context.getValAttrAsBoolean("i", elem, true)) {
      jsonFont.style = IFont.Style.Italic;
    } else {
      // jsonFont.style = FontStyle.Normal;
    }
    if (context.getValAttrAsBoolean("strike", elem, true)) {
      jsonFont.strike = true;
    } else{
      // jsonFont.strike = false;
    }
    const elemUnderline = context.evaluate("u", elem) as Element;
    if (elemUnderline) {
      const underlineType = elemUnderline.getAttribute("val");
      jsonFont.underline = (underlineType as IFont.UnderlineStyle) || IFont.UnderlineStyle.Single;
    } else {
      // jsonFont.underline = IFont.UnderlineStyle.None;
    }
    VisitorUtils.parseValAttrAsString(context, elem, jsonFont, "vertAlign", "verticalAlign");
    // correct values
    if ((jsonFont.verticalAlign as any) === "superscript")
      jsonFont.verticalAlign = IFont.VerticalAlignment.Super;
    else if ((jsonFont.verticalAlign as any) === "subscript")
      jsonFont.verticalAlign = IFont.VerticalAlignment.Sub;
    VisitorUtils.parseValAttrAsFloat(context, elem, jsonFont, "sz", "size");
    const elemColor:Element = context.evaluate("color", elem) as Element;
    this.processDataBarColor(context, elemColor, jsonFont, "fill");
    // Missing font color doesn't not seem to indicate inherit but rather auto
    if (!jsonFont.fill) {
      jsonFont.fill = 'dk1';
    }
    // if (!jsonFont.fill) {
    //   jsonFont.fill = {};
    // };
    // if (CommonUtils.isObject(jsonFont.fill) &&  !(jsonFont.fill as any).val) {
    //   (jsonFont.fill as any).val = 'dk1'; //Scheme.dk1; // TODO - what color is auto? This is the same as unspecified?
    // }

    /* Map to CSS values - OOXML used `name` and `rFont` as the family name and family as the fallback. */
    VisitorUtils.parseValAttrAsString(context, elem, jsonFont, "name", "family");
    VisitorUtils.parseValAttrAsString(context, elem, jsonFont, "rFont", "family");
    const elemFamily = context.evaluate("family", elem) as Element;
    if (elemFamily) {
      const fallback = elemFamily.getAttribute("val");
      // TODO - use IFont.getFallbackFromPanose
      if (fallback) {
        switch (fallback) {
          case '1': // Roman
            jsonFont.fallbacks = ['serif'];
          break;
          case '2': // Swiss
            jsonFont.fallbacks = ['sans-serif'];
          break;
          case '3': // Modern
            jsonFont.fallbacks = ['monospace'];
          break;
          case '4': // Script
            jsonFont.fallbacks = ['cursive'];
          break;
          case '5': // Decorative
            jsonFont.fallbacks = ['fantasy'];
          break;
          case '0': // Not applicable
          // do nothing
          break;
        }
      }
    }

    VisitorUtils.parseValAttrAsString(context, elem, jsonFont, "scheme", "scheme");
    VisitorUtils.parseValAttrAsBoolean(context, elem, jsonFont, "shadow", "shadow", true);
    VisitorUtils.parseValAttrAsBoolean(context, elem, jsonFont, "outline", "outline", true);
    const isCondense = context.getValAttrAsBoolean("condense", elem, true);
    if (isCondense)
      jsonFont.letterSpacing = -1; // just a guess
    const isExpend = context.getValAttrAsBoolean("extend", elem, true);
    if (isExpend)
      jsonFont.letterSpacing = 1; // just a guess

    VisitorUtils.parseValAttrAsString(context, elem, jsonFont, "charset", "charset");
    return jsonFont;
  }

  processFills(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    let index:number = 0;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'fill') { // 1 - Node.ELEMENT_NODE;
        this.processFill(context, elemChild, jsonParent, index++);
      }
    }
    return jsonParent;
  }

  processFill(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/, index: number): any/*JSON*/ {
    const jsonFill:IFill.JSON = {
      type: IFill.Type.None
    };
    const childNodes: NodeList = elem.childNodes;
    let processedFirst = false;
    for (let i=0; !processedFirst && i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType !== 1) continue;
      if (elemChild.localName === 'gradientFill') {
        this.processGradientFill(context, elemChild, jsonFill as IFill.GradientJSON);
        processedFirst = true;
      } else if (elemChild.localName === 'patternFill') {
        this.processPatternFill(context, elemChild, jsonFill as IFill.PatternJSON);
        processedFirst = true;
      }
    }

    jsonParent[index] = jsonFill;
    return jsonParent;
  }

  processGradientFill(context: ExecutionContext, elem: Element, jsonParent: IFill.GradientJSON): any/*JSON*/ {
    if (!elem) return;
    jsonParent.type = IFill.Type.Gradient;
    const jsonStops:IFill.GradientStopProperties<string>[] = [];
    jsonParent.stops = jsonStops;

    // TODO - review.
    jsonParent.angle = 90 + (elem.hasAttribute("degree") ? parseFloat(elem.getAttribute("degree")) : 0);

    const type = elem.getAttribute("type");
    if (type)
      jsonParent.gradientType = type as IFill.GradientType;

    const parseFloatSafe = (val: string) => {
      if (!val) return 0;
      const asFloat = parseFloat(val);
      if (!isNaN(asFloat)) return asFloat;
      return 0;
    }

    if (elem.hasAttribute("left") || elem.hasAttribute("top") || elem.hasAttribute("right") || elem.hasAttribute("bottom")) {
      jsonParent.fillTo = {
        left: parseFloatSafe(elem.getAttribute("left")),
        top: parseFloatSafe(elem.getAttribute("top")),
        right: parseFloatSafe(elem.getAttribute("right")),
        bottom: parseFloatSafe(elem.getAttribute("bottom")),
      }
    }

    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemStop:Element = childNodes.item(i) as Element;
      if (elemStop.nodeType === 1 && elemStop.localName === 'stop') { // 1 - Node.ELEMENT_NODE;
        const jsonStop:IFill.GradientStopProperties<string> = {} as IFill.GradientStopProperties<string>;
        jsonStops.push(jsonStop);
        const position = parseFloat(elemStop.getAttribute("position"));
        jsonStop.offset = position; // multiple by 100?
        const elemColor:Element = context.evaluate("color", elemStop) as Element;
        this.processDataBarColor(context, elemColor, jsonStop, "color");
      }
    }

    return jsonParent;
  }

  processPatternFill(context: ExecutionContext, elem: Element, jsonParent: IFill.PatternProperties<string>): any/*JSON*/ {
    if (!elem) return;
    const isProcessingDXFs = context.getVisitorParamsState().get("processingDXFs");
    // the default pattern depends on if we are processing dxf or xf
    const patternType = elem.getAttribute("patternType") || (isProcessingDXFs ? IFill.BuiltInSheetPattern.Solid : IFill.BuiltInSheetPattern.None);
    if (patternType === IFill.BuiltInSheetPattern.None) {
      return {
        none: true
      }
    }

    jsonParent.type = IFill.Type.Pattern;
    if (patternType)
      jsonParent.patternType = patternType as IFill.BuiltInSheetPattern;

    /**
     * For reasons I don't understand Excel inverts the colors for solid fills for dfx records (only?)
     * We do this in importer as we don't want to 'inverted' behavior in the sdk.
     */
    let foreground = "foreground";
    let background = "background";
    const invertColors = jsonParent.patternType === IFill.BuiltInSheetPattern.Solid && isProcessingDXFs;
    let autoColorFg = invertColors ? 'dk1' : 'lt1';
    let autoColorBg = invertColors ? 'lt1' : 'dk1';
    if (invertColors) { // invert
      const temp = foreground;
      foreground = background;
      background = temp;
    }
    const elemFgColor:Element = context.evaluate("fgColor", elem) as Element;
    this.processDataBarColor(context, elemFgColor, jsonParent, foreground, autoColorFg);
    const elemBgColor:Element = context.evaluate("bgColor", elem) as Element;
    this.processDataBarColor(context, elemBgColor, jsonParent, background, autoColorBg);
    // we need to default the colors if they are missing as the non inverted colors are incorrect.
    if (invertColors) {
       if (!jsonParent.foreground) {
         jsonParent.foreground = 'lt1'; // defaults to Tx1 in sdk.
       }
       if (!jsonParent.background) {
         jsonParent.background = 'dk1'; // defaults to Tx2 in sdk.
       }
    }

    return jsonParent;
  }

  processBorders(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/, tile: boolean): any/*JSON*/ {
    if (!elem) return;
    const childNodes: NodeList = elem.childNodes;
    let index:number = 0;
    for (let i=0; i<childNodes.length; i++) {
      const childNode: Node = childNodes.item(i);
      if (childNode.nodeType === 1 && (childNode as Element).localName === 'border') { // 1 - Node.ELEMENT_NODE;
        this.processBorder(context, childNode as Element, jsonParent, index++, tile);
      }
    }

    return jsonParent;
  }

  /**
   * Excel stores in 2 ways. For tables they use the internal borders but for cells they don't.
   * Because SheetXL stores all styles as ranges (similar to tables) we need to tile the borders
   * for cells.
   *
   * @remarks
   * This creates a subtle but handled exception where a ranged style of 1 cell will have horizontal/vertical
   * border definitions. In both SheetXL and Excel these values are ignored.
   */
  processBorder(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/, index: number, tile: boolean): any/*JSON*/ {
    if (!elem) return;

    const jsonBorder:IBorder.JSON = {};
    this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Left);
    this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Right);
    if (!tile) {
      this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Vertical);
    } else if (jsonBorder.right || jsonBorder.left) {
      if (jsonBorder.right) {
        jsonBorder.vertical = {...jsonBorder.right};
      } else {
        jsonBorder.vertical = {...jsonBorder.left};
      }
    }
    this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Top);
    this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Bottom);
    if (!tile) {
      this.processBorderStroke(context, elem, jsonBorder, IBorder.Edge.Horizontal);
    } else if (jsonBorder.bottom || jsonBorder.top) {
      if (jsonBorder.bottom) {
        jsonBorder.horizontal = {...jsonBorder.bottom};
      } else {
        jsonBorder.horizontal = {...jsonBorder.top};
      }
    }

    // TODO - These are done a bit differently
    // this.processBorderStroke(context, elem, jsonParent, IBorder.Edge.DiagonalUp);
    // this.processBorderStroke(context, elem, jsonParent, IBorder.Edge.DiagonalDown);
    jsonParent[index] = jsonBorder;

    return jsonParent;
  }

  processBorderStroke(context: ExecutionContext, elem: Element, jsonParent: IBorder.JSON, edge: IBorder.Edge): any/*JSON*/ {
    if (!elem) return;

    const elemEdge = context.evaluate(edge, elem) as Element;
    if (!elemEdge) return;
    const jsonStroke:IBorder.StrokeJSON = {};
    // If there is an edge element, but no style, then it is a None style
    if (elemEdge.hasAttribute("style")) {
      jsonStroke.style = elemEdge.getAttribute("style") as IBorder.StrokeStyle;
    }
    const elemColor:Element = context.evaluate("color", elemEdge) as Element;
    if (elemColor) {
      this.processDataBarColor(context, elemColor, jsonStroke, "color");
    }

    if (Object.keys(jsonStroke).length > 0) {
      return jsonParent[edge] = jsonStroke;
    }
    return null;

  }

}