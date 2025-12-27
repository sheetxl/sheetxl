import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

import { IComment } from '@sheetxl/sdk';

export class CommentsVisitor implements Visitor {
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any): IComment.JSON[] {
    if (!elemParent) return;

    const authors:string[] = [];
    this.processAuthors(context, context.evaluate("authors", elemParent) as Element, authors);
    if (authors.length > 0)
      jsonParent.authors = authors;

    const comments:IComment.JSON[] = [];
    jsonParent.comments = comments;
    return jsonParent;
  }

  processAuthors(context: ExecutionContext, elem: Element, authors: string[]/*JSON*/): void {
    if (!elem) return;
    const childNodes: NodeList = elem.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'author') { // 1 - Node.ELEMENT_NODE;
        const firstChild = elemChild.firstChild;
        if (firstChild && firstChild.nodeType === 3) // 3 - Node.TEXT_NODE
          authors.push(firstChild.textContent);
      }
    }
  }

}
