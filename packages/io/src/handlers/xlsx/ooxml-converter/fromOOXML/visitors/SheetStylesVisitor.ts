import {
  IStyle, ITableStyle, ICellProtection, ITextFrame, IFill, IStyleCollection, IBorder
} from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import * as NumberUtils from '../NumberUtils';

import { SheetColorContainerVisitor } from './SheetColorContainerVisitor';

export class SheetStylesVisitor extends SheetColorContainerVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonParent: IStyleCollection.JSON): any/*JSON*/ {
    this.processNumFmts(context, context.evaluate("numFmts", elem) as Element, null);

    context.getVisitorParamsState().set("colorsToProcess", new Set());
    const denormalized: any/*JSON*/ = {
      fills: {},
      fonts: {},
      borders: {},
    };
    this.processFonts(context, context.evaluate("fonts", elem) as Element, denormalized.fonts);
    this.processFills(context, context.evaluate("fills", elem) as Element, denormalized.fills);
    this.processBorders(context, context.evaluate("borders", elem) as Element, denormalized.borders, true);

    /*
     * Note - Excel also hardcodes the first 2 fills and the first border.
     */
    denormalized.fills[0] = { // None
      type: IFill.Type.None
    };
    denormalized.fills[1] = {
      type: IFill.Type.Pattern,
      patternType: IFill.BuiltInSheetPattern.Gray125,
    };
    denormalized.borders[0] = {
      bottom: { style: IBorder.StrokeStyle.None },
      left: { style: IBorder.StrokeStyle.None },
      right: { style: IBorder.StrokeStyle.None },
      top: { style: IBorder.StrokeStyle.None }
    };

    // Process named styles
    const namedXfs:IStyle.JSON[] = [];
    this.processXFs(context, context.evaluate("cellStyleXfs", elem) as Element, namedXfs, denormalized, null, false);
    const namedIds = new Map<number, string>();
    if (namedXfs.length > 0) {
      const jsonNamed:IStyle.NamedJSON[] = [];
      // Now collect the names
      this.processCellStyles(context, context.evaluate("cellStyles", elem) as Element, jsonNamed, namedXfs, namedIds);
      jsonParent.named = jsonNamed;
    }

    // process shared styles
    const direct = [];
    this.processXFs(context, context.evaluate("cellXfs", elem) as Element, direct, denormalized, namedIds);
    if (Object.keys(direct).length > 0)
      jsonParent.direct = direct;

    const dxfs = [];
    this.processDXFs(context, context.evaluate("dxfs", elem) as Element, dxfs);
    this.processTableStyles(context, context.evaluate("tableStyles", elem) as Element, jsonParent, dxfs);

    // this.processSlicerStyles(context, context.evaluate("colors/ext/x14:slicerStyles", elem) as Element, jsonParent);
    // this.processTimelineStyles(context, context.evaluate("extLst/ext/x15:timelineStyles", elem) as Element, jsonParent);

    this.processIndexColors(context, context.evaluate("colors/indexedColors", elem) as Element, jsonParent);
    this.processMruColors(context, context.evaluate("colors/mruColors", elem) as Element, jsonParent);

    return jsonParent;
  }

  processIndexColors(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/) {
    if (!elem) return;

    const jsonIndexColors = [];
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'rgbColor') { // 1 - Node.ELEMENT_NODE;
        const jsonColor = { color: null };
        this.processDataBarColor(context, elemChild, jsonColor, "color");
        if (jsonColor.color)
          jsonIndexColors.push(jsonColor.color);
      }
    }
    jsonParent.indexedColors = jsonIndexColors;
  }

  processMruColors(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/) {
    if (!elem) return;

    const jsonMruColors = [];
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'color') { // 1 - Node.ELEMENT_NODE;
        const jsonColor = { color: null };
        this.processDataBarColor(context, elemChild, jsonColor, "color");
        if (jsonColor.color)
          jsonMruColors.push(jsonColor.color);
      }
    }
    if (jsonMruColors.length > 0)
      jsonParent.mruColors = jsonMruColors;
  }

  processNumFmts(context: ExecutionContext, elem: Element, _jsonParent: any[]/*JSON*/) {
    if (!elem) return;
    // currently we don't add these to the json. We could if we decide we need these
    const mapFmts = new Map<number, string>();
    context.getVisitorParamsState().set("numFmts", mapFmts);
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;

    for (let i=0; i<childNodes.length; i++) {
      const elemNumFmt:Element = childNodes.item(i) as Element;
      if (elemNumFmt.nodeType === 1 && elemNumFmt.localName === 'numFmt') { // 1 - Node.ELEMENT_NODE;
        const numFmtId = elemNumFmt.getAttribute("numFmtId");
        const formatCode = elemNumFmt.getAttribute("formatCode");
        if (numFmtId && formatCode) {
          // Fix the unescaping to properly handle backslashes from XML
          // This will convert \\ to \ and then \ followed by any character to just that character
          const unescaped = formatCode.replace(/\\(.)/g, '$1');
          mapFmts.set(parseInt(numFmtId), unescaped);
        }
      }
    }
  }

  processXFs(context: ExecutionContext, elem: Element, jsonParent: IStyle.JSON[]/*JSON*/,
    denormalized: any/*map*/,
    namedIds: Map<number, string>=null,
    ignoreApplys: boolean=true): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemXF:Element = childNodes.item(i) as Element;
      if (elemXF.nodeType === 1 && elemXF.localName === 'xf') { // 1 - Node.ELEMENT_NODE;
        const xf = {};
        this.processXF(context, elemXF, xf, denormalized, namedIds, ignoreApplys);
        jsonParent.push(xf);
      }
    }
  }

  processXF(context: ExecutionContext, elem: Element, jsonParent: IStyle.JSON, denormalized: any/*map*/, namedIds: Map<number, string>, ignoreApplys: boolean): any/*JSON*/ {
    if (!elem) return;
    const xfId = elem.getAttribute("xfId");
    if (xfId) {
      if (namedIds) {
        const namedStyle = namedIds.get(parseInt(xfId));
        if (namedStyle && namedStyle !== IStyle.BuiltInName.Normal) // normal is implied
          jsonParent.named = namedStyle;
      } else {
        // invalid ooxml but some tools may do this.
      }
    }

    /*
     * Note - This is MAY not modelled correctly.
     * By having a flag we can save the values but not use them.
     * The SheetXL model is to clear these out.
     * Revisit best approach when we create NamedStyle UI.
     * We may want to load all of the values into the memory model
     * including the applyFlag and allow the application to filter/manage this.
    */
    const isApplyAttribute = (name: string): boolean => {
      if (ignoreApplys || !elem.hasAttribute(name)) return true;
      return NumberUtils.parseAsBoolean(elem.getAttribute(name));
    }

    const defaultIndex: string|undefined = ignoreApplys ? '0' : undefined;
    if (isApplyAttribute("applyFont")) {
      const font = denormalized.fonts[elem.getAttribute("fontId") ?? defaultIndex];
      if (font !== undefined)
        jsonParent.font = font;
    }
    if (isApplyAttribute("applyFill")) {
      const fill = denormalized.fills[elem.getAttribute("fillId") ?? defaultIndex];
      if (fill !== undefined && Object.keys(fill).length > 0)
        jsonParent.fill = fill;
    }

    if (isApplyAttribute("applyBorder")) {
      const border = denormalized.borders[elem.getAttribute("borderId") ?? defaultIndex];
      if (border !== undefined) { //} && Object.keys(border).length > 0)
        jsonParent.border = border;
      }
    }

    if (isApplyAttribute("applyNumberFormat")) {
      const numFmtId = elem.getAttribute("numFmtId") ?? defaultIndex;
      if (numFmtId !== undefined) {
        const fmtId = parseInt(numFmtId);
        let fmt:string;
        /* see if it's a custom format */
        const getVisitorParamsState = context.getVisitorParamsState()
        if (getVisitorParamsState) {
          const customFmts = getVisitorParamsState.get("numFmts");
          if (customFmts) {
            fmt = customFmts.get(fmtId);
          }
          /* if we have a custom numberformat then set it to the numberFormat otherwise just add the id */
          // fmtId !== 0 check caused a sheet with a percent preset style with general number formatting to be incorrect
          // if (fmt) { // } || fmtId !== 0) {
            jsonParent.numberFormat = fmt ?? fmtId;
          // }
        } else {
          console.warn('no visitor params state');
        }
      }
    }

    if (isApplyAttribute("applyAlignment")) {
      this.processAlignment(context, context.evaluate("alignment", elem) as Element, jsonParent);
    }
    if (isApplyAttribute("applyProtection")) {
      this.processProtection(context, context.evaluate("protection", elem) as Element, jsonParent);
    }
    const quotePrefix = NumberUtils.parseAsBoolean(elem.getAttribute("quotePrefix")); // defaults to false
    if (quotePrefix) {
      jsonParent.quotePrefix = quotePrefix;
    }
    // const pivotButton = NumberUtils.parseAsBoolean(elem.getAttribute("pivotButton"));
  }

  processAlignment(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    // Always process alignment
    const jsonAlignment: ITextFrame.IAlignment.JSON = {};
    if (elem?.hasAttribute("horizontal")) {
      jsonAlignment.horizontal = elem.getAttribute("horizontal") as ITextFrame.HorizontalAlignment;
    } else {
      jsonAlignment.horizontal = ITextFrame.HorizontalAlignment.General;
    }
    if (elem?.hasAttribute("vertical")) {
      jsonAlignment.vertical = elem.getAttribute("vertical") as ITextFrame.VerticalAlignment;
    } else {
      jsonAlignment.vertical = ITextFrame.VerticalAlignment.Bottom;
    }
    if (elem?.hasAttribute("indent")) {
      jsonAlignment.indent = parseInt(elem.getAttribute("indent"));
    } else {
      jsonAlignment.indent = 0;
    }
    if (elem?.hasAttribute("relativeIndent")) {
      jsonAlignment.relativeIndent = parseInt(elem.getAttribute("relativeIndent"));
    } else {
      jsonAlignment.relativeIndent = 0;
    }

    if (NumberUtils.parseAsBoolean(elem?.getAttribute("wrapText"))) {
      jsonAlignment.overflow = ITextFrame.Overflow.Wrap;
    } else {
      jsonAlignment.overflow = ITextFrame.Overflow.Visible;
    }
    if (NumberUtils.parseAsBoolean(elem?.getAttribute("shrinkToFit"))) {
      jsonAlignment.overflow = ITextFrame.Overflow.Shrink;
    }

    if (elem?.hasAttribute("textRotation")) {
      let rotation = parseFloat(elem.getAttribute("textRotation"));
      // convert to css degrees
      if (rotation > 0 && rotation <= 90) {
        rotation = 360 - rotation;
      } else if (rotation > 90 && rotation <= 180) {
        rotation = rotation - 90;
      } else if (rotation === 255) { // Excel uses 255 as a magic number to indicate stacked
        rotation = 0;
        jsonAlignment.stacked = true;
      }
      jsonAlignment.rotation = rotation;
    } else {
      jsonAlignment.rotation = 0;
    }

    if (elem?.hasAttribute("justifyLastLine")) {
      jsonAlignment.justifyLastLine = NumberUtils.parseAsBoolean(elem.getAttribute("justifyLastLine"));
    }
    const readingOrder = elem?.getAttribute("readingOrder");
    if (readingOrder) {
      if (readingOrder === "0") {
        jsonAlignment.readingDirection = ITextFrame.ReadingDirection.Auto;
      } else if (readingOrder === "1") {
        jsonAlignment.readingDirection = ITextFrame.ReadingDirection.LeftToRight;
      } else if (readingOrder === "2") {
        jsonAlignment.readingDirection = ITextFrame.ReadingDirection.RightToLeft;
      } else {
        console.warn(`invalid readingOrder: ${readingOrder}`);
      }
    }

    if (Object.keys(jsonAlignment).length > 0) {
      jsonParent.alignment = jsonAlignment;
    }

    return jsonParent;
  }

  processProtection(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    if (!elem) return;

    const jsonProtection: ICellProtection.JSON = {};
    const attrLock = elem.getAttribute("locked");
    // if locked is false then we can edit
    if (attrLock && !NumberUtils.parseAsBoolean(attrLock)) { // defaults to true
      jsonProtection.edit = true;
    }
    const attrHidden = elem.getAttribute("hidden");
    if (attrHidden && NumberUtils.parseAsBoolean(attrHidden)) {
      jsonProtection.formulaHidden = true;
    }
    if (Object.keys(jsonProtection).length > 0) {
      jsonParent.protection = jsonProtection;
    }
    return jsonParent;
  }

  processDXF(context: ExecutionContext, elem: Element, jsonParent: IStyle.JSON): any/*JSON*/ {
    if (!elem) return;
    const childNodes: NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'font') {
        const font = {};
        this.processFont(context, elemChild, font);
        jsonParent.font = font;
      } else if (elemChild.nodeType === 1 && elemChild.localName === 'fill') {
        const fill = [];
        this.processFill(context, elemChild, fill, 0);
        if (fill.length > 0 && fill[0])
          jsonParent.fill = fill[0];
      } else if (elemChild.nodeType === 1 && elemChild.localName === 'border') {
        const border = [];
        this.processBorder(context, elemChild, border, 0, false);
        if (border.length > 0 && border[0])
          jsonParent.border = border[0];
      }
    }
  }

  processDXFs(context: ExecutionContext, elem: Element, jsonParent: any[]/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    /* super strange - Excel seems to invert the solid fill arguments for dxf entries */
    context.getVisitorParamsState().set("processingDXFs", true);
    const mapDxfs = new Map();
    /* add to a map so that these can be referenced in worksheets and other resources */
    context.getVisitorParamsState().set("dxfs", mapDxfs);
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'dxf') { // 1 - Node.ELEMENT_NODE;
        const xf = {};
        this.processDXF(context, elemChild, xf);
        /* because dxfs node may have text or other non dxf records */
        const index = jsonParent.length;
        mapDxfs.set(index, xf);
        jsonParent.push(xf);
      }
    }

    context.getVisitorParamsState().delete("processingDXFs");
  }

  processTableStyle(_context: ExecutionContext, elem: Element, jsonParent: any, dxfs: any[], shiftTableDx: boolean=false): any/*JSON*/ {
    const name:string = elem.getAttribute("name");
    const jsonTableStyle:ITableStyle.Properties = {
      name
    };
    if (elem.hasAttribute("table")) {
      jsonTableStyle.table = NumberUtils.parseAsBoolean(elem.getAttribute("table"));
    } if (elem.hasAttribute("pivot")) {
      jsonTableStyle.pivot = NumberUtils.parseAsBoolean(elem.getAttribute("pivot"));
    }
    // super weird. presets seems to have a 1-based offset for tables (but not pivots) unlike dxfs in SheetStyles?
    if (shiftTableDx && !jsonTableStyle.pivot) {
      dxfs.unshift(null);
    }
    // process elements
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      // https://c-rex.net/samples/ooxml/e1/Part4/OOXML_P4_DOCX_tableStyleElement_topic_ID0EWRR6.html#topic_ID0EWRR6
      if (elemChild.nodeType === 1 && elemChild.localName === 'tableStyleElement') { // 1 - Node.ELEMENT_NODE;
        const type = elemChild.getAttribute("type");
        const dxfId = elemChild.getAttribute("dxfId");
        // TODO - convert to onWarning like SaxParser
        let dxf:any = dxfs?.[dxfId];
        if (!dxf) {
          console.warn('invalid dfx id', dxfId);
          dxf = {};
        }
        jsonTableStyle[type] = dxf;
        let size = null;
        // default to 1 or 0?
        // size applies to firstRowStripe, secondRowStripe, firstColumnStripe, or secondColumnStripe
        if (elemChild.hasAttribute("size"))
          size = parseInt(elemChild.getAttribute("size"));
        if (size && !isNaN(size))
          dxf.size = size;

      }
    }
    delete jsonTableStyle.name;
    jsonParent[name] = jsonTableStyle;
  }

  processTableStyles(context: ExecutionContext, elem: Element, jsonParent: any, dxfs: any[], shiftTableDx?: boolean): any/*JSON*/ {
    if (!elem) return;
    const jsonTableStyles:any = {};

    const defaultTableStyle = elem.getAttribute("defaultTableStyle");
    if (defaultTableStyle)
      jsonTableStyles.defaultTableStyle = defaultTableStyle;
    const defaultPivotStyle = elem.getAttribute("defaultPivotStyle");
    if (defaultPivotStyle)
      jsonTableStyles.defaultPivotStyle = defaultPivotStyle

    const childNodes:NodeList = elem.childNodes;
    const jsonStyles = {};
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'tableStyle') { // 1 - Node.ELEMENT_NODE;
        this.processTableStyle(context, elemChild, jsonStyles, dxfs, shiftTableDx);
      }
    }
    if (Object.keys(jsonStyles).length > 0)
      jsonTableStyles.styles = jsonStyles;

    if (Object.keys(jsonTableStyles).length > 0)
      jsonParent.tables = jsonTableStyles;
    return jsonParent;
  }

  processCellStyles(context: ExecutionContext, elem: Element, named: IStyle.NamedJSON[], namedXfs: IStyle.JSON[], namedIds: Map<number, string>): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'cellStyle') { // 1 - Node.ELEMENT_NODE;
        const xfId = parseInt(elemChild.getAttribute("xfId"));
        const name = elemChild.getAttribute("name");
        namedIds.set(xfId, name);

        const xf = namedXfs[xfId];
        if (!xf)
          continue;
        const asNamed:IStyle.NamedJSON = {
          name: name,
          style: namedXfs[xfId]
        }
        if (elemChild.getAttribute("hidden")) {
          asNamed.hidden = NumberUtils.parseAsBoolean(elemChild.getAttribute("hidden"));
        }
        if (elemChild.getAttribute("iLevel")) {
          asNamed.iLevel = parseInt(elemChild.getAttribute("iLevel"));
        }
        named.push(asNamed);
      }
    }
  }

  afterVisit(_context: ExecutionContext, _elem: Element, _json: any/*JSON*/): void {
  }
}