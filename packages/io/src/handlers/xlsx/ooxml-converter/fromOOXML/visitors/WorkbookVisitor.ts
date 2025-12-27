import type { ExecutionContext } from '../ExecutionContext';

import type {
  IWorkbook, INamedCollection, INamed,
  IWorkbookView, ICalculation, IWorkbookProtection, IProtection
} from '@sheetxl/sdk';

import { SheetColorContainerVisitor } from './SheetColorContainerVisitor';

export class WorkbookVisitor extends SheetColorContainerVisitor {

  visit(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    this.processSheetRefs(context, context.evaluate("sheets", elem) as Element, jsonParent);
    this.processBookViews(context, context.evaluate("bookViews", elem) as Element, jsonParent);
    this.processDefinedNames(context, context.evaluate("definedNames", elem) as Element, jsonParent);

    this.processCalcPr(context, context.evaluate("calcPr", elem) as Element, jsonParent);
    this.processWorkbookProtection(context, context.evaluate("workbookProtection", elem) as Element, jsonParent);
    this.processWorkbookPr(context, context.evaluate("workbookPr", elem) as Element, jsonParent);

    return jsonParent;
  }

  processPassword(context: ExecutionContext, elem: Element, jsonProtection: IProtection.JSON/*JSON*/, key: string='password'): any/*JSON*/ {
    if (!elem) return;

    const password:Partial<IProtection.EncryptedPassword> = {}
    context.copyFromAttribute(elem, "algorithmName", password, "algorithmName");
    context.copyFromAttribute(elem, "hashValue", password, "hashValue");
    context.copyFromAttribute(elem, "saltValue", password, "saltValue", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "spinCount", password, "spinCount", context.INT_COPY);
    if (Object.keys(password).length > 0) {
      jsonProtection[key] = password;
    }
  }

  processWorkbookProtection(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const workbookProtection:IWorkbookProtection.JSON = {};

    this.processPassword(context, context.evaluate("workbookPassword", elem) as Element, workbookProtection);
    this.processPassword(context, context.evaluate("revisionsPassword", elem) as Element, workbookProtection, "revisionsPassword");


    // sheet flags are allow so we rationalize them to the opposite
    const _OppositeBOOLEAN_COPY = (value: any): boolean => {
      if (value === true || value === "1" || value === "on" || value === "true") return false;
      if (value === false || value === "0" || value === "off" || value === "false") return true;
      return null;
    }

    context.copyFromAttribute(elem, "lockStructure", workbookProtection, "structure", _OppositeBOOLEAN_COPY);
    context.copyFromAttribute(elem, "lockWindows", workbookProtection, "windows", _OppositeBOOLEAN_COPY);
    context.copyFromAttribute(elem, "lockRevision", workbookProtection, "revision", _OppositeBOOLEAN_COPY);

    jsonParent.protection = workbookProtection; // always set even if empty to indicate protection is enabled
    return jsonParent;
  }

  processCalcPr(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;

    const calcProperties:ICalculation.JSON = {};

    // fullCalcOnLoad
    // iterate

    // xcalcf:calcFeatures

    jsonParent.calc = calcProperties;
  }

  processSheetRefs(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return; // should never happen

    const sheets: IWorkbook.SheetRefJSON[] = [];
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemSheet:Element = childNodes.item(i) as Element;
      if (elemSheet.nodeType === 1 && elemSheet.localName === 'sheet') { // 1 - Node.ELEMENT_NODE;
        this.processSheetRef(context, elemSheet, sheets);
      }
    }
    jsonParent.sheets = sheets;
  }

  processSheetRef(context: ExecutionContext, elem: Element, sheets: IWorkbook.SheetRefJSON[]/*JSON*/): any/*JSON*/ {
    const jsonSheetRef:Partial<IWorkbook.SheetRefJSON> = {};

    context.copyFromAttribute(elem, "name", jsonSheetRef, "name");
    context.copyFromAttribute(elem, "state", jsonSheetRef, "visibility");

    const rId = elem.getAttribute("r:id");
    const sheet = context.getRef(rId);
    if (sheet) {
      jsonSheetRef.sheet = sheet;
    }
    sheets.push(jsonSheetRef as IWorkbook.SheetRefJSON);
  }

  processBookViews(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const childNodes:NodeList = elem.childNodes;
    // OOXML spec allows multiple workbook views
    let index:number = 0;
    // We don't currently support split panes so we just grab the first sheetView
    for (let i=0; index<1 && i<elem.childNodes.length; i++) {
      const elemView:Element = childNodes.item(i) as Element;
      if (elemView.nodeType === 1 && elemView.localName === 'workbookView') { // 1 - Node.ELEMENT_NODE;
        this.processWorkbookView(context, elemView, jsonParent);
        index++;
      }
    }
  }

  processWorkbookView(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const jsonView: IWorkbookView.JSON = {};

    // Excel activeTab is zero base but our is 1 base. (Ironically this is the exact opposite of most other offsets)
    context.copyFromAttribute(elem, "activeTab", jsonView, "activeSheetId", [context.INT_COPY, (val) => val + 1]);
    // if activeTab is not defined then Excel treats it as the first tab but we treat is as the last
    if (!elem.hasAttribute("activeTab")) {
      jsonView.activeSheetId = 1;
    }
    context.copyFromAttribute(elem, "showHorizontalScroll", jsonView, "showHorizontalScrollbar", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "showVerticalScroll", jsonView, "showVerticalScrollbar", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "showSheetTabs", jsonView, "showTabs", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "tabRatio", jsonView, "tabRatio", [context.FLOAT_COPY, (val) => val]);

    // showStatusBar: boolean; ?
    // showFormulaBar: boolean; ?
    // TODO - formulaBarHeight: number; ?
    // TODO - formulaBarRatio: boolean; ?

    // TODO = shown/hidden status bar items

    // autoFilterDateGrouping
    // firstSheet

    // visibility (very important)
    // minimized
    // xWindow
    // yWindow
    // windowWidth
    // windowHeight

    if (Object.keys(jsonView).length > 0) {
      jsonParent.view = jsonView;
    }
  }

  processDefineName(context: ExecutionContext, elem: Element, jsonNames: INamedCollection.JSON, sheets: IWorkbook.SheetRefJSON[]): any/*JSON*/ {
    if (!elem) return;
    const jsonDefinedName: INamed.JSON = {} as INamed.JSON;

    const firstChild = elem.firstChild;
    if (firstChild && firstChild.nodeType === 3) // 3 - Node.TEXT_NODE
      jsonDefinedName.ref = firstChild.textContent;
    context.copyFromAttribute(elem, "name", jsonDefinedName);
    context.copyFromAttribute(elem, "comment", jsonDefinedName);
    context.copyFromAttribute(elem, "hidden", jsonDefinedName, "hidden", context.BOOLEAN_COPY);

    if (elem.hasAttribute("localSheetId")) {
      const localSheetId = elem.getAttribute("localSheetId");
      if (!sheets[localSheetId]?.name) {
        console.warn(`Defined name '${elem.getAttribute("name")}' references a sheet with localSheetId '${localSheetId}' which does not exist.`);
        return;
      }
      jsonDefinedName.scope = sheets[localSheetId].name;
    }

    // The following are copied but not supported by our model
    context.copyFromAttribute(elem, "customMenu", jsonDefinedName);
    context.copyFromAttribute(elem, "description", jsonDefinedName);
    context.copyFromAttribute(elem, "statusBar", jsonDefinedName);
    context.copyFromAttribute(elem, "help", jsonDefinedName);
    context.copyFromAttribute(elem, "shortcutKey", jsonDefinedName);

    context.copyFromAttribute(elem, "function", jsonDefinedName, "function", context.BOOLEAN_COPY);
    /**
     * @see _FunctionGroups
     */
    context.copyFromAttribute(elem, "functionGroupId", jsonDefinedName, "functionGroupId", context.INT_COPY);

    context.copyFromAttribute(elem, "publishToServer", jsonDefinedName, "publishToServer", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "vbProcedure", jsonDefinedName, "vbProcedure", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "xlm", jsonDefinedName, "xlm", context.BOOLEAN_COPY);

    if (Object.keys(jsonDefinedName).length > 0) {
      jsonNames.push(jsonDefinedName);
    }
  }

  processDefinedNames(context: ExecutionContext, elem: Element, jsonParent: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    const definedNames = [];
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'definedName') { // 1 - Node.ELEMENT_NODE;
        this.processDefineName(context, elemChild, definedNames, jsonParent.sheets);
      }
    }
    if (definedNames.length > 0)
      jsonParent.names = definedNames;
  }

  processWorkbookPr(context: ExecutionContext, elem: Element, jsonWorkbook: IWorkbook.JSON/*JSON*/): any/*JSON*/ {
    if (!elem) return;
    context.copyFromAttribute(elem, "date1904", jsonWorkbook, "date1904", context.BOOLEAN_COPY);
    // showBorderUnselectedTables
    //updateLinks
  }

  afterVisit(_context: ExecutionContext, _elem: Element, _json: any/*JSON*/): void {
  }
}