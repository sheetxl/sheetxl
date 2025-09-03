import { FormulaError } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

const RICH_TYPES_KEY = "richTypes";
const RICH_DATA_KEY = "richData";
export class RichValueDataVisitor implements Visitor {
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any[]/*JSON*/ {
    let richTypes: any[] = context.getVisitorParamsState().get(RICH_TYPES_KEY);
    if (!richTypes) {
      context.warn("RichValueFound but not type.");
      return;
    }
    let richData:any[] = context.getVisitorParamsState().get(RICH_DATA_KEY);
    if (!richData) {
      richData = [];
      context.getVisitorParamsState().set(RICH_DATA_KEY, richData);
    }
    const childNodes: NodeList = elemParent.childNodes;
    const childNodesLength = childNodes.length;
    for (let i=0; i<childNodesLength; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'rv') {
        const index = elemChild.getAttribute("s");
        const jsonStructure = richTypes[index];
        const jsonInstance:any = {
          type: jsonStructure.type, // required for instance
        }
        this.processValues(context, elemChild, jsonInstance, jsonStructure);
        const mapped = this.mapType(context, jsonInstance);
        richData.push(mapped);
      }
    }
    jsonParent.richData = richData;
    return richData;
  }

  mapType(context: ExecutionContext, jsonInstance: any): void {
    if (jsonInstance.type === '_error') {
      const errorType = jsonInstance.errorType;
      if (errorType) {
        try {
          jsonInstance = FormulaError.getBuiltInById(errorType + 1); // 0 based
        } catch (e) {
          // context.warn("Error", e);
        }
      }
    }
    return jsonInstance;
  }

  processValues(context: ExecutionContext, elem: Element, jsonInstance: any, jsonStructure: any): void {
    const childNodes: NodeList = elem.childNodes;
    const childNodesLength = childNodes.length;
    const type = jsonStructure.type;
    const keys: [name: string, type: string] = jsonStructure.keys;
    for (let i=0; i<childNodesLength; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'v') {
        const key = keys[i];
        if (!key) {
          context.warn("Invalid richData")
          return;
        }
        const name = key[0];
        const propType = key[1];
        let value:any = elemChild.textContent;
        //  <xsd:enumeration value="d"/>
        //  <xsd:enumeration value="i"/> // integer
        //  <xsd:enumeration value="b"/>
        //  <xsd:enumeration value="e"/>
        //  <xsd:enumeration value="s"/>
        //  <xsd:enumeration value="r"/>
        //  <xsd:enumeration value="a"/>
        //  <xsd:enumeration value="spb"/>
        /**
         * OOXML Rich Value Structure type enumeration values:
         *
         * "d" - Date/Time value (ISO8601 formatted date string)
         * "i" - Integer value (32-bit signed integer)
         * "b" - Boolean value (true/false)
         * "e" - Error value (common Excel errors like #DIV/0!, #N/A, etc.)
         * "s" - String value (text string)
         * "r" - Rich Text value (formatted text with styling information)
         * "a" - Array value (collection of values, typically for array formulas)
         * "spb" - Spreadsheet Data Model value (linked to external data model)
         *
         * These types are defined in the OOXML spec at:
         * https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/18ae38fa-2f8c-4728-8d2c-9b420e5b2513
         * (Section 2.4.810 - ST_RichValueStructureType)
         */
        if (propType === 'i') {
          value = Number(value);
        }
        jsonInstance[name] = value;
      }
    }
  }
}
