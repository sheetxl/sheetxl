import type { ITheme } from '@sheetxl/sdk';

import type { Visitor } from '../Visitor';
import type { ExecutionContext } from '../ExecutionContext';

export class ThemeVisitor implements Visitor {

  visit(context: ExecutionContext, elemParent: Element, jsonParent: ITheme.JSON): ITheme.JSON {
    jsonParent.name = elemParent.getAttribute("name");
    return jsonParent;
  }

}