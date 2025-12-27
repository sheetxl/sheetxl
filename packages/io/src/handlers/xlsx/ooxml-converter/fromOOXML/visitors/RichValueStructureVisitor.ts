import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

//https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/5a37902a-0bc2-43ea-8039-d68aa4344f76

// https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/9058338f-cf3b-4a7b-8f84-622e180eacc5

const RICH_TYPES_KEY = "richTypes";
export class RichValueStructureVisitor implements Visitor {
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any[]/*JSON*/ {
    let richTypes: any[] = context.getVisitorParamsState().get(RICH_TYPES_KEY);
    if (!richTypes) {
      richTypes = [];
      context.getVisitorParamsState().set(RICH_TYPES_KEY, richTypes);
    }

    const childNodes: NodeList = elemParent.childNodes;
    const childNodesLength = childNodes.length;
    for (let i=0; i<childNodesLength; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 's') {
        const type = elemChild.getAttribute("t") ?? 'n';
        const richType = {
          type,
          keys: []
        };
        this.processKeys(context, elemChild, richType);
        richTypes.push(richType);
      }
    }

    jsonParent.richTypes = richTypes;
    return richTypes;
  }

  processKeys(context: ExecutionContext, elem: Element, richType: any): void {
    const childNodes: NodeList = elem.childNodes;
    const childNodesLength = childNodes.length;
    const keys:[string, string][] = richType.keys;
    for (let i=0; i<childNodesLength; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'k') {
        const keyName = elemChild.getAttribute("n");
        const type = elemChild.getAttribute("t");
        keys.push([keyName, type]);
      }
    }
  }
}
