import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { ColorContainerVisitor } from './ColorContainerVisitor';

import type { ITheme } from '@sheetxl/sdk';

export class ClrSchemeVisitor extends ColorContainerVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: ITheme.JSON): ITheme.ColorSchemeJSON {
    const jsonClrScheme:ITheme.ColorSchemeJSON = {};
    jsonClrScheme.name = elemParent.getAttribute("name");

    const childNodes: NodeList = elemParent.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild:Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1) { // Node.ELEMENT_NODE) {
        let name: string = elemChild.localName;
        const elemColor: Element = context.evaluate(name, elemParent) as Element;
        const jsonColor: string = this.processAdjColor(context, elemColor);
        jsonClrScheme[name] = jsonColor;
      }
    }
    if (Object.keys(jsonClrScheme).length > 0) {
      jsonParent.colors = jsonClrScheme; // map to colorScheme name
    }

    return jsonClrScheme;
  }
}