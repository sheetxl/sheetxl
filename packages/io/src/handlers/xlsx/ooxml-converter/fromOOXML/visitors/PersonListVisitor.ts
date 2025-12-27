import type { IComment } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';
import { removeCurlyBraces } from '../../UtilsOOXML';


export class PersonListVisitor implements Visitor {
  visit(context: ExecutionContext, elemParent: Element, jsonParent: any/*JSON*/): any/*JSON*/ {
    const persons:IComment.PersonJSON[] = [];
    /**
     * Note - We don't call context add person. Perhaps we should?
     */
    const childNodes: NodeList = elemParent.childNodes;
    for (let i=0; i<childNodes.length; i++) {
      const elemChild: Element = childNodes.item(i) as Element;
      if (elemChild.nodeType === 1 && elemChild.localName === 'person') {
        const jsonPerson:IComment.PersonJSON = {} as IComment.PersonJSON;
        context.copyFromAttribute(elemChild, "id", jsonPerson, "id", removeCurlyBraces);
        context.copyFromAttribute(elemChild, "displayName", jsonPerson);
        context.copyFromAttribute(elemChild, "userId", jsonPerson, "userId", removeCurlyBraces);
        context.copyFromAttribute(elemChild, "providerId", jsonPerson);
        persons.push(jsonPerson);
      }
    }

    if (persons.length > 0) {
      jsonParent.persons = persons;
    }
    return persons;
  }
}
