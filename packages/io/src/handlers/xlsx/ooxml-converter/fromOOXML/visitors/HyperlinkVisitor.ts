import type { IHyperlink } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

// TODO - Review. This isn't being used. The actual implementation is in SheetVisitor.
export class HyperlinkVisitor implements Visitor {

  visit(context: ExecutionContext, elem: Element, jsonParent: any): IHyperlink.JSON {
    if (!elem) return;

    const jsonHyperlink:IHyperlink.Properties = {} as IHyperlink.Properties;
    const rId = elem.getAttribute("r:id");
    if (rId) {
      const externalHyperlink = context.getRef(rId);
      if (typeof externalHyperlink === 'string') {
        jsonHyperlink.address = externalHyperlink;
      }
    }

    context.copyFromAttribute(elem, "tooltip", jsonHyperlink);
    context.copyFromAttribute(elem, "history", jsonHyperlink, "history", context.BOOLEAN_COPY);
    context.copyFromAttribute(elem, "tgtFrame", jsonHyperlink, "target");

    jsonParent.hyperlink = jsonHyperlink;
    return jsonHyperlink;
  }
}
