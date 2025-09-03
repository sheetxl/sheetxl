// import { CommonUtils } from '@sheetxl/utils';
import type { ExecutionContext } from '../ExecutionContext';

import { SheetStylesVisitor } from './SheetStylesVisitor';

export class PresetTableStylesVisitor extends SheetStylesVisitor  {
  visit(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const childNodes:NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType !== 1) continue; // 1 - Node.ELEMENT_NODE;
      const name = elemChild.localName.trim();

      const presetStyle:any = {}
      const dxfs = [];

      this.processDXFs(context, context.evaluate("dxfs", elemChild) as Element, dxfs);

      this.processTableStyles(context, context.evaluate("tableStyles", elemChild) as Element, presetStyle, dxfs, true/*shiftTableDx*/);
      // rename styles to style as there is always 1.

      const compressName = (name: string): string => {
        let compressedName = name;
        // compressedName = compressedName.replace('TableStyle', 'T');
        // compressedName = compressedName.replace('PivotStyle', 'P');
        // compressedName = compressedName.replace('Medium', 'M');
        // compressedName = compressedName.replace('Dark', 'D');
        // compressedName = compressedName.replace('Light', 'L');
        return compressedName;
      }

      // The default
      if (presetStyle.tables.defaultTableStyle === "TableStyleMedium9") {
        delete presetStyle.tables.defaultTableStyle;
      } else {
        presetStyle.tables.defaultTableStyle = compressName(presetStyle.tables.defaultTableStyle);
      }
      // The default
      if (presetStyle.tables.defaultPivotStyle === "PivotStyleLight16") {
        delete presetStyle.tables.defaultPivotStyle;
      } else {
        presetStyle.tables.defaultTableStyle = compressName(presetStyle.tables.defaultTableStyle);
      }

      jsonParent[compressName(name)] = presetStyle.tables.styles[name];

    }
    return jsonParent;
  }

  processFill(context: ExecutionContext, elem: Element, jsonParent: any/*JSON*/, index: number): any/*JSON*/ {
    super.processFill(context, elem, jsonParent, index);
    if (jsonParent[index].type === "pattern") {
      // compress
      if (jsonParent[index].patternType === "solid") {
        jsonParent[index] = jsonParent[index].foreground;
      } else {
        console.warn('not solid', jsonParent[index]);
      }
    } else {
      console.warn('not pattern', jsonParent[index]);
    }
  }
  processDataBarColor(context: ExecutionContext, elemColor: Element, jsonParent: any/*JSON*/, key: string): any/*JSON*/ {
     super.processDataBarColor(context, elemColor, jsonParent, key);
     if (jsonParent[key]) {
      const adjs = jsonParent[key]?.adjs;
      if (adjs) {
        if (adjs.length === 1) {
          for (let i=0; i<adjs.length; i++) {
            let adj = adjs[i];
            const adjKey = Object.keys(adj)[0];
            let adjVal = adj[adjKey];
            if (adjKey === 'etint') {
              jsonParent[key].etint = parseFloat(adjVal);
              delete jsonParent[key].adjs;
            }
            else {
              console.warn('not etint', adjKey);
            }
          //     adjVal = CommonUtils.roundAccurately(parseFloat(adjVal), 5);
          //   asString += ',' + adjKey + ' ' + adjVal;
          }
        } else {
          console.warn('multiple adjust', jsonParent);
        }
      }
    }
  }
}