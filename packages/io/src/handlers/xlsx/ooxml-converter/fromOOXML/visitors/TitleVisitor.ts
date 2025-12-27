import type { ExecutionContext } from '../ExecutionContext';

import { TextPropertiesVisitor } from './TextPropertiesVisitor';

import { parseValAttrAsBoolean } from '../VisitorUtils';

export class TitleVisitor extends TextPropertiesVisitor {

  constructor(jsonKey: string='title') {
    super(jsonKey);
  }

  parseTitleRangeOrValue(context: ExecutionContext, elemParent: Element, jsonTitle: any/*JSON*/): void {
    let elemTitleRange: Element = context.evaluate("tx/strRef/f", elemParent) as Element ?? null;
    if (elemTitleRange) {
      const titleRange: string = elemTitleRange.firstElementChild.nodeValue;
      context.setToPath(jsonTitle, "range", titleRange);
    }
//    else {//parse node title value
//      let nodeTitleValue: Element = context.evaluate("tx/v", elemParent) ?? null;
//      if (nodeTitleValue !== null)
//        jsonSeries.titleValues = nodeTitleValue.firstChild.nodeValue;
//    }
  }

  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const jsonTitle: any/*JSON*/ = {};
    parseValAttrAsBoolean(context, elemParent, jsonTitle, "overlay", "overlay");
    jsonParent[this._jsonKey] = jsonTitle;

    let jsonText: any/*JSON*/ = context.getFromPath(jsonTitle, this.getTextPath());
    if (!jsonText)
      jsonText = {};

    this.parseTitleRangeOrValue(context, elemParent, jsonTitle);

    const elemTxPr: Element = context.evaluate("txPr", elemParent) as Element;
    if (elemTxPr)
      this.parseTextElement(context, elemTxPr, jsonText, false/*defaultRun*/);

    const elemRich: Element = context.evaluate("tx/rich", elemParent) as Element;
    if (elemRich)
      this.parseTextElement(context, elemRich, jsonText, true/*defaultRun*/);

    if (Object.keys(jsonText).length > 0)
      context.setToPath(jsonTitle, this.getTextPath(), jsonText);

    return jsonTitle;
  }

  afterVisit(context: ExecutionContext, xmlElementContext: Element, jsonTitle: any/*JSON*/): void {
    //set rot from text into this and unset on text
    if (jsonTitle?.text) {
      const jsonRotation: any/*JSON*/ = jsonTitle.text?.rotation ?? null;
      if (jsonRotation !== null) {
        jsonTitle.rotation = parseInt(jsonRotation);
        //remove from title
        delete jsonTitle.title.rotation;
      }
    }
  }
}