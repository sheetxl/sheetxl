import { IFont } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import * as VisitorUtils from '../VisitorUtils';
import { ShapePropertiesVisitor } from './ShapePropertiesVisitor';

export class TextPropertiesVisitor implements Visitor {

  protected _jsonKey: string;

  constructor(jsonKey: string="text") {
    this._jsonKey = jsonKey;
  }

  getTextPath(): string {
    return this._jsonKey;
  }

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    let jsonText: any/*JSON*/ = context.getFromPath(jsonParent, this.getTextPath());
    if (!jsonText)
      jsonText = {};

    this.parseTextElement(context, elemParent, jsonText, false/*defaultRun*/);

    if (Object.keys(jsonText).length > 0)
      context.setToPath(jsonParent, this.getTextPath(), jsonText);

    return jsonParent;
  }

  parseTextElement(context: ExecutionContext, elemParent: Element, jsonText: any/*JSON*/, defaultRun: boolean): void {
    //parse child element p/pPr/defRPr - attribute sz, b, i, u, strike
    const defRPrElement:Element = (context.evaluate("p/pPr/defRPr", elemParent) ?? context.evaluate("defRPr", elemParent)) as Element;
    if (defRPrElement) {
      this.parseTextProperties(context, defRPrElement, jsonText);
      new ShapePropertiesVisitor().visit(context, defRPrElement, jsonText);
    }

    let runs = [];
    // let simpleText: string = '';
    let runElements: Element | NodeList = context.evaluate("p/r", elemParent) ?? context.evaluate("r", elemParent);
    const addRun = (elemRun: Element) => {
      const run:any = {};
      let textElement = context.evaluate("t", elemRun) as Element;
      const propElement = context.evaluate("rPr", elemRun) as Element;
      if (propElement) {
        this.parseTextProperties(context, propElement, run);
      }
      // new ShapeVisitor().visit(context, context.evaluate("rPr", elemRun) as Element, run);

      if (textElement) {
        run.text = (textElement.firstChild.textContent ?? '');
      } else if (elemRun.textContent) {
        run.text = (elemRun.textContent ?? '');
      }
      runs.push(run);
      // if (run.text)
      //   simpleText += run.text;
    }

    if ((runElements as NodeList)?.length !== undefined) {
      for (let i=0; runElements && i<(runElements as NodeList).length; i++) {
        addRun((runElements as NodeList).item(i) as Element);
      }
    } else if (runElements) {
      addRun(runElements as Element);
    } else {
      addRun(elemParent as Element);
    }

    if (defaultRun) {
      // This is a default run
      // ? - This doesn't do anything should it add a run?
      // const endPara: Element = context.evaluate("p/endParaRPr", elemParent) as Element;
      // if (endPara) {
      //   simpleText = '';
      // }
    }

    if (runs.length > 0) {
      jsonText.runs = runs;
    }
    // Calculate this in the client not the import
    // if (simpleText) {
      // jsonText.simpleRun = simpleText;
    // }

    // parse rotation
    const bodyPrElement: Element = context.evaluate("bodyPr", elemParent) as Element;
    if (bodyPrElement) {
      VisitorUtils.parseRotation(bodyPrElement, jsonText);
    }
    // TODO: how to parse insets
  }

  // TODO - these can also be child element nodes (as in comments)
  parseTextProperties(context: ExecutionContext, elem: Element, jsonText: any/*JSON*/): void {
    if (!elem) return;
    // TODO - this need to be the read font
    if (elem.hasAttribute("sz"))
      jsonText.size = parseFloat(elem.getAttribute("sz")) / 100;
    if (elem.hasAttribute("b"))
      jsonText.weight = "1" === elem.getAttribute("b") ? 700 : 400;
    if (elem.hasAttribute("i"))
      jsonText.italic = "1" === elem.getAttribute("i") ? true : false;
    if (elem.hasAttribute("u"))
      jsonText.underline = elem.getAttribute("u");
    if (elem.hasAttribute("strike"))
      jsonText.strike = elem.getAttribute("strike");

    // TODO - get other dialects
    const fontElement: Element = context.evaluate("latin", elem) as Element;
    if (fontElement) {
      const strFont: string = fontElement.getAttribute("typeface");
      if (!strFont.startsWith("+")) {
        const jsonFamily: any/*JSON*/ = jsonText.font ?? {};
        if (fontElement.hasAttribute("typeface")) {
          jsonFamily.family = fontElement.getAttribute("typeface");
        }
        if (fontElement.hasAttribute("panose")) {
          const panose: string = fontElement.getAttribute("panose");
          if (panose) {
            jsonFamily.fallbacks = [IFont.getPanoseFallback(panose)];
          }
        }
        if (fontElement.hasAttribute("pitchFamily"))
          jsonFamily.pitch = fontElement.getAttribute("pitchFamily");
        if (fontElement.hasAttribute("charset"))
          jsonFamily.charset = fontElement.getAttribute("charset");
        if (Object.keys(jsonFamily).length > 0)
          jsonText.font = jsonFamily;
      }
    }
  }

}
