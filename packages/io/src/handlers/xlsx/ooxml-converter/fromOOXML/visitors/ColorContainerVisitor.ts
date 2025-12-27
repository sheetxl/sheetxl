import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { EnumMappings } from '../EnumMappings';
import * as NumberUtils from '../NumberUtils';


import { IFill } from '@sheetxl/sdk';
export class ColorContainerVisitor implements Visitor {

  visit(_context: ExecutionContext, _elemParent: Element, _jsonParent: any/*JSON*/): any/*JSON*/ {
  }

  processStroke(context: ExecutionContext, elemSpPr: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonStroke: any/*JSON*/ = {};
    const elemStroke: Element = context.evaluate("ln", elemSpPr) as Element;
    if (elemStroke) {
      if (elemStroke.hasAttribute("algn"))
        jsonStroke.align = EnumMappings.fromOoxmlAlignment(elemStroke.getAttribute("algn"));
      if (elemStroke.hasAttribute("cap"))
        jsonStroke.lineCap = EnumMappings.fromOoxmlLineCap(elemStroke.getAttribute("cap"));
      if (elemStroke.hasAttribute("cmpd"))
        jsonStroke.compound = EnumMappings.fromOoxmlCompound(elemStroke.getAttribute("cmpd"));
      if (elemStroke.hasAttribute("w"))
        jsonStroke.width = NumberUtils.toPoints(elemStroke.getAttribute("w"));
      //linejoin
      const miterElement: Element = context.evaluate("miter", elemStroke) as Element;
      if (miterElement) {
        jsonStroke.lineJoin = "miter";
        if (miterElement.hasAttribute("lim")) {
          jsonStroke.miter = parseFloat(miterElement.getAttribute("lim"));
        }
      }
      const bevelElement: Element = context.evaluate("bevel", elemStroke) as Element;
      if (bevelElement) {
        jsonStroke.lineJoin = "bevel";
      }
      const roundElement: Element = context.evaluate("round", elemStroke) as Element;
      if (roundElement) {
        jsonStroke.lineJoin = "round";
      }
      //String dash
      const custDashElement: Element = context.evaluate("custDash", elemStroke) as Element;
      if (custDashElement) {
        const dsElements: NodeList = context.evaluate("ds", custDashElement) as NodeList;
        if (dsElements && dsElements.length > 0) {
          let customDash: string = "";
          for (let i=0; i<dsElements.length; i++) {
            const ds: Element = dsElements.item(i) as Element;
            const dashLength: number = NumberUtils.parsePercentage(ds.getAttribute("d"));
            const spaceLength: number = NumberUtils.parsePercentage(ds.getAttribute("sp"));
            customDash += dashLength + "," + spaceLength;
          }
          jsonStroke.dash = customDash;
        }
      }
      const presetDashElement: Element = context.evaluate("prstDash", elemStroke) as Element;
      if (presetDashElement) {
        if (presetDashElement.hasAttribute("val")) {
          jsonStroke.dash = presetDashElement.getAttribute("val");
        }
      }
      //head and tail
      this.parseEndElement(context, elemStroke, jsonStroke, "headEnd", "head");
      this.parseEndElement(context, elemStroke, jsonStroke, "tailEnd", "tail");
      const jsonFill: any/*JSON*/ = this.processFill(context, elemStroke, jsonParent);
      jsonStroke.fill = jsonFill;
    }
    return jsonStroke;
  }

  parseEndElement(context: ExecutionContext, elemStroke: Element, jsonStroke: any/*JSON*/, xpath: string, attributeName: string): void {
    const endElement:Element = context.evaluate(xpath, elemStroke) as Element;
    if (!endElement)
      return;
    if (endElement.hasAttribute("type")) {
      jsonStroke[attributeName + "Type"] = endElement.getAttribute("type");
    }

    if (endElement.hasAttribute("len") || endElement.hasAttribute("w")) {
      const l: string = (endElement.getAttribute("len") ? endElement.getAttribute("len") : "med");
      const w: string = (endElement.getAttribute("w") ? endElement.getAttribute("w") : "med");
      jsonStroke[attributeName + "Size"] = l + "-" + w;
    }
  }

  processFill(context: ExecutionContext, shPropsElement: Element, _jsonOutputContainerNode: any/*JSON*/): any/*JSON*/ {
    const jsonFill: any/*JSON*/ = {};
    const noFill: Element = context.evaluate("noFill", shPropsElement) as Element;
    if (noFill) {
      jsonFill.none = true;
      return jsonFill;
    }
    const solidFill: Element = context.evaluate("solidFill", shPropsElement) as Element;
    if (solidFill) {
      const solid: string = this.processAdjColor(context, solidFill);
      if (solid)
        jsonFill.solid = solid;
      return jsonFill;
    }
    const gradFillElement: Element = context.evaluate("gradFill", shPropsElement) as Element;
    if (gradFillElement) {
      if (gradFillElement.hasAttribute("rotWithShape")) {
        jsonFill.isRotated = "1" === gradFillElement.getAttribute("rotWithShape") ? true : false;
      }
      const jsonGrad: any/*JSON*/ = this.processGradFill(context, gradFillElement);
      jsonFill.gradient = jsonGrad;
      return jsonFill;
    }
    const pattFill: Element = context.evaluate("pattFill", shPropsElement) as Element;
    if (pattFill) {
      const jsonPattern: any/*JSON*/ = this.processPatternFill(context, pattFill);
      jsonFill.pattern = jsonPattern;
      return jsonFill;
    }
    const imageFillElement: Element = context.evaluate("blipFill", shPropsElement) as Element;
    if (imageFillElement) {
      if (imageFillElement.hasAttribute("rotWithShape")) {
        jsonFill.isRotated = NumberUtils.parseAsBoolean(imageFillElement.getAttribute("rotWithShape"));
      }
      if (imageFillElement.hasAttribute("dpi")) {
        jsonFill.dpi = imageFillElement.getAttribute("dpi");
      }

      const jsonImageFill: any/*JSON*/ = this.processImageFill(context, imageFillElement);
      jsonFill.image = jsonImageFill;
      return jsonFill;
    }

    //return noFill
    jsonFill.none = true;
    return jsonFill;
  }

  processGradFill(context: ExecutionContext, gradFillElement: Element): any/*JSON*/ {
    const jsonGradFill: any/*JSON*/ = {};
    const linElement: Element = context.evaluate("lin", gradFillElement) as Element;
    if (linElement) {
      jsonGradFill.type = "linear";
      //TODO: rounded to 2 decimal float
      if (linElement.hasAttribute("ang")) {
        const angle: number = NumberUtils.parseAngle(linElement.getAttribute("ang"));
        jsonGradFill.angle = angle;
      }
      if (linElement.hasAttribute("scaled")) {
        const scaled: boolean = NumberUtils.parseAsBoolean(linElement.getAttribute("scaled"));
        jsonGradFill.scaled = scaled;
      }
    }
    const jsonTile: any/*JSON*/ = {};
    if (gradFillElement.hasAttribute("flip")) {
      jsonTile.mirror = gradFillElement.getAttribute("flip");
    }
    if (Object.keys(jsonTile).length > 0)
      jsonGradFill.tile = jsonTile;
    const pathElement: Element = context.evaluate("path", gradFillElement) as Element;
    if (pathElement) {
      if (pathElement.hasAttribute("path"))
        jsonGradFill.type = EnumMappings.fromOoxmlGradientType(pathElement.getAttribute("path"));
      const fillToRectElement: Element = context.evaluate("fillToRect", pathElement) as Element;
      if (fillToRectElement) {
        //top, left, bottom, right
        jsonGradFill.fillTo = this.getRect(fillToRectElement);
      }
    }
    const tileRectElement: Element = context.evaluate("tileRect", gradFillElement) as Element;
    if (tileRectElement) {
      jsonGradFill.tile.bounds = this.getRect(tileRectElement);
    }
    const jsonStops:any[] = [];
    const gsElements: NodeList = context.evaluate("gsLst/gs", gradFillElement) as NodeList;
    for (let i=0; gsElements && i<gsElements.length; i++) {
      const gs: Element = gsElements.item(i) as Element;
      const offset: number = NumberUtils.parsePercentage(gs.getAttribute("pos"));
      const color: string = this.processAdjColor(context, gs);
      const jsonStop: IFill.GradientStopProperties = {
        offset,
        color
      };
      jsonStops.push(jsonStop);
    }
    if (jsonStops.length > 0)
      jsonGradFill.stops = jsonStops;
    return jsonGradFill;
  }

  //TODO: check if the coords have to be divided by factor
  getRect(fillToRectElement: Element): any/*JSON*/ {
    const jsonRect: any/*JSON*/ = {};
    if (fillToRectElement.hasAttribute("t"))
      jsonRect.t = NumberUtils.parsePercentage(fillToRectElement.getAttribute("t"));
    if (fillToRectElement.hasAttribute("l"))
      jsonRect.l = NumberUtils.parsePercentage(fillToRectElement.getAttribute("l"));
    if (fillToRectElement.hasAttribute("b"))
      jsonRect.b = NumberUtils.parsePercentage(fillToRectElement.getAttribute("b"));
    if (fillToRectElement.hasAttribute("r"))
      jsonRect.r = NumberUtils.parsePercentage(fillToRectElement.getAttribute("r"));

    if (Object.keys(jsonRect).length === 0)
      return null;
    else
      return jsonRect;
  }

  //TODO: image fill
  processImageFill(_context: ExecutionContext, _imageFillElement: Element): any/*JSON*/ {
    const jsonImage: any/*JSON*/ = {};
    // https://c-rex.net/projects/samples/ooxml/e1/Part4/OOXML_P4_DOCX_blip_topic_ID0EI2NMB.html#topic_ID0EI2NMB
    // TODO - blip // embed/link
    jsonImage.ref = "https://www.sheetxl.com/logo-color-padded-white.jpg";
    jsonImage.tile = false;
      // TODO - effects can be here for blip
    // TODO - srcRect
    // TODO - stretch
    // TODO - tile
    return jsonImage;
  }

  processPatternFill(context: ExecutionContext, pattFill: Element): any/*JSON*/ {
    const jsonPattern: any/*JSON*/ = {};
    const type: string = pattFill.getAttribute("prst");
    jsonPattern.type = type;
    const bgClrElement: Element = context.evaluate("bgClr", pattFill) as Element;
    if (bgClrElement) {
      const jsonBgAdjColor: string = this.processAdjColor(context, bgClrElement);
      if (jsonBgAdjColor)
        jsonPattern.background = jsonBgAdjColor;
    }
    const fgClrElement: Element = context.evaluate("fgClr", pattFill) as Element;
    if (fgClrElement) {
      let jsonFgAdjColor: string = this.processAdjColor(context, fgClrElement);
      if (jsonFgAdjColor)
        jsonPattern.foreground = jsonFgAdjColor;
    }
    return jsonPattern;
  }

  processAdjColor(context: ExecutionContext, fillElement: Element): string {
    const hslClrElement: Element = context.evaluate("hslClr", fillElement) as Element;
    if (hslClrElement) {
      return this.processHslClr(context, hslClrElement);
    }
    const prstClrElement: Element = context.evaluate("prstClr", fillElement) as Element;
    if (prstClrElement) {
      return this.processClrWithValAttribute(context, prstClrElement);
    }
    const schemeClr: Element = context.evaluate("schemeClr", fillElement) as Element;
    if (schemeClr) {
      return this.processClrWithValAttribute(context, schemeClr);
    }
    const sysClr: Element = context.evaluate("sysClr", fillElement) as Element;
    if (sysClr) {
      const jsonSolid: string = this.processClrWithValAttribute(context, sysClr);
      //parse lastRGB
      // const strLastClrHex: string  = sysClr.getAttribute("lastClr");
      // // We should just leave this as hex
      // if (strLastClrHex) {
      //   const r: number = parseInt( strLastClrHex.substring( 0, 2 ), 16 );
      //   const g: number = parseInt( strLastClrHex.substring( 2, 4 ), 16 );
      //   const b: number = parseInt( strLastClrHex.substring( 4, 6 ), 16 );
      //   jsonSolid.lastRGB = "rgb(" + r + ", " + g + ", " + b + ")";
      // }
      return jsonSolid;
    }
    const scrgbClrElement: Element = context.evaluate("scrgbClr", fillElement) as Element;
    if (scrgbClrElement) {
      return this.processScrgbClrElement(context, scrgbClrElement);
    }
    const srgbClrElement: Element = context.evaluate("srgbClr", fillElement) as Element;
    if (srgbClrElement) {
      return this.processSrgbClrElement(context, srgbClrElement);
    }

    return null; // should never come here
  }

  processScrgbClrElement(context: ExecutionContext, elem: Element): string {
    const r: number = NumberUtils.parsePercentage(elem.getAttribute("r"));
    const g: number = NumberUtils.parsePercentage(elem.getAttribute("g"));
    const b: number = NumberUtils.parsePercentage(elem.getAttribute("b"));
    let retValue: string = "lrgba(" + r + "," + g + "," + b + ")";
    retValue += this.processAdjustments(context, elem);
    return retValue;
  }

  processSrgbClrElement(context: ExecutionContext, elem: Element): string {
    const strHex: string = elem.getAttribute("val");
    let retValue: string = strHex;
    retValue += this.processAdjustments(context, elem);
    return retValue;
  }

  processHslClr(context: ExecutionContext, elem: Element): string {
    const hue: number = NumberUtils.parseAngle(elem.getAttribute("hue"));
    const sat: number = NumberUtils.parsePercentage(elem.getAttribute("sat"));
    const lum: number = NumberUtils.parsePercentage(elem.getAttribute("lum"));
    let retValue: string = "hsl(" + hue + "," + sat + "," + lum+ ")";
    retValue += this.processAdjustments(context, elem);
    return retValue;
  }

  processClrWithValAttribute(context: ExecutionContext, elem: Element): string {
    const val: string = elem.getAttribute("val");
    if (!val) return;
    let retValue: string = val;
    retValue += this.processAdjustments(context, elem);
    return retValue;
  }

  processAdjustments(context: ExecutionContext, elem: Element): string {
    let retValue = '';
    const childNodes: NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1) { // Node.ELEMENT_NODE) {
        let name: string = elemChild.localName;
        if (name === "hue" || name === "hueOff" || name === "hueMod") {
          retValue += this.processAdjustmentElement(context, elem, name, 60000);
        } else if (name === "gray" || name === "comp" || name === "inv" || name === "gamma" || name === "invGamma") {
          retValue += this.processAdjustmentElement(context, elem, name, 1);
        } else {
          retValue += this.processAdjustmentElement(context, elem, name/*fFactor=1000L*/);
        }
      }
    }
    return retValue;
  }

  processAdjustmentElement(context: ExecutionContext, elem: Element, type: string, fFactor: number=1000): string {
    const adjsElement: Element = context.evaluate(type, elem) as Element;
    if (!adjsElement) {
      return '';
    }

    const strVal: string = adjsElement.getAttribute("val");
    if (!strVal) {
      return ` ${type}`;
    }
    const amount: number | boolean = (strVal) ? (parseFloat(strVal) / fFactor) : true;
    return ` ${type} ${amount}`;
  }

}